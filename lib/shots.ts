"use client";

import { createClient } from "@/lib/supabase/client";
import type { VersionKey } from "@/lib/versions";

/**
 * The screen inventory: one PNG per screen (and per modal hanging off it),
 * captured from inside the running demo.
 *
 * Storage rides the existing `project-chat` bucket under a `shots/` prefix —
 * its policies key on the FIRST path segment being the project id, so members
 * already have exactly the right access and no new bucket or migration is
 * needed. Ordering and the screen/modal hierarchy live in the file name, which
 * keeps the whole feature free of new tables:
 *
 *   <projectId>/shots/<version>/<index>.<parent-b64>.<name-b64>.<via-b64>.<from-b64>.png
 *
 * The <version> folder keeps a Standard walk and a Premium walk from mixing in
 * one gallery — the demo has two versions and a screenshot belongs to the one
 * that was on screen when it was taken. Shots captured before this folder
 * existed live one level up (<projectId>/shots/<index>…png); they count as
 * Standard, so listing/clearing Standard folds those legacy files in.
 *
 * `parent` and `from` are different questions and were once the same field:
 * parent means "a modal OF this screen" (the gallery nests it), from means
 * "arrived FROM this screen" (the flow map draws an arrow). Recording sets a
 * from on every capture, so sharing one field turned every screen into a
 * sub-item of the first one.
 *
 * The separator is "." because base64url's own alphabet contains "_" and "-" —
 * an underscore separator collided with encoded names and split them apart.
 */

const BUCKET = "project-chat";

/** The folder a version's shots live under. */
const versionDir = (projectId: string, version: VersionKey): string =>
  `${projectId}/shots/${version}`;

/**
 * Legacy shots — written before versions existed — sit directly in
 * `<projectId>/shots/` and are read as Standard. Premium never inherits them.
 */
const legacyDir = (projectId: string): string => `${projectId}/shots`;

export interface Shot {
  path: string;
  /** The control that led here, when the capture came from a recording. */
  via?: string | null;
  /** The screen this was reached from — the flow edge, not a nesting. */
  from?: string | null;
  /** Screen or modal name, as it will appear on the quotation. */
  name: string;
  /** Parent screen name for a modal/sub-state; null for a top-level screen. */
  parent: string | null;
  /** Capture order, so the gallery reads in walk order. */
  index: number;
  url: string;
}

/**
 * Names go into the key as base64url.
 *
 * Not percent-encoding: Supabase Storage rejects `%` in an object key outright
 * ("Invalid key"), so encodeURIComponent — the obvious choice — fails on every
 * Thai screen name. base64url is pure [A-Za-z0-9-_], which the key charset
 * allows, and it round-trips UTF-8 exactly.
 */
const encode = (s: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const decode = (s: string): string => {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return s;
  }
};

/** The object key for a capture — pure ASCII, sortable by walk order. */
export function shotKeyFor(
  projectId: string,
  version: VersionKey,
  shot: { index: number; parent: string | null; name: string; via?: string | null; from?: string | null }
): string {
  const index = String(shot.index).padStart(3, "0");
  const parent = shot.parent ? encode(shot.parent) : "";
  // Trailing segments are optional, so keys written before recording existed
  // still parse.
  const tail = shot.from
    ? `.${shot.via ? encode(shot.via) : ""}.${encode(shot.from)}`
    : shot.via
      ? `.${encode(shot.via)}`
      : "";
  return `${versionDir(projectId, version)}/${index}.${parent}.${encode(shot.name)}${tail}.png`;
}

/** Read back what the key encodes: walk order, parent screen, display name. */
export function shotMetaFromPath(path: string): {
  index: number;
  parent: string | null;
  name: string;
  via: string | null;
  from: string | null;
} {
  const file = path.split("/").pop() ?? "";
  const [rawIndex, rawParent, rawName, rawVia, rawFrom] = file.replace(/\.png$/, "").split(".");
  const index = Number(rawIndex);
  return {
    index: Number.isFinite(index) ? index : 0,
    parent: rawParent ? decode(rawParent) : null,
    name: (rawName && decode(rawName)) || "หน้าจอ",
    via: rawVia ? decode(rawVia) : null,
    from: rawFrom ? decode(rawFrom) : null,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadShot(
  projectId: string,
  version: VersionKey,
  shot: {
    name: string;
    parent: string | null;
    index: number;
    dataUrl: string;
    /** Recording only: which control led here, and from where. */
    via?: string | null;
    from?: string | null;
  }
): Promise<Shot> {
  const supabase = createClient();
  const path = shotKeyFor(projectId, version, shot);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, dataUrlToBlob(shot.dataUrl), { contentType: "image/png", upsert: true });
  if (error) throw error;
  return {
    path,
    name: shot.name,
    parent: shot.parent ?? null,
    from: shot.from ?? null,
    via: shot.via ?? null,
    index: shot.index,
    url: await signedUrl(path),
  };
}

async function signedUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 8);
  return data?.signedUrl ?? "";
}

/** The .png keys directly under one folder (non-recursive). */
async function pngPathsIn(dir: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).list(dir, {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return [];
  // Sub-folders (the version dirs) come back as entries with no ".png" and are
  // filtered out here, so listing the legacy dir never pulls in versioned shots.
  return data.filter((f) => f.name.endsWith(".png")).map((f) => `${dir}/${f.name}`);
}

/**
 * One version's inventory, in walk order.
 *
 * Standard folds in the legacy shots that predate the version folder; Premium
 * sees only its own. A key can repeat an index across the two Standard sources
 * after a partial re-capture, but every fresh walk clears first (clearShots),
 * so in practice one source is empty when the other is written.
 */
export async function listShots(projectId: string, version: VersionKey): Promise<Shot[]> {
  const dirs =
    version === "standard"
      ? [versionDir(projectId, version), legacyDir(projectId)]
      : [versionDir(projectId, version)];
  const paths = (await Promise.all(dirs.map(pngPathsIn))).flat();
  if (paths.length === 0) return [];
  const supabase = createClient();
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 8);
  return paths
    .map((path, i) => ({ path, ...shotMetaFromPath(path), url: signed?.[i]?.signedUrl ?? "" }))
    .sort((a, b) => a.index - b.index);
}

export async function deleteShot(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/** Wipe one version's inventory before a fresh walk, so runs never interleave. */
export async function clearShots(projectId: string, version: VersionKey): Promise<void> {
  const shots = await listShots(projectId, version);
  if (shots.length === 0) return;
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove(shots.map((s) => s.path));
}
