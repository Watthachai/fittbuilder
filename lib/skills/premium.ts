import type { PremiumOption, SkillTemplate } from "./types";

/**
 * What a project can sell on top of the standard build, and which of those it
 * can actually sell.
 *
 * Two questions, deliberately answered in different places:
 *
 *   WHAT Premium can be is a property of the DOMAIN — written once per skill,
 *   named, and costed, because quotations price per module and MA charges per
 *   module per month. An upgrade the model invents fresh each time cannot be
 *   put on a piece of paper a customer signs.
 *
 *   WHICH ones apply is a property of THIS project — a demo with no stock
 *   levels cannot be sold a reorder forecast. That is decided here, from the
 *   screens and files the demo already has, not by re-reading the whole
 *   codebase every time.
 */

/**
 * Upgrades that are worth money in every domain, so no skill repeats them.
 *
 * Each is the same shape of jump the domain-specific ones make: from a screen
 * one person looks at, to something the business runs on — work that survives
 * more than one person, output that leaves the system, answers to questions
 * nobody built a screen for.
 */
export const CROSS_DOMAIN_PREMIUM: PremiumOption[] = [
  {
    id: "teamflow",
    name: "อนุมัติเป็นทีม พร้อมสิทธิ์ตามบทบาทและประวัติการแก้ไข",
    pitch:
      "ระบบที่คนเดียวใช้ได้ กับระบบที่ทั้งแผนกใช้ได้ ต่างกันตรงที่ใครอนุมัติได้ ใครเห็นอะไร และย้อนดูได้ไหมว่าใครแก้",
    requires: [],
    effortDays: 4,
    build:
      "บทบาทอย่างน้อยสามระดับ + คิวรออนุมัติที่เห็นว่าค้างที่ใคร + บันทึกการแก้ไขที่ย้อนดูค่าเดิมได้",
  },
  {
    id: "handoff",
    name: "ออกเอกสารและแจ้งเตือนออกนอกระบบ",
    pitch:
      "งานไม่ได้จบบนหน้าจอ ลูกค้าต้องได้ไฟล์ หัวหน้าต้องได้ข้อความ และบัญชีต้องได้ตัวเลข",
    requires: [],
    effortDays: 3,
    build:
      "เอกสาร PDF ที่จัดหน้ามาให้พิมพ์ได้จริง + แจ้งเตือนเข้า LINE/อีเมล + ส่งออกเป็นไฟล์ที่โปรแกรมบัญชีอ่านได้",
  },
  {
    id: "askai",
    name: "ผู้ช่วย AI ประจำระบบ",
    pitch:
      "คำถามที่คนอยากรู้จริงๆ ไม่เคยตรงกับหน้าจอที่มีอยู่พอดี และไม่มีใครสร้างรายงานใหม่ทุกครั้งที่มีคนสงสัย",
    requires: [],
    effortDays: 4,
    build:
      "ช่องถามเป็นภาษาไทยที่ตอบจากข้อมูลในเดโมเท่านั้น ห้ามแต่งตัวเลข พร้อมชี้ว่าคำตอบมาจากรายการไหน",
  },
];

/**
 * The options this project can be sold, most substantial first.
 *
 * `haystack` is what the demo demonstrably has — screen names and file paths.
 * An option is offered when every word it requires appears somewhere in there,
 * so "reorder forecast" stays hidden until the demo actually tracks stock.
 * Matching is loose on purpose: a false positive costs a line in a picker, a
 * false negative costs a sale nobody knew was available.
 */
export function premiumOptionsFor(
  skill: SkillTemplate | undefined,
  haystack: string[]
): PremiumOption[] {
  const hay = haystack.join(" ").toLowerCase();
  const all = [...(skill?.premiumOptions ?? []), ...CROSS_DOMAIN_PREMIUM];
  return all
    .filter((o) => o.requires.every((r) => hay.includes(r.toLowerCase())))
    .sort((a, b) => b.effortDays - a.effortDays);
}

/**
 * The chosen upgrades, as the brief the generator builds from.
 *
 * `build` and not `pitch` leads each line: the model is being told what to
 * make, and the sales language is for the person choosing, not the one
 * building.
 */
export function buildPremiumContext(options: PremiumOption[]): string {
  if (options.length === 0) return "";
  const lines = options.map((o) => `- **${o.name}** — ${o.build}`);
  return [
    "## เวอร์ชัน Premium ของเดโมนี้",
    "สร้างสิ่งเหล่านี้ให้ทำงานได้จริงบนข้อมูลที่มีอยู่ในเดโม (ห้ามเป็นปุ่มหลอกหรือหน้าจอเปล่า):",
    ...lines,
    "",
    "ทุกอย่างที่เวอร์ชันปกติทำได้ ต้องยังทำได้เหมือนเดิม — นี่คือการต่อยอด ไม่ใช่การเขียนใหม่",
  ].join("\n");
}
