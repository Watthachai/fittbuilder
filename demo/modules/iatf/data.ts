import { commit } from "../kit";
import {
  PEOPLE, QMR, TODAY, YEAR, addDays, addMonths, assertValid, carOf, contributeReviewInput, courseName, docByCode, isDate, isQualified,
  nextNo, openCapa,
} from "../ims/data";
import type { CourseCode, Errors } from "../ims/data";
import { VENDORS } from "../mm/data";
import { CUSTOMERS, DELIVERIES, SALES_ORDERS } from "../sd/data";
import { NCRS } from "../qm/data";
import { PARTS, planOfPhase, releasedForProduction, specialsOf } from "../ct/data";

export { TODAY };
export type { Errors };

/**
 * ข้อกำหนดเพิ่มเติมของ IATF 16949 ที่ ISO 9001 ไม่มี — ข้อกำหนดเฉพาะลูกค้า ความปลอดภัยผลิตภัณฑ์
 * แผนฉุกเฉินทางธุรกิจ การตรวจประเมินผู้ส่งมอบ ผลงานต่อลูกค้า และอุปกรณ์ป้องกันความผิดพลาด
 *
 * ทุกข้อตัดสินจากข้อมูลของระบบอื่น: ข้อกำหนดเฉพาะลูกค้าที่นำไปใช้ต้องชี้ไปที่เอกสารที่ใช้งานอยู่
 * ความปลอดภัยผลิตภัณฑ์อ่านคุณลักษณะ CC แผนควบคุม และ PPAP จาก Core Tools ผู้ตรวจผู้ส่งมอบต้องผ่าน
 * หลักสูตรในทะเบียนความสามารถ และ PPM ที่ลูกค้ารายงานวางคู่ข้อร้องเรียนที่ระบบคุณภาพนับเอง
 */

export const customerName = (code: string) => CUSTOMERS.find((c) => c.code === code)?.name ?? code;
export const vendorName = (code: string) => VENDORS.find((v) => v.code === code)?.name ?? code;

/** ลูกค้ายานยนต์ — ลูกค้าที่มีชิ้นส่วนยานยนต์ในระบบ Core Tools */
export const automotiveCustomers = () => [...new Set(PARTS.map((p) => p.customer))];

/* ================================================================== csr */

export const CSR_STATUSES = ["นำไปใช้แล้ว", "กำลังดำเนินการ", "ยังไม่ได้ทำ"] as const;
export type CsrStatus = (typeof CSR_STATUSES)[number];

export type Csr = { id: number; customer: string; source: string; clause: string; requirement: string; doc?: string; status: CsrStatus; owner: string };

const TAP = "TAP Supplier Quality Manual Rev.7";

export const CSRS: Csr[] = [
  { id: 1, customer: "C-106", source: TAP, clause: "8.3.4.4", requirement: "PPAP ระดับ 3 ทุกชิ้นส่วนใหม่และทุกการเปลี่ยนแปลง", doc: "SP-17", status: "นำไปใช้แล้ว", owner: "ธนพล เจริญผล" },
  { id: 2, customer: "C-106", source: TAP, clause: "8.5.2.1", requirement: "สอบกลับจากชิ้นงานถึงล็อตวัตถุดิบได้ภายใน 4 ชั่วโมง", doc: "SP-21", status: "นำไปใช้แล้ว", owner: "ธนพล เจริญผล" },
  { id: 3, customer: "C-106", source: TAP, clause: "10.2.3", requirement: "ตอบ 8D: กักกันภายใน 24 ชั่วโมง สาเหตุรากภายใน 10 วันทำการ", doc: "SP-04", status: "นำไปใช้แล้ว", owner: QMR },
  { id: 4, customer: "C-106", source: TAP, clause: "8.5.1.1", requirement: "แผนควบคุมที่มี CC ต้องส่งลูกค้าอนุมัติก่อนใช้", doc: "SP-18", status: "นำไปใช้แล้ว", owner: "ศักดิ์ชัย วงศ์ไทย" },
  { id: 5, customer: "C-106", source: TAP, clause: "8.6.2", requirement: "ตรวจวัดขนาดเต็มรูปแบบ (layout inspection) ปีละครั้งทุกชิ้นส่วน", status: "กำลังดำเนินการ", owner: "สุภาพร แก้วมณี" },
  { id: 6, customer: "C-106", source: TAP, clause: "8.5.6.1", requirement: "แจ้งการเปลี่ยนแปลงกระบวนการล่วงหน้า 60 วันก่อนดำเนินการ", status: "กำลังดำเนินการ", owner: "ศักดิ์ชัย วงศ์ไทย" },
  { id: 7, customer: "C-106", source: TAP, clause: "8.5.4", requirement: "บรรจุในกล่องหมุนเวียนของลูกค้า ติดป้ายบาร์โค้ดตามมาตรฐานลูกค้า", status: "ยังไม่ได้ทำ", owner: "วรวุฒิ พึ่งบุญ" },
  { id: 8, customer: "C-106", source: TAP, clause: "4.4.1.2", requirement: "ชิ้นส่วนความปลอดภัยต้องมีผู้แทนความปลอดภัยผลิตภัณฑ์ที่ผ่านการอบรม", doc: "SP-21", status: "นำไปใช้แล้ว", owner: QMR },
];

export const csrById = (id: number) => {
  const c = CSRS.find((x) => x.id === id);
  if (!c) throw new Error("ไม่พบข้อกำหนดนี้");
  return c;
};

/** ความครอบคลุม — ข้อที่นำไปใช้แล้วและเอกสารที่ชี้ยังใช้งานอยู่จริง */
export const effective = (c: Csr) => c.status === "นำไปใช้แล้ว" && !!c.doc && docByCode(c.doc).status === "ใช้งาน";
export const coverage = (customer: string) => {
  const mine = CSRS.filter((c) => c.customer === customer);
  return { done: mine.filter(effective).length, total: mine.length };
};

export type CsrInput = Omit<Csr, "id" | "status" | "doc">;

export function csrErrors(input: CsrInput): Errors {
  const e: Errors = {};
  if (!automotiveCustomers().includes(input.customer)) e.customer = "เลือกลูกค้ายานยนต์";
  if (input.source.trim().length < 3) e.source = "เอกสารต้นทางของลูกค้า";
  if (!/^\d+(\.\d+)*$/.test(input.clause.trim())) e.clause = "ข้อ IATF ที่เกี่ยวข้อง เช่น 8.5.2.1";
  if (input.requirement.trim().length < 10) e.requirement = "สิ่งที่ลูกค้ากำหนด";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบ";
  return e;
}

export function addCsr(input: CsrInput) {
  assertValid(csrErrors(input));
  return commit(() => {
    const c: Csr = { ...input, id: Math.max(0, ...CSRS.map((x) => x.id)) + 1, source: input.source.trim(), clause: input.clause.trim(), requirement: input.requirement.trim(), status: "ยังไม่ได้ทำ" };
    CSRS.push(c);
    return c;
  });
}

/** นำไปใช้ — ต้องผูกกับเอกสารควบคุมที่ใช้งานอยู่ในทะเบียนกลาง */
export function implementCsr(id: number, doc: string) {
  const c = csrById(id);
  let d;
  try {
    d = docByCode(doc);
  } catch {
    throw new Error(`ไม่พบ ${doc} ในทะเบียนเอกสาร`);
  }
  if (d.status !== "ใช้งาน") throw new Error(`${doc} ยังไม่ได้ใช้งาน`);
  return commit(() => {
    c.doc = d.code;
    c.status = "นำไปใช้แล้ว";
    return c;
  });
}

export function progressCsr(id: number) {
  const c = csrById(id);
  if (c.status !== "ยังไม่ได้ทำ") throw new Error(`ข้อนี้${c.status}`);
  return commit(() => {
    c.status = "กำลังดำเนินการ";
    return c;
  });
}

/* ========================================================= product safety */

/** ผู้แทนความปลอดภัยผลิตภัณฑ์ (Product Safety Representative) */
export const PSR = "ธนพล เจริญผล";
const PSR_COURSE: CourseCode = "TR-06";

export type TraceDrill = { no: string; part: string; lot: string; date: string; tracedTo: string; minutes: number; by: string };

export const TRACE_DRILLS: TraceDrill[] = [
  { no: "TRC-2569-01", part: "FG-5004", lot: "LOT-BK-260905", date: "2026-09-06", tracedTo: "MAT-1004 heat H24-7781 · ใบรับของ GR-2569-203 · ผลิตทดลองกะเช้า 05/09 · ผู้ควบคุมเครื่อง อนุชา ทองดี", minutes: 95, by: PSR },
];

/** สอบกลับผ่านเมื่อทำได้ภายในเวลาที่ลูกค้ากำหนด (CSR ข้อ 2) */
export const TRACE_LIMIT_MINUTES = 240;

/** รายการตรวจความปลอดภัยผลิตภัณฑ์ของชิ้นส่วนหนึ่ง (IATF 4.4.1.2) — ตัดสินจากข้อมูลจริงทุกข้อ */
export function safetyChecks(part: string) {
  const cc = specialsOf(part).filter((s) => s.special === "CC");
  const cp = planOfPhase(part, "ผลิตจริง") ?? planOfPhase(part, "ก่อนผลิต");
  const drill = TRACE_DRILLS.filter((d) => d.part === part && d.date >= addMonths(TODAY, -12)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return [
    { item: "PFMEA ระบุคุณลักษณะวิกฤต (CC)", ok: cc.length > 0, why: cc.map((c) => c.characteristic).join(", ") || "ยังไม่มี CC" },
    { item: "แผนควบคุมมี CC ครบและอนุมัติแล้ว", ok: !!cp?.approvedBy && cc.every((c) => cp.rows.some((r) => r.characteristic === c.characteristic && r.special === "CC")), why: cp ? `${cp.no} ${cp.approvedBy ? "อนุมัติแล้ว" : "รออนุมัติ"}` : "ยังไม่มีแผนควบคุม" },
    { item: "ลูกค้าอนุมัติ PPAP", ok: releasedForProduction(part), why: releasedForProduction(part) ? "อนุมัติแล้ว" : "ยังไม่อนุมัติ" },
    { item: "ผู้แทนความปลอดภัยผลิตภัณฑ์ผ่านการอบรม", ok: isQualified(PSR, PSR_COURSE), why: `${PSR} · ${courseName(PSR_COURSE)}` },
    { item: `ทดสอบสอบกลับภายใน ${TRACE_LIMIT_MINUTES / 60} ชั่วโมงในรอบปี`, ok: !!drill && drill.minutes <= TRACE_LIMIT_MINUTES, why: drill ? `${drill.no} ใช้ ${drill.minutes} นาที` : "ยังไม่เคยทดสอบในรอบปี" },
  ];
}

export const safetyParts = () => PARTS.filter((p) => p.safety);
export const safetyGaps = () => safetyParts().flatMap((p) => safetyChecks(p.code).filter((c) => !c.ok).map((c) => ({ part: p.code, item: c.item })));

export type TraceInput = Omit<TraceDrill, "no">;

export function traceErrors(input: TraceInput): Errors {
  const e: Errors = {};
  if (!PARTS.some((p) => p.code === input.part)) e.part = "เลือกชิ้นส่วน";
  if (input.lot.trim().length < 3) e.lot = "ล็อตที่ทดสอบ";
  if (input.tracedTo.trim().length < 10) e.tracedTo = "สอบกลับไปถึงอะไร เช่น ล็อตวัตถุดิบ ใบรับของ กะผลิต";
  if (!(input.minutes > 0)) e.minutes = "เวลาที่ใช้ (นาที)";
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่ต้องไม่เกินวันนี้";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้ทดสอบ";
  return e;
}

export function recordTrace(input: TraceInput) {
  assertValid(traceErrors(input));
  return commit(() => {
    const d: TraceDrill = { ...input, no: nextNo(TRACE_DRILLS.map((x) => x.no), `TRC-${YEAR}-`, 2), lot: input.lot.trim(), tracedTo: input.tracedTo.trim() };
    TRACE_DRILLS.push(d);
    return d;
  });
}

/* ============================================================ contingency */

export type Contingency = {
  code: string;
  scenario: string;
  /** กี่วันก่อนกระทบการส่งมอบลูกค้า */
  impactDays: number;
  actions: string[];
  owner: string;
  risk?: string;
  tests: { date: string; result: "ผ่าน" | "ต้องปรับปรุง"; note: string; by: string }[];
};

export const CONTINGENCIES: Contingency[] = [
  { code: "BCP-01", scenario: "เครื่องปั๊ม 200 ตันเสียนานเกิน 8 ชั่วโมง", impactDays: 2, owner: "ประสิทธิ์ ขยันยิ่ง", risk: "RSK-001", actions: ["ใช้สต็อกสำรองชิ้นส่วน 2 วัน", "ย้ายแม่พิมพ์ไปปั๊มที่โรงงานพันธมิตรตามสัญญา", "เบิกอะไหล่วิกฤตจากคลัง แจ้งลูกค้าภายใน 24 ชั่วโมง"], tests: [{ date: "2026-08-28", result: "ผ่าน", note: "ซ้อมแบบโต๊ะ ย้ายแม่พิมพ์ถึงโรงงานพันธมิตรใน 6 ชั่วโมง", by: QMR }] },
  { code: "BCP-02", scenario: "ไฟฟ้าดับเกิน 4 ชั่วโมง", impactDays: 3, owner: "ประสิทธิ์ ขยันยิ่ง", actions: ["เปิดเครื่องกำเนิดไฟฟ้าให้ปั๊มลมและระบบไอที", "เลื่อนงานพ่นสีไปกะถัดไป", "ทำงานล่วงเวลาชดเชย"], tests: [] },
  { code: "BCP-03", scenario: "เหล็กแผ่น SAPH440 ขาดตลาด", impactDays: 10, owner: "ปิยะนุช ใจดี", actions: ["ถือสต็อกขั้นต่ำ 2 สัปดาห์", "สั่งจากผู้ขายรายที่สองที่ผ่านการอนุมัติ", "แจ้งลูกค้าขออนุมัติวัตถุดิบทดแทนถ้าจำเป็น"], tests: [{ date: "2025-07-15", result: "ต้องปรับปรุง", note: "ยังไม่มีผู้ขายรายที่สองที่อนุมัติแล้ว", by: "ปิยะนุช ใจดี" }] },
  { code: "BCP-04", scenario: "ถูกโจมตีทางไซเบอร์ ระบบหยุด", impactDays: 1, owner: "วีระ ตั้งมั่น", actions: ["ตัดเครือข่ายเครื่องที่ติดเชื้อ", "กู้ข้อมูลจากสำเนาออฟไลน์รายวัน", "ออกใบส่งของด้วยแบบฟอร์มกระดาษชั่วคราว"], tests: [] },
  { code: "BCP-05", scenario: "ขาดแรงงานเกิน 20% จากโรคระบาด", impactDays: 5, owner: "อนุชา ทองดี", actions: ["หมุนพนักงานที่ฝึกข้ามหน้าที่ตามตารางความสามารถ", "จัดลำดับงานลูกค้ายานยนต์ก่อน", "ใช้แรงงานเสริมจากผู้รับเหมาที่ผ่านการอบรม"], tests: [{ date: "2026-03-10", result: "ผ่าน", note: "ตารางความสามารถครอบคลุมทุกตำแหน่งหลักอย่างน้อยสองคน", by: "อนุชา ทองดี" }] },
];

export const contingencyByCode = (code: string) => {
  const c = CONTINGENCIES.find((x) => x.code === code);
  if (!c) throw new Error(`ไม่พบ ${code}`);
  return c;
};

/** ทดสอบแผนอย่างน้อยปีละครั้ง (IATF 6.1.2.3 จ) — ครั้งล่าสุดต้องผ่านด้วย */
export const lastTest = (c: Contingency) => c.tests.at(-1);
export const testDue = (c: Contingency) => !lastTest(c) || addMonths(lastTest(c)!.date, 12) < TODAY || lastTest(c)!.result === "ต้องปรับปรุง";

export function testErrors(code: string, input: { result: "ผ่าน" | "ต้องปรับปรุง"; note: string; by: string; date: string }): Errors {
  contingencyByCode(code);
  const e: Errors = {};
  if (input.note.trim().length < 10) e.note = "บอกวิธีทดสอบและสิ่งที่พบ";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้ทดสอบ";
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่ต้องไม่เกินวันนี้";
  return e;
}

export function testContingency(code: string, input: { result: "ผ่าน" | "ต้องปรับปรุง"; note: string; by: string; date: string }) {
  assertValid(testErrors(code, input));
  const c = contingencyByCode(code);
  return commit(() => {
    c.tests.push({ date: input.date, result: input.result, note: input.note.trim(), by: input.by });
    return c;
  });
}

/* ========================================================== supplier audits */

export type SupplierCert = { vendor: string; standard: "IATF 16949" | "ISO 9001" | "ไม่มี"; certNo?: string; validUntil?: string };

export const CERTS: SupplierCert[] = [
  { vendor: "V-001", standard: "IATF 16949", certNo: "IATF-0441872", validUntil: "2027-05-20" },
  { vendor: "V-002", standard: "ISO 9001", certNo: "TH-QMS-19-0033", validUntil: "2026-12-10" },
  { vendor: "V-003", standard: "ISO 9001", certNo: "TH-QMS-21-0271", validUntil: "2027-08-31" },
  { vendor: "V-004", standard: "ไม่มี" },
];

export const certOf = (vendor: string) => CERTS.find((c) => c.vendor === vendor) ?? { vendor, standard: "ไม่มี" as const };
/** ผู้ส่งมอบวัตถุดิบยานยนต์ต้องได้ ISO 9001 เป็นอย่างน้อย และใบรับรองยังไม่หมดอายุ (IATF 8.4.2.3) */
export const certified = (vendor: string) => {
  const c = certOf(vendor);
  return c.standard !== "ไม่มี" && !!c.validUntil && c.validUntil >= TODAY;
};

export type SupplierAudit = { no: string; vendor: string; planned: string; auditor: string; status: "ตามแผน" | "ปิดแล้ว"; performedOn?: string; score?: number; findings?: string };

export const SUPPLIER_AUDITS: SupplierAudit[] = [
  { no: "SA-2569-01", vendor: "V-001", planned: "2026-07-22", auditor: "ธนพล เจริญผล", status: "ปิดแล้ว", performedOn: "2026-07-22", score: 88, findings: "ไม่มีการตรวจสอบความแข็งของล็อตรีดทุกม้วน ให้แนบใบรับรองผลทดสอบทุกล็อต" },
  { no: "SA-2569-02", vendor: "V-002", planned: "2026-10-28", auditor: "ธนพล เจริญผล", status: "ตามแผน" },
];

export const supplierAuditByNo = (no: string) => {
  const a = SUPPLIER_AUDITS.find((x) => x.no === no);
  if (!a) throw new Error(`ไม่พบ ${no}`);
  return a;
};

/** ผู้ตรวจผู้ส่งมอบต้องมีความสามารถตาม IATF 7.2.4 — VDA 6.3 และ Core Tools */
export const SUPPLIER_AUDITOR_COURSES: CourseCode[] = ["TR-04", "TR-05"];
export const grade = (score: number) => (score >= 90 ? "A" : score >= 80 ? "B" : "C");

export function supplierAuditErrors(input: { vendor: string; planned: string; auditor: string }): Errors {
  const e: Errors = {};
  if (!VENDORS.some((v) => v.code === input.vendor)) e.vendor = "เลือกผู้ขาย";
  else if (SUPPLIER_AUDITS.some((a) => a.vendor === input.vendor && a.status === "ตามแผน")) e.vendor = "ผู้ขายรายนี้มีแผนตรวจค้างอยู่แล้ว";
  if (!isDate(input.planned) || input.planned < TODAY) e.planned = "วันที่ตรวจต้องไม่ย้อนหลัง";
  const missing = SUPPLIER_AUDITOR_COURSES.filter((c) => !isQualified(input.auditor, c));
  if (!PEOPLE.includes(input.auditor)) e.auditor = "เลือกผู้ตรวจ";
  else if (missing.length) e.auditor = `${input.auditor} ยังขาดหลักสูตร ${missing.map(courseName).join(", ")}`;
  return e;
}

export function planSupplierAudit(input: { vendor: string; planned: string; auditor: string }) {
  assertValid(supplierAuditErrors(input));
  return commit(() => {
    const a: SupplierAudit = { no: nextNo(SUPPLIER_AUDITS.map((x) => x.no), `SA-${YEAR}-`, 2), vendor: input.vendor, planned: input.planned, auditor: input.auditor, status: "ตามแผน" };
    SUPPLIER_AUDITS.push(a);
    return a;
  });
}

/** บันทึกผลตรวจ — เกรด C เปิด CAR ให้ผู้ส่งมอบพัฒนาในระบบบริหารบูรณาการ */
export function closeSupplierAudit(no: string, input: { score: number; findings: string }, date = TODAY) {
  const a = supplierAuditByNo(no);
  if (a.status !== "ตามแผน") throw new Error(`${no} ปิดแล้ว`);
  if (!(input.score >= 0 && input.score <= 100)) throw new Error("คะแนน VDA 6.3 เป็นร้อยละ 0–100");
  if (input.findings.trim().length < 10) throw new Error("บอกสิ่งที่พบ");
  return commit(() => {
    a.status = "ปิดแล้ว";
    a.performedOn = date;
    a.score = input.score;
    a.findings = input.findings.trim();
    const car = grade(input.score) === "C"
      ? openCapa({ method: "8D", std: "IATF 16949", ref: a.no, problem: `${vendorName(a.vendor)} ได้คะแนนตรวจกระบวนการ ${input.score}% เกรด C — ${input.findings.trim()}`, owner: "ปิยะนุช ใจดี", team: [a.auditor] })
      : undefined;
    return { audit: a, car };
  });
}

/* =============================================================== scorecard */

export type Scorecard = { month: string; customer: string; ppm: number; delivery: number; premiumFreight: number; disruptions: number };

export const SCORECARDS: Scorecard[] = [
  { month: "2026-07", customer: "C-106", ppm: 0, delivery: 100, premiumFreight: 0, disruptions: 0 },
  { month: "2026-08", customer: "C-106", ppm: 0, delivery: 96, premiumFreight: 1, disruptions: 0 },
];

/** ระดับตามเกณฑ์ของลูกค้า — เขียวคือไม่ต้องทำอะไร แดงต้องตอบด้วย 8D */
export function rating(s: Pick<Scorecard, "ppm" | "delivery" | "disruptions">) {
  if (s.ppm <= 50 && s.delivery >= 98 && s.disruptions === 0) return "เขียว" as const;
  if (s.ppm <= 150 && s.delivery >= 95 && s.disruptions <= 1) return "เหลือง" as const;
  return "แดง" as const;
}

/** PPM ที่ระบบคุณภาพนับเองในเดือนเดียวกัน — ข้อร้องเรียนของลูกค้ารายนั้นเทียบจำนวนที่ส่ง */
export function ourPpm(customer: string, month: string) {
  const shipped = DELIVERIES.filter((d) => d.date.slice(0, 7) === month && SALES_ORDERS.find((s) => s.no === d.so)?.customer === customer).reduce((n, d) => n + d.lines.reduce((m, l) => m + l.qty, 0), 0);
  const rejected = NCRS.filter((n) => n.customer === customer && n.date.slice(0, 7) === month).reduce((k, n) => k + n.qty, 0);
  return { shipped, rejected, ppm: shipped ? Math.round((rejected / shipped) * 1_000_000) : 0 };
}

export function scorecardErrors(input: Scorecard): Errors {
  const e: Errors = {};
  if (!automotiveCustomers().includes(input.customer)) e.customer = "เลือกลูกค้ายานยนต์";
  if (!/^\d{4}-\d{2}$/.test(input.month) || input.month > TODAY.slice(0, 7)) e.month = "เดือนที่ลูกค้ารายงาน";
  else if (SCORECARDS.some((s) => s.customer === input.customer && s.month === input.month)) e.month = "เดือนนี้บันทึกแล้ว";
  if (!(input.ppm >= 0)) e.ppm = "PPM ตามที่ลูกค้ารายงาน";
  if (!(input.delivery >= 0 && input.delivery <= 100)) e.delivery = "ร้อยละ 0–100";
  if (!(Number.isInteger(input.premiumFreight) && input.premiumFreight >= 0)) e.premiumFreight = "จำนวนครั้ง";
  if (!(Number.isInteger(input.disruptions) && input.disruptions >= 0)) e.disruptions = "จำนวนครั้ง";
  return e;
}

/** บันทึก scorecard — ระดับแดงเปิด 8D ในระบบบริหารบูรณาการทันที (IATF 9.1.2.1) */
export function recordScorecard(input: Scorecard) {
  assertValid(scorecardErrors(input));
  return commit(() => {
    const s: Scorecard = { ...input };
    SCORECARDS.push(s);
    const r = rating(s);
    const ref = `SC ${s.customer} ${s.month}`;
    const car = r === "แดง" && !carOf(ref)
      ? openCapa({ method: "8D", std: "IATF 16949", ref, problem: `${customerName(s.customer)} ให้ระดับแดงเดือน ${s.month}: PPM ${s.ppm} ส่งตรงเวลา ${s.delivery}% กระทบสายการผลิต ${s.disruptions} ครั้ง`, owner: "ธนพล เจริญผล", team: ["ชลธิชา มั่นคง", "อนุชา ทองดี"] })
      : undefined;
    return { scorecard: s, rating: r, car };
  });
}

/* ================================================================ poka-yoke */

export const SHIFTS = ["เช้า", "บ่าย"] as const;
export type Shift = (typeof SHIFTS)[number];

export type Device = {
  code: string;
  name: string;
  part: string;
  op: string;
  prevents: string;
  master: string;
  status: "ใช้งาน" | "หยุดใช้";
  checks: { date: string; shift: Shift; ok: boolean; by: string; note?: string }[];
};

const daily = (from: string, days: number, by: string) =>
  Array.from({ length: days }, (_, i) => addDays(from, i)).flatMap((date) => SHIFTS.map((shift) => ({ date, shift, ok: true, by })));

export const DEVICES: Device[] = [
  { code: "PY-01", name: "เกจ Go/No-Go ตรวจรูพร้อมรางคัดออกอัตโนมัติ", part: "FG-5004", op: "0030", prevents: "ชิ้นที่ตำแหน่งรูเยื้องหลุดถึงลูกค้า", master: "ชิ้นต้นแบบเสีย RR-BK220-01 (รูเยื้อง 0.3 มม.)", status: "ใช้งาน", checks: [...daily("2026-09-15", 7, "อนุชา ทองดี"), { date: "2026-09-22", shift: "เช้า", ok: true, by: "อนุชา ทองดี" }] },
  { code: "PY-02", name: "เซนเซอร์ตรวจแผ่นซ้อนที่ป้อนเครื่องปั๊ม", part: "FG-5004", op: "0010", prevents: "ปั๊มสองแผ่นพร้อมกันจนแม่พิมพ์เสียหายและชิ้นงานผิดรูป", master: "แผ่นทดสอบซ้อนสองชั้น", status: "ใช้งาน", checks: daily("2026-09-15", 7, "อนุชา ทองดี") },
];

export const deviceByCode = (code: string) => {
  const d = DEVICES.find((x) => x.code === code);
  if (!d) throw new Error(`ไม่พบ ${code}`);
  return d;
};

/** กะของวันนี้ที่ยังไม่ได้ทวนสอบ — ต้องทวนสอบด้วยชิ้นต้นแบบเสียทุกกะก่อนผลิต (IATF 10.2.4) */
export const missingChecks = () =>
  DEVICES.filter((d) => d.status === "ใช้งาน").flatMap((d) => SHIFTS.filter((s) => !d.checks.some((c) => c.date === TODAY && c.shift === s)).map((s) => ({ device: d.code, shift: s })));

export function verifyErrors(code: string, input: { shift: Shift; ok: boolean; by: string; note: string }): Errors {
  const d = deviceByCode(code);
  const e: Errors = {};
  if (d.status !== "ใช้งาน") e.shift = `${code} หยุดใช้อยู่ ซ่อมแล้วทวนสอบใหม่ผ่าน CAR`;
  else if (d.checks.some((c) => c.date === TODAY && c.shift === input.shift)) e.shift = `กะ${input.shift}วันนี้ทวนสอบแล้ว`;
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้ทวนสอบ";
  if (!input.ok && input.note.trim().length < 10) e.note = "ไม่ผ่านต้องบอกสิ่งที่พบและชิ้นงานที่กักไว้";
  return e;
}

/** ทวนสอบประจำกะ — ไม่ผ่านคือหยุดใช้ ตรวจ 100% ด้วยมือแทน และเปิด CAR ทันที */
export function verifyDevice(code: string, input: { shift: Shift; ok: boolean; by: string; note: string }) {
  assertValid(verifyErrors(code, input));
  const d = deviceByCode(code);
  return commit(() => {
    d.checks.push({ date: TODAY, shift: input.shift, ok: input.ok, by: input.by, note: input.note.trim() || undefined });
    if (input.ok) return { device: d, car: undefined };
    d.status = "หยุดใช้";
    const car = openCapa({ method: "5 Why", std: "IATF 16949", ref: `${d.code} ${TODAY} ${input.shift}`, problem: `${d.name} ไม่จับชิ้นต้นแบบเสีย — ${input.note.trim()}`, owner: "ศักดิ์ชัย วงศ์ไทย", team: [] });
    return { device: d, car };
  });
}

/** กลับมาใช้หลังซ่อม — CAR ของครั้งที่ไม่ผ่านต้องปิดแล้ว */
export function restoreDevice(code: string) {
  const d = deviceByCode(code);
  if (d.status === "ใช้งาน") throw new Error(`${code} ใช้งานอยู่`);
  const failed = [...d.checks].reverse().find((c) => !c.ok);
  const car = failed ? carOf(`${d.code} ${failed.date} ${failed.shift}`) : undefined;
  if (car && car.status !== "ปิดแล้ว") throw new Error(`ปิด ${car.no} ก่อนนำ ${code} กลับมาใช้`);
  return commit(() => {
    d.status = "ใช้งาน";
    return d;
  });
}

/* ======================================================== review inputs */

const toneOf = (bad: boolean, warn = false) => (bad ? "bad" : warn ? "warn" : "ok") as "bad" | "warn" | "ok";

contributeReviewInput({
  key: "iatf-customer", std: ["IATF 16949"], input: "IATF 9.3.2.1", title: "ผลงานต่อลูกค้ายานยนต์และข้อกำหนดเฉพาะ",
  facts: () => {
    const last = SCORECARDS.at(-1);
    const cov = automotiveCustomers().map(coverage).reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total }), { done: 0, total: 0 });
    return [
      { label: "Scorecard ล่าสุด", value: last ? `${last.month} ${rating(last)}` : "—", tone: last ? toneOf(rating(last) === "แดง", rating(last) === "เหลือง") : "idle" },
      { label: "ข้อกำหนดเฉพาะลูกค้าที่นำไปใช้", value: `${cov.done} จาก ${cov.total}`, tone: toneOf(false, cov.done < cov.total) },
    ];
  },
});

contributeReviewInput({
  key: "iatf-risk", std: ["IATF 16949"], input: "IATF 9.3.2.1", title: "ความปลอดภัยผลิตภัณฑ์ แผนฉุกเฉิน และผู้ส่งมอบ",
  facts: () => [
    { label: "ข้อความปลอดภัยผลิตภัณฑ์ที่ยังไม่ผ่าน", value: `${safetyGaps().length} ข้อ`, tone: toneOf(false, safetyGaps().length > 0) },
    { label: "แผนฉุกเฉินที่ต้องทดสอบ", value: `${CONTINGENCIES.filter(testDue).length} แผน`, tone: toneOf(CONTINGENCIES.filter(testDue).length > 2, CONTINGENCIES.some(testDue)) },
    { label: "อุปกรณ์ป้องกันความผิดพลาดหยุดใช้", value: `${DEVICES.filter((d) => d.status === "หยุดใช้").length} ชิ้น`, tone: toneOf(DEVICES.some((d) => d.status === "หยุดใช้")) },
  ],
});
