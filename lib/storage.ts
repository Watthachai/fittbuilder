"use client";

import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/current-user";
import { projectToRow, rowToProject, type ProjectRow } from "@/lib/db/project-mapper";
import type { PhaseId } from "./phases";
import type { ChatMessage, ProjectFiles, ProjectGeneration, ProjectRecord, ProjectSummary, RunnerSend, ShareRole } from "./types";
import type { Database, Json } from "@/lib/db/types";

type ProjInsert = Database["public"]["Tables"]["fittbuilder_projects"]["Insert"];


/**
 * The whole project. Still expensive: `files` is the source tree and `messages`
 * carries every turn's before/after file bodies. Read it only when the studio
 * actually needs the project, never to answer a question a column could answer.
 *
 * `history` is deliberately absent — it was ten more copies of the source tree
 * (3 MB on the heaviest project, 89% of the row) and nothing here ever needed to
 * READ it: the button only asks whether the stack is empty, which history_count
 * answers in 4 bytes, and Undo wants exactly one entry, which popHistory returns.
 */
/** Mirrors the cap in fittbuilder_history_push (migration 0032). */
const HISTORY_LIMIT = 10; // US-004

const SELECT = "id, owner_id, name, files, phase, approved_phases, history_count, messages, share_token, share_role, skill_id, org_id, runner_last, created_at, updated_at";


// Reads the session this browser already holds instead of asking the auth
// server. uid() runs before seven different database calls, so the old
// getUser() here alone put an auth round-trip in front of most queries the app
// makes — see lib/current-user.ts.
const uid = currentUserId;

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("fittbuilder_projects").select(SELECT).eq("id", id).maybeSingle();
  if (error) { console.error("[storage] getProject:", error); return null; }
  if (!data) return null;
  return rowToProject(data as unknown as ProjectRow);
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  const supabase = createClient();
  // No owner_id here — see ProjectInsertRow. Autosave runs for every editor, so
  // sending it handed the project to whoever saved last.
  const row = { id: project.id, ...projectToRow(project) };
  // Write only. Selecting the row back doubled every autosave: we just sent
  // those megabytes, so reading them again tells us nothing we do not hold —
  // except `updated_at`, which the server stamps and the caller needs.
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .upsert(row as unknown as ProjInsert)
    .select("updated_at")
    .single();
  if (error) throw error;
  return { ...project, updatedAt: (data?.updated_at as string) ?? project.updatedAt };
}

/**
 * Just the workflow phase and the version stamp.
 *
 * The tab-focus check needs to know whether a collaborator advanced the phase.
 * It used to answer that by downloading the entire project — files, history and
 * every turn's diffs — to compare one short string, on every focus.
 */
export async function getProjectPhase(
  id: string
): Promise<{ phase: PhaseId; updatedAt: string } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .select("phase, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return { phase: data.phase as PhaseId, updatedAt: data.updated_at as string };
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

/** Attach/detach a project to a workspace (null = ส่วนตัว). org_id is omitted from
 *  projectToRow (so autosave never touches it), so changing it needs a direct
 *  column update — this is the only writer of org_id after creation. */
export async function setProjectOrg(projectId: string, orgId: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_projects")
    .update({ org_id: orgId, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw error;
}

/** Persist the last "sent to Code Runner" hand-off (direct column update — like
 *  setProjectOrg, projectToRow omits runner_last so autosave never clobbers it). */
export async function setProjectRunner(projectId: string, runner: RunnerSend): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_projects")
    .update({ runner_last: runner as unknown as Json, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw error;
}

export async function duplicateProject(id: string): Promise<ProjectRecord | null> {
  return duplicateProjectAs(id, (name) => `${name} (copy)`);
}

/**
 * Fork a project under a name the caller chooses.
 *
 * This is how a tiered offer is built: Standard and Premium are two PROJECTS,
 * not two modes of one. A tier switch inside a single codebase would ship the
 * Premium code inside the Standard customer's zip — one DevTools toggle and the
 * upsell is gone. Separate projects mean separate exports and separate builds.
 */
export async function duplicateProjectAs(
  id: string,
  rename: (name: string) => string
): Promise<ProjectRecord | null> {
  const source = await getProject(id);
  if (!source) return null;
  return saveProjectAsNew({ ...source, name: rename(source.name) });
}

async function saveProjectAsNew(rec: ProjectRecord): Promise<ProjectRecord> {
  const supabase = createClient();
  // A copy belongs to whoever made it — the owner_id default stamps auth.uid().
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .insert(projectToRow(rec) as unknown as ProjInsert)
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
    // NOT `files`. Listing pulled the entire source tree of every project the
    // user can see, to render a file count. file_count is maintained by a
    // trigger (migration 0027) precisely so this query stays small.
    .select("id, owner_id, name, file_count, org_id, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const [{ data: memberships }, { data: owners }, { data: drafts }] = await Promise.all([
    supabase.from("fittbuilder_project_members").select("project_id, role").eq("user_id", me),
    // Creator names for shared rows — profiles_select_own hides other users'
    // profiles, so this rides a gated security-definer RPC (migration 0022).
    supabase.rpc("fittbuilder_shared_project_owners"),
    // Which projects have an unfinished turn. Note the columns: NOT `files`.
    // This table holds whole file maps, and pulling one into a list render is
    // the exact shape of the 2026-08-06 outage — file_count exists (0036) so
    // the list can say how much is parked without reading any of it.
    supabase
      .from("fittbuilder_project_drafts")
      .select("project_id, updated_at, updated_by, file_count"),
  ]);
  const roleByProject = new Map<string, ShareRole>((memberships ?? []).map((m) => [m.project_id, m.role as ShareRole]));
  const ownerByProject = new Map<string, string>(
    (owners ?? []).map((o) => [o.project_id, o.name?.trim() || o.email || ""])
  );
  const draftByProject = new Map<string, ProjectGeneration>(
    (drafts ?? []).map((d) => [
      d.project_id,
      {
        live: isDraftLive({ files: {}, prompt: "", updatedAt: d.updated_at, updatedBy: d.updated_by }),
        fileCount: d.file_count ?? 0,
        updatedAt: d.updated_at,
        updatedBy: d.updated_by,
      },
    ])
  );
  return (rows ?? []).map((r) => {
    const owner = r.owner_id === me;
    return {
      id: r.id,
      name: r.name,
      fileCount: (r as { file_count: number | null }).file_count ?? 0,
      orgId: (r as { org_id: string | null }).org_id ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      access: owner ? "owner" : "member",
      role: owner ? undefined : roleByProject.get(r.id),
      ownerName: owner ? undefined : ownerByProject.get(r.id) || undefined,
      generation: draftByProject.get(r.id),
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

/* ---------- unfinished generations ---------- */

/**
 * What a turn has produced so far, kept where it can be offered back rather than
 * applied.
 *
 * The stream lives in the browser (see lib/generation/registry.ts), so closing
 * or reloading the tab ends it. Files used to reach the database only when a
 * turn finished, which made a reload at file 11 of 12 cost all twelve.
 *
 * Deliberately NOT written into `files`: a half-streamed set has no index.html
 * yet, and the saved project must stay the last COMPLETE one or it boots to a
 * white screen (migration 0034).
 */
export async function saveDraft(
  projectId: string,
  files: ProjectFiles,
  prompt: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fittbuilder_project_drafts").upsert(
    {
      project_id: projectId,
      files: files as unknown as Json,
      prompt,
      // Doubles as a heartbeat: a timestamp that keeps moving means the turn is
      // still alive somewhere, which is what tells a live run apart from a dead
      // one (migration 0035).
      updated_at: new Date().toISOString(),
      updated_by: await uid(),
    },
    { onConflict: "project_id" }
  );
  if (error) throw new Error(error.message);
}

export interface GenerationDraft {
  files: ProjectFiles;
  prompt: string;
  updatedAt: string;
  /** Who was generating. Null for drafts written before 0035. */
  updatedBy: string | null;
}

/**
 * How long a draft's heartbeat may go quiet before its turn counts as dead.
 *
 * Checkpoints land every 5s (DRAFT_INTERVAL_MS in Studio), so three missed ones
 * is a generous margin for a slow request — and still short enough that someone
 * whose tab crashed is not left staring at "generating" for minutes.
 */
export const DRAFT_STALE_MS = 20_000;

/** Is this draft still being written, or did its turn die? */
export function isDraftLive(draft: GenerationDraft, now = Date.now()): boolean {
  return now - new Date(draft.updatedAt).getTime() < DRAFT_STALE_MS;
}

/** The unfinished turn for this project, if one was interrupted. */
export async function loadDraft(projectId: string): Promise<GenerationDraft | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_project_drafts")
    .select("files, prompt, updated_at, updated_by")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    files: data.files as unknown as ProjectFiles,
    prompt: data.prompt,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

/** Drop the draft — the turn finished, one way or the other. */
export async function clearDraft(projectId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("fittbuilder_project_drafts").delete().eq("project_id", projectId);
}

/* ---------- undo stack (lives in the database, migration 0032) ---------- */

/**
 * Snapshot `files` so Undo can come back to it, and return the record pointed at
 * `nextFiles`.
 *
 * The snapshot is SENT rather than copied from the row inside the function
 * because saves here are debounced: the row can still hold the previous step
 * when this is called, and snapshotting that would silently skip a step.
 *
 * The write is fired, not awaited, so the four call sites stay synchronous and
 * the studio never waits on it to show the result of an edit. `historyCount` is
 * advanced optimistically — it decides whether the Undo button is enabled, and
 * a push that fails leaves a button that finds nothing to pop (undo() asks the
 * database, which is authoritative) until the next read corrects the count.
 */
export function withHistory(project: ProjectRecord, nextFiles: ProjectFiles): ProjectRecord {
  if (!project.files) return { ...project, files: nextFiles };
  const supabase = createClient();
  void supabase
    .rpc("fittbuilder_history_push", {
      pid: project.id,
      snapshot: project.files as unknown as Json,
    })
    .then(({ error }) => {
      if (error) console.error("[storage] history push failed:", error);
    });
  return {
    ...project,
    files: nextFiles,
    historyCount: Math.min(HISTORY_LIMIT, project.historyCount + 1),
  };
}

/**
 * Step back one snapshot. Returns null when the stack is empty.
 *
 * The pop and the write of the restored files happen in one statement inside the
 * database, so an Undo cannot half-apply: either the entry leaves the stack and
 * becomes the project's files, or neither happens.
 */
export async function undo(project: ProjectRecord): Promise<ProjectRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fittbuilder_history_pop", { pid: project.id });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...project,
    files: data as unknown as ProjectFiles,
    historyCount: Math.max(0, project.historyCount - 1),
  };
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
