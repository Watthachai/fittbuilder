import type { ProposalPoint } from "@/lib/proposal";

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

export interface ProposalDraft {
  context: string;
  points: ProposalPoint[];
  excluded: string[];
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
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

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
