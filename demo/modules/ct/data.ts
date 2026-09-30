import { commit } from "../kit";
import { PEOPLE, QMR, TODAY, YEAR, addDays, assertValid, contributeReviewInput, isDate, nextNo } from "../ims/data";
import type { Errors } from "../ims/data";
import { MATERIALS } from "../mm/data";
import { ROUTING, WORK_CENTERS } from "../pp/data";
import { CUSTOMERS } from "../sd/data";
import { GAUGES } from "../qm/data";

export { TODAY };
export type { Errors };

/**
 * เครื่องมือหลักยานยนต์ (Core Tools) ตาม IATF 16949 — APQP PPAP FMEA แผนควบคุม SPC และ MSA
 *
 * ทั้งหกเครื่องมือผูกกันด้วยข้อมูลเดียว: ขั้นตอนใน PFMEA และแผนควบคุมคือขั้นตอนการผลิตของ
 * ระบบวางแผนการผลิต คุณลักษณะพิเศษที่ PFMEA ประกาศต้องไปอยู่ในแผนควบคุม ความสามารถของ
 * กระบวนการคำนวณจากค่าที่วัดจริง ผลวิเคราะห์ระบบการวัดใช้เครื่องมือวัดในทะเบียนของระบบคุณภาพ
 * และรายการส่งมอบของ APQP กับเอกสาร PPAP ตัดสินจากข้อมูลเหล่านี้เอง ไม่ใช่ช่องติ๊กที่ใครก็ติ๊กได้
 */

export const materialName = (code: string) => MATERIALS.find((m) => m.code === code)?.name ?? code;
export const customerName = (code: string) => CUSTOMERS.find((c) => c.code === code)?.name ?? code;

/* ================================================================== parts */

export type Part = {
  code: string;
  customer: string;
  customerPart: string;
  program: string;
  /** วันเริ่มผลิตจริงตามที่ลูกค้ากำหนด */
  sop: string;
  /** ชิ้นส่วนที่เกี่ยวกับความปลอดภัย (IATF 4.4.1.2) */
  safety: boolean;
  drawing: string;
};

export const PARTS: Part[] = [
  { code: "FG-5004", customer: "C-106", customerPart: "52211-TK220", program: "EV-Compact 2027", sop: "2027-01-15", safety: true, drawing: "52211-TK220 Rev.C" },
];

export const partOf = (code: string) => {
  const p = PARTS.find((x) => x.code === code);
  if (!p) throw new Error(`ไม่พบชิ้นส่วน ${code}`);
  return p;
};

/** ขั้นตอนการผลิตของชิ้นส่วน — อ่านจากขั้นตอนการผลิตของระบบวางแผนการผลิต */
export const stepsOf = (part: string) => (ROUTING[part] ?? []).map((r) => ({ op: r.op, text: r.text, wc: r.wc, machine: WORK_CENTERS.find((w) => w.code === r.wc)?.name ?? r.wc }));

/* =================================================================== fmea */

export type ApLevel = "สูง" | "กลาง" | "ต่ำ";

/**
 * ลำดับความสำคัญของการดำเนินการ (Action Priority) ตามคู่มือ AIAG-VDA — ไม่ใช้ RPN
 * เพราะ RPN ให้ความรุนแรง 10 กับโอกาสเกิด 1 เท่ากับความรุนแรง 1 กับโอกาสเกิด 10
 */
export function actionPriority(s: number, o: number, d: number): ApLevel {
  if (s <= 1) return "ต่ำ";
  if (s <= 3) return o >= 8 && d >= 5 ? "กลาง" : "ต่ำ";
  if (s <= 6) {
    if (o >= 8) return d >= 5 ? "สูง" : "กลาง";
    if (o >= 6) return d >= 2 ? "กลาง" : "ต่ำ";
    if (o >= 4) return d >= 7 ? "กลาง" : "ต่ำ";
    return "ต่ำ";
  }
  if (s <= 8) {
    if (o >= 8) return "สูง";
    if (o >= 6) return d >= 2 ? "สูง" : "กลาง";
    if (o >= 4) return d >= 7 ? "สูง" : "กลาง";
    if (o >= 2) return d >= 5 ? "กลาง" : "ต่ำ";
    return "ต่ำ";
  }
  if (o >= 6) return "สูง";
  if (o >= 4) return d >= 2 ? "สูง" : "กลาง";
  if (o >= 2) return d >= 7 ? "สูง" : d >= 5 ? "กลาง" : "ต่ำ";
  return "ต่ำ";
}

export type Special = "CC" | "SC";

export type FmeaAction = { what: string; owner: string; due: string; doneOn?: string; s?: number; o?: number; d?: number };

export type FmeaRow = {
  id: number;
  /** ขั้นตอนการผลิต (PFMEA) หรือหน้าที่ของชิ้นส่วน (DFMEA) */
  step: string;
  failure: string;
  effect: string;
  cause: string;
  s: number;
  o: number;
  d: number;
  prevention: string;
  detection: string;
  /** คุณลักษณะพิเศษที่ความล้มเหลวนี้ชี้ — ต้องไปอยู่ในแผนควบคุม */
  characteristic?: string;
  special?: Special;
  action?: FmeaAction;
};

export type Fmea = { no: string; type: "DFMEA" | "PFMEA"; part: string; team: string[]; rev: number; date: string; rows: FmeaRow[] };

/** ค่าที่ใช้ตัดสินตอนนี้ — มาตรการเสร็จและประเมินซ้ำแล้วใช้ค่าหลังมาตรการ */
export const rated = (r: FmeaRow) => (r.action?.doneOn && r.action.s ? { s: r.action.s, o: r.action.o!, d: r.action.d! } : { s: r.s, o: r.o, d: r.d });
export const apOf = (r: FmeaRow) => {
  const x = rated(r);
  return actionPriority(x.s, x.o, x.d);
};
/** ระดับสูงที่ยังไม่มีมาตรการ หรือมาตรการยังไม่เสร็จ */
export const openHigh = (f: Fmea) => f.rows.filter((r) => apOf(r) === "สูง");

export const FMEAS: Fmea[] = [
  {
    no: "PF-2569-01", type: "PFMEA", part: "FG-5004", team: ["ศักดิ์ชัย วงศ์ไทย", "ธนพล เจริญผล", "อนุชา ทองดี", "ประสิทธิ์ ขยันยิ่ง"], rev: 2, date: "2026-08-20",
    rows: [
      { id: 1, step: "0010 ปั๊มขึ้นรูปและเจาะรู", failure: "ตำแหน่งรูยึดเยื้อง", effect: "ประกอบแบตเตอรี่ไม่ได้ หรือยึดไม่แน่นเมื่อรถชน", cause: "ไกด์พินแม่พิมพ์สึก", s: 9, o: 4, d: 6, prevention: "เปลี่ยนไกด์พินทุก 50,000 ครั้ง", detection: "ตรวจชิ้นแรกทุกกะด้วยฟิกซ์เจอร์", characteristic: "ตำแหน่งรูยึด", special: "CC", action: { what: "ติดตั้งเกจ Go/No-Go ตรวจรูทุกชิ้นและเพิ่มการเปลี่ยนไกด์พินในแผน PM แม่พิมพ์", owner: "ศักดิ์ชัย วงศ์ไทย", due: "2026-09-10", doneOn: "2026-09-08", s: 9, o: 2, d: 3 } },
      { id: 2, step: "0010 ปั๊มขึ้นรูปและเจาะรู", failure: "ขนาดรูเล็กกว่าเกณฑ์", effect: "สกรูยึดใส่ไม่ได้ที่สายประกอบลูกค้า", cause: "พันช์สึกหรอ", s: 7, o: 5, d: 5, prevention: "ลับพันช์ตามรอบ", detection: "วัดรูด้วยเวอร์เนียร์ 5 ชิ้นต่อชั่วโมง", characteristic: "ขนาดรูยึด", special: "SC" },
      { id: 3, step: "0010 ปั๊มขึ้นรูปและเจาะรู", failure: "ครีบคม (burr) ที่ขอบ", effect: "บาดสายไฟแบตเตอรี่", cause: "ระยะห่างพันช์กับดายไม่ได้", s: 8, o: 3, d: 4, prevention: "ตั้งระยะห่างตามใบตั้งแม่พิมพ์", detection: "ตรวจพินิจทุกชิ้น" },
      { id: 4, step: "0020 พ่นสีฝุ่นดำและอบ", failure: "ความหนาสีต่ำกว่าเกณฑ์", effect: "เป็นสนิมก่อนกำหนด", cause: "แรงดันปืนพ่นตก", s: 5, o: 4, d: 3, prevention: "ตรวจแรงดันต้นกะ", detection: "วัดความหนาสี 3 ชิ้นต่อชั่วโมง", characteristic: "ความหนาสีเคลือบ" },
      { id: 5, step: "0030 ตรวจรูด้วยเกจ Go/No-Go ทุกชิ้นและบรรจุ", failure: "บรรจุชิ้นงานผิดรุ่นปนกัน", effect: "ลูกค้าประกอบผิดรุ่น", cause: "วางกล่องหลายรุ่นในพื้นที่เดียว", s: 6, o: 3, d: 5, prevention: "แยกพื้นที่บรรจุตามรุ่น", detection: "สแกนบาร์โค้ดป้ายกล่อง" },
    ],
  },
  {
    no: "DF-2569-01", type: "DFMEA", part: "FG-5001", team: ["ศักดิ์ชัย วงศ์ไทย", "สุภาพร แก้วมณี"], rev: 0, date: "2026-04-12",
    rows: [
      { id: 1, step: "รับน้ำหนักชั้นละ 150 กก.", failure: "คานรับชั้นยุบตัว", effect: "สินค้าบนชั้นตกใส่ผู้ใช้", cause: "ความหนาคานไม่พอ", s: 9, o: 2, d: 3, prevention: "คำนวณแรงด้วยค่าความปลอดภัย 1.5 เท่า", detection: "ทดสอบรับน้ำหนักต้นแบบ 24 ชั่วโมง" },
      { id: 2, step: "ป้องกันสนิม 5 ปี", failure: "สีหลุดล่อน", effect: "เป็นสนิม ลูกค้าร้องเรียน", cause: "ไม่ได้ปรับสภาพผิวก่อนพ่น", s: 4, o: 3, d: 4, prevention: "กำหนดขั้นตอนฟอสเฟตใน WI-03", detection: "ทดสอบการยึดเกาะแบบขีดตาราง" },
    ],
  },
];

export const fmeaByNo = (no: string) => {
  const f = FMEAS.find((x) => x.no === no);
  if (!f) throw new Error(`ไม่พบ ${no}`);
  return f;
};

const in1to10 = (n: number) => Number.isInteger(n) && n >= 1 && n <= 10;

export type FmeaRowInput = Omit<FmeaRow, "id" | "action">;

export function fmeaRowErrors(input: FmeaRowInput): Errors {
  const e: Errors = {};
  if (input.step.trim().length < 3) e.step = "ขั้นตอนหรือหน้าที่";
  if (input.failure.trim().length < 3) e.failure = "ลักษณะความล้มเหลว";
  if (input.effect.trim().length < 3) e.effect = "ผลกระทบ";
  if (input.cause.trim().length < 3) e.cause = "สาเหตุ";
  if (![input.s, input.o, input.d].every(in1to10)) e.s = "S O D ต้องเป็น 1–10";
  if (input.detection.trim().length < 3) e.detection = "การตรวจจับที่ใช้อยู่";
  if (input.special && !input.characteristic?.trim()) e.characteristic = "คุณลักษณะพิเศษต้องบอกว่าคุณลักษณะอะไร";
  if (input.special === "CC" && input.s < 9) e.special = "CC ใช้กับความรุนแรง 9–10 (ความปลอดภัยหรือกฎหมาย)";
  return e;
}

export function addFmeaRow(no: string, input: FmeaRowInput) {
  const f = fmeaByNo(no);
  assertValid(fmeaRowErrors(input));
  return commit(() => {
    const r: FmeaRow = { ...input, id: Math.max(0, ...f.rows.map((x) => x.id)) + 1, characteristic: input.characteristic?.trim() || undefined };
    f.rows.push(r);
    return r;
  });
}

export function fmeaActionErrors(input: Pick<FmeaAction, "what" | "owner" | "due">): Errors {
  const e: Errors = {};
  if (input.what.trim().length < 5) e.what = "บอกมาตรการ";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบ";
  if (!isDate(input.due) || input.due < TODAY) e.due = "กำหนดเสร็จต้องไม่ย้อนหลัง";
  return e;
}

export function addFmeaAction(no: string, id: number, input: Pick<FmeaAction, "what" | "owner" | "due">) {
  const f = fmeaByNo(no);
  const r = f.rows.find((x) => x.id === id);
  if (!r) throw new Error("ไม่พบแถวนี้");
  if (r.action && !r.action.doneOn) throw new Error("แถวนี้มีมาตรการค้างอยู่แล้ว");
  assertValid(fmeaActionErrors(input));
  return commit(() => {
    r.action = { what: input.what.trim(), owner: input.owner, due: input.due };
    return r;
  });
}

/** ปิดมาตรการพร้อมประเมินซ้ำ — ความรุนแรงลดได้เฉพาะเมื่อแก้แบบ ปกติคงเดิม */
export function completeFmeaAction(no: string, id: number, input: { s: number; o: number; d: number }, date = TODAY) {
  const f = fmeaByNo(no);
  const r = f.rows.find((x) => x.id === id);
  if (!r?.action || r.action.doneOn) throw new Error("ไม่มีมาตรการที่รอปิด");
  if (![input.s, input.o, input.d].every(in1to10)) throw new Error("S O D ต้องเป็น 1–10");
  if (f.type === "PFMEA" && input.s !== r.s) throw new Error("PFMEA ลดความรุนแรงไม่ได้ ต้องแก้แบบผลิตภัณฑ์");
  return commit(() => {
    Object.assign(r.action!, { doneOn: date, s: input.s, o: input.o, d: input.d });
    f.rev += 1;
    f.date = date;
    return r;
  });
}

/** คุณลักษณะพิเศษที่ PFMEA ของชิ้นส่วนประกาศไว้ */
export const specialsOf = (part: string) =>
  FMEAS.filter((f) => f.part === part && f.type === "PFMEA").flatMap((f) => f.rows.filter((r) => r.special && r.characteristic).map((r) => ({ characteristic: r.characteristic!, special: r.special! })));

/* ========================================================== control plan */

export const CP_PHASES = ["ต้นแบบ", "ก่อนผลิต", "ผลิตจริง"] as const;
export type CpPhase = (typeof CP_PHASES)[number];
export const CONTROL_METHODS = ["SPC", "Poka-Yoke", "ตรวจ 100%", "ตรวจชิ้นแรกและชิ้นสุดท้าย", "สุ่มตรวจ"] as const;
export type ControlMethod = (typeof CONTROL_METHODS)[number];

export type CpRow = {
  op: string;
  characteristic: string;
  special?: Special;
  spec: string;
  lsl?: number;
  usl?: number;
  gauge: string;
  sample: string;
  control: ControlMethod;
  reaction: string;
};

export type ControlPlan = { no: string; part: string; phase: CpPhase; rev: number; date: string; approvedBy?: string; rows: CpRow[] };

const BK220_ROWS: CpRow[] = [
  { op: "0010", characteristic: "ตำแหน่งรูยึด", special: "CC", spec: "120.00 ± 0.20 มม.", lsl: 119.8, usl: 120.2, gauge: "CMM-FX-01", sample: "5 ชิ้น ทุก 2 ชั่วโมง", control: "SPC", reaction: "หยุดเครื่อง กักชิ้นงานตั้งแต่ครั้งตรวจก่อน แจ้ง QC" },
  { op: "0010", characteristic: "ตำแหน่งรูยึด", special: "CC", spec: "ผ่านเกจ Go/No-Go", gauge: "GG-BK220-01", sample: "ทุกชิ้น", control: "Poka-Yoke", reaction: "ชิ้นที่ไม่ผ่านตกรางของเสียอัตโนมัติ ทวนสอบเกจต้นกะ" },
  { op: "0010", characteristic: "ขนาดรูยึด", special: "SC", spec: "Ø10.50–10.60 มม.", lsl: 10.5, usl: 10.6, gauge: "QC-VC-01", sample: "5 ชิ้น ทุก 2 ชั่วโมง", control: "SPC", reaction: "ลับพันช์ ตรวจย้อนหลัง 2 ชั่วโมง" },
  { op: "0010", characteristic: "ครีบคมที่ขอบ", spec: "ไม่มีครีบเกิน 0.1 มม.", gauge: "ตรวจพินิจ", sample: "ทุกชิ้น", control: "ตรวจ 100%", reaction: "คัดแยก ตั้งระยะแม่พิมพ์ใหม่" },
  { op: "0020", characteristic: "ความหนาสีเคลือบ", spec: "60–120 ไมครอน", lsl: 60, usl: 120, gauge: "QC-CT-01", sample: "3 ชิ้น ทุกชั่วโมง", control: "สุ่มตรวจ", reaction: "ปรับแรงดันปืนพ่น พ่นซ้ำชิ้นที่บาง" },
];

export const CONTROL_PLANS: ControlPlan[] = [
  { no: "CP-BK220-P", part: "FG-5004", phase: "ต้นแบบ", rev: 0, date: "2026-06-15", approvedBy: QMR, rows: BK220_ROWS.filter((r) => r.control !== "Poka-Yoke").map((r) => ({ ...r, sample: "ทุกชิ้น", control: "ตรวจ 100%" as ControlMethod })) },
  { no: "CP-BK220-L", part: "FG-5004", phase: "ก่อนผลิต", rev: 1, date: "2026-09-08", approvedBy: QMR, rows: BK220_ROWS.map((r) => ({ ...r })) },
];

export const planByNo = (no: string) => {
  const p = CONTROL_PLANS.find((x) => x.no === no);
  if (!p) throw new Error(`ไม่พบ ${no}`);
  return p;
};

export const planOfPhase = (part: string, phase: CpPhase) => CONTROL_PLANS.find((p) => p.part === part && p.phase === phase);

/** คุณลักษณะพิเศษที่ PFMEA ประกาศแต่แผนควบคุมยังไม่มี — ผู้ตรวจ IATF ถามข้อนี้เสมอ */
export const missingSpecials = (cp: ControlPlan) =>
  specialsOf(cp.part).filter((s) => !cp.rows.some((r) => r.characteristic === s.characteristic && r.special === s.special));

/** CC ต้องควบคุมด้วยวิธีที่จับของเสียได้จริง ไม่ใช่สุ่มตรวจ */
export const weakCc = (cp: ControlPlan) =>
  [...new Set(cp.rows.filter((r) => r.special === "CC").map((r) => r.characteristic))].filter(
    (c) => !cp.rows.some((r) => r.characteristic === c && (r.control === "SPC" || r.control === "Poka-Yoke" || r.control === "ตรวจ 100%")),
  );

export function cpRowErrors(no: string, input: CpRow): Errors {
  const cp = planByNo(no);
  const e: Errors = {};
  if (!stepsOf(cp.part).some((s) => s.op === input.op)) e.op = "เลือกขั้นตอนจากขั้นตอนการผลิต";
  if (input.characteristic.trim().length < 3) e.characteristic = "ใส่คุณลักษณะ";
  if (input.spec.trim().length < 2) e.spec = "ใส่เกณฑ์";
  if (input.gauge.trim().length < 2) e.gauge = "ใส่เครื่องมือวัดหรือวิธีตรวจ";
  if (input.sample.trim().length < 2) e.sample = "ขนาดและความถี่การสุ่ม";
  if (input.reaction.trim().length < 5) e.reaction = "แผนตอบสนองเมื่อไม่เป็นไปตามเกณฑ์";
  if (input.special === "CC" && input.control === "สุ่มตรวจ") e.control = "CC ใช้การสุ่มตรวจอย่างเดียวไม่ได้";
  return e;
}

export function addCpRow(no: string, input: CpRow) {
  assertValid(cpRowErrors(no, input));
  const cp = planByNo(no);
  return commit(() => {
    cp.rows.push({ ...input, characteristic: input.characteristic.trim() });
    cp.rev += 1;
    cp.date = TODAY;
    cp.approvedBy = undefined;
    return cp;
  });
}

export function approvePlanErrors(no: string, by: string): Errors {
  const cp = planByNo(no);
  const e: Errors = {};
  if (cp.approvedBy) e.by = `${no} ฉบับนี้อนุมัติแล้ว`;
  else if (missingSpecials(cp).length) e.by = `ยังขาดคุณลักษณะพิเศษ ${missingSpecials(cp).map((s) => `${s.characteristic} (${s.special})`).join(", ")}`;
  else if (weakCc(cp).length) e.by = `CC ${weakCc(cp).join(", ")} ยังควบคุมด้วยการสุ่มตรวจอย่างเดียว`;
  if (!PEOPLE.includes(by)) e.by = e.by ?? "เลือกผู้อนุมัติ";
  return e;
}

export function approvePlan(no: string, by: string) {
  assertValid(approvePlanErrors(no, by));
  const cp = planByNo(no);
  return commit(() => {
    cp.approvedBy = by;
    return cp;
  });
}

/** ยกแผนก่อนผลิตเป็นแผนผลิตจริง — ทำได้เมื่อ PPAP อนุมัติแล้วเท่านั้น */
export function promoteToProduction(part: string) {
  const launch = planOfPhase(part, "ก่อนผลิต");
  if (!launch?.approvedBy) throw new Error("ต้องมีแผนควบคุมก่อนผลิตที่อนุมัติแล้ว");
  if (planOfPhase(part, "ผลิตจริง")) throw new Error("มีแผนควบคุมผลิตจริงแล้ว");
  const s = submissionOf(part);
  if (s?.decision !== "อนุมัติ" && s?.decision !== "อนุมัติชั่วคราว") throw new Error("ลูกค้าต้องอนุมัติ PPAP ก่อนใช้แผนควบคุมผลิตจริง");
  return commit(() => {
    const cp: ControlPlan = { no: launch.no.replace(/-L$/, "-M"), part, phase: "ผลิตจริง", rev: 0, date: TODAY, approvedBy: QMR, rows: launch.rows.map((r) => ({ ...r })) };
    CONTROL_PLANS.push(cp);
    return cp;
  });
}

/* ==================================================================== spc */

/** ค่าคงที่ของแผนภูมิ X̄–R สำหรับกลุ่มย่อยขนาด 2–5 */
const SPC_CONST: Record<number, { a2: number; d2: number; d3: number; d4: number }> = {
  2: { a2: 1.88, d2: 1.128, d3: 0, d4: 3.267 },
  3: { a2: 1.023, d2: 1.693, d3: 0, d4: 2.574 },
  4: { a2: 0.729, d2: 2.059, d3: 0, d4: 2.282 },
  5: { a2: 0.577, d2: 2.326, d3: 0, d4: 2.114 },
};

export type Subgroup = { date: string; values: number[] };
export type SpcChart = {
  code: string; part: string; op: string; characteristic: string; special?: Special; lsl: number; usl: number; n: number; subgroups: Subgroup[];
  /** การศึกษาก่อนหน้าที่ปิดไปเมื่อกระบวนการเปลี่ยน — เก็บไว้เป็นหลักฐาน ไม่นำมาคำนวณ */
  history: { closedOn: string; reason: string; subgroups: Subgroup[] }[];
};

/** ตัวสุ่มที่ให้ค่าเดิมทุกครั้ง — ข้อมูลตัวอย่างต้องเหมือนกันทุกเครื่องทุกครั้งที่เปิด */
function seeded(seed: number) {
  let x = seed;
  const next = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
  // Box–Muller: ค่ากระจายแบบปกติ
  return () => Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

function sampleGroups(seed: number, mean: number, sd: number, count: number, dp: number): Subgroup[] {
  const z = seeded(seed);
  return Array.from({ length: count }, (_, i) => ({
    date: addDays("2026-08-24", Math.floor(i / 3)),
    values: Array.from({ length: 5 }, () => round(mean + z() * sd, dp)),
  }));
}

export const CHARTS: SpcChart[] = [
  { code: "SPC-01", part: "FG-5004", op: "0010", characteristic: "ตำแหน่งรูยึด", special: "CC", lsl: 119.8, usl: 120.2, n: 5, subgroups: sampleGroups(11, 120.01, 0.025, 25, 3), history: [] },
  { code: "SPC-02", part: "FG-5004", op: "0010", characteristic: "ขนาดรูยึด", special: "SC", lsl: 10.5, usl: 10.6, n: 5, subgroups: sampleGroups(29, 10.557, 0.013, 25, 3), history: [] },
];

export const chartByCode = (code: string) => {
  const c = CHARTS.find((x) => x.code === code);
  if (!c) throw new Error(`ไม่พบ ${code}`);
  return c;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** สถิติของแผนภูมิ — Cp/Cpk จากความแปรปรวนภายในกลุ่ม (R̄/d2) Pp/Ppk จากส่วนเบี่ยงเบนรวม */
export function stats(c: SpcChart) {
  const k = SPC_CONST[c.n];
  const means = c.subgroups.map((g) => mean(g.values));
  const ranges = c.subgroups.map((g) => Math.max(...g.values) - Math.min(...g.values));
  const xbar = mean(means);
  const rbar = mean(ranges);
  const within = rbar / k.d2;
  if (c.subgroups.length < 2) return { xbar: NaN, rbar: NaN, within: NaN, overall: NaN, cp: NaN, cpk: NaN, pp: NaN, ppk: NaN, limits: { uclX: NaN, lclX: NaN, uclR: NaN, lclR: NaN }, means, ranges, outOfControl: [] as number[] };
  const all = c.subgroups.flatMap((g) => g.values);
  const overall = Math.sqrt(all.reduce((s, v) => s + (v - xbar) ** 2, 0) / (all.length - 1));
  const tol = c.usl - c.lsl;
  const cp = tol / (6 * within);
  const cpk = Math.min(c.usl - xbar, xbar - c.lsl) / (3 * within);
  const pp = tol / (6 * overall);
  const ppk = Math.min(c.usl - xbar, xbar - c.lsl) / (3 * overall);
  const limits = { uclX: xbar + k.a2 * rbar, lclX: xbar - k.a2 * rbar, uclR: k.d4 * rbar, lclR: k.d3 * rbar };
  const outOfControl = c.subgroups.map((_, i) => i).filter((i) => means[i] > limits.uclX || means[i] < limits.lclX || ranges[i] > limits.uclR);
  return { xbar, rbar, within, overall, cp: round(cp, 2), cpk: round(cpk, 2), pp: round(pp, 2), ppk: round(ppk, 2), limits, means, ranges, outOfControl };
}

/** เกณฑ์ความสามารถตาม IATF — CC ต้องได้ 1.67 ในการศึกษาเบื้องต้น ที่เหลือ 1.33 */
export const capabilityTarget = (c: SpcChart) => (c.special === "CC" ? 1.67 : 1.33);
/** การศึกษาเบื้องต้นต้องมีอย่างน้อย 25 กลุ่มย่อย ไม่อย่างนั้นค่าดัชนียังเชื่อไม่ได้ */
export const MIN_SUBGROUPS = 25;
export const enoughData = (c: SpcChart) => c.subgroups.length >= MIN_SUBGROUPS;
export const capable = (c: SpcChart) => enoughData(c) && stats(c).ppk >= capabilityTarget(c);

/** เริ่มการศึกษาใหม่หลังปรับกระบวนการหรือเปลี่ยนเครื่องมือวัด — ข้อมูลเดิมย้ายไปเป็นประวัติ */
export function restartChart(code: string, reason: string, date = TODAY) {
  const c = chartByCode(code);
  if (reason.trim().length < 10) throw new Error("บอกว่าเปลี่ยนอะไรในกระบวนการ จึงต้องเริ่มศึกษาใหม่");
  if (c.subgroups.length === 0) throw new Error("ยังไม่มีข้อมูลให้ปิดการศึกษา");
  return commit(() => {
    c.history.push({ closedOn: date, reason: reason.trim(), subgroups: c.subgroups });
    c.subgroups = [];
    return c;
  });
}

export function subgroupErrors(code: string, values: number[]): Errors {
  const c = chartByCode(code);
  const e: Errors = {};
  if (values.length !== c.n || values.some((v) => !Number.isFinite(v))) e.values = `ใส่ค่าที่วัดได้ครบ ${c.n} ชิ้น`;
  return e;
}

/** เพิ่มกลุ่มย่อย — จุดที่หลุดเส้นควบคุมคืนค่ากลับให้หน้าจอบอกแผนตอบสนอง */
export function addSubgroup(code: string, values: number[], date = TODAY) {
  assertValid(subgroupErrors(code, values));
  const c = chartByCode(code);
  return commit(() => {
    c.subgroups.push({ date, values: [...values] });
    const st = stats(c);
    return { chart: c, outOfControl: st.outOfControl.includes(c.subgroups.length - 1), outOfSpec: values.some((v) => v < c.lsl || v > c.usl) };
  });
}

/** นำเข้าหลายกลุ่มย่อยในครั้งเดียว — บรรทัดละหนึ่งกลุ่ม */
export function parseSubgroups(text: string, n: number): number[][] | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,]+/).map(Number));
  if (lines.length === 0 || lines.some((l) => l.length !== n || l.some((v) => !Number.isFinite(v)))) return undefined;
  return lines;
}

export function addSubgroups(code: string, text: string, date = TODAY) {
  const c = chartByCode(code);
  const rows = parseSubgroups(text, c.n);
  if (!rows) throw new Error(`ใส่บรรทัดละ ${c.n} ค่า คั่นด้วยช่องว่างหรือจุลภาค`);
  return commit(() => {
    for (const values of rows) c.subgroups.push({ date, values });
    return c;
  });
}

/* ==================================================================== msa */

/** ค่าคงที่วิธีค่าเฉลี่ยและพิสัย (AIAG MSA ฉบับที่ 4) — 3 ครั้ง 3 ผู้วัด 10 ชิ้น */
const K1 = 0.5908;
const K2 = 0.5231;
const K3 = 0.3146;

export type MsaStudy = {
  no: string;
  gauge: string;
  gaugeName: string;
  characteristic: string;
  lsl: number;
  usl: number;
  date: string;
  appraisers: string[];
  /** data[ผู้วัด][ครั้งที่][ชิ้นที่] */
  data: number[][][];
};

function studyData(seed: number, center: number, partSpread: number, bias: number[], repeat: number, dp: number): number[][][] {
  const z = seeded(seed);
  const parts = Array.from({ length: 10 }, () => center + z() * partSpread);
  return bias.map((b) => Array.from({ length: 3 }, () => parts.map((p) => round(p + b + z() * repeat, dp))));
}

export const STUDIES: MsaStudy[] = [
  {
    no: "MSA-2569-01", gauge: "CMM-FX-01", gaugeName: "ฟิกซ์เจอร์วัดตำแหน่งรู", characteristic: "ตำแหน่งรูยึด", lsl: 119.8, usl: 120.2, date: "2026-08-18",
    appraisers: ["สุภาพร แก้วมณี", "ธนพล เจริญผล", "อนุชา ทองดี"], data: studyData(7, 120.01, 0.06, [0, 0.002, -0.002], 0.004, 3),
  },
  {
    no: "MSA-2569-02", gauge: "QC-VC-01", gaugeName: "เวอร์เนียร์คาลิปเปอร์", characteristic: "ขนาดรูยึด", lsl: 10.5, usl: 10.6, date: "2026-08-19",
    appraisers: ["สุภาพร แก้วมณี", "ธนพล เจริญผล", "อนุชา ทองดี"], data: studyData(13, 10.555, 0.012, [0, 0.004, -0.003], 0.004, 3),
  },
];

export const studyByNo = (no: string) => {
  const s = STUDIES.find((x) => x.no === no);
  if (!s) throw new Error(`ไม่พบ ${no}`);
  return s;
};

/** Gage R&R วิธีค่าเฉลี่ยและพิสัย — %GRR เทียบความแปรปรวนรวม และจำนวนกลุ่มที่แยกได้ (ndc) */
export function grr(s: MsaStudy) {
  const appraiserAvg = s.data.map((trials) => mean(trials.flat()));
  const rangeBar = mean(s.data.map((trials) => mean(trials[0].map((_, p) => Math.max(...trials.map((t) => t[p])) - Math.min(...trials.map((t) => t[p]))))));
  const ev = rangeBar * K1;
  const xdiff = Math.max(...appraiserAvg) - Math.min(...appraiserAvg);
  const n = s.data[0][0].length;
  const r = s.data[0].length;
  const av = Math.sqrt(Math.max(0, (xdiff * K2) ** 2 - ev ** 2 / (n * r)));
  const g = Math.sqrt(ev ** 2 + av ** 2);
  const partAvg = s.data[0][0].map((_, p) => mean(s.data.flatMap((trials) => trials.map((t) => t[p]))));
  const pv = (Math.max(...partAvg) - Math.min(...partAvg)) * K3;
  const tv = Math.sqrt(g ** 2 + pv ** 2);
  const pct = round((100 * g) / tv, 1);
  const ndc = Math.floor((1.41 * pv) / g);
  return { ev, av, grr: g, pv, tv, pct, ndc, verdict: pct < 10 && ndc >= 5 ? ("ยอมรับได้" as const) : pct <= 30 ? ("ยอมรับได้แบบมีเงื่อนไข" as const) : ("ยอมรับไม่ได้" as const) };
}

export const msaAcceptable = (s: MsaStudy) => grr(s).verdict !== "ยอมรับไม่ได้";

/** อุปกรณ์ช่วยตรวจเฉพาะชิ้นส่วน (PPAP ข้อ 16) — ทำขึ้นสำหรับชิ้นส่วนนี้โดยเฉพาะ */
export const CHECKING_AIDS = [
  { code: "CMM-FX-01", name: "ฟิกซ์เจอร์วัดตำแหน่งรู", part: "FG-5004" },
  { code: "GG-BK220-01", name: "เกจ Go/No-Go ตรวจรูยึด", part: "FG-5004" },
  { code: "BG-BK220-01", name: "เกจวัดรูแบบบอร์ (air gauge)", part: "FG-5004" },
];

/** เครื่องมือวัดที่ใช้ศึกษาได้ — ทะเบียนเครื่องมือวัดของระบบคุณภาพ และอุปกรณ์ช่วยตรวจเฉพาะชิ้นส่วน */
export const GAUGE_OPTIONS = () => [
  ...GAUGES.map((g) => ({ value: g.code, label: `${g.code} · ${g.name}` })),
  ...CHECKING_AIDS.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` })),
];

/** ผลศึกษาล่าสุดของแต่ละคุณลักษณะ — ศึกษาใหม่หลังเปลี่ยนเครื่องมือ ผลเก่าไม่นับ */
export const latestStudies = (part: string) => {
  const chars = CHARTS.filter((c) => c.part === part).map((c) => c.characteristic);
  return chars.map((ch) => STUDIES.filter((x) => x.characteristic === ch).sort((a, b) => a.no.localeCompare(b.no)).at(-1)).filter((x): x is MsaStudy => !!x);
};

export type StudyInput = { gauge: string; characteristic: string; lsl: number; usl: number; appraisers: string[]; rows: string };

/** ข้อมูลเก้าบรรทัด: ผู้วัดละสามครั้ง บรรทัดละสิบค่าคั่นด้วยช่องว่างหรือจุลภาค */
export function parseRows(rows: string): number[][][] | undefined {
  const lines = rows.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,]+/).map(Number));
  if (lines.length !== 9 || lines.some((l) => l.length !== 10 || l.some((v) => !Number.isFinite(v)))) return undefined;
  return [lines.slice(0, 3), lines.slice(3, 6), lines.slice(6, 9)];
}

export function studyErrors(input: StudyInput): Errors {
  const e: Errors = {};
  if (!GAUGE_OPTIONS().some((g) => g.value === input.gauge)) e.gauge = "เลือกเครื่องมือวัด";
  if (input.characteristic.trim().length < 3) e.characteristic = "คุณลักษณะที่วัด";
  if (!(input.usl > input.lsl)) e.usl = "USL ต้องมากกว่า LSL";
  if (new Set(input.appraisers).size !== 3 || input.appraisers.some((a) => !PEOPLE.includes(a))) e.appraisers = "เลือกผู้วัด 3 คนไม่ซ้ำกัน";
  if (!parseRows(input.rows)) e.rows = "ใส่ 9 บรรทัด (ผู้วัด 3 คน × 3 ครั้ง) บรรทัดละ 10 ค่า";
  return e;
}

export function recordStudy(input: StudyInput, date = TODAY) {
  assertValid(studyErrors(input));
  return commit(() => {
    const s: MsaStudy = {
      no: nextNo(STUDIES.map((x) => x.no), `MSA-${YEAR}-`, 2), gauge: input.gauge, gaugeName: GAUGE_OPTIONS().find((g) => g.value === input.gauge)!.label.split(" · ")[1],
      characteristic: input.characteristic.trim(), lsl: input.lsl, usl: input.usl, date, appraisers: [...input.appraisers], data: parseRows(input.rows)!,
    };
    STUDIES.push(s);
    return s;
  });
}

/* ================================================================== ppap */

export const PPAP_ELEMENTS = [
  "บันทึกการออกแบบ", "เอกสารการเปลี่ยนแปลงทางวิศวกรรม", "การอนุมัติทางวิศวกรรมจากลูกค้า", "DFMEA", "แผนผังกระบวนการ", "PFMEA",
  "แผนควบคุม", "ผลการวิเคราะห์ระบบการวัด", "ผลการวัดขนาด", "ผลทดสอบวัสดุและสมรรถนะ", "ผลการศึกษากระบวนการเบื้องต้น",
  "เอกสารห้องปฏิบัติการ", "รายงานอนุมัติลักษณะภายนอก", "ชิ้นงานตัวอย่าง", "ชิ้นงานต้นแบบ", "อุปกรณ์ช่วยตรวจ", "ข้อกำหนดเฉพาะลูกค้า",
  "ใบรับรองการส่งชิ้นส่วน (PSW)",
] as const;
export type PpapElement = (typeof PPAP_ELEMENTS)[number];
export type ElementStatus = "ครบ" | "ยังไม่ครบ" | "ไม่เกี่ยวข้อง";

export type Submission = {
  no: string;
  part: string;
  level: 1 | 2 | 3 | 4 | 5;
  reason: string;
  manual: Partial<Record<PpapElement, ElementStatus>>;
  submittedOn?: string;
  decision?: "อนุมัติ" | "อนุมัติชั่วคราว" | "ไม่อนุมัติ";
  decidedOn?: string;
  customerNote?: string;
  interimUntil?: string;
};

export const SUBMISSIONS: Submission[] = [
  {
    no: "PPAP-2569-01", part: "FG-5004", level: 3, reason: "ชิ้นส่วนใหม่",
    manual: {
      "บันทึกการออกแบบ": "ครบ", "เอกสารการเปลี่ยนแปลงทางวิศวกรรม": "ไม่เกี่ยวข้อง", "การอนุมัติทางวิศวกรรมจากลูกค้า": "ไม่เกี่ยวข้อง", DFMEA: "ไม่เกี่ยวข้อง",
      "แผนผังกระบวนการ": "ครบ", "ผลการวัดขนาด": "ครบ", "ผลทดสอบวัสดุและสมรรถนะ": "ครบ", "เอกสารห้องปฏิบัติการ": "ครบ", "รายงานอนุมัติลักษณะภายนอก": "ครบ",
      "ชิ้นงานตัวอย่าง": "ครบ", "ชิ้นงานต้นแบบ": "ครบ", "อุปกรณ์ช่วยตรวจ": "ครบ", "ข้อกำหนดเฉพาะลูกค้า": "ครบ",
    },
  },
];

export const submissionOf = (part: string) => SUBMISSIONS.filter((s) => s.part === part).at(-1);
export const submissionByNo = (no: string) => {
  const s = SUBMISSIONS.find((x) => x.no === no);
  if (!s) throw new Error(`ไม่พบ ${no}`);
  return s;
};

/** องค์ประกอบที่ระบบตัดสินเองจากข้อมูลจริง — ไม่ต้องติ๊ก และติ๊กแทนไม่ได้ */
export const AUTO_ELEMENTS: PpapElement[] = ["PFMEA", "แผนควบคุม", "ผลการวิเคราะห์ระบบการวัด", "ผลการศึกษากระบวนการเบื้องต้น", "ใบรับรองการส่งชิ้นส่วน (PSW)"];

export function elementStatus(s: Submission, el: PpapElement): { status: ElementStatus; why: string } {
  const pf = FMEAS.filter((f) => f.part === s.part && f.type === "PFMEA");
  const cp = planOfPhase(s.part, "ก่อนผลิต");
  const studies = latestStudies(s.part);
  const charts = CHARTS.filter((c) => c.part === s.part);
  switch (el) {
    case "PFMEA":
      if (!pf.length) return { status: "ยังไม่ครบ", why: "ยังไม่มี PFMEA" };
      return pf.some((f) => openHigh(f).length) ? { status: "ยังไม่ครบ", why: `ยังมี AP สูง ${pf.reduce((n, f) => n + openHigh(f).length, 0)} แถว` } : { status: "ครบ", why: `${pf.map((f) => `${f.no} Rev.${f.rev}`).join(", ")} ไม่มี AP สูงค้าง` };
    case "แผนควบคุม":
      if (!cp) return { status: "ยังไม่ครบ", why: "ยังไม่มีแผนควบคุมก่อนผลิต" };
      if (!cp.approvedBy) return { status: "ยังไม่ครบ", why: `${cp.no} ยังไม่อนุมัติ` };
      return missingSpecials(cp).length ? { status: "ยังไม่ครบ", why: "ขาดคุณลักษณะพิเศษจาก PFMEA" } : { status: "ครบ", why: `${cp.no} Rev.${cp.rev} อนุมัติแล้ว` };
    case "ผลการวิเคราะห์ระบบการวัด":
      if (!studies.length) return { status: "ยังไม่ครบ", why: "ยังไม่ศึกษา MSA" };
      return studies.every(msaAcceptable) ? { status: "ครบ", why: studies.map((x) => `${x.no} %GRR ${grr(x).pct}%`).join(", ") } : { status: "ยังไม่ครบ", why: "มีเครื่องมือที่ %GRR เกิน 30%" };
    case "ผลการศึกษากระบวนการเบื้องต้น": {
      const weak = charts.filter((c) => !capable(c));
      const why = (c: SpcChart) => (enoughData(c) ? `${c.characteristic} Ppk ${stats(c).ppk} < ${capabilityTarget(c)}` : `${c.characteristic} มีข้อมูล ${c.subgroups.length} จาก ${MIN_SUBGROUPS} กลุ่มย่อย`);
      return weak.length ? { status: "ยังไม่ครบ", why: weak.map(why).join(", ") } : { status: "ครบ", why: charts.map((c) => `${c.characteristic} Ppk ${stats(c).ppk}`).join(", ") };
    }
    case "ใบรับรองการส่งชิ้นส่วน (PSW)":
      return s.submittedOn ? { status: "ครบ", why: `ลงนามส่ง ${s.submittedOn}` } : { status: "ยังไม่ครบ", why: "ออกเมื่อส่ง" };
    default:
      return { status: s.manual[el] ?? "ยังไม่ครบ", why: s.manual[el] === "ไม่เกี่ยวข้อง" ? "ลูกค้าเป็นผู้ออกแบบ หรือไม่มีการเปลี่ยนแปลง" : "" };
  }
}

/** ที่ยังขาดก่อนส่ง — ทุกองค์ประกอบยกเว้น PSW ที่จะออกตอนส่ง */
export const pendingElements = (s: Submission) => PPAP_ELEMENTS.filter((el) => el !== "ใบรับรองการส่งชิ้นส่วน (PSW)" && elementStatus(s, el).status === "ยังไม่ครบ");

export function setElement(no: string, el: PpapElement, status: ElementStatus) {
  const s = submissionByNo(no);
  if (AUTO_ELEMENTS.includes(el)) throw new Error(`${el} ระบบตัดสินจากข้อมูลจริง แก้ด้วยมือไม่ได้`);
  if (s.submittedOn) throw new Error(`${no} ส่งลูกค้าแล้ว`);
  return commit(() => {
    s.manual[el] = status;
    return s;
  });
}

export function submitPpap(no: string, date = TODAY) {
  const s = submissionByNo(no);
  if (s.submittedOn) throw new Error(`${no} ส่งแล้ว`);
  const pending = pendingElements(s);
  if (pending.length) throw new Error(`ยังขาด ${pending.join(", ")}`);
  return commit(() => {
    s.submittedOn = date;
    return s;
  });
}

export function decisionErrors(no: string, input: { decision: NonNullable<Submission["decision"]>; note: string; interimUntil: string }): Errors {
  const s = submissionByNo(no);
  const e: Errors = {};
  if (!s.submittedOn) e.decision = "ส่ง PPAP ก่อนบันทึกผลจากลูกค้า";
  else if (s.decision) e.decision = `${no} ลูกค้าตัดสินแล้ว`;
  if (input.decision !== "อนุมัติ" && input.note.trim().length < 5) e.note = "บันทึกเหตุผลหรือเงื่อนไขจากลูกค้า";
  if (input.decision === "อนุมัติชั่วคราว" && (!isDate(input.interimUntil) || input.interimUntil <= TODAY)) e.interimUntil = "อนุมัติชั่วคราวต้องมีวันหมดอายุ";
  return e;
}

export function recordDecision(no: string, input: { decision: NonNullable<Submission["decision"]>; note: string; interimUntil: string }, date = TODAY) {
  assertValid(decisionErrors(no, input));
  const s = submissionByNo(no);
  return commit(() => {
    s.decision = input.decision;
    s.decidedOn = date;
    s.customerNote = input.note.trim() || undefined;
    s.interimUntil = input.decision === "อนุมัติชั่วคราว" ? input.interimUntil : undefined;
    return s;
  });
}

/** ส่งชิ้นส่วนผลิตจริงได้หรือยัง — ใช้ร่วมกับข้อกำหนด IATF และฝ่ายขาย */
export const releasedForProduction = (part: string) => {
  const s = submissionOf(part);
  return s?.decision === "อนุมัติ" || (s?.decision === "อนุมัติชั่วคราว" && (s.interimUntil ?? "") >= TODAY);
};

/* ================================================================== apqp */

export const PHASES = [
  "วางแผนและกำหนดโครงการ",
  "ออกแบบและพัฒนาผลิตภัณฑ์",
  "ออกแบบและพัฒนากระบวนการ",
  "ทวนสอบผลิตภัณฑ์และกระบวนการ",
  "ผลป้อนกลับและการปรับปรุง",
] as const;

export type AutoCheck = "pfmea" | "cp-launch" | "msa" | "spc" | "ppap" | "cp-production";

export type Deliverable = { item: string; phase: number; owner: string; due: string; doneOn?: string; auto?: AutoCheck };
export type Gate = { phase: number; date: string; decision: "ผ่าน" | "ผ่านแบบมีเงื่อนไข"; note: string; by: string };

export type ApqpProject = { no: string; part: string; leader: string; team: string[]; started: string; deliverables: Deliverable[]; gates: Gate[] };

export const PROJECTS: ApqpProject[] = [
  {
    no: "APQP-2569-01", part: "FG-5004", leader: "ธนพล เจริญผล", team: ["ธนพล เจริญผล", "ศักดิ์ชัย วงศ์ไทย", "อนุชา ทองดี", "ปิยะนุช ใจดี", "ชลธิชา มั่นคง"], started: "2026-05-04",
    deliverables: [
      { item: "ข้อกำหนดลูกค้าและเป้าหมายคุณภาพ", phase: 0, owner: "ชลธิชา มั่นคง", due: "2026-05-15", doneOn: "2026-05-12" },
      { item: "รายการคุณลักษณะพิเศษเบื้องต้น", phase: 0, owner: "ธนพล เจริญผล", due: "2026-05-20", doneOn: "2026-05-19" },
      { item: "ทบทวนความเป็นไปได้และลงนามรับงาน (Feasibility)", phase: 1, owner: "ศักดิ์ชัย วงศ์ไทย", due: "2026-06-05", doneOn: "2026-06-03" },
      { item: "ทบทวนแบบและความคลาดเคลื่อนที่ผลิตได้", phase: 1, owner: "ศักดิ์ชัย วงศ์ไทย", due: "2026-06-10", doneOn: "2026-06-09" },
      { item: "แผนผังกระบวนการ", phase: 2, owner: "ศักดิ์ชัย วงศ์ไทย", due: "2026-07-01", doneOn: "2026-06-28" },
      { item: "PFMEA ไม่มี AP สูงค้าง", phase: 2, owner: "ศักดิ์ชัย วงศ์ไทย", due: "2026-07-20", auto: "pfmea" },
      { item: "แผนควบคุมก่อนผลิตที่อนุมัติแล้ว", phase: 2, owner: "ธนพล เจริญผล", due: "2026-08-10", auto: "cp-launch" },
      { item: "ผลการวิเคราะห์ระบบการวัด", phase: 3, owner: "ธนพล เจริญผล", due: "2026-08-25", auto: "msa" },
      { item: "ความสามารถกระบวนการเบื้องต้นถึงเกณฑ์", phase: 3, owner: "ธนพล เจริญผล", due: "2026-09-15", auto: "spc" },
      { item: "PPAP ได้รับอนุมัติจากลูกค้า", phase: 3, owner: "ธนพล เจริญผล", due: "2026-10-30", auto: "ppap" },
      { item: "แผนควบคุมผลิตจริง", phase: 4, owner: "ธนพล เจริญผล", due: "2027-01-10", auto: "cp-production" },
      { item: "ติดตามของเสียที่ลูกค้าพบ 3 เดือนแรกหลังเริ่มผลิต", phase: 4, owner: "ธนพล เจริญผล", due: "2027-04-15" },
    ],
    gates: [
      { phase: 0, date: "2026-05-22", decision: "ผ่าน", note: "ได้รับการคัดเลือกเป็นผู้ส่งมอบ", by: QMR },
      { phase: 1, date: "2026-06-12", decision: "ผ่าน", note: "ยืนยันความเป็นไปได้ ลูกค้าเป็นผู้ออกแบบ", by: QMR },
      { phase: 2, date: "2026-09-09", decision: "ผ่าน", note: "PFMEA และแผนควบคุมก่อนผลิตพร้อม เริ่มผลิตทดลอง", by: QMR },
    ],
  },
];

export const projectByNo = (no: string) => {
  const p = PROJECTS.find((x) => x.no === no);
  if (!p) throw new Error(`ไม่พบ ${no}`);
  return p;
};

export function isDone(p: ApqpProject, d: Deliverable) {
  if (!d.auto) return !!d.doneOn;
  const s = submissionOf(p.part);
  switch (d.auto) {
    case "pfmea":
      return s ? elementStatus(s, "PFMEA").status === "ครบ" : false;
    case "cp-launch":
      return s ? elementStatus(s, "แผนควบคุม").status === "ครบ" : false;
    case "msa":
      return s ? elementStatus(s, "ผลการวิเคราะห์ระบบการวัด").status === "ครบ" : false;
    case "spc":
      return s ? elementStatus(s, "ผลการศึกษากระบวนการเบื้องต้น").status === "ครบ" : false;
    case "ppap":
      return releasedForProduction(p.part);
    case "cp-production":
      return !!planOfPhase(p.part, "ผลิตจริง");
  }
}

/** เฟสปัจจุบัน — เฟสแรกที่ยังไม่ผ่านประตู */
export const currentPhase = (p: ApqpProject) => {
  const passed = p.gates.map((g) => g.phase);
  return PHASES.findIndex((_, i) => !passed.includes(i));
};

export const lateDeliverables = (p: ApqpProject) => p.deliverables.filter((d) => !isDone(p, d) && d.due < TODAY);

export function completeDeliverable(no: string, index: number, date = TODAY) {
  const p = projectByNo(no);
  const d = p.deliverables[index];
  if (!d) throw new Error("ไม่พบรายการนี้");
  if (d.auto) throw new Error(`${d.item} ระบบตัดสินจากข้อมูลจริง`);
  if (d.doneOn) throw new Error("ทำเสร็จแล้ว");
  if (d.phase > Math.max(0, currentPhase(p))) throw new Error("ยังไม่ถึงเฟสนี้");
  return commit(() => {
    d.doneOn = date;
    return p;
  });
}

export function gateErrors(no: string, input: { decision: Gate["decision"]; note: string; by: string }): Errors {
  const p = projectByNo(no);
  const phase = currentPhase(p);
  const e: Errors = {};
  if (phase < 0) e.decision = "ผ่านครบทุกเฟสแล้ว";
  else {
    const open = p.deliverables.filter((d) => d.phase === phase && !isDone(p, d));
    if (input.decision === "ผ่าน" && open.length) e.decision = `ยังค้าง ${open.map((d) => d.item).join(", ")} — ผ่านแบบมีเงื่อนไขพร้อมบอกแผน`;
  }
  if (input.decision === "ผ่านแบบมีเงื่อนไข" && input.note.trim().length < 10) e.note = "บอกสิ่งที่ค้างและกำหนดปิด";
  if (input.by !== QMR && input.by !== "วีระ ตั้งมั่น") e.by = "ประตูผ่านเฟสอนุมัติโดยผู้แทนฝ่ายบริหารหรือผู้บริหารสูงสุด";
  return e;
}

export function passGate(no: string, input: { decision: Gate["decision"]; note: string; by: string }, date = TODAY) {
  assertValid(gateErrors(no, input));
  const p = projectByNo(no);
  return commit(() => {
    const g: Gate = { phase: currentPhase(p), date, decision: input.decision, note: input.note.trim(), by: input.by };
    p.gates.push(g);
    return g;
  });
}

/* ======================================================== review inputs */

const toneOf = (bad: boolean, warn = false) => (bad ? "bad" : warn ? "warn" : "ok") as "bad" | "warn" | "ok";

contributeReviewInput({
  key: "ct-launch", std: ["IATF 16949"], input: "IATF 9.3.2.1", title: "ความพร้อมการเปิดตัวชิ้นส่วนใหม่",
  facts: () => {
    const p = PROJECTS[0];
    const s = submissionOf(p.part);
    return [
      { label: `${p.part} เฟส APQP`, value: currentPhase(p) < 0 ? "ครบทุกเฟส" : PHASES[currentPhase(p)], tone: "idle" },
      { label: "รายการส่งมอบเลยกำหนด", value: `${lateDeliverables(p).length} รายการ`, tone: toneOf(lateDeliverables(p).length > 0) },
      { label: "PPAP", value: s?.decision ?? (s?.submittedOn ? "รอลูกค้า" : `ขาด ${s ? pendingElements(s).length : "—"} องค์ประกอบ`), tone: toneOf(!releasedForProduction(p.part) && !!s && pendingElements(s).length > 0, !releasedForProduction(p.part)) },
    ];
  },
});

contributeReviewInput({
  key: "ct-capability", std: ["IATF 16949"], input: "IATF 9.1.1.1", title: "ความสามารถของกระบวนการและระบบการวัด",
  facts: () => [
    { label: "คุณลักษณะที่ Ppk ต่ำกว่าเกณฑ์", value: `${CHARTS.filter((c) => !capable(c)).length} จาก ${CHARTS.length}`, tone: toneOf(CHARTS.some((c) => !capable(c))) },
    { label: "MSA ล่าสุดที่ยอมรับไม่ได้", value: `${PARTS.flatMap((p) => latestStudies(p.code)).filter((s) => !msaAcceptable(s)).length} เรื่อง`, tone: toneOf(PARTS.flatMap((p) => latestStudies(p.code)).some((s) => !msaAcceptable(s))) },
  ],
});
