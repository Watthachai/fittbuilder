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
