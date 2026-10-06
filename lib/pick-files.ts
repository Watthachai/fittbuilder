import { generateText } from "./gemini";

/** Enough for a change that spans a page, its parts and its data; small enough to stay focused. */
const MAX_PICKED = 30;

/**
 * Ask the model which files a request needs, from the project's file list.
 *
 * For a project too large to send whole (lib/iteration-context). A request that
 * names its file — the Wand, an error — is already covered by namedIn; this is
 * for the ones in plain words ("เพิ่มเมนูรายงานภาษี"), where only something that
 * reads the request can tell which pages it is about. It sees paths and line
 * counts only, so it costs a few thousand tokens against the ~1M it replaces.
 */
export async function pickFiles(prompt: string, files: Record<string, string>): Promise<string[]> {
  const list = Object.entries(files)
    .map(([path, content]) => `${path} (${content.split("\n").length} lines)`)
    .join("\n");
  const raw = await generateText({
    system: `You choose which files of a React + Vite project an engineer must read in full to carry out a change request. The project is too large to read whole.
Answer JSON only: {"files": ["path", ...]} — at most ${MAX_PICKED} paths from the list, most important first: the files to change, then the files whose exports, props, types or data those use, then the screen the request talks about.
Use only paths that appear in the list. For a greeting or a question that changes no code, answer {"files": []}.`,
    user: `FILES:\n${list}\n\nREQUEST:\n${prompt}`,
    json: true,
    level: "low",
    maxOutputTokens: 4096,
    abortSignal: AbortSignal.timeout(60_000),
  });
  const parsed = JSON.parse(raw) as { files?: unknown };
  if (!Array.isArray(parsed.files)) throw new Error("เลือกไฟล์ที่เกี่ยวข้องไม่สำเร็จ");
  return parsed.files.filter((p): p is string => typeof p === "string" && p in files).slice(0, MAX_PICKED);
}
