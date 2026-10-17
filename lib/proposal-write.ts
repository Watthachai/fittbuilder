import type { ProposalPoint, ScreenDoc } from "@/lib/proposal";

/**
 * Writing the argument of a proposal from what was actually built.
 *
 * The model gets the brief, the screens that exist, and the sentences the
 * quotation already uses to describe them — never a blank page. It is asked for
 * problem/feature/outcome triples rather than prose because the failure mode of
 * a generated proposal is fluent paragraphs that name no problem: three short
 * fields make an empty claim visible while it can still be deleted.
 */

export const PROPOSAL_SYSTEM = `คุณคือที่ปรึกษาที่เขียน "ข้อเสนอโครงการ" ให้ลูกค้าองค์กรไทยอ่าน

เป้าหมาย: อธิบายว่าระบบที่สร้างเสร็จแล้วนี้ แก้ปัญหาอะไรของลูกค้าได้บ้าง

กติกา
- เขียนภาษาไทย ภาษาธุรกิจ ไม่ใช่ภาษาโปรแกรมเมอร์ ห้ามใช้ชื่อไฟล์ ชื่อคอมโพเนนต์ หรือศัพท์เทคนิค
- อ้างได้เฉพาะหน้าจอและความสามารถที่มีอยู่ในรายการที่ให้มา ห้ามเพิ่มฟีเจอร์ที่ไม่มี
- "problem" ต้องเป็นความเจ็บปวดของลูกค้าก่อนมีระบบนี้ ไม่ใช่คำอธิบายฟีเจอร์ที่เขียนกลับด้าน
- "outcome" ต้องเป็นสิ่งที่วัดหรือสังเกตได้ เช่น เวลาที่ลดลง งานที่ไม่ต้องทำซ้ำ ข้อมูลที่ไม่ตกหล่น
- ห้ามใส่ตัวเลขราคา ค่าใช้จ่าย หรือ ROI เป็นบาท — เอกสารนี้ไม่พูดเรื่องเงิน
- ห้ามสัญญาเรื่องความปลอดภัย มาตรฐาน หรือการรับรองใดๆ ที่ไม่ได้อยู่ในข้อมูลที่ให้มา
- ถ้าข้อมูลไม่พอจะเขียนข้อไหนให้ข้ามข้อนั้น ดีกว่าเดา

ตอบเป็น JSON เท่านั้น:
{
  "context": "2-4 ประโยค สภาพการทำงานก่อนมีระบบนี้",
  "points": [
    { "problem": "...", "feature": "...", "outcome": "..." }
  ],
  "excluded": ["สิ่งที่ไม่รวมในเฟสนี้ ..."]
}`;

/**
 * The screen manual, written apart from the argument and a batch at a time.
 *
 * One answer for every screen ran out of room: Sechin's 143 screens hit the
 * length cap seven times out of seven, and a cut-off answer parses as nothing.
 * A batch that fails now loses its own screens only, and pressing again writes
 * just the ones still empty.
 */
export const SCREEN_DOCS_SYSTEM = `คุณคือที่ปรึกษาที่เขียน "คู่มือการใช้งานรายหน้า" ในข้อเสนอโครงการ ให้ลูกค้าองค์กรไทยอ่าน

กติกา
- เขียนภาษาไทย ภาษาธุรกิจ ไม่ใช่ภาษาโปรแกรมเมอร์ ห้ามใช้ชื่อไฟล์ ชื่อคอมโพเนนต์ หรือศัพท์เทคนิค
- เขียนเฉพาะหน้าที่อยู่ในรายการ "หน้าที่ต้องเขียนคู่มือ" ให้ครบทุกหน้า หน้าอื่นมีไว้ให้เห็นภาพรวมเท่านั้น
- อ้างได้เฉพาะสิ่งที่อยู่ในข้อมูลที่ให้มา ห้ามเพิ่มฟีเจอร์ที่ไม่มี
- ห้ามใส่ราคา ค่าใช้จ่าย หรือตัวเลขที่ไม่ได้อยู่ในข้อมูล

ตอบเป็น JSON เท่านั้น:
{
  "screens": {
    "<ชื่อหน้าตามรายการ ตรงตัวอักษร>": {
      "does": "หน้านี้มีไว้ทำอะไร 1-2 ประโยค",
      "how": "ขั้นตอนการใช้งานเรียงตามลำดับจริง หนึ่งขั้นต่อบรรทัด (คั่นด้วย \\n) 2-5 ขั้น ห้ามใส่เลขนำหน้า",
      "result": "จบหน้านี้แล้วได้อะไร 1-2 ประโยค"
    }
  }
}

ใช้ชื่อหน้าเป็น key ตรงตัวอักษร ห้ามตั้งชื่อใหม่`;

/** Screens one answer can document without running into the length cap. */
export const SCREEN_BATCH = 25;

/** The screens to document, cut into batches written side by side. */
export function screenBatches(names: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < names.length; i += SCREEN_BATCH) out.push(names.slice(i, i + SCREEN_BATCH));
  return out;
}

const CHAR_BUDGET = 6_000;

const clip = (s: string, n: number): string =>
  s.length <= n ? s : s.slice(0, n) + "\n…(ตัดทอน)";

export function buildProposalUser(input: {
  projectName: string;
  brd: string;
  prd: string;
  /** Screen name → what it does, as the quotation already describes it. */
  screens: { name: string; note: string }[];
  /** "จากหน้า X กด Y → Z" for every step the walk actually recorded. */
  journey: string[];
  orgContext: string;
}): string {
  const screens = input.screens
    .map((s) => (s.note ? `- ${s.name} — ${s.note}` : `- ${s.name}`))
    .join("\n");
  return [
    `ชื่อระบบ: ${input.projectName || "(ไม่ระบุ)"}`,
    input.orgContext ? `\nบริบทองค์กรของลูกค้า\n${input.orgContext}` : "",
    input.brd ? `\n--- BRD ---\n${clip(input.brd, CHAR_BUDGET)}` : "",
    input.prd ? `\n--- PRD ---\n${clip(input.prd, CHAR_BUDGET)}` : "",
    screens ? `\n--- หน้าจอที่มีอยู่จริงในระบบ ---\n${screens}` : "",
    // The demonstrated walk is the strongest evidence in the whole prompt: it
    // is the only part that came from running the app rather than reading it.
    input.journey.length
      ? `\n--- เส้นทางการใช้งานที่บันทึกจากการเดินระบบจริง ---\n${input.journey.join("\n")}`
      : "",
    "\nเขียนข้อเสนอตามกติกา ตอบ JSON อย่างเดียว",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Lists every screen so the batch reads in context, then names the ones to write. */
export function buildScreenDocsUser(input: {
  projectName: string;
  screens: { name: string; note: string }[];
  journey: string[];
  /** This batch: the screens to document. */
  write: string[];
}): string {
  const screens = input.screens
    .map((s) => (s.note ? `- ${s.name} — ${s.note}` : `- ${s.name}`))
    .join("\n");
  return [
    `ชื่อระบบ: ${input.projectName || "(ไม่ระบุ)"}`,
    `\n--- หน้าจอทั้งหมดในระบบ ---\n${screens}`,
    input.journey.length
      ? `\n--- เส้นทางการใช้งานที่บันทึกจากการเดินระบบจริง ---\n${input.journey.join("\n")}`
      : "",
    `\n--- หน้าที่ต้องเขียนคู่มือ (${input.write.length} หน้า) ---\n${input.write.map((n) => `- ${n}`).join("\n")}`,
    "\nเขียนคู่มือให้ครบทุกหน้าในรายการนี้ ตอบ JSON อย่างเดียว",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface ProposalDraft {
  context: string;
  points: ProposalPoint[];
  excluded: string[];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The answer as an object, or null when it is not one — cut off, or not JSON. */
function answerObject(raw: string): Record<string, unknown> | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
}

/**
 * Read the model's answer, keeping only what is usable.
 *
 * A point missing either its problem or its feature is dropped rather than
 * printed half-empty — a proposal with a blank cell in front of a customer is
 * worse than a shorter proposal. Returns null when nothing survives, so the
 * caller can say so instead of silently replacing the document with emptiness.
 */
export function parseProposalDraft(raw: string): ProposalDraft | null {
  const o = answerObject(raw);
  if (!o) return null;

  const points: ProposalPoint[] = (Array.isArray(o.points) ? o.points : [])
    .map((raw, i) => {
      const p = (raw ?? {}) as Record<string, unknown>;
      return {
        id: `ai-${i}`,
        problem: str(p.problem),
        feature: str(p.feature),
        outcome: str(p.outcome),
      };
    })
    .filter((p) => p.problem && p.feature);

  const excluded = (Array.isArray(o.excluded) ? o.excluded : [])
    .map(str)
    .filter(Boolean)
    .slice(0, 12);

  const context = str(o.context);
  if (!context && points.length === 0) return null;
  return { context, points, excluded };
}

/**
 * Read one batch of the screen manual.
 *
 * Keys are clamped to the names that were asked about — same rule as
 * parseScreenSpecs, because a name the model invented would print as a page
 * the system does not have. Null when the answer is not an object, so the
 * batch counts as failed rather than as written.
 */
export function parseScreenDocs(raw: string, asked: string[]): Record<string, ScreenDoc> | null {
  const o = answerObject(raw);
  if (!o) return null;
  const wanted = new Set(asked.map((n) => n.trim()).filter(Boolean));
  const field = (v: unknown) => str(v).slice(0, 600);
  const screens: Record<string, ScreenDoc> = {};
  for (const [name, raw2] of Object.entries(
    o.screens && typeof o.screens === "object" && !Array.isArray(o.screens)
      ? (o.screens as Record<string, unknown>)
      : {}
  )) {
    const key = name.trim();
    if (!wanted.has(key)) continue;
    const d = (raw2 ?? {}) as Record<string, unknown>;
    const entry: ScreenDoc = { does: field(d.does), how: field(d.how), result: field(d.result) };
    if (entry.does || entry.how || entry.result) screens[key] = entry;
  }
  return screens;
}
