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

/**
 * What a tier adds to an exported filename.
 *
 * Both export paths — the zip the user downloads and the zip_name handed to Code
 * Runner — have to agree, or the same project ships two files called the same
 * thing and nobody downstream can tell the paid build from the free one. The
 * standard tier gets no marker: it is the product, and every existing export
 * already has that name.
 */
export function versionTag(key: VersionKey): string {
  return key === "standard" ? "" : `-${key}`;
}

export function isVersionKey(v: string): v is VersionKey {
  return (VERSION_KEYS as readonly string[]).includes(v);
}

/** Which version the project is pointed at right now. */
export async function activeVersionOf(projectId: string): Promise<VersionKey> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fittbuilder_projects")
    .select("active_version")
    .eq("id", projectId)
    .maybeSingle();
  const key = data?.active_version ?? "standard";
  return isVersionKey(key) ? key : "standard";
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
 * One call, one transaction (migration 0033). It used to be four separate
 * writes — park the outgoing version, delete the incoming one's row, save the
 * files, move the pointer — and a real project was found stopped between them:
 * the pointer said "ปกติ" while `files` held the Premium build, so the phase bar
 * named one product and an export would have shipped the other.
 *
 * The outgoing files are SENT rather than read from the row inside the function
 * because saves are debounced: the row can still hold the previous step.
 *
 * A version that has never existed is SEEDED from the current files — the first
 * switch to Premium starts from whatever Standard is now.
 */
export async function switchVersion(
  projectId: string,
  from: VersionKey,
  to: VersionKey,
  currentFiles: ProjectFiles
): Promise<ProjectFiles> {
  if (from === to) return currentFiles;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fittbuilder_switch_version", {
    pid: projectId,
    from_key: from,
    to_key: to,
    outgoing: currentFiles as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return data as unknown as ProjectFiles;
}
