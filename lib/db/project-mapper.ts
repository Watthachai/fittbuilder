import type { PhaseId } from "@/lib/phases";
import type { ChatMessage, ProjectFiles, ProjectRecord } from "@/lib/types";

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
  created_at: string;
  updated_at: string;
}

/** Columns we write on insert/update (owner-managed; id/timestamps are DB-managed). */
export interface ProjectInsertRow {
  owner_id: string;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function projectToRow(rec: ProjectRecord, ownerId: string): ProjectInsertRow {
  return {
    owner_id: ownerId,
    name: rec.name,
    files: rec.files,
    phase: rec.phase,
    approved_phases: rec.approvedPhases ?? [],
    history: rec.history,
    messages: rec.messages,
    skill_id: rec.skillId ?? null,
  };
}
