import type { FileChange, ProjectFiles } from "./types";

/**
 * Tailwind here is the CDN browser build, not an installed package — so the v4
 * build-time directives `@import "tailwindcss"` / `@tailwind …` make Vite's
 * PostCSS try (and fail) to resolve a "tailwindcss" module, crashing the dev
 * server. Strip them from any .css so generated/cached projects can't 500.
 */
export function sanitizeCss(content: string): string {
  return content
    .replace(/^[ \t]*@import\s+["']tailwindcss[^"']*["'];?[ \t]*\r?\n?/gim, "")
    .replace(/^[ \t]*@tailwind\s+[^;]+;[ \t]*\r?\n?/gim, "");
}

/** Apply sanitizeCss to every .css entry in a file map (returns a new map). */
export function sanitizeFiles(files: ProjectFiles): ProjectFiles {
  const out: ProjectFiles = {};
  for (const [path, content] of Object.entries(files)) {
    out[path] = path.endsWith(".css") ? sanitizeCss(content) : content;
  }
  return out;
}

/** Per-file content cap stored in a changeset (keeps localStorage + the diff modal light). */
const CHANGE_FILE_CAP = 40_000;

function capContent(value: string | null): string | null {
  if (value === null) return null;
  return value.length > CHANGE_FILE_CAP ? `${value.slice(0, CHANGE_FILE_CAP)}\n… (ตัดทอน)` : value;
}

/**
 * Diff two file maps into a changeset (only paths whose content differs), for the
 * "ดูการเปลี่ยนแปลง" viewer. `before` null on a path = added; `after` null = deleted.
 */
export function computeChanges(before: ProjectFiles | null, after: ProjectFiles): FileChange[] {
  const prev = before ?? {};
  const paths = [...new Set([...Object.keys(prev), ...Object.keys(after)])].sort();
  const changes: FileChange[] = [];
  for (const path of paths) {
    const b = prev[path] ?? null;
    const a = after[path] ?? null;
    if (b === a) continue;
    changes.push({ path, before: capContent(b), after: capContent(a) });
  }
  return changes;
}

/**
 * The generated demo always carries its product name in index.html's <title>
 * (e.g. "ExpenseFlow"). Pull a concise name out of the assembled files so the
 * project can be titled with the product, not the raw prompt. Returns null when
 * no usable title exists (so the caller keeps the current name).
 */
export function deriveProductName(files: ProjectFiles): string | null {
  const html = files["index.html"];
  if (!html) return null;
  const match = html.match(/<title>([^<]*)<\/title>/i);
  if (!match) return null;
  // Drop boilerplate suffixes ("My App — Dashboard", "Foo | Vite") and the
  // generic scaffold title, then collapse whitespace.
  const name = match[1]
    .replace(/\s*[|–—•:-]\s*(dashboard|app|demo|vite|react).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || /^(fitt demo|vite|react|app|untitled|document)$/i.test(name)) return null;
  // Keep it short (2–4 words is the product-name shape); cap length defensively.
  return name.split(" ").slice(0, 4).join(" ").slice(0, 60);
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
