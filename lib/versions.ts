"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/db/types";
import type { ProjectFiles } from "@/lib/types";

/**
 * The two sellable versions of a demo.
 *
 * They are versions of ONE project — same customer, same quotation, same chat —
 * not two projects. The studio switches between them and each exports its own
 * zip, so Code Runner builds two genuinely different products.
 *
 * INVARIANT: `fittbuilder_projects.files` is always the ACTIVE version, and this
 * table holds only the inactive ones. Each version therefore exists exactly once,
 * every other feature keeps reading `files` unaware that versions exist, and a
 * project read never drags a version nobody asked for (migration 0031 explains
 * why that matters — project rows already reach 4.3 MB).
 */

export const VERSION_KEYS = ["standard", "premium"] as const;
export type VersionKey = (typeof VERSION_KEYS)[number];

export const VERSION_LABEL: Record<VersionKey, string> = {
  standard: "ปกติ",
  premium: "Premium",
};

const TABLE = "fittbuilder_project_versions";

export function isVersionKey(v: string): v is VersionKey {
  return (VERSION_KEYS as readonly string[]).includes(v);
}

/** Which stored versions exist besides the active one. */
export async function parkedVersions(projectId: string): Promise<VersionKey[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from(TABLE).select("key").eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((r) => r.key).filter(isVersionKey);
}

/**
 * Switch the project to `to`, returning that version's files.
 *
 * Park the version being left, take back the one being entered. Done in that
 * order on purpose: if the write of the outgoing version fails we stop before
 * anything is deleted, so the worst case is an unchanged project rather than a
 * version that exists in neither place.
 *
 * A version that has never existed is SEEDED from the current files — the first
 * switch to Premium is what creates it, starting from whatever Standard is now.
 */
export async function switchVersion(
  projectId: string,
  from: VersionKey,
  to: VersionKey,
  currentFiles: ProjectFiles
): Promise<ProjectFiles> {
  if (from === to) return currentFiles;
  const supabase = createClient();

  const { error: parkError } = await supabase.from(TABLE).upsert(
    { project_id: projectId, key: from, files: currentFiles as unknown as Json, updated_at: new Date().toISOString() },
    { onConflict: "project_id,key" }
  );
  if (parkError) throw parkError;

  const { data, error } = await supabase
    .from(TABLE)
    .select("files")
    .eq("project_id", projectId)
    .eq("key", to)
    .maybeSingle();
  if (error) throw error;

  const next = (data?.files as ProjectFiles | undefined) ?? currentFiles;

  // Only one copy of each version may exist: the incoming one now lives in
  // `projects.files`, so its parked row has to go or the next switch would
  // restore a stale snapshot over newer work.
  if (data) {
    const { error: dropError } = await supabase
      .from(TABLE)
      .delete()
      .eq("project_id", projectId)
      .eq("key", to);
    if (dropError) throw dropError;
  }
  return next;
}
