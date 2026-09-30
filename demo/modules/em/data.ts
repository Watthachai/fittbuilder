import { commit } from "../kit";
import {
  EMR, PEOPLE, TODAY, YEAR, addDays, addMonths, assertValid, carOf, contributeReviewInput, docByCode, isDate, nextNo, openCapa,
} from "../ims/data";
import type { Errors } from "../ims/data";
import { MATERIALS, STOCK_MOVES } from "../mm/data";

export { TODAY };
export type { Errors };

/**
 * การจัดการสิ่งแวดล้อมตาม ISO 14001:2015 บนระบบบริหารบูรณาการ
 *
 * ประเด็นสิ่งแวดล้อมที่มีนัยสำคัญต้องชี้ไปที่เอกสารควบคุมที่ใช้งานอยู่จริงในทะเบียนกลาง
 * ของเสียจากการตัดสต็อกในคลังวัสดุขึ้นมารอชั่งเข้าบัญชีของเสีย ส่งกำจัดได้ไม่เกินที่มีอยู่
 * และต้องใช้ผู้รับกำจัดที่ใบอนุญาตยังไม่หมดอายุ ผลตรวจวัดที่เกินค่ามาตรฐาน กฎหมายที่ประเมิน
 * แล้วไม่สอดคล้อง และอุบัติการณ์ เปิด CAR ในระบบบริหารบูรณาการให้เอง
 */

/* ================================================================ aspects */

export const CONDITIONS = ["ปกติ", "ไม่ปกติ", "ฉุกเฉิน"] as const;
export type Condition = (typeof CONDITIONS)[number];
/** มุมมองวัฏจักรชีวิต (ข้อ 6.1.2) — ไม่ได้มองแค่ในรั้วโรงงาน */
export const STAGES = ["วัตถุดิบ", "ผลิต", "ขนส่ง", "ใช้งาน", "หมดอายุการใช้งาน"] as const;
export type Stage = (typeof STAGES)[number];

export type Aspect = {
  no: string;
  activity: string;
  aspect: string;
  impact: string;
  condition: Condition;
  stage: Stage;
  severity: number;
  frequency: number;
  /** มีกฎหมายหรือพันธะที่เกี่ยวข้อง — มีแล้วมีนัยสำคัญเสมอ */
  legal: boolean;
  /** เอกสารควบคุมการปฏิบัติงานในทะเบียนกลาง */
  control?: string;
  owner: string;
};

export const aspectScore = (a: Pick<Aspect, "severity" | "frequency">) => a.severity * a.frequency;
/** มีนัยสำคัญเมื่อมีกฎหมายเกี่ยวข้อง หรือคะแนนความรุนแรงคูณความถี่ตั้งแต่ 12 */
export const significant = (a: Pick<Aspect, "severity" | "frequency" | "legal">) => a.legal || aspectScore(a) >= 12;

export const ASPECTS: Aspect[] = [
  { no: "ASP-001", activity: "พ่นสีฝุ่นและอบ", aspect: "ไอระเหยสารอินทรีย์จากปล่องเตาอบ", impact: "มลพิษทางอากาศ กลิ่นรบกวนชุมชน", condition: "ปกติ", stage: "ผลิต", severity: 4, frequency: 5, legal: true, control: "SP-15", owner: "มานพ รุ่งเรือง" },
  { no: "ASP-002", activity: "ถ่ายทินเนอร์ลงถังผสม", aspect: "ทินเนอร์หกรั่วไหล", impact: "ปนเปื้อนดินและรางระบายน้ำฝน", condition: "ฉุกเฉิน", stage: "ผลิต", severity: 5, frequency: 2, legal: true, control: "WI-04", owner: EMR },
  { no: "ASP-003", activity: "ล้างชิ้นงานก่อนพ่นสี", aspect: "น้ำเสียจากบ่อฟอสเฟต", impact: "คุณภาพน้ำผิวดิน", condition: "ปกติ", stage: "ผลิต", severity: 4, frequency: 4, legal: true, control: "SP-15", owner: EMR },
  { no: "ASP-004", activity: "เตาอบสี", aspect: "ใช้ไฟฟ้าและก๊าซหุงต้ม", impact: "ใช้ทรัพยากรพลังงาน ก๊าซเรือนกระจก", condition: "ปกติ", stage: "ผลิต", severity: 3, frequency: 5, legal: false, control: "SP-15", owner: "อนุชา ทองดี" },
  { no: "ASP-005", activity: "พ่นสีและทำความสะอาดปืนพ่น", aspect: "กากสีและภาชนะปนเปื้อน", impact: "ของเสียอันตรายต้องกำจัดถูกวิธี", condition: "ปกติ", stage: "ผลิต", severity: 4, frequency: 4, legal: true, control: "SP-15", owner: EMR },
  { no: "ASP-006", activity: "ปั๊มขึ้นรูปเหล็ก", aspect: "เสียงดังจากเครื่องปั๊ม", impact: "เสียงรบกวนชุมชนหลังโรงงาน", condition: "ปกติ", stage: "ผลิต", severity: 3, frequency: 4, legal: true, control: "SP-14", owner: "ประสิทธิ์ ขยันยิ่ง" },
  { no: "ASP-007", activity: "เชื่อมประกอบ", aspect: "ฟูมเชื่อม", impact: "คุณภาพอากาศในพื้นที่ทำงาน", condition: "ปกติ", stage: "ผลิต", severity: 2, frequency: 5, legal: false, owner: "อนุชา ทองดี" },
  { no: "ASP-008", activity: "คลังเก็บสีและทินเนอร์", aspect: "ไฟไหม้จากสารไวไฟ", impact: "มลพิษอากาศ น้ำดับเพลิงปนเปื้อน", condition: "ฉุกเฉิน", stage: "ผลิต", severity: 5, frequency: 1, legal: true, control: "SP-16", owner: EMR },
  { no: "ASP-009", activity: "ส่งสินค้าด้วยรถบริษัท", aspect: "ไอเสียรถบรรทุก", impact: "ฝุ่นละอองและก๊าซเรือนกระจก", condition: "ปกติ", stage: "ขนส่ง", severity: 2, frequency: 4, legal: false, owner: "วรวุฒิ พึ่งบุญ" },
  { no: "ASP-010", activity: "สินค้าหมดอายุการใช้งานที่ลูกค้า", aspect: "เศษเหล็กเคลือบสี", impact: "ของเสียที่ลูกค้าต้องกำจัด", condition: "ปกติ", stage: "หมดอายุการใช้งาน", severity: 2, frequency: 2, legal: false, owner: "ศักดิ์ชัย วงศ์ไทย" },
  { no: "ASP-011", activity: "ซื้อเหล็กแผ่นรีดร้อน", aspect: "พลังงานที่ใช้ผลิตวัตถุดิบ", impact: "ก๊าซเรือนกระจกต้นน้ำ", condition: "ปกติ", stage: "วัตถุดิบ", severity: 3, frequency: 3, legal: false, owner: "ปิยะนุช ใจดี" },
];

export const aspectByNo = (no: string) => {
  const a = ASPECTS.find((x) => x.no === no);
  if (!a) throw new Error(`ไม่พบ ${no}`);
  return a;
};

/** ประเด็นที่มีนัยสำคัญแต่ยังไม่มีเอกสารควบคุมที่ใช้งานอยู่ — ผู้ตรวจประเมินถามข้อนี้ก่อน */
export const uncontrolled = () =>
  ASPECTS.filter((a) => significant(a) && (!a.control || docByCode(a.control).status !== "ใช้งาน"));

export type AspectInput = Omit<Aspect, "no">;

const in1to5 = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;

export function aspectErrors(input: AspectInput): Errors {
  const e: Errors = {};
  if (input.activity.trim().length < 3) e.activity = "ใส่กิจกรรม";
  if (input.aspect.trim().length < 3) e.aspect = "ใส่ประเด็นสิ่งแวดล้อม";
  if (input.impact.trim().length < 3) e.impact = "ใส่ผลกระทบ";
  if (!in1to5(input.severity)) e.severity = "ความรุนแรง 1–5";
  if (!in1to5(input.frequency)) e.frequency = "ความถี่ 1–5";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบ";
  if (significant(input)) {
    if (!input.control) e.control = "ประเด็นที่มีนัยสำคัญต้องมีเอกสารควบคุมการปฏิบัติงาน (ข้อ 8.1)";
    else {
      try {
        if (docByCode(input.control).status !== "ใช้งาน") e.control = `${input.control} ยังไม่ได้ใช้งาน`;
      } catch {
        e.control = `ไม่พบ ${input.control} ในทะเบียนเอกสาร`;
      }
    }
  }
  return e;
}

export function addAspect(input: AspectInput): Aspect {
  assertValid(aspectErrors(input));
  return commit(() => {
    const a: Aspect = { ...input, no: nextNo(ASPECTS.map((x) => x.no), "ASP-", 3), activity: input.activity.trim(), aspect: input.aspect.trim(), impact: input.impact.trim(), control: input.control || undefined };
    ASPECTS.push(a);
    return a;
  });
}

/* =========================================================== obligations */

export type Evaluation = { date: string; result: "สอดคล้อง" | "ไม่สอดคล้อง"; evidence: string; by: string };

export type Obligation = {
  no: string;
  title: string;
  authority: string;
  requirement: string;
  appliesTo: string;
  evaluations: Evaluation[];
};

export const OBLIGATIONS: Obligation[] = [
  {
    no: "LAW-001", title: "พ.ร.บ.โรงงาน พ.ศ. 2535 และประกาศกระทรวงอุตสาหกรรม เรื่องการจัดการสิ่งปฏิกูลหรือวัสดุที่ไม่ใช้แล้ว พ.ศ. 2566", authority: "กรมโรงงานอุตสาหกรรม",
    requirement: "แจ้งประเภทและปริมาณของเสีย ส่งกำจัดกับผู้รับที่ได้รับอนุญาตพร้อมใบกำกับการขนส่ง เก็บของเสียอันตรายไม่เกิน 90 วัน", appliesTo: "ของเสียทุกประเภท",
    evaluations: [{ date: "2026-03-15", result: "สอดคล้อง", evidence: "ใบกำกับการขนส่งครบทุกรอบ ไม่มีของเสียค้างเกิน 90 วัน", by: EMR }],
  },
  {
    no: "LAW-002", title: "ประกาศกระทรวงอุตสาหกรรม เรื่องกำหนดมาตรฐานควบคุมการระบายน้ำทิ้งจากโรงงาน", authority: "กรมโรงงานอุตสาหกรรม",
    requirement: "น้ำทิ้ง BOD ไม่เกิน 20 mg/L, COD ไม่เกิน 120 mg/L, สารแขวนลอยไม่เกิน 50 mg/L, pH 5.5–9.0 ตรวจทุกไตรมาส", appliesTo: "บ่อพักน้ำทิ้งจากการล้างชิ้นงาน",
    evaluations: [{ date: "2026-03-15", result: "สอดคล้อง", evidence: "ผลตรวจไตรมาส 4/68 และ 1/69 อยู่ในเกณฑ์", by: EMR }],
  },
  {
    no: "LAW-003", title: "ประกาศกระทรวงอุตสาหกรรม เรื่องกำหนดค่าปริมาณสารเจือปนในอากาศที่ระบายออกจากโรงงาน", authority: "กรมโรงงานอุตสาหกรรม",
    requirement: "ปล่องเตาอบสี ฝุ่นละอองไม่เกิน 320 mg/Nm³ ไซลีนไม่เกิน 200 ppm ตรวจปีละครั้ง", appliesTo: "ปล่องเตาอบสี",
    evaluations: [{ date: "2025-09-10", result: "สอดคล้อง", evidence: "ผลตรวจปล่อง 06/2568 อยู่ในเกณฑ์", by: EMR }],
  },
  {
    no: "LAW-004", title: "ประกาศกระทรวงทรัพยากรธรรมชาติฯ เรื่องกำหนดมาตรฐานระดับเสียงโดยทั่วไป", authority: "กรมควบคุมมลพิษ",
    requirement: "ระดับเสียงเฉลี่ย 24 ชั่วโมงที่แนวเขตโรงงานไม่เกิน 70 dBA", appliesTo: "แนวรั้วด้านชุมชน",
    evaluations: [{ date: "2026-03-15", result: "สอดคล้อง", evidence: "ผลตรวจวัดเสียง 01/2569 ค่าเฉลี่ย 64 dBA", by: EMR }],
  },
  {
    no: "LAW-005", title: "พ.ร.บ.วัตถุอันตราย พ.ศ. 2535 และระบบข้อมูลความปลอดภัยสารเคมี (SDS)", authority: "กรมโรงงานอุตสาหกรรม",
    requirement: "มี SDS ภาษาไทยฉบับปัจจุบันทุกสาร เก็บแยกตามความเข้ากันได้ ปริมาณไม่เกินที่ขออนุญาต", appliesTo: "สี ทินเนอร์ น้ำยาฟอสเฟต",
    evaluations: [{ date: "2025-08-20", result: "สอดคล้อง", evidence: "SDS ครบทุกสาร ณ วันตรวจ", by: EMR }],
  },
  {
    no: "LAW-006", title: "กฎกระทรวงกำหนดมาตรฐานในการบริหาร จัดการ และดำเนินการด้านความปลอดภัยฯ เกี่ยวกับการป้องกันและระงับอัคคีภัย", authority: "กรมสวัสดิการและคุ้มครองแรงงาน",
    requirement: "ฝึกซ้อมดับเพลิงและอพยพหนีไฟปีละครั้ง อบรมดับเพลิงขั้นต้นไม่น้อยกว่าร้อยละ 40 ของลูกจ้างแต่ละหน่วยงาน", appliesTo: "ทุกพื้นที่",
    evaluations: [{ date: "2026-03-15", result: "สอดคล้อง", evidence: "ซ้อมอพยพ 11/2568 อบรมดับเพลิงครบ", by: EMR }],
  },
];

export const obligationByNo = (no: string) => {
  const o = OBLIGATIONS.find((x) => x.no === no);
  if (!o) throw new Error(`ไม่พบ ${no}`);
  return o;
};

export const lastEvaluation = (o: Obligation) => o.evaluations[o.evaluations.length - 1];
/** ประเมินความสอดคล้องอย่างน้อยปีละครั้ง (ข้อ 9.1.2) */
export const nextEvaluation = (o: Obligation) => (lastEvaluation(o) ? addMonths(lastEvaluation(o).date, 12) : TODAY);
export const evaluationDue = () => OBLIGATIONS.filter((o) => nextEvaluation(o) <= addDays(TODAY, 30));

export type ObligationInput = Omit<Obligation, "no" | "evaluations">;

export function obligationErrors(input: ObligationInput): Errors {
  const e: Errors = {};
  if (input.title.trim().length < 10) e.title = "ใส่ชื่อกฎหมายหรือพันธะ";
  else if (OBLIGATIONS.some((o) => o.title === input.title.trim())) e.title = "มีในทะเบียนแล้ว";
  if (input.authority.trim().length < 3) e.authority = "ใส่หน่วยงานกำกับ";
  if (input.requirement.trim().length < 10) e.requirement = "สรุปสิ่งที่ต้องทำให้สอดคล้อง";
  if (input.appliesTo.trim().length < 3) e.appliesTo = "ใช้กับพื้นที่หรือกิจกรรมใด";
  return e;
}

export function addObligation(input: ObligationInput) {
  assertValid(obligationErrors(input));
  return commit(() => {
    const o: Obligation = { no: nextNo(OBLIGATIONS.map((x) => x.no), "LAW-", 3), title: input.title.trim(), authority: input.authority.trim(), requirement: input.requirement.trim(), appliesTo: input.appliesTo.trim(), evaluations: [] };
    OBLIGATIONS.push(o);
    return o;
  });
}

export function evaluationErrors(no: string, input: Omit<Evaluation, "date">): Errors {
  obligationByNo(no);
  const e: Errors = {};
  if (input.evidence.trim().length < 10) e.evidence = "บอกหลักฐานที่ใช้ประเมิน เช่น ผลตรวจวัด ใบกำกับ";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้ประเมิน";
  return e;
}

/** ประเมินความสอดคล้อง — ไม่สอดคล้องเปิด CAR ในระบบบริหารบูรณาการทันที */
export function evaluateObligation(no: string, input: Omit<Evaluation, "date">, date = TODAY) {
  assertValid(evaluationErrors(no, input));
  const o = obligationByNo(no);
  return commit(() => {
    const ev: Evaluation = { date, result: input.result, evidence: input.evidence.trim(), by: input.by };
    o.evaluations.push(ev);
    const ref = `${o.no} ${date}`;
    const car = input.result === "ไม่สอดคล้อง" && !carOf(ref)
      ? openCapa({ method: "5 Why", std: "ISO 14001", ref, problem: `ไม่สอดคล้องกับ ${o.title}: ${input.evidence.trim()}`, owner: EMR, team: [] })
      : undefined;
    return { obligation: o, car };
  });
}

/* =================================================== waste and chemicals */

export type WasteType = { code: string; name: string; hazardous: boolean; wasteCode: string; storage: string; method: string };

export const WASTE_TYPES: WasteType[] = [
  { code: "W-01", name: "กากสีและตะกอนสี", hazardous: true, wasteCode: "080113", storage: "โรงเก็บของเสียอันตราย ช่อง A", method: "049 เผาร่วมในเตาเผาปูนซีเมนต์" },
  { code: "W-02", name: "ภาชนะบรรจุปนเปื้อนสีและทินเนอร์", hazardous: true, wasteCode: "150110", storage: "โรงเก็บของเสียอันตราย ช่อง B", method: "049 เผาร่วมในเตาเผาปูนซีเมนต์" },
  { code: "W-03", name: "ทินเนอร์ใช้แล้ว", hazardous: true, wasteCode: "140603", storage: "โรงเก็บของเสียอันตราย ช่อง C", method: "021 นำกลับมาใช้ใหม่ (กลั่น)" },
  { code: "W-04", name: "เศษเหล็กและชิ้นงานเสีย", hazardous: false, wasteCode: "120101", storage: "ลานเศษเหล็ก", method: "041 นำกลับมาใช้ใหม่ (หลอม)" },
  { code: "W-05", name: "กระดาษและกล่องลูกฟูก", hazardous: false, wasteCode: "150101", storage: "ลานคัดแยกขยะรีไซเคิล", method: "041 นำกลับมาใช้ใหม่" },
];

export const wasteType = (code: string) => {
  const w = WASTE_TYPES.find((x) => x.code === code);
  if (!w) throw new Error(`ไม่พบประเภทของเสีย ${code}`);
  return w;
};

export type Generation = { date: string; type: string; kg: number; source: string };

export const GENERATIONS: Generation[] = [
  { date: "2026-06-30", type: "W-01", kg: 210, source: "รวมเดือนมิถุนายน" },
  { date: "2026-06-30", type: "W-02", kg: 85, source: "รวมเดือนมิถุนายน" },
  { date: "2026-06-30", type: "W-03", kg: 160, source: "รวมเดือนมิถุนายน" },
  { date: "2026-07-31", type: "W-01", kg: 195, source: "รวมเดือนกรกฎาคม" },
  { date: "2026-07-31", type: "W-02", kg: 80, source: "รวมเดือนกรกฎาคม" },
  { date: "2026-07-31", type: "W-03", kg: 155, source: "รวมเดือนกรกฎาคม" },
  { date: "2026-08-31", type: "W-01", kg: 180, source: "รวมเดือนสิงหาคม" },
  { date: "2026-08-31", type: "W-02", kg: 70, source: "รวมเดือนสิงหาคม" },
  { date: "2026-08-31", type: "W-03", kg: 150, source: "รวมเดือนสิงหาคม" },
  { date: "2026-08-31", type: "W-04", kg: 1240, source: "รวมเดือนสิงหาคม" },
  { date: "2026-08-31", type: "W-05", kg: 320, source: "รวมเดือนสิงหาคม" },
];

export type Receiver = { name: string; license: string; validUntil: string; methods: string[] };

/** ผู้รับกำจัดที่ได้รับอนุญาต — ใบอนุญาตหมดอายุแล้วส่งของเสียให้ไม่ได้ */
export const RECEIVERS: Receiver[] = [
  { name: "บจก. ปูนซีเมนต์ไทยอุตสาหกรรม (โรงงานแก่งคอย)", license: "3-60(1)-1/40สบ", validUntil: "2027-12-31", methods: ["049 เผาร่วมในเตาเผาปูนซีเมนต์"] },
  { name: "บจก. รีไซเคิลโซลเว้นท์", license: "3-106-12/58ชบ", validUntil: "2026-09-30", methods: ["021 นำกลับมาใช้ใหม่ (กลั่น)"] },
  { name: "หจก. ค้าเหล็กเก่าบางปู", license: "3-105-44/61สป", validUntil: "2028-06-30", methods: ["041 นำกลับมาใช้ใหม่ (หลอม)", "041 นำกลับมาใช้ใหม่"] },
];

export type Disposal = { no: string; date: string; type: string; kg: number; receiver: string; manifest: string; certificate?: string };

export const DISPOSALS: Disposal[] = [
  { no: "WD-2569-011", date: "2026-07-20", type: "W-01", kg: 210, receiver: RECEIVERS[0].name, manifest: "สก.3-69-00418", certificate: "COD-69-1187" },
  { no: "WD-2569-012", date: "2026-07-20", type: "W-02", kg: 85, receiver: RECEIVERS[0].name, manifest: "สก.3-69-00419", certificate: "COD-69-1188" },
  { no: "WD-2569-013", date: "2026-08-12", type: "W-03", kg: 315, receiver: RECEIVERS[1].name, manifest: "สก.3-69-00502", certificate: "RS-69-0331" },
  { no: "WD-2569-014", date: "2026-09-05", type: "W-04", kg: 1240, receiver: RECEIVERS[2].name, manifest: "ขายเศษเหล็ก 09/69" },
  { no: "WD-2569-015", date: "2026-09-10", type: "W-01", kg: 195, receiver: RECEIVERS[0].name, manifest: "สก.3-69-00561" },
];

export const disposalByNo = (no: string) => {
  const d = DISPOSALS.find((x) => x.no === no);
  if (!d) throw new Error(`ไม่พบ ${no}`);
  return d;
};

/** ของเสียที่ยังเก็บอยู่ และวันที่เกิดของล็อตที่เก่าที่สุดที่ยังไม่ส่งกำจัด (เข้าก่อนออกก่อน) */
export function onHand(type: string) {
  const gen = GENERATIONS.filter((g) => g.type === type).sort((a, b) => a.date.localeCompare(b.date));
  let out = DISPOSALS.filter((d) => d.type === type).reduce((n, d) => n + d.kg, 0);
  const kg = gen.reduce((n, g) => n + g.kg, 0) - out;
  let oldest: string | undefined;
  for (const g of gen) {
    if (out >= g.kg) {
      out -= g.kg;
      continue;
    }
    oldest = g.date;
    break;
  }
  return { kg, oldest, days: oldest ? Math.round((Date.parse(TODAY) - Date.parse(oldest)) / 86_400_000) : 0 };
}

/** ของเสียอันตรายที่เก็บนานเกิน 60 วัน — เตือนก่อนถึงกำหนด 90 วันตามกฎหมาย */
export const storedTooLong = () => WASTE_TYPES.filter((w) => w.hazardous && onHand(w.code).days > 60);

/** ของที่คลังวัสดุตัดเป็นของเสียแล้ว แต่ยังไม่ได้ชั่งเข้าบัญชีของเสีย */
export const pendingScrap = () =>
  STOCK_MOVES.filter((m) => m.kind === "ตัดของเสีย" && m.doc && !GENERATIONS.some((g) => g.source === m.doc));

export type GenerationInput = { type: string; kg: number; source: string; date: string };

export function generationErrors(input: GenerationInput): Errors {
  const e: Errors = {};
  if (!WASTE_TYPES.some((w) => w.code === input.type)) e.type = "เลือกประเภทของเสีย";
  if (!(input.kg > 0)) e.kg = "น้ำหนักเป็นกิโลกรัม มากกว่าศูนย์";
  if (input.source.trim().length < 3) e.source = "ใส่ที่มา เช่น เอกสารตัดสต็อก";
  else if (GENERATIONS.some((g) => g.source === input.source.trim() && g.source.startsWith("AJ-"))) e.source = `${input.source} ชั่งเข้าบัญชีแล้ว`;
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่ต้องไม่เกินวันนี้";
  return e;
}

export function recordGeneration(input: GenerationInput) {
  assertValid(generationErrors(input));
  return commit(() => {
    const g: Generation = { date: input.date, type: input.type, kg: input.kg, source: input.source.trim() };
    GENERATIONS.push(g);
    return g;
  });
}

export type DisposalInput = { type: string; kg: number; receiver: string; manifest: string; date: string };

export function disposalErrors(input: DisposalInput): Errors {
  const e: Errors = {};
  const w = WASTE_TYPES.find((x) => x.code === input.type);
  if (!w) e.type = "เลือกประเภทของเสีย";
  else if (!(input.kg > 0)) e.kg = "น้ำหนักมากกว่าศูนย์";
  else if (input.kg > onHand(w.code).kg) e.kg = `ส่งได้ไม่เกินที่เก็บอยู่ ${onHand(w.code).kg.toLocaleString("th-TH")} กก.`;
  const r = RECEIVERS.find((x) => x.name === input.receiver);
  if (!r) e.receiver = "เลือกผู้รับกำจัดที่ได้รับอนุญาต";
  else if (r.validUntil < (input.date || TODAY)) e.receiver = `ใบอนุญาต ${r.license} หมดอายุ ${r.validUntil} — ส่งของเสียให้ไม่ได้`;
  else if (w && !r.methods.includes(w.method)) e.receiver = `${r.name} ไม่ได้รับอนุญาตวิธี ${w.method}`;
  if (w?.hazardous && input.manifest.trim().length < 5) e.manifest = "ของเสียอันตรายต้องมีเลขใบกำกับการขนส่ง";
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่ต้องไม่เกินวันนี้";
  return e;
}

export function recordDisposal(input: DisposalInput) {
  assertValid(disposalErrors(input));
  return commit(() => {
    const d: Disposal = { no: nextNo(DISPOSALS.map((x) => x.no), `WD-${YEAR}-`, 3), date: input.date, type: input.type, kg: input.kg, receiver: input.receiver, manifest: input.manifest.trim() };
    DISPOSALS.push(d);
    return d;
  });
}

/** ใบรับรองการกำจัดจากผู้รับ — ปิดวงจรว่าของเสียถูกกำจัดจริง */
export function recordCertificate(no: string, certificate: string) {
  const d = disposalByNo(no);
  if (d.certificate) throw new Error(`${no} ได้รับใบรับรองแล้ว`);
  if (certificate.trim().length < 3) throw new Error("ใส่เลขใบรับรองการกำจัด");
  return commit(() => {
    d.certificate = certificate.trim();
    return d;
  });
}

export type Chemical = {
  code: string;
  name: string;
  hazard: string;
  sdsDate: string;
  location: string;
  maxQty: number;
  unit: string;
  /** รหัสวัสดุในระบบจัดซื้อ — ปริมาณคงเหลืออ่านจากคลังวัสดุ */
  material?: string;
  qty?: number;
};

export const CHEMICALS: Chemical[] = [
  { code: "CH-01", name: "สีพ่นอุตสาหกรรม สีเทา", hazard: "ไวไฟ ระคายเคือง", sdsDate: "2024-05-10", location: "คลังสารไวไฟ", maxQty: 60, unit: "ถัง", material: "MAT-1003" },
  { code: "CH-02", name: "ทินเนอร์ผสมสี", hazard: "ไวไฟมาก เป็นพิษต่อระบบประสาท", sdsDate: "2020-11-02", location: "คลังสารไวไฟ", maxQty: 40, unit: "ถัง", qty: 18 },
  { code: "CH-03", name: "น้ำยาฟอสเฟตปรับสภาพผิว", hazard: "กัดกร่อน", sdsDate: "2023-02-14", location: "ห้องเตรียมผิวชิ้นงาน", maxQty: 20, unit: "แกลลอน", qty: 12 },
  { code: "CH-04", name: "ก๊าซหุงต้ม (LPG) เตาอบ", hazard: "ก๊าซไวไฟ", sdsDate: "2025-01-08", location: "ลานถังก๊าซ", maxQty: 8, unit: "ถัง 48 กก.", qty: 6 },
];

export const chemicalByCode = (code: string) => {
  const c = CHEMICALS.find((x) => x.code === code);
  if (!c) throw new Error(`ไม่พบ ${code}`);
  return c;
};

/** ปริมาณคงเหลือ — สารที่ซื้อผ่านระบบจัดซื้ออ่านจากคลังวัสดุ ไม่นับซ้ำ */
export const qtyOf = (c: Chemical) => (c.material ? MATERIALS.find((m) => m.code === c.material)?.stock ?? 0 : c.qty ?? 0);
/** SDS ต้องทบทวนทุก 5 ปี (LAW-005) */
export const sdsExpired = (c: Chemical) => addMonths(c.sdsDate, 60) < TODAY;
export const overStored = (c: Chemical) => qtyOf(c) > c.maxQty;
export const chemicalIssues = () => CHEMICALS.filter((c) => sdsExpired(c) || overStored(c));

export function updateSds(code: string, date: string) {
  const c = chemicalByCode(code);
  if (!isDate(date) || date > TODAY) throw new Error("วันที่ SDS ต้องไม่เกินวันนี้");
  if (date <= c.sdsDate) throw new Error("SDS ฉบับใหม่ต้องใหม่กว่าฉบับเดิม");
  return commit(() => {
    c.sdsDate = date;
    return c;
  });
}

/* ============================================================ monitoring */

export type Parameter = { code: string; group: string; point: string; name: string; unit: string; min?: number; max?: number; law: string; everyMonths: number };

export const PARAMETERS: Parameter[] = [
  { code: "WW-BOD", group: "น้ำทิ้ง", point: "บ่อพักก่อนระบาย", name: "BOD", unit: "mg/L", max: 20, law: "LAW-002", everyMonths: 3 },
  { code: "WW-COD", group: "น้ำทิ้ง", point: "บ่อพักก่อนระบาย", name: "COD", unit: "mg/L", max: 120, law: "LAW-002", everyMonths: 3 },
  { code: "WW-SS", group: "น้ำทิ้ง", point: "บ่อพักก่อนระบาย", name: "สารแขวนลอย", unit: "mg/L", max: 50, law: "LAW-002", everyMonths: 3 },
  { code: "WW-PH", group: "น้ำทิ้ง", point: "บ่อพักก่อนระบาย", name: "pH", unit: "", min: 5.5, max: 9, law: "LAW-002", everyMonths: 3 },
  { code: "ST-TSP", group: "อากาศจากปล่อง", point: "ปล่องเตาอบสี", name: "ฝุ่นละออง", unit: "mg/Nm³", max: 320, law: "LAW-003", everyMonths: 12 },
  { code: "ST-XYL", group: "อากาศจากปล่อง", point: "ปล่องเตาอบสี", name: "ไซลีน", unit: "ppm", max: 200, law: "LAW-003", everyMonths: 12 },
  { code: "NS-LEQ", group: "เสียง", point: "แนวรั้วด้านชุมชน", name: "ระดับเสียงเฉลี่ย 24 ชม.", unit: "dBA", max: 70, law: "LAW-004", everyMonths: 6 },
];

export const parameterByCode = (code: string) => {
  const p = PARAMETERS.find((x) => x.code === code);
  if (!p) throw new Error(`ไม่พบ ${code}`);
  return p;
};

export const exceeds = (p: Parameter, v: number) => (p.max !== undefined && v > p.max) || (p.min !== undefined && v < p.min);
export const limitText = (p: Parameter) => (p.min !== undefined ? `${p.min}–${p.max}` : `≤ ${p.max}`) + (p.unit ? ` ${p.unit}` : "");

export type Monitoring = { no: string; date: string; group: string; lab: string; values: Record<string, number>; car?: string };

export const MONITORINGS: Monitoring[] = [
  { no: "MON-2569-01", date: "2026-01-14", group: "เสียง", lab: "บจก. เอ็นไวรอนเมนทัลแล็บ", values: { "NS-LEQ": 64 } },
  { no: "MON-2569-02", date: "2026-03-10", group: "น้ำทิ้ง", lab: "บจก. เอ็นไวรอนเมนทัลแล็บ", values: { "WW-BOD": 14, "WW-COD": 88, "WW-SS": 31, "WW-PH": 7.2 } },
  { no: "MON-2569-03", date: "2026-06-09", group: "น้ำทิ้ง", lab: "บจก. เอ็นไวรอนเมนทัลแล็บ", values: { "WW-BOD": 18, "WW-COD": 104, "WW-SS": 42, "WW-PH": 6.8 } },
  { no: "MON-2569-04", date: "2026-06-18", group: "อากาศจากปล่อง", lab: "บจก. เอ็นไวรอนเมนทัลแล็บ", values: { "ST-TSP": 95, "ST-XYL": 132 } },
  { no: "MON-2569-05", date: "2026-07-15", group: "เสียง", lab: "บจก. เอ็นไวรอนเมนทัลแล็บ", values: { "NS-LEQ": 67 } },
];

export const GROUPS = [...new Set(PARAMETERS.map((p) => p.group))];

/** รอบตรวจวัดถัดไปของแต่ละกลุ่ม — จากผลครั้งล่าสุดบวกรอบที่กฎหมายกำหนด */
export function monitoringDue() {
  return GROUPS.map((group) => {
    const every = Math.min(...PARAMETERS.filter((p) => p.group === group).map((p) => p.everyMonths));
    const last = MONITORINGS.filter((m) => m.group === group).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const due = last ? addMonths(last.date, every) : TODAY;
    return { group, last: last?.date, due, late: due < TODAY, soon: due <= addDays(TODAY, 30) };
  });
}

export const exceedancesOf = (m: Monitoring) => Object.entries(m.values).filter(([code, v]) => exceeds(parameterByCode(code), v)).map(([code, v]) => ({ parameter: parameterByCode(code), value: v }));

export type MonitoringInput = { group: string; date: string; lab: string; values: Record<string, number | undefined> };

export function monitoringErrors(input: MonitoringInput): Errors {
  const e: Errors = {};
  if (!GROUPS.includes(input.group)) e.group = "เลือกกลุ่มการตรวจวัด";
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่เก็บตัวอย่างต้องไม่เกินวันนี้";
  if (input.lab.trim().length < 3) e.lab = "ใส่ห้องปฏิบัติการที่ตรวจ";
  const missing = PARAMETERS.filter((p) => p.group === input.group && !Number.isFinite(input.values[p.code]));
  if (missing.length) e.values = `ใส่ผล ${missing.map((p) => p.name).join(", ")}`;
  return e;
}

/** บันทึกผลตรวจวัด — เกินค่ามาตรฐานข้อใดก็ตามเปิด CAR ในระบบบริหารบูรณาการทันที */
export function recordMonitoring(input: MonitoringInput) {
  assertValid(monitoringErrors(input));
  return commit(() => {
    const values = Object.fromEntries(PARAMETERS.filter((p) => p.group === input.group).map((p) => [p.code, input.values[p.code]!]));
    const m: Monitoring = { no: nextNo(MONITORINGS.map((x) => x.no), `MON-${YEAR}-`, 2), date: input.date, group: input.group, lab: input.lab.trim(), values };
    MONITORINGS.push(m);
    const over = exceedancesOf(m);
    if (over.length) {
      const car = openCapa({
        method: "5 Why", std: "ISO 14001", ref: m.no, owner: EMR, team: [],
        problem: `${input.group}เกินค่ามาตรฐาน: ${over.map((x) => `${x.parameter.name} ${x.value}${x.parameter.unit ? ` ${x.parameter.unit}` : ""} (เกณฑ์ ${limitText(x.parameter)})`).join(", ")}`,
      });
      m.car = car.no;
    }
    return m;
  });
}

/* ============================================================= emergency */

export type Plan = { code: string; scenario: string; area: string; response: string[]; equipment: string; everyMonths: number };

export const PLANS: Plan[] = [
  { code: "EP-01", scenario: "สารเคมีหกรั่วไหล", area: "พื้นที่ผสมสีและคลังสารไวไฟ", response: ["หยุดการรั่วไหลและกั้นพื้นที่", "ใช้ชุดดูดซับปิดรางระบายน้ำฝน", "เก็บวัสดุดูดซับเป็นของเสียอันตราย W-02", "รายงานผู้แทนฝ่ายบริหารด้านสิ่งแวดล้อม"], equipment: "ชุดดูดซับสารเคมี 2 ชุด ถาดรอง แผ่นปิดท่อระบาย", everyMonths: 12 },
  { code: "EP-02", scenario: "อัคคีภัย", area: "ทั้งโรงงาน", response: ["กดสัญญาณเตือนภัย", "ทีมดับเพลิงขั้นต้นระงับเหตุ", "อพยพไปจุดรวมพล นับจำนวน", "กั้นน้ำดับเพลิงไม่ให้ลงรางน้ำฝน"], equipment: "ถังดับเพลิง 24 ถัง ตู้สายฉีดน้ำ 4 ตู้ ประตูกั้นน้ำ", everyMonths: 12 },
  { code: "EP-03", scenario: "ก๊าซ LPG รั่วที่เตาอบ", area: "ลานถังก๊าซและเตาอบสี", response: ["ปิดวาล์วหลัก ตัดไฟเตาอบ", "ห้ามก่อประกายไฟ เปิดระบายอากาศ", "อพยพรัศมี 50 เมตร", "แจ้งผู้จำหน่ายก๊าซตรวจสอบก่อนเปิดใช้"], equipment: "เครื่องตรวจจับก๊าซ วาล์วตัดฉุกเฉิน", everyMonths: 12 },
];

export type Drill = { no: string; plan: string; date: string; participants: number; minutes: number; result: "ผ่าน" | "ต้องปรับปรุง"; findings: string; improvement?: string; by: string };

export const DRILLS: Drill[] = [
  { no: "DR-2568-02", plan: "EP-02", date: "2025-11-20", participants: 86, minutes: 7, result: "ผ่าน", findings: "อพยพครบใน 7 นาที ตามเป้าไม่เกิน 8 นาที", by: EMR },
  { no: "DR-2569-01", plan: "EP-01", date: "2026-07-29", participants: 12, minutes: 9, result: "ต้องปรับปรุง", findings: "ชุดดูดซับอยู่ไกลจุดถ่ายถัง ใช้เวลาเดินไปหยิบ 3 นาที", improvement: "ย้ายชุดดูดซับไว้ติดจุดถ่ายถังและเพิ่มหนึ่งชุด", by: EMR },
  { no: "DR-2568-01", plan: "EP-03", date: "2025-06-12", participants: 8, minutes: 5, result: "ผ่าน", findings: "ปิดวาล์วและอพยพได้ตามขั้นตอน", by: EMR },
];

export const planByCode = (code: string) => {
  const p = PLANS.find((x) => x.code === code);
  if (!p) throw new Error(`ไม่พบแผน ${code}`);
  return p;
};

export const lastDrill = (code: string) => DRILLS.filter((d) => d.plan === code).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
export const drillDue = (p: Plan) => (lastDrill(p.code) ? addMonths(lastDrill(p.code)!.date, p.everyMonths) : TODAY);
export const drillsOverdue = () => PLANS.filter((p) => drillDue(p) < TODAY);

export type DrillInput = Omit<Drill, "no">;

export function drillErrors(input: DrillInput): Errors {
  const e: Errors = {};
  if (!PLANS.some((p) => p.code === input.plan)) e.plan = "เลือกแผนที่ซ้อม";
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่ซ้อมต้องไม่เกินวันนี้";
  if (!(input.participants > 0)) e.participants = "จำนวนผู้เข้าร่วม";
  if (!(input.minutes > 0)) e.minutes = "เวลาที่ใช้ (นาที)";
  if (input.findings.trim().length < 10) e.findings = "บอกสิ่งที่พบจากการซ้อม";
  if (input.result === "ต้องปรับปรุง" && (input.improvement ?? "").trim().length < 10) e.improvement = "ซ้อมแล้วต้องปรับปรุง ต้องบอกว่าจะปรับอะไร";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้บันทึก";
  return e;
}

export function recordDrill(input: DrillInput) {
  assertValid(drillErrors(input));
  return commit(() => {
    const d: Drill = { ...input, no: nextNo(DRILLS.map((x) => x.no), `DR-${YEAR}-`, 2), findings: input.findings.trim(), improvement: input.improvement?.trim() || undefined };
    DRILLS.push(d);
    return d;
  });
}

export type Incident = {
  no: string;
  date: string;
  plan?: string;
  description: string;
  impact: string;
  containment: string;
  severity: "รุนแรง" | "ปานกลาง" | "เล็กน้อย";
  /** รายงานหน่วยงานรัฐแล้ว — เหตุรุนแรงต้องรายงาน */
  reported?: string;
  status: "เปิด" | "ปิดแล้ว";
};

export const INCIDENTS: Incident[] = [
  {
    no: "INC-2569-01", date: "2026-05-02", plan: "EP-01", description: "ทินเนอร์หกจากถังขณะถ่ายประมาณ 5 ลิตร", impact: "ไหลลงรางระบายน้ำฝนบางส่วน ไม่ออกนอกโรงงาน",
    containment: "ปิดรางด้วยแผ่นปิด ใช้วัสดุดูดซับ เก็บเป็นของเสีย W-02", severity: "ปานกลาง", status: "ปิดแล้ว",
  },
];

export const incidentByNo = (no: string) => {
  const i = INCIDENTS.find((x) => x.no === no);
  if (!i) throw new Error(`ไม่พบ ${no}`);
  return i;
};

export type IncidentInput = Omit<Incident, "no" | "status" | "reported">;

export function incidentErrors(input: IncidentInput): Errors {
  const e: Errors = {};
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่เกิดเหตุต้องไม่เกินวันนี้";
  if (input.description.trim().length < 10) e.description = "เล่าสิ่งที่เกิดขึ้น";
  if (input.impact.trim().length < 5) e.impact = "ผลกระทบต่อสิ่งแวดล้อม";
  if (input.containment.trim().length < 10) e.containment = "ทำอะไรไปแล้วเพื่อควบคุมเหตุ";
  return e;
}

/** รายงานอุบัติการณ์ (ข้อ 10.2) — เปิด CAR ให้หาสาเหตุทุกครั้ง */
export function reportIncident(input: IncidentInput) {
  assertValid(incidentErrors(input));
  return commit(() => {
    const i: Incident = { ...input, no: nextNo(INCIDENTS.map((x) => x.no), `INC-${YEAR}-`, 2), description: input.description.trim(), impact: input.impact.trim(), containment: input.containment.trim(), status: "เปิด" };
    INCIDENTS.push(i);
    const car = openCapa({ method: "5 Why", std: "ISO 14001", ref: i.no, problem: `${i.description} — ${i.impact}`, owner: EMR, team: [] });
    return { incident: i, car };
  });
}

export function markReported(no: string, text: string) {
  const i = incidentByNo(no);
  if (text.trim().length < 5) throw new Error("บอกหน่วยงานและวันที่รายงาน");
  return commit(() => {
    i.reported = text.trim();
    return i;
  });
}

export function closeIncidentErrors(no: string): Errors {
  const i = incidentByNo(no);
  const e: Errors = {};
  if (i.status === "ปิดแล้ว") e.close = `${no} ปิดแล้ว`;
  else if (i.severity === "รุนแรง" && !i.reported) e.close = "เหตุรุนแรงต้องรายงานหน่วยงานรัฐก่อนปิด";
  else if (carOf(i.no)?.status !== "ปิดแล้ว") e.close = `ปิด ${carOf(i.no)?.no ?? "CAR"} ในระบบบริหารบูรณาการก่อน`;
  return e;
}

export function closeIncident(no: string) {
  assertValid(closeIncidentErrors(no));
  const i = incidentByNo(no);
  return commit(() => {
    i.status = "ปิดแล้ว";
    return i;
  });
}

/* ======================================================== review inputs */

const toneOf = (bad: boolean, warn = false) => (bad ? "bad" : warn ? "warn" : "ok") as "bad" | "warn" | "ok";

contributeReviewInput({
  key: "em-compliance", std: ["ISO 14001"], input: "ค 6", title: "การประเมินความสอดคล้องกับกฎหมาย",
  facts: () => {
    const failing = OBLIGATIONS.filter((o) => lastEvaluation(o)?.result === "ไม่สอดคล้อง").length;
    return [
      { label: "ไม่สอดคล้องครั้งล่าสุด", value: `${failing} ฉบับ`, tone: toneOf(failing > 0) },
      { label: "ถึงรอบประเมิน", value: `${evaluationDue().length} ฉบับ`, tone: toneOf(false, evaluationDue().length > 0) },
    ];
  },
});

contributeReviewInput({
  key: "em-aspects", std: ["ISO 14001"], input: "ข 2", title: "ประเด็นสิ่งแวดล้อมที่มีนัยสำคัญ",
  facts: () => [
    { label: "มีนัยสำคัญ", value: `${ASPECTS.filter(significant).length} จาก ${ASPECTS.length} ประเด็น`, tone: "idle" },
    { label: "ไม่มีเอกสารควบคุมที่ใช้งาน", value: `${uncontrolled().length} ประเด็น`, tone: toneOf(uncontrolled().length > 0) },
  ],
});

contributeReviewInput({
  key: "em-monitoring", std: ["ISO 14001"], input: "ค 5", title: "ผลการตรวจวัดสิ่งแวดล้อม",
  facts: () => {
    const year = MONITORINGS.filter((m) => m.date.slice(0, 4) === TODAY.slice(0, 4));
    const over = year.filter((m) => exceedancesOf(m).length > 0).length;
    const late = monitoringDue().filter((d) => d.late).length;
    return [
      { label: "เกินค่ามาตรฐานปีนี้", value: `${over} จาก ${year.length} ครั้ง`, tone: toneOf(over > 0) },
      { label: "เลยรอบตรวจวัด", value: `${late} กลุ่ม`, tone: toneOf(late > 0) },
    ];
  },
});

contributeReviewInput({
  key: "em-waste", std: ["ISO 14001"], input: "ค 5", title: "ของเสียและสารเคมี",
  facts: () => {
    const haz = WASTE_TYPES.filter((w) => w.hazardous).reduce((n, w) => n + onHand(w.code).kg, 0);
    return [
      { label: "ของเสียอันตรายที่เก็บอยู่", value: `${haz.toLocaleString("th-TH")} กก.`, tone: toneOf(false, storedTooLong().length > 0) },
      { label: "สารเคมีที่ SDS หมดอายุหรือเก็บเกิน", value: `${chemicalIssues().length} รายการ`, tone: toneOf(chemicalIssues().length > 0) },
    ];
  },
});

contributeReviewInput({
  key: "em-emergency", std: ["ISO 14001"], input: "ค 2", title: "การเตรียมพร้อมและอุบัติการณ์",
  facts: () => [
    { label: "แผนที่เลยรอบซ้อม", value: `${drillsOverdue().length} แผน`, tone: toneOf(drillsOverdue().length > 0) },
    { label: "อุบัติการณ์ปีนี้", value: `${INCIDENTS.filter((i) => i.date.slice(0, 4) === TODAY.slice(0, 4)).length} ครั้ง`, tone: toneOf(false, INCIDENTS.some((i) => i.status === "เปิด")) },
  ],
});
