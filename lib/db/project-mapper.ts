import type { PhaseId } from "@/lib/phases";
import type { ChatMessage, ProjectFiles, ProjectRecord, RunnerSend } from "@/lib/types";

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  files: ProjectFiles | null;
  phase: string;
  approved_phases: PhaseId[];
  history_count: number;
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
    historyCount: row.history_count ?? 0,
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
    messages: trimOldDiffs(rec.messages),
    skill_id: rec.skillId ?? null,
    // `history` is not written here either, and for a sharper reason: the record
    // this row is built from no longer carries the stack at all. It is pushed and
    // popped in the database (fittbuilder_history_push/pop) so an ordinary save
    // stops shipping ten copies of the source tree — 3 MB on the heaviest
    // project, on every keystroke-triggered save.
    //
    // active_version is DELIBERATELY not written here. Ordinary saves are built
    // from whatever record the caller holds, and a caller holding one captured
    // before a version switch would write the OLD version back — pointing the
    // row at files belonging to the other tier. Only setProjectVersion writes
    // that column.
  };
}
