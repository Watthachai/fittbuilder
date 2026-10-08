import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import {
  CASE_LOG_LINES,
  needsTeam,
  unreadForReporter,
  type CaseActivity,
  type CaseAttachment,
  type CaseKind,
  type CasePerson,
  type CaseStatus,
  type CaseSummary,
} from "@/lib/cases";

/**
 * Server side of /api/cases. The case tables have RLS on and no policies, so
 * every route resolves who is asking here first, decides what they may touch,
 * and only then reads or writes through the service role.
 */

export const CASE_FILES_BUCKET = "case-files";
const SIGNED_URL_TTL = 60 * 60;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** One picture, as the browser uploaded it (the bucket enforces type and size too). */
export const attachmentSchema = z.object({
  path: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(200),
  type: z.string().regex(/^image\/(png|jpeg|webp|gif)$/),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
});
export const attachmentsSchema = z.array(attachmentSchema).max(6);

/** The bounds lib/cases.ts buildCaseContext already keeps, checked again at the door. */
export const contextSchema = z.object({
  phase: z.string().max(40).nullable(),
  error: z.string().max(4_000).nullable(),
  log: z.array(z.string().max(400)).max(CASE_LOG_LINES),
  fileCount: z.number().int().nonnegative().nullable(),
  appVersion: z.string().max(40),
  userAgent: z.string().max(400),
  page: z.string().max(300),
});

export const CASE_COLUMNS =
  "id, number, reporter_id, project_id, title, kind, status, context, fixed_in, last_reporter_at, last_team_at, reporter_seen_at, team_seen_at, created_at, updated_at";

export interface CaseRow {
  id: string;
  number: number;
  reporter_id: string;
  project_id: string | null;
  title: string;
  kind: CaseKind;
  status: CaseStatus;
  context: unknown;
  fixed_in: string | null;
  last_reporter_at: string;
  last_team_at: string | null;
  reporter_seen_at: string;
  team_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseViewer {
  id: string;
  /** On the team (ADMIN_EMAILS): sees and answers every case. */
  team: boolean;
}

export async function caseViewer(): Promise<CaseViewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, team: isAdminEmail(user.email) } : null;
}

export function mayOpen(viewer: CaseViewer, row: Pick<CaseRow, "reporter_id">): boolean {
  return viewer.team || row.reporter_id === viewer.id;
}

/** Something new on this viewer's side of the case. */
export function unreadFor(viewer: CaseViewer, row: Pick<CaseRow, "reporter_id"> & CaseActivity): boolean {
  return row.reporter_id === viewer.id ? unreadForReporter(row) : needsTeam(row);
}

/** Names for a set of people, from their profiles. */
export async function peopleById(ids: string[]): Promise<Map<string, CasePerson>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, CasePerson>();
  if (unique.length === 0) return map;
  const { data, error } = await createAdminClient()
    .from("fittbuilder_profiles")
    .select("id, name, email")
    .in("id", unique);
  if (error) throw error;
  for (const p of data ?? []) map.set(p.id, { name: p.name, email: p.email });
  return map;
}

export async function projectsById(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await createAdminClient()
    .from("fittbuilder_projects")
    .select("id, name")
    .in("id", unique);
  if (error) throw error;
  for (const p of data ?? []) map.set(p.id, p.name);
  return map;
}

export function toSummary(
  viewer: CaseViewer,
  row: CaseRow,
  people: Map<string, CasePerson>,
  projects: Map<string, string>
): CaseSummary {
  const projectName = row.project_id ? projects.get(row.project_id) : undefined;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    kind: row.kind,
    status: row.status,
    fixedIn: row.fixed_in,
    project: row.project_id && projectName !== undefined ? { id: row.project_id, name: projectName } : null,
    reporter: people.get(row.reporter_id) ?? { name: null, email: null },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unread: unreadFor(viewer, row),
  };
}

/** Sign every attachment in one round-trip; the bucket is private. */
export async function signAttachments<T extends { attachments: CaseAttachment[] }>(
  items: T[]
): Promise<T[]> {
  const paths = items.flatMap((m) => m.attachments.map((a) => a.path));
  if (paths.length === 0) return items;
  const { data, error } = await createAdminClient()
    .storage.from(CASE_FILES_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) throw error;
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return items.map((m) => ({
    ...m,
    attachments: m.attachments.map((a) => ({ ...a, url: urlByPath.get(a.path) ?? undefined })),
  }));
}
