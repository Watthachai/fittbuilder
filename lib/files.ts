import type { GenerationResult, ProjectFiles } from "./types";

/** Files every generated project must contain (Vite + React + TypeScript). */
export const REQUIRED_FILES = [
  "package.json",
  "index.html",
  "src/main.tsx",
  "src/App.tsx",
  "src/index.css",
] as const;

/** Hard cap on total generated output (PRD §6.4 rule 8). */
const MAX_TOTAL_BYTES = 400 * 1024;
const MAX_FILE_COUNT = 60;

export class GenerationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationParseError";
  }
}

export function isSafePath(path: string): boolean {
  if (path.length === 0 || path.length > 200) return false;
  if (path.startsWith("/") || path.startsWith("~")) return false;
  if (path.includes("..") || path.includes("\\") || path.includes("\0")) return false;
  return /^[\w@./ -]+$/.test(path);
}

export function normalizePath(path: string): string {
  return path.replace(/^\.\//, "").trim();
}

/**
 * Parse and validate raw model output into a GenerationResult.
 * Tolerates markdown fences even though the prompt forbids them.
 */
export function parseGeneration(raw: string, options: { iteration: boolean }): GenerationResult {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) text = fenced[1];
  // Some models prepend prose before the JSON object — cut to the first brace.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new GenerationParseError("Model output contained no JSON object");
  }
  text = text.slice(firstBrace, lastBrace + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GenerationParseError("Model output was not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new GenerationParseError("Model output was not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;

  const rawFiles = obj.files;
  if (typeof rawFiles !== "object" || rawFiles === null || Array.isArray(rawFiles)) {
    throw new GenerationParseError('Model output is missing the "files" object');
  }

  const files: ProjectFiles = {};
  let totalBytes = 0;
  for (const [key, value] of Object.entries(rawFiles as Record<string, unknown>)) {
    if (typeof value !== "string") {
      throw new GenerationParseError(`File "${key}" contents must be a string`);
    }
    const path = normalizePath(key);
    if (!isSafePath(path)) {
      throw new GenerationParseError(`Unsafe file path in model output: "${key}"`);
    }
    totalBytes += value.length;
    files[path] = value;
  }

  if (Object.keys(files).length === 0) {
    throw new GenerationParseError("Model produced no files");
  }
  if (Object.keys(files).length > MAX_FILE_COUNT) {
    throw new GenerationParseError("Model produced too many files");
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new GenerationParseError("Generated project exceeds the size limit");
  }

  if (!options.iteration) {
    const missing = REQUIRED_FILES.filter((f) => !(f in files));
    if (missing.length > 0) {
      throw new GenerationParseError(`Generated project is missing: ${missing.join(", ")}`);
    }
  }

  const deleted = Array.isArray(obj.deleted)
    ? (obj.deleted as unknown[])
        .filter((d): d is string => typeof d === "string")
        .map(normalizePath)
        .filter(isSafePath)
    : undefined;

  const note =
    typeof obj.note === "string" && obj.note.trim().length > 0
      ? obj.note.trim()
      : options.iteration
        ? "แก้ไขเรียบร้อยแล้ว"
        : "สร้าง demo เรียบร้อยแล้ว";

  return { note, files, deleted };
}

/** Apply an iteration result on top of the previous file set. */
export function mergeFiles(
  previous: ProjectFiles,
  changed: ProjectFiles,
  deleted?: string[]
): ProjectFiles {
  const merged: ProjectFiles = { ...previous, ...changed };
  for (const path of deleted ?? []) {
    delete merged[path];
  }
  return merged;
}

/**
 * WebContainer FileSystemTree shape (subset — files only; @webcontainer/api
 * accepts this structurally via `mount`).
 */
export interface FileSystemTree {
  [name: string]:
    | { file: { contents: string } }
    | { directory: FileSystemTree };
}

/** Convert a flat path→contents map into a nested FileSystemTree. */
export function toFileSystemTree(files: ProjectFiles): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const segments = path.split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      const existing = node[segment];
      if (existing && "directory" in existing) {
        node = existing.directory;
      } else {
        const dir: FileSystemTree = {};
        node[segment] = { directory: dir };
        node = dir;
      }
    }
    node[segments[segments.length - 1]] = { file: { contents } };
  }
  return root;
}
