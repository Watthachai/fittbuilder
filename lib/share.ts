"use client";

import type { ProjectFiles } from "./types";

/**
 * Zero-backend share links (BR-003): the project is deflate-compressed and
 * base64url-encoded into the URL fragment. The fragment never reaches a
 * server, and the /share page rebuilds the demo locally in a WebContainer.
 */

export interface SharePayload {
  name: string;
  files: ProjectFiles;
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
