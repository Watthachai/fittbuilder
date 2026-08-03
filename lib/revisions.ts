"use client";

import { createClient } from "@/lib/supabase/client";
import type { ProjectFiles } from "./types";

/**
 * Addressable checkpoints. Every change that lands — an AI turn or a wand quick
 * patch — gets a revision, so the chat can offer "ย้อนกลับมาเวอร์ชันนี้" at any
 * point instead of only stepping back one at a time.
 *
 * The id is content-addressed: SHA-256 over canonical JSON of the file map,
 * first 7 hex. Identical files always produce the same sha (a git tree hash in
 * spirit) — and no git is involved, which matters because WebContainer cannot
 * run it.
 */

export type RevisionKind = "ai" | "quick" | "restore";

export interface Revision {
  id: string;
  sha: string;
  parentSha: string | null;
  label: string;
  kind: RevisionKind;
  targetLoc: string | null;
  createdAt: string;
  authorName?: string;
}

/** Stable serialization: sorted paths, so key order can never change the sha. */
function canonical(files: ProjectFiles): string {
  const sorted = Object.keys(files).sort();
  return JSON.stringify(sorted.map((p) => [p, files[p]]));
}

export async function shaOf(files: ProjectFiles): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(files));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 7);
}

/** Rapid quick edits on one element fold into a single revision for this long. */
const AMEND_WINDOW_MS = 120_000;

interface CommitOptions {
  projectId: string;
  files: ProjectFiles;
  label: string;
  kind: RevisionKind;
  /** Element a wand edit targeted — enables amending instead of piling up. */
  targetLoc?: string | null;
}

/**
 * Record a checkpoint. Returns the sha, or null when the write fails — a failed
 * checkpoint must never break the edit the user just made.
 */
export async function commitRevision({
  projectId,
  files,
  label,
  kind,
  targetLoc = null,
}: CommitOptions): Promise<string | null> {
  try {
    const supabase = createClient();
    const sha = await shaOf(files);
    const { data: last } = await supabase
      .from("fittbuilder_project_revisions")
      .select("id, sha, kind, target_loc, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last?.sha === sha) return sha; // nothing actually changed

    // Ten colour taps on one button are one edit, not ten — amend in place so the
    // timeline stays readable (and the row count stays sane).
    const amendable =
      kind === "quick" &&
      last?.kind === "quick" &&
      targetLoc !== null &&
      last?.target_loc === targetLoc &&
      Date.now() - new Date(last.created_at as string).getTime() < AMEND_WINDOW_MS;

    if (amendable && last) {
      await supabase
        .from("fittbuilder_project_revisions")
        .update({ sha, label, files })
        .eq("id", last.id);
      return sha;
    }

    const { data: me } = await supabase.auth.getUser();
    await supabase.from("fittbuilder_project_revisions").insert({
      project_id: projectId,
      sha,
      parent_sha: last?.sha ?? null,
      label,
      kind,
      target_loc: targetLoc,
      files,
      author_id: me.user?.id ?? null,
    });
    return sha;
  } catch (error) {
    console.error("[revisions] commit failed:", error);
    return null;
  }
}

/** Newest first. Files are omitted — the list view never needs them. */
export async function listRevisions(projectId: string): Promise<Revision[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_project_revisions")
    .select("id, sha, parent_sha, label, kind, target_loc, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    sha: r.sha as string,
    parentSha: (r.parent_sha as string | null) ?? null,
    label: r.label as string,
    kind: r.kind as RevisionKind,
    targetLoc: (r.target_loc as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** The file map stored at `sha`, or null when it has been pruned away. */
export async function revisionFiles(
  projectId: string,
  sha: string
): Promise<{ files: ProjectFiles; label: string } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_project_revisions")
    .select("files, label")
    .eq("project_id", projectId)
    .eq("sha", sha)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { files: data.files as ProjectFiles, label: data.label as string };
}
