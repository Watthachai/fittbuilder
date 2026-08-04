"use client";

import { createClient } from "@/lib/supabase/client";

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
 *   <projectId>/shots/<index>__<parent|_>__<name>.png
 */

const BUCKET = "project-chat";

export interface Shot {
  path: string;
  /** Screen or modal name, as it will appear on the quotation. */
  name: string;
  /** Parent screen name for a modal/sub-state; null for a top-level screen. */
  parent: string | null;
  /** Capture order, so the gallery reads in walk order. */
  index: number;
  url: string;
}

const encode = (s: string) => encodeURIComponent(s).replace(/[.*]/g, "_");
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function nameOf(path: string): { index: number; parent: string | null; name: string } {
  const file = path.split("/").pop() ?? "";
  const [rawIndex, rawParent, ...rest] = file.replace(/\.png$/, "").split("__");
  const index = Number(rawIndex);
  const parent = rawParent && rawParent !== "_" ? decode(rawParent) : null;
  return {
    index: Number.isFinite(index) ? index : 0,
    parent,
    name: decode(rest.join("__")) || "หน้าจอ",
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
  shot: { name: string; parent: string | null; index: number; dataUrl: string }
): Promise<Shot> {
  const supabase = createClient();
  const path = `${projectId}/shots/${String(shot.index).padStart(3, "0")}__${
    shot.parent ? encode(shot.parent) : "_"
  }__${encode(shot.name)}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, dataUrlToBlob(shot.dataUrl), { contentType: "image/png", upsert: true });
  if (error) throw error;
  return { path, name: shot.name, parent: shot.parent, index: shot.index, url: await signedUrl(path) };
}

async function signedUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 8);
  return data?.signedUrl ?? "";
}

/** Every capture for the project, in walk order. */
export async function listShots(projectId: string): Promise<Shot[]> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).list(`${projectId}/shots`, {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return [];
  const files = data.filter((f) => f.name.endsWith(".png"));
  const paths = files.map((f) => `${projectId}/shots/${f.name}`);
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 8);
  return paths
    .map((path, i) => ({ path, ...nameOf(path), url: signed?.[i]?.signedUrl ?? "" }))
    .sort((a, b) => a.index - b.index);
}

export async function deleteShot(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/** Wipe the inventory before a fresh walk, so runs never interleave. */
export async function clearShots(projectId: string): Promise<void> {
  const shots = await listShots(projectId);
  if (shots.length === 0) return;
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove(shots.map((s) => s.path));
}
