"use client";

import { createClient } from "@/lib/supabase/client";
import { projectToRow, rowToProject, type ProjectRow } from "@/lib/db/project-mapper";
import type { PhaseId } from "./phases";
import type { ChatMessage, ProjectFiles, ProjectRecord, ProjectSummary, ShareRole } from "./types";
import type { Database } from "@/lib/db/types";

type ProjInsert = Database["public"]["Tables"]["fittbuilder_projects"]["Insert"];

const HISTORY_LIMIT = 10; // US-004

const SELECT = "id, owner_id, name, files, phase, approved_phases, history, messages, share_token, share_role, skill_id, created_at, updated_at";

async function uid(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("fittbuilder_projects").select(SELECT).eq("id", id).maybeSingle();
  if (error) { console.error("[storage] getProject:", error); return null; }
  if (!data) return null;
  return rowToProject(data as unknown as ProjectRow);
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  const supabase = createClient();
  const ownerId = await uid();
  const row = { id: project.id, ...projectToRow(project, ownerId) };
  const { data, error } = await supabase.from("fittbuilder_projects").upsert(row as unknown as ProjInsert).select(SELECT).single();
  if (error) throw error;
  return rowToProject(data as unknown as ProjectRow);
}

export async function createProject(options?: {
  name?: string;
  phase?: PhaseId;
  skillId?: string;
  orgId?: string;
}): Promise<ProjectRecord> {
  const supabase = createClient();
  // owner_id is stamped by the DB default (auth.uid()) so it always matches the
  // RLS insert check — the client never sends it.
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .insert({
      name: options?.name?.trim() || "Untitled",
      phase: options?.phase ?? "define",
      skill_id: options?.skillId ?? null,
      org_id: options?.orgId ?? null,
    })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message || "createProject failed");
  return rowToProject(data as unknown as ProjectRow);
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fittbuilder_projects").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateProject(id: string): Promise<ProjectRecord | null> {
  const source = await getProject(id);
  if (!source) return null;
  return saveProjectAsNew({ ...source, name: `${source.name} (copy)` });
}

async function saveProjectAsNew(rec: ProjectRecord): Promise<ProjectRecord> {
  const supabase = createClient();
  const ownerId = await uid();
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .insert(projectToRow(rec, ownerId) as unknown as ProjInsert)
    .select(SELECT)
    .single();
  if (error) throw error;
  return rowToProject(data as unknown as ProjectRow);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const supabase = createClient();
  const me = await uid();
  // RLS returns owned + shared rows; classify by owner_id, attach role from memberships.
  const { data: rows, error } = await supabase
    .from("fittbuilder_projects")
    .select("id, owner_id, name, files, org_id, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const { data: memberships } = await supabase
    .from("fittbuilder_project_members")
    .select("project_id, role")
    .eq("user_id", me);
  const roleByProject = new Map<string, ShareRole>((memberships ?? []).map((m) => [m.project_id, m.role as ShareRole]));
  return (rows ?? []).map((r) => {
    const owner = r.owner_id === me;
    return {
      id: r.id,
      name: r.name,
      fileCount: r.files ? Object.keys(r.files as ProjectFiles).length : 0,
      orgId: (r as { org_id: string | null }).org_id ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      access: owner ? "owner" : "member",
      role: owner ? undefined : roleByProject.get(r.id),
    } satisfies ProjectSummary;
  });
}

export async function getAccess(id: string): Promise<{ access: "owner" | "member"; role?: ShareRole } | null> {
  const me = await uid();
  const supabase = createClient();
  const { data: p, error: pErr } = await supabase.from("fittbuilder_projects").select("owner_id").eq("id", id).maybeSingle();
  if (pErr) { console.error("[storage] getAccess project:", pErr); return null; }
  if (!p) return null;
  if (p.owner_id === me) return { access: "owner" };
  const { data: m, error: mErr } = await supabase.from("fittbuilder_project_members").select("role").eq("project_id", id).eq("user_id", me).maybeSingle();
  if (mErr) { console.error("[storage] getAccess member:", mErr); return null; }
  return { access: "member", role: m?.role as ShareRole | undefined };
}

/* ---------- multi-party phase approval ---------- */

export interface ApprovalState {
  /** Who must approve: owner + editor members only. Viewers are read-only and
   *  cannot approve, so counting them would deadlock the gate forever. */
  approvers: string[];
  /** User ids who have approved the given phase. */
  approved: string[];
  /** The current user's id. */
  me: string;
}

/** Who must approve `phase`, and who already has. */
export async function getApprovalState(projectId: string, phase: string): Promise<ApprovalState> {
  const supabase = createClient();
  const me = await uid();
  const { data: proj } = await supabase
    .from("fittbuilder_projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  // Only editors approve; viewers are read-only (see ApprovalState).
  const { data: members } = await supabase
    .from("fittbuilder_project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("role", "editor");
  const approvers = Array.from(
    new Set([...(proj ? [proj.owner_id] : []), ...(members ?? []).map((m) => m.user_id)])
  );
  const { data: approvals } = await supabase
    .from("fittbuilder_phase_approvals")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("phase", phase);
  return { approvers, approved: (approvals ?? []).map((a) => a.user_id), me };
}

/** Record the current user's approval of `phase` (idempotent). */
export async function approvePhase(projectId: string, phase: string): Promise<void> {
  const supabase = createClient();
  const me = await uid();
  const { error } = await supabase
    .from("fittbuilder_phase_approvals")
    .upsert(
      { project_id: projectId, phase, user_id: me },
      { onConflict: "project_id,phase,user_id" }
    );
  if (error) throw new Error(error.message);
}

/* ---------- pure helpers (unchanged behaviour) ---------- */

export function withHistory(project: ProjectRecord, nextFiles: ProjectFiles): ProjectRecord {
  const history = project.files
    ? [...project.history, project.files].slice(-HISTORY_LIMIT)
    : project.history;
  return { ...project, history, files: nextFiles };
}

export function undo(project: ProjectRecord): ProjectRecord | null {
  if (project.history.length === 0) return null;
  const history = [...project.history];
  const files = history.pop()!;
  return { ...project, files, history };
}

export function appendMessage(project: ProjectRecord, message: ChatMessage): ProjectRecord {
  return { ...project, messages: [...project.messages, message] };
}

export function newMessage(role: ChatMessage["role"], content: string, phase?: PhaseId): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...(phase ? { phase } : {}),
  };
}
