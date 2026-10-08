/**
 * A change request with many items, done one item per turn.
 *
 * One turn has a wall clock (ATTEMPT_TIMEOUT_MS in /api/generate) and an output
 * ceiling. A message asking for ten changes spends both before it reaches the
 * fourth or fifth, and the turn used to end with "แก้ไขเรียบร้อยแล้ว" anyway — so
 * people sent the same message again and again. Split into tasks, each item gets
 * a whole turn of its own, and the checklist in the chat says which are done.
 */

export type TaskStatus = "pending" | "running" | "done" | "partial" | "failed";

export interface BuildTask {
  id: string;
  title: string;
  /** The item in the user's own words, with whatever detail they gave for it. */
  detail: string;
  status: TaskStatus;
  /** Why a task is not done, or what its turn said when it is. */
  note?: string;
}

/** How a generation turn ended early (null: it finished on its own). */
export type TurnCut = "time" | "tokens" | "error";

export const TURN_CUT_LABEL: Record<TurnCut, string> = {
  time: "หมดเวลาของรอบ",
  tokens: "คำตอบยาวเกินเพดานของรอบ",
  error: "การเชื่อมต่อกับ AI หลุดกลางทาง",
};

const LIST_LINE = /^\s*(?:\d{1,2}\s*[.)\]:]|[-*•▪●]|ข้อ\s*\d+)\s*\S/;
const MULTI_TASK_MIN_ITEMS = 3;
const MULTI_TASK_MIN_CHARS = 700;

/**
 * Worth splitting: a list of three or more items, or a request long enough to
 * hold several. The splitter itself decides the rest — it may answer with one
 * task, and then the message runs as an ordinary turn.
 */
export function looksMultiTask(text: string): boolean {
  const items = text.split("\n").filter((line) => LIST_LINE.test(line)).length;
  return items >= MULTI_TASK_MIN_ITEMS || text.trim().length >= MULTI_TASK_MIN_CHARS;
}

/** The line every task turn ends its reply with (asked for in taskTurnPrompt). */
const VERDICT = /^\s*สถานะงาน\s*:\s*(ไม่ครบ|ครบ)\s*(?:[—–-]\s*(.*))?$/;

/**
 * What the model said about its own task: done, or not done and why. Its
 * reply minus that line is the note for the chat. Null when it said neither —
 * the turn's outcome then rests on whether it ran to the end.
 */
export function parseTaskVerdict(reply: string): { complete: boolean | null; reason: string; note: string } {
  const lines = reply.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = VERDICT.exec(lines[i]);
    if (!m) continue;
    const note = [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n").trim();
    return { complete: m[1] === "ครบ", reason: (m[2] ?? "").trim(), note };
  }
  return { complete: null, reason: "", note: reply.trim() };
}

/** The prompt for one task: the whole request for context, this item as the job. */
export function taskTurnPrompt(request: string, tasks: BuildTask[], index: number): string {
  const task = tasks[index];
  const list = tasks
    .map((t, i) => {
      const mark = i === index ? "← รอบนี้" : t.status === "done" ? "(ทำแล้ว)" : "(ทำในรอบอื่น)";
      return `${i + 1}. ${t.title} ${mark}`;
    })
    .join("\n");
  return `คำสั่งนี้มี ${tasks.length} ข้อ ระบบทำทีละข้อ รอบละหนึ่งข้อ

คำสั่งเต็มจากผู้ใช้:
"""
${request}
"""

รายการทั้งหมด:
${list}

รอบนี้ทำเฉพาะข้อ ${index + 1}: ${task.title}
${task.detail}

กติกา:
- ทำข้อนี้ให้ครบทุกรายละเอียดที่ผู้ใช้ขอ ข้อมูลตัวอย่างต้องครบตามจำนวนที่ขอ ห้ามย่อหรือใส่แค่บางส่วน
- ไม่ต้องทำข้ออื่นในรอบนี้ และห้ามย้อนแก้จนงานของข้อที่ทำแล้วหายไป
- จบคำตอบด้วยบรรทัดสุดท้ายแบบนี้บรรทัดเดียว: "สถานะงาน: ครบ" หรือ "สถานะงาน: ไม่ครบ — <ยังขาดอะไร>"`;
}

/** Pick up where a cut turn stopped: same request, told what already landed. */
export function continuationPrompt(prompt: string, cut: TurnCut, written: string[]): string {
  return `รอบก่อนหยุดกลางทางเพราะ${TURN_CUT_LABEL[cut]} งานยังไม่ครบ

คำสั่งเดิม:
"""
${prompt}
"""

ไฟล์ที่เขียนไปแล้วในรอบนั้น (อยู่ในโปรเจกต์แล้ว): ${written.length ? written.join(", ") : "ยังไม่มี"}

ทำส่วนที่ยังไม่เสร็จให้ครบ ไฟล์ที่เขียนเสร็จแล้วไม่ต้องเขียนซ้ำ เว้นแต่ยังทำไม่ครบ`;
}

/** How one generation turn in the studio ended. */
export interface TurnOutcome {
  status: "done" | "cut" | "failed" | "cancelled" | "busy";
  /** The turn's reply, or the error for a failed one. */
  note: string;
  cut: TurnCut | null;
  /** Paths the turn wrote before it ended. */
  written: string[];
}

/**
 * The prompt for one more turn on a task, or null when there is nothing more
 * to try: the task is done, or the person stopped it. A cut turn continues
 * from what it wrote, a failed one tries again, and one that said it was not
 * complete is told what it said it still lacks.
 */
export function nextAttempt(prompt: string, out: TurnOutcome): string | null {
  if (out.status === "cancelled" || out.status === "busy") return null;
  if (out.status === "cut") return continuationPrompt(prompt, out.cut ?? "error", out.written);
  if (out.status === "failed") return prompt;
  const verdict = parseTaskVerdict(out.note);
  if (verdict.complete !== false) return null;
  return `${prompt}

รอบก่อนรายงานว่ายังไม่ครบ: ${verdict.reason || "ไม่ได้บอกว่าขาดอะไร"}
ทำส่วนที่ยังขาดให้ครบในรอบนี้`;
}

/** Where a task stands after its last turn. */
export function taskOutcome(out: TurnOutcome): Pick<BuildTask, "status" | "note"> {
  if (out.status === "cancelled" || out.status === "busy") return { status: "pending", note: undefined };
  if (out.status === "failed") return { status: "failed", note: out.note };
  if (out.status === "cut") {
    return { status: "partial", note: `หยุดกลางทางเพราะ${TURN_CUT_LABEL[out.cut ?? "error"]}` };
  }
  const verdict = parseTaskVerdict(out.note);
  if (verdict.complete === false) return { status: "partial", note: verdict.reason || "AI รายงานว่ายังไม่ครบ" };
  return { status: "done", note: excerpt(verdict.note) };
}

const EXCERPT_CHARS = 160;

/** The reply as one short line for the checklist — a first line alone is often just "ทำแล้ว:". */
function excerpt(note: string): string | undefined {
  const flat = note
    .replace(/[*_`#>]/g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .join(" · ");
  if (!flat) return undefined;
  return flat.length > EXCERPT_CHARS ? `${flat.slice(0, EXCERPT_CHARS - 1)}…` : flat;
}

export function taskProgress(tasks: BuildTask[]): { done: number; total: number; open: BuildTask[] } {
  return {
    done: tasks.filter((t) => t.status === "done").length,
    total: tasks.length,
    open: tasks.filter((t) => t.status !== "done"),
  };
}
