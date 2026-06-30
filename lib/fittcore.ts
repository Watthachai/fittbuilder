"use client";

import type { ProjectFiles, ProjectRecord } from "./types";
import { docsFromFiles } from "./define";

/** Build channel tag stamped on every hand-off while the integration is in alpha. */
export const FITTCORE_TAG = "alpha-test";

/**
 * The machine payload POSTed to the Code Runner (via /api/fittcore).
 * Mirrors CRN's `POST /internal/projects` request body exactly.
 *
 * The prototype's files are shipped as ONE zip (base64) — the Code Runner writes
 * it into the build workdir and the Claude Code build agent extracts it itself
 * (no per-file array on the wire). idea/brd/prd ride along as plain text too
 * (they're also inside the zip under docs/) so CRN can compose the build prompt
 * without unzipping first.
 */
export interface FittcorePayload {
  org_id: string;
  org_name: string;
  project_id: string;
  name: string;
  /** Marks the hand-off channel — "alpha-test" for now. */
  tag: string;
  idea: string;
  brd: string;
  prd: string;
  prompts: string[];
  /** Suggested filename for the zip CRN drops in the workdir. */
  zip_name: string;
  /** base64 of a zip containing every project file (incl. docs/). */
  zip_base64: string;
  file_count: number;
  zip_bytes: number;
}

/** CRN's 202 response to `POST /internal/projects`. */
export interface FittcoreRunnerResult {
  project_id: string;
  job_id: string;
  build_no: number;
  org_id: string;
  git_remote: string;
  git_branch: string;
  status: string;
}

/** Chunked Uint8Array → base64 (btoa over String.fromCharCode blows the call
 *  stack on big arrays, so feed it in 32 KB slices). */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Zip every project file (paths preserved, incl. docs/) → base64 + sizes. */
async function zipFiles(
  files: ProjectFiles
): Promise<{ base64: string; bytes: number; count: number }> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return { base64: toBase64(bytes), bytes: bytes.length, count: Object.keys(files).length };
}

/** Prompts to hand off = the user's chat messages, in order. */
function promptsOf(project: ProjectRecord): string[] {
  return project.messages.filter((m) => m.role === "user").map((m) => m.content);
}

/**
 * Build the machine-readable hand-off payload for the Code Runner. Unlike
 * {@link buildFittcoreSpec} (human Markdown), this is the structured JSON the
 * Runner ingests: brief docs (idea/brd/prd), the user's prompts, and the whole
 * prototype as a single zip the build agent extracts. Async because zipping is.
 */
export async function buildFittcorePayload(
  project: ProjectRecord,
  orgName?: string
): Promise<FittcorePayload> {
  const files = project.files ?? {};
  const docs = docsFromFiles(project.files);
  const zip = await zipFiles(files);

  return {
    org_id: project.orgId ?? "",
    org_name: orgName ?? "",
    project_id: project.id,
    name: project.name,
    tag: FITTCORE_TAG,
    idea: docs.idea ?? "",
    brd: docs.brd ?? "",
    prd: docs.prd ?? "",
    prompts: promptsOf(project),
    zip_name: `${slug(project.name)}.zip`,
    zip_base64: zip.base64,
    file_count: zip.count,
    zip_bytes: zip.bytes,
  };
}

/**
 * A display-only mirror of the wire body for the "ดู body" preview — identical
 * shape, but the heavy fields are elided (zip as a placeholder, long docs as a
 * char count) so the user sees the FORMAT without zipping on every render.
 */
export function fittcoreBodyPreview(
  project: ProjectRecord,
  orgName?: string
): Record<string, unknown> {
  const files = project.files ?? {};
  const docs = docsFromFiles(project.files);
  const count = Object.keys(files).length;
  const elide = (s?: string) => (s ? `‹${s.length.toLocaleString()} ตัวอักษร›` : "");
  return {
    org_id: project.orgId ?? "",
    org_name: orgName ?? "",
    project_id: project.id,
    name: project.name,
    tag: FITTCORE_TAG,
    idea: elide(docs.idea),
    brd: elide(docs.brd),
    prd: elide(docs.prd),
    prompts: promptsOf(project),
    zip_name: `${slug(project.name)}.zip`,
    zip_base64: `‹base64 · zip ${count} ไฟล์›`,
    file_count: count,
    zip_bytes: 0,
  };
}

function slug(name: string): string {
  return name.replace(/[^\w฀-๿-]+/g, "-").toLowerCase() || "demo";
}

/** Fence `content` so embedded ``` runs never break out of the code block. */
function fence(content: string, lang: string): string {
  let ticks = "```";
  while (content.includes(ticks)) ticks += "`";
  return `${ticks}${lang}\n${content}\n${ticks}`;
}

/**
 * Build a FITTCORE V2 hand-off spec — a Markdown issue body capturing the brief,
 * the requirements (the user's prompts), and the prototype's full source, so the
 * demo can be rebuilt as a production app. No API yet (interim flow): the spec is
 * generated for the user to file as an issue manually.
 */
export function buildFittcoreSpec(project: ProjectRecord): string {
  const files = project.files ?? {};
  const paths = Object.keys(files).sort();

  const requirements =
    project.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.trim())
      .filter(Boolean)
      .map((p, i) => `${i + 1}. ${p}`)
      .join("\n") || "_(ไม่มี prompt บันทึกไว้)_";

  const tree = paths.map((p) => `- \`${p}\``).join("\n") || "_(ยังไม่มีไฟล์)_";

  const sources = paths
    .map((p) => `### \`${p}\`\n\n${fence(files[p], p.split(".").pop() ?? "")}`)
    .join("\n\n");

  return `# ${project.name}

> FITTCORE V2 hand-off — ต้นแบบจาก FITT Builder เพื่อนำไปสร้างเป็นของจริง

## Overview

ต้นแบบนี้สร้างด้วย FITT Builder เป็น Vite SPA ที่รันได้จริงใน browser
ใช้เป็น reference สำหรับสร้าง production app บน FITTCORE V2

## Requirements (จาก prompt ของผู้ใช้)

${requirements}

## Prototype file manifest

${tree}

## Metadata

| field | value |
| --- | --- |
| Project ID | \`${project.id}\` |
| Phase | \`${project.phase}\` |
${project.skillId ? `| Skill template | \`${project.skillId}\` |\n` : ""}| Created | ${project.createdAt} |
| Updated | ${project.updatedAt} |

## Prototype source

${sources}
`;
}

/** Download the spec as a `.fittcore.md` file (interim hand-off mechanism). */
export function downloadFittcoreSpec(project: ProjectRecord): void {
  const blob = new Blob([buildFittcoreSpec(project)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug(project.name)}.fittcore.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
