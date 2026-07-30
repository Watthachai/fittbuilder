/**
 * Streaming parser for the generator's incremental output. The model emits each
 * file as a <file path="...">…</file> block (and optional <delete path="..."/>),
 * with a short prose note before the first file. As chunks arrive we pull out
 * each COMPLETE block so the caller can write it to the live container right away
 * — no waiting for one giant JSON to finish (which is slow and often malformed).
 */

export interface ParsedFile {
  path: string;
  content: string;
}

// Non-greedy content + line-start-agnostic so blocks anywhere in the buffer match
// only once their closing tag has streamed in.
const FILE_RE = /<file\s+path="([^"]+)"\s*>\r?\n?([\s\S]*?)\r?\n?<\/file>/;
const DELETE_RE = /<delete\s+path="([^"]+)"\s*\/>/;
const DEPS_RE = /<deps>\s*([\s\S]*?)\s*<\/deps>/;

export class FileStreamParser {
  private buffer = "";
  private note = "";
  private sawFile = false;

  /** Feed a chunk; return any files/deletes/deps whose blocks are now complete. */
  push(chunk: string): { files: ParsedFile[]; deletes: string[]; deps: string[] } {
    this.buffer += chunk;
    const files: ParsedFile[] = [];
    const deletes: string[] = [];
    const deps: string[] = [];

    // npm packages the build wants installed (extracted independently of files).
    for (;;) {
      const depsMatch = DEPS_RE.exec(this.buffer);
      if (!depsMatch) break;
      for (const name of depsMatch[1].split(/[\s,]+/)) {
        const trimmed = name.trim();
        if (trimmed) deps.push(trimmed);
      }
      this.buffer = this.buffer.slice(0, depsMatch.index) + this.buffer.slice(depsMatch.index + depsMatch[0].length);
    }

    for (;;) {
      const fileMatch = FILE_RE.exec(this.buffer);
      const deleteMatch = DELETE_RE.exec(this.buffer);
      const fileIdx = fileMatch ? fileMatch.index : Infinity;
      const deleteIdx = deleteMatch ? deleteMatch.index : Infinity;
      if (fileIdx === Infinity && deleteIdx === Infinity) break;

      if (fileIdx <= deleteIdx && fileMatch) {
        // Everything before the first file block is the chat note.
        if (!this.sawFile) {
          this.note += this.buffer.slice(0, fileMatch.index);
          this.sawFile = true;
        }
        files.push({ path: fileMatch[1].trim(), content: fileMatch[2] });
        this.buffer = this.buffer.slice(fileMatch.index + fileMatch[0].length);
      } else if (deleteMatch) {
        deletes.push(deleteMatch[1].trim());
        this.buffer = this.buffer.slice(deleteMatch.index + deleteMatch[0].length);
      }
    }

    return { files, deletes, deps };
  }

  /**
   * The chat reply shown to the user. Prefer the trailing summary the model
   * writes AFTER the last file (rich Markdown); fall back to the leading note
   * (and to whatever prose exists when no files were emitted at all). Any
   * dangling partial <file …> fragment left in the buffer is stripped.
   */
  getReply(): string {
    const tail = this.buffer.replace(/<file[\s\S]*$/, "").trim();
    return tail || this.note.trim();
  }
}

export interface SalvagedGeneration {
  files: ParsedFile[];
  deletes: string[];
  /** The model's own summary, so the chat shows prose instead of the raw JSON. */
  note: string;
}

/**
 * Recover files from an answer that came back as the legacy JSON payload
 * (`{"files": …, "deleted": …, "note": …}`) instead of <file> blocks. Returns
 * null when the text isn't that shape.
 *
 * The prompt forbids JSON, but a model that drifts here used to fail SILENTLY:
 * zero blocks parsed → nothing written → the user reads "แก้ไขเรียบร้อยแล้ว"
 * while the app is untouched, and burns turns repeating the request. Same
 * trust-boundary tolerance as sanitizeCss: hold the contract in the prompt,
 * and don't throw away work the model actually did. Callers log when it fires,
 * so the drift stays visible instead of becoming the quiet normal.
 */
export function salvageJsonFiles(raw: string): SalvagedGeneration | null {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const files: ParsedFile[] = [];
  // Both shapes seen in the wild: an array of {path, content} and a
  // {path: contents} map (the original JSON contract).
  if (Array.isArray(obj.files)) {
    for (const entry of obj.files) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const content = typeof e.content === "string" ? e.content : e.contents;
      if (typeof e.path === "string" && typeof content === "string") {
        files.push({ path: e.path, content });
      }
    }
  } else if (typeof obj.files === "object" && obj.files !== null) {
    for (const [path, content] of Object.entries(obj.files)) {
      if (typeof content === "string") files.push({ path, content });
    }
  }

  const deletes = Array.isArray(obj.deleted)
    ? obj.deleted.filter((d): d is string => typeof d === "string")
    : [];
  if (files.length === 0 && deletes.length === 0) return null;

  return { files, deletes, note: typeof obj.note === "string" ? obj.note.trim() : "" };
}
