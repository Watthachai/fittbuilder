"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/db/types";
import type { ProjectFiles } from "./types";

/**
 * Two ways to carry a demo to the /share viewer:
 *
 * - Short link (default for the copy-share button): a snapshot is stored in the
 *   database and the link is `…/share/<token>`. See createSharedDemo.
 * - URL fragment (BR-003, still used by pop-out-in-a-new-tab and older links):
 *   the whole project is deflate-compressed and base64url-encoded into the
 *   fragment, which never reaches a server. See encodeShareUrl.
 */

export interface SharePayload {
  name: string;
  files: ProjectFiles;
}

/** ~8-char base62 id — 62^8 ≈ 2e14 possibilities, ample for share tokens. */
function shortToken(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += alphabet[b % 62];
  return out;
}

/**
 * Store a snapshot of the demo and return a short link to it.
 *
 * A snapshot, not a reference: name+files are copied as they are now, so the
 * link a customer receives keeps showing this version even after the project is
 * edited. `created_by` defaults to auth.uid() in the row, gated by RLS to
 * someone who can read the project.
 */
export async function createSharedDemo(projectId: string, payload: SharePayload): Promise<string> {
  const supabase = createClient();
  const token = shortToken();
  const { error } = await supabase.from("fittbuilder_shared_demos").insert({
    token,
    project_id: projectId,
    name: payload.name,
    files: payload.files as unknown as Json,
  });
  if (error) throw error;
  return `${window.location.origin}/share/${token}`;
}

/** Read a shared snapshot by its token (public, no login — via a SECURITY
 *  DEFINER function that returns only name+files for the matching token). */
export async function getSharedDemo(token: string): Promise<SharePayload> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fittbuilder_shared_demo", { share_token: token });
  if (error) throw error;
  const payload = data as SharePayload | null;
  if (!payload || typeof payload !== "object" || typeof payload.files !== "object") {
    throw new Error("ลิงก์แชร์ไม่ถูกต้องหรือหมดอายุ");
  }
  return payload;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): Uint8Array {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compress(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

export async function encodeShareUrl(payload: SharePayload): Promise<string> {
  const compressed = await compress(JSON.stringify(payload));
  return `${window.location.origin}/share#${toBase64Url(compressed)}`;
}

export async function decodeShareFragment(fragment: string): Promise<SharePayload> {
  const payload = JSON.parse(await decompress(fromBase64Url(fragment))) as SharePayload;
  if (!payload || typeof payload !== "object" || typeof payload.files !== "object") {
    throw new Error("ลิงก์แชร์ไม่ถูกต้อง");
  }
  return payload;
}
