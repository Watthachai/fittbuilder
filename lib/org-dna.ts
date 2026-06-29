import type { OrgArchetype, OrgDna } from "@/lib/types";

/** The 4 free-text Org DNA blocks (archetype/notes handled separately). */
export type DnaTextKey = "decisionRights" | "information" | "motivators" | "structure";

/** The 4 Org DNA building blocks (Strategy& / PwC) — metadata for the editor. */
export const DNA_BLOCKS: { key: DnaTextKey; th: string; hint: string }[] = [
  {
    key: "decisionRights",
    th: "สิทธิการตัดสินใจ (Decision Rights)",
    hint: "ใครมีอำนาจตัดสินใจเรื่องใด เรื่องใดต้องรออนุมัติ มีขั้นตอนซ้ำซ้อนไหม",
  },
  {
    key: "information",
    th: "ระบบข้อมูลข่าวสาร (Information)",
    hint: "ข้อมูลไหลข้ามสายงานดีไหม เข้าใจเป้าหมายร่วมกันไหม วัดผล (KPI) อย่างไร",
  },
  {
    key: "motivators",
    th: "สิ่งจูงใจ (Motivators)",
    hint: "ผลตอบแทน รางวัล เส้นทางเติบโต และแรงจูงใจที่กระตุ้นให้สร้างผลงาน",
  },
  {
    key: "structure",
    th: "โครงสร้างองค์กร (Structure)",
    hint: "แผนผังองค์กร จำนวนลำดับขั้น (Layers) และ span of control",
  },
];

/** The 7 archetypes — for the picker and AI classification. */
export const ARCHETYPES: {
  key: OrgArchetype;
  th: string;
  en: string;
  healthy: boolean;
  desc: string;
}[] = [
  { key: "resilient", th: "ยืดหยุ่นสูง", en: "Resilient", healthy: true, desc: "ปรับตัวไว เป้าหมายตรงกัน ร่วมมือไร้รอยต่อ" },
  { key: "military-precision", th: "แม่นยำดั่งกองทัพ", en: "Military Precision", healthy: true, desc: "Top-down วินัยสูง ควบคุมการดำเนินงานเป๊ะ" },
  { key: "just-in-time", th: "คล่องตัวตามสถานการณ์", en: "Just-in-Time", healthy: true, desc: "คว้าโอกาสเก่ง เป็นผู้ประกอบการ แต่แผนยาวอาจไม่มั่นคง" },
  { key: "passive-aggressive", th: "ต่อต้านเงียบ", en: "Passive-Aggressive", healthy: false, desc: "เห็นด้วยในที่ประชุม แต่ลงมือจริงไม่คืบ" },
  { key: "fits-and-starts", th: "ดีเป็นพักๆ", en: "Fits-and-Starts", healthy: false, desc: "คนเก่งเยอะ ไอเดียดี แต่ขาดทิศทาง งานสำเร็จเป็นหย่อม" },
  { key: "overmanaged", th: "บริหารซ้ำซ้อน", en: "Overmanaged", healthy: false, desc: "ลำดับขั้นเยอะ micro-manage ตัดสินใจช้า" },
  { key: "outgrown", th: "โตเกินโครงสร้าง", en: "Outgrown", healthy: false, desc: "เคยสำเร็จ แต่โตจนระบบเดิมรับไม่ไหว อุ้ยอ้าย" },
];

export function archetypeMeta(key?: OrgArchetype | null) {
  return ARCHETYPES.find((a) => a.key === key) ?? null;
}

/** Build a prompt context block from the (possibly partial) Org DNA. Only filled
 *  fields are included — missing dimensions are omitted, never fabricated. Returns
 *  "" when there's nothing to add, so generation behaves exactly as before. */
export function buildOrgDnaContext(dna: OrgDna | null | undefined): string {
  if (!dna) return "";
  const lines: string[] = [];
  const arch = archetypeMeta(dna.archetype);
  const cite = (key: keyof NonNullable<OrgDna["cites"]>) => {
    const q = dna.cites?.[key]?.trim();
    return q ? ` (อ้างอิงจากข้อมูลบริษัท: "${q}")` : "";
  };
  if (arch) lines.push(`- รูปแบบองค์กร (archetype): ${arch.en} — ${arch.desc}`);
  if (dna.decisionRights?.trim())
    lines.push(`- สิทธิการตัดสินใจ: ${dna.decisionRights.trim()}${cite("decisionRights")}`);
  if (dna.information?.trim())
    lines.push(`- ระบบข้อมูลข่าวสาร: ${dna.information.trim()}${cite("information")}`);
  if (dna.motivators?.trim())
    lines.push(`- สิ่งจูงใจ: ${dna.motivators.trim()}${cite("motivators")}`);
  if (dna.structure?.trim())
    lines.push(`- โครงสร้างองค์กร: ${dna.structure.trim()}${cite("structure")}`);
  if (dna.notes?.trim()) lines.push(`- หมายเหตุ: ${dna.notes.trim()}`);
  if (lines.length === 0) return "";
  return `ORG DNA ขององค์กรผู้ใช้ (ใช้เป็นบริบท — ออกแบบ flow/โครงสร้าง/บทบาทให้สอดคล้องกับลักษณะองค์กรนี้ ห้ามแต่งข้อมูลองค์กรที่ไม่ได้ระบุ):
${lines.join("\n")}`;
}
