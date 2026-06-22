"use client";

import { createClient } from "@/lib/supabase/client";
import { projectToRow, rowToProject, type ProjectRow } from "@/lib/db/project-mapper";
import type { PhaseId } from "./phases";
import type { ChatMessage, ProjectFiles, ProjectRecord, ProjectSummary, ShareRole } from "./types";

const HISTORY_LIMIT = 10; // US-004

const SELECT = "id, owner_id, name, files, phase, approved_phases, history, messages, share_token, share_role, created_at, updated_at";

async function uid(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("fittbuilder_projects").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToProject(data as unknown as ProjectRow);
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  const supabase = createClient();
  const ownerId = await uid();
  const row = { id: project.id, ...projectToRow(project, ownerId) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from("fittbuilder_projects").upsert(row as any).select(SELECT).single();
  if (error) throw error;
  return rowToProject(data as unknown as ProjectRow);
}

export async function createProject(options?: {
  name?: string;
  pendingPrompt?: string;
  pendingSpec?: boolean;
  phase?: PhaseId;
}): Promise<ProjectRecord> {
  const supabase = createClient();
  const ownerId = await uid();
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .insert({ owner_id: ownerId, name: options?.name?.trim() || "Untitled", phase: options?.phase ?? "define" })
    .select(SELECT)
    .single();
  if (error) throw error;
  const rec = rowToProject(data as unknown as ProjectRow);
  return { ...rec, pendingPrompt: options?.pendingPrompt, pendingSpec: options?.pendingSpec };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(projectToRow(rec, ownerId) as any)
    .select(SELECT)
    .single();
  if (error) throw error;
  return rowToProject(data as unknown as ProjectRow);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const supabase = createClient();
  const me = await uid();
  // RLS returns owned + shared rows; classify by owner_id, attach role from memberships.
  const { data: rows } = await supabase
    .from("fittbuilder_projects")
    .select("id, owner_id, name, files, created_at, updated_at")
    .order("updated_at", { ascending: false });
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
  const { data: p } = await supabase.from("fittbuilder_projects").select("owner_id").eq("id", id).maybeSingle();
  if (!p) return null;
  if (p.owner_id === me) return { access: "owner" };
  const { data: m } = await supabase.from("fittbuilder_project_members").select("role").eq("project_id", id).eq("user_id", me).maybeSingle();
  return { access: "member", role: m?.role as ShareRole | undefined };
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
