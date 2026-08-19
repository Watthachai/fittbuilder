import type { PremiumOption } from "./types";

/**
 * Which of the offered upgrades suit THIS demo, and why.
 *
 * The catalogue answers what a domain can sell; it cannot know that this
 * particular shop sells tiles people choose by texture, or that the brief never
 * mentions a warehouse. That is what the documents are for — so the advice is
 * built from the BRD and PRD rather than from the file list, which only ever
 * said what screens exist, never what the business is trying to do.
 *
 * The model RANKS AND EXPLAINS a fixed list. It never invents an option: prices
 * come from each option's own effortDays, and a recommendation for something
 * that is not in the catalogue has no price, no build brief and nothing a
 * partner could put in front of a customer.
 */

export interface PremiumAdvice {
  /** One or two sentences on how far this demo should go, and why. */
  summary: string;
  picks: PremiumPick[];
}

export interface PremiumPick {
  /** An id from the offered list. Anything else is dropped. */
  id: string;
  recommend: boolean;
  /** Why, said about THIS demo — not about the feature in general. */
  reason: string;
}

export const PREMIUM_ADVICE_SYSTEM = `คุณคือที่ปรึกษาที่ช่วยเจ้าของงานตัดสินใจว่า "เวอร์ชัน Premium" ของเดโมนี้ควรมีอะไร

กติกาที่ห้ามฝ่า:
- เลือกได้เฉพาะจากรายการที่ให้มาเท่านั้น ห้ามคิดฟีเจอร์ใหม่ ห้ามเปลี่ยนชื่อข้อ
- ตอบเป็น id ที่ให้มาเป๊ะๆ ทุกข้อในรายการต้องมีคำตอบ ไม่ว่าจะแนะนำหรือไม่
- เหตุผลต้องพูดถึง "เดโมนี้" โดยเฉพาะ อ้างจากเอกสารหรือหน้าจอที่มีจริง
  ห้ามอธิบายว่าฟีเจอร์นั้นดียังไงโดยทั่วไป
- ข้อที่ไม่แนะนำก็ต้องบอกเหตุผล และเหตุผลที่ดีที่สุดคือ "ข้อมูลที่จำเป็นยังไม่มีในเดโมนี้"
- อย่าแนะนำทุกข้อ การเลือกทุกอย่างคือการไม่ได้เลือก — ปกติ 2-4 ข้อกำลังดี

ตอบเป็น JSON เท่านั้น:
{"summary":"...","picks":[{"id":"...","recommend":true,"reason":"..."}]}`;

export function buildPremiumAdviceUser(input: {
  options: PremiumOption[];
  brd: string;
  prd: string;
  screens: string[];
  orgContext: string;
}): string {
  const list = input.options
    .map((o) => `- id: ${o.id} | ${o.name} (~${o.effortDays} วัน) — ${o.pitch}`)
    .join("\n");
  return [
    "รายการที่ขายเพิ่มได้สำหรับเดโมนี้ (เลือกจากนี้เท่านั้น):",
    list,
    "",
    input.screens.length ? `หน้าจอที่มีในเดโม: ${input.screens.join(", ")}` : "",
    input.orgContext ? `\n${input.orgContext}` : "",
    input.brd ? `\n--- BRD ---\n${input.brd.slice(0, 8_000)}` : "",
    input.prd ? `\n--- PRD ---\n${input.prd.slice(0, 8_000)}` : "",
    "",
    "ประเมินว่าเวอร์ชัน Premium ของเดโมนี้ควรมีข้อไหนบ้าง และทำไม",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Parse the model's answer, keeping only ids that were actually offered.
 *
 * A pick for something not in the list is not a suggestion, it is a price with
 * no product behind it — dropped rather than shown.
 */
export function parsePremiumAdvice(raw: string, offered: PremiumOption[]): PremiumAdvice | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const valid = new Set(offered.map((x) => x.id));
  const seen = new Set<string>();
  const picks: PremiumPick[] = [];
  for (const raw of Array.isArray(o.picks) ? o.picks : []) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const id = typeof p.id === "string" ? p.id : "";
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    picks.push({
      id,
      recommend: p.recommend === true,
      reason: typeof p.reason === "string" ? p.reason.trim() : "",
    });
  }
  if (picks.length === 0) return null;
  return {
    summary: typeof o.summary === "string" ? o.summary.trim() : "",
    picks,
  };
}
