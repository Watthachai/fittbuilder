/**
 * Placing an edit turn's change into the file it belongs to.
 *
 * An edit turn used to send back every file it touched in full: three quarters
 * of what it wrote was code it had only copied, every copied line was one it
 * could quietly change, and the turn took as long as the copying did. Now it
 * names the text it replaces and what replaces it, and the swap happens here —
 * by string, not by model — so nothing outside that text can change.
 */

/** One replacement: `find` exactly as it stands in the file, `replace` what goes there. */
export interface EditPair {
  find: string;
  replace: string;
}

/**
 * Why an edit could not be placed. `not-found`: the text is not in the file as
 * given. `ambiguous`: it is there more than once, so where it was meant is a
 * guess. `empty`: there was nothing to look for.
 */
export type EditMiss = "not-found" | "ambiguous" | "empty";

export type EditResult = { ok: true; content: string } | { ok: false; pair: number; reason: EditMiss };

/**
 * Apply `pairs` to `content` in order, each against what the one before left.
 *
 * All or nothing: one pair that cannot be placed exactly leaves the file as it
 * was, because half a change is a file nobody asked for.
 */
export function applyEdit(content: string, pairs: EditPair[]): EditResult {
  if (pairs.length === 0) return { ok: false, pair: 0, reason: "empty" };
  let out = content;
  for (const [i, { find, replace }] of pairs.entries()) {
    if (find === "") return { ok: false, pair: i, reason: "empty" };
    const at = out.indexOf(find);
    if (at === -1) return { ok: false, pair: i, reason: "not-found" };
    if (out.indexOf(find, at + 1) !== -1) return { ok: false, pair: i, reason: "ambiguous" };
    // Removing lines takes their line break with them, or a blank line is left
    // where they were.
    const end = replace === "" && out[at + find.length] === "\n" ? at + find.length + 1 : at + find.length;
    out = out.slice(0, at) + replace + out.slice(end);
  }
  return { ok: true, content: out };
}

/** An edit that could not be placed, kept to try once more. `missing`: there is no such file. */
export interface FailedEdit {
  path: string;
  pairs: EditPair[];
  /** Which pair could not be placed (0-based). */
  pair: number;
  reason: EditMiss | "missing";
}

const MISS_TEXT: Record<EditMiss, string> = {
  "not-found": "is not in the file",
  ambiguous: "matches more than one place — take in a neighbouring line to make it unique",
  empty: "is empty — there is nothing to look for",
};

const editBlock = ({ path, pairs }: FailedEdit) =>
  [
    `<edit path="${path}">`,
    ...pairs.flatMap(({ find, replace }) => [`<find>\n${find}\n</find>`, `<replace>\n${replace}\n</replace>`]),
    "</edit>",
  ].join("\n");

/**
 * The one more try an edit turn gets for the edits it could not place: what it
 * sent, which <find> missed and why, and each file exactly as it is now. The
 * answer may only be edits to those files — never the file written again, which
 * is the copying this whole path exists to stop.
 */
export function buildEditRepairPrompt(failed: FailedEdit[], files: Record<string, string>): string {
  const sections = failed.map((miss) => {
    const why = miss.reason === "missing" ? "there is no file at this path" : `<find> #${miss.pair + 1} ${MISS_TEXT[miss.reason]}`;
    return `=== ${miss.path} ===\nFailed: ${why}.\nYour edit was:\n${editBlock(miss)}\n\nThe file now:\n--- ${miss.path} ---\n${files[miss.path] ?? ""}`;
  });
  return `SOME OF YOUR EDITS COULD NOT BE PLACED. Every <find> has to match the current file exactly once, character for character; these did not, so the files below were NOT changed at all.

For each file: the edit you sent, which <find> failed and why, and the file exactly as it is now. Send ONE <edit> block per file that makes the same change, copying every <find> from the file as shown here. Send nothing else — no <file> blocks, no other files, no summary.

${sections.join("\n\n")}`;
}

/** What the chat says about files whose edits could not be placed: they were left exactly as they were. */
export function unplacedNote(paths: string[]): string {
  const files = paths.map((p) => `\`${p}\``).join(", ");
  return (
    `ยังแก้ไม่ครบ — หาโค้ดท่อนที่จะแก้ใน ${files} ไม่เจอ ` +
    `${paths.length > 1 ? "ไฟล์เหล่านี้" : "ไฟล์นี้"}จึงยังเหมือนเดิมทุกตัวอักษร ลองสั่งเฉพาะจุดนั้นอีกครั้ง`
  );
}
