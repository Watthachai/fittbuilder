import type { PhaseId } from "@/lib/phases";
import type { ChatMessage, ProjectFiles, ProjectRecord, RunnerSend } from "@/lib/types";

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  files: ProjectFiles | null;
  phase: string;
  approved_phases: PhaseId[];
  history: ProjectFiles[];
  messages: ChatMessage[];
  share_token: string | null;
  share_role: "viewer" | "editor" | null;
  skill_id: string | null;
  org_id: string | null;
  runner_last: RunnerSend | null;
  created_at: string;
  updated_at: string;
}

/**
 * Columns we write on insert/update (id/timestamps are DB-managed).
 *
 * owner_id is deliberately ABSENT: it is stamped once by the column default
 * (auth.uid(), migration 0004) and must never be written again. Sending it made
 * every autosave rewrite the owner to whoever had the project open, so a shared
 * editor silently took ownership and the real owner's project fell into
 * "แชร์กับฉัน" (migration 0024 now pins the column server-side too).
 */
export interface ProjectInsertRow {
  name: string;
  files: ProjectFiles | null;
  phase: string;
  approved_phases: PhaseId[];
  history: ProjectFiles[];
  messages: ChatMessage[];
  skill_id: string | null;
}

export function rowToProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    files: row.files,
    phase: row.phase as PhaseId,
    approvedPhases: row.approved_phases ?? [],
    history: row.history ?? [],
    messages: row.messages ?? [],
    skillId: row.skill_id ?? undefined,
    orgId: row.org_id ?? null,
    runnerLast: row.runner_last ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * How many recent turns keep the full text of what they changed.
 *
 * Every AI turn stores the before/after body of every file it touched, and
 * nothing ever removed them: one measured project reached 2 MB of chat log
 * across 223 turns, read in full on every studio open. People open the diff of
 * a turn they just ran, essentially never of one from last week — and the
 * turns that lose their bodies keep their file list and their revision, which
 * is the durable, content-addressed copy anyway.
 */
const DIFF_BODIES_KEPT = 10;

/**
 * Drop file bodies from old changesets on the way to the database.
 *
 * In memory the session keeps everything; only what is PERSISTED is trimmed,
 * so nothing a user is looking at right now changes under them.
 */
function trimOldDiffs(messages: ChatMessage[]): ChatMessage[] {
  let budget = DIFF_BODIES_KEPT;
  const out = messages.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (!m.changes?.length) continue;
    if (budget > 0) {
      budget--;
      continue;
    }
    out[i] = { ...m, changes: m.changes.map((c) => ({ path: c.path, before: null, after: null })) };
  }
  return out;
}

export function projectToRow(rec: ProjectRecord): ProjectInsertRow {
  return {
    name: rec.name,
    files: rec.files,
    phase: rec.phase,
    approved_phases: rec.approvedPhases ?? [],
    history: rec.history,
    messages: trimOldDiffs(rec.messages),
    skill_id: rec.skillId ?? null,
  };
}
