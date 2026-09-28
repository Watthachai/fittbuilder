import { commit } from "../kit";
import { COMPANY, TODAY } from "../company";
import { GOODS_RECEIPTS, MATERIALS, PURCHASE_ORDERS, VENDORS, postStockMove } from "../mm/data";
import { ORDERS, PP_MOVEMENTS } from "../pp/data";
import { CUSTOMERS, DELIVERIES, SALES_ORDERS } from "../sd/data";

export { COMPANY, TODAY };

/**
 * บริหารคุณภาพตาม ISO 9001:2015 — ข้อกำหนดแต่ละข้อเป็นงานที่ทำได้จริงในระบบ
 * ไม่ใช่แฟ้มเอกสารที่ทำแยกไว้ตอนรอผู้ตรวจ
 *
 * ของที่ตรวจมาจากเอกสารจริงของระบบอื่น: ล็อตตรวจรับมาจากใบรับของของจัดซื้อ
 * ล็อตตรวจก่อนส่งมาจากการรับสินค้าผลิตเสร็จ ข้อร้องเรียนอ้างใบส่งของของฝ่ายขาย
 * และของที่ตัดสินให้ทำลายหรือส่งคืนผู้ขายตัดสต็อกผ่านฟังก์ชันของคลังวัสดุ
 * โมดูลนี้ไม่เขียนข้อมูลของโมดูลอื่นตรง ๆ
 */

const YEAR = Number(TODAY.slice(0, 4)) + 543;

export type Errors = Record<string, string>;

function assertValid(e: Errors) {
  const first = Object.values(e)[0];
  if (first) throw new Error(first);
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1 + n, d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** เลขถัดไปของชุดเอกสาร — ต่อจากเลขที่สูงสุดที่มีอยู่ ไม่ใช่จากจำนวนใบ */
function nextNo(existing: string[], prefix: string, width: number) {
  const max = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return prefix + String(max + 1).padStart(width, "0");
}

export const materialName = (code: string) => MATERIALS.find((m) => m.code === code)?.name ?? code;
export const materialUnit = (code: string) => MATERIALS.find((m) => m.code === code)?.unit ?? "";
export const vendorName = (code?: string) => (code ? VENDORS.find((v) => v.code === code)?.name ?? code : "—");
export const customerName = (code?: string) => (code ? CUSTOMERS.find((c) => c.code === code)?.name ?? code : "—");

/* ================================================================ people */

/** ทีมที่รับผิดชอบระบบคุณภาพ — ผู้ตรวจติดตามต้องไม่ตรวจงานของฝ่ายตัวเอง (ข้อ 9.2.2 ค) */
export const QM_TEAM = [
  { name: "นพดล ศรีวงศ์", role: "ผู้จัดการฝ่ายประกันคุณภาพ (QMR)", dept: "ฝ่ายประกันคุณภาพ", auditor: true },
  { name: "สุภาพร แก้วมณี", role: "หัวหน้าตรวจสอบคุณภาพ (QC)", dept: "ฝ่ายประกันคุณภาพ", auditor: true },
  { name: "อนุชา ทองดี", role: "หัวหน้าฝ่ายผลิต", dept: "ฝ่ายผลิต", auditor: true },
  { name: "ปิยะนุช ใจดี", role: "หัวหน้าฝ่ายจัดซื้อ", dept: "ฝ่ายจัดซื้อ", auditor: true },
  { name: "วรวุฒิ พึ่งบุญ", role: "หัวหน้าคลังสินค้า", dept: "ฝ่ายคลังสินค้า", auditor: false },
  { name: "ชลธิชา มั่นคง", role: "หัวหน้าฝ่ายขาย", dept: "ฝ่ายขาย", auditor: true },
];

export const QMR = QM_TEAM[0].name;
export const DEPARTMENTS = [...new Set(QM_TEAM.map((p) => p.dept))];
export const PEOPLE = QM_TEAM.map((p) => p.name);
export const deptOf = (name: string) => QM_TEAM.find((p) => p.name === name)?.dept ?? "";

/** ข้อกำหนดของ ISO 9001:2015 ที่ระบบนี้ครอบคลุม ใช้อ้างในเอกสาร ผลตรวจติดตาม และรายงาน */
export const CLAUSES = [
  { code: "4.4", name: "ระบบบริหารคุณภาพและกระบวนการ" },
  { code: "5.2", name: "นโยบายคุณภาพ" },
  { code: "6.2", name: "วัตถุประสงค์คุณภาพ" },
  { code: "7.1.5", name: "ทรัพยากรสำหรับการเฝ้าติดตามและการวัด" },
  { code: "7.2", name: "ความสามารถ" },
  { code: "7.5", name: "เอกสารสารสนเทศ" },
  { code: "8.4", name: "การควบคุมผู้ให้บริการภายนอก" },
  { code: "8.5", name: "การผลิตและการให้บริการ" },
  { code: "8.6", name: "การตรวจปล่อยผลิตภัณฑ์" },
  { code: "8.7", name: "การควบคุมผลลัพธ์ที่ไม่เป็นไปตามข้อกำหนด" },
  { code: "9.1.2", name: "ความพึงพอใจของลูกค้า" },
  { code: "9.2", name: "การตรวจติดตามภายใน" },
  { code: "9.3", name: "การทบทวนโดยฝ่ายบริหาร" },
  { code: "10.2", name: "สิ่งที่ไม่เป็นไปตามข้อกำหนดและการแก้ไข" },
];

export const clauseName = (code: string) => CLAUSES.find((c) => c.code === code)?.name ?? "";

/* ============================================================= documents */

export const DOC_TYPES = ["คู่มือคุณภาพ", "ขั้นตอนการปฏิบัติงาน", "วิธีการทำงาน", "แบบฟอร์ม"] as const;
export type DocType = (typeof DOC_TYPES)[number];

const DOC_PREFIX: Record<DocType, string> = {
  "คู่มือคุณภาพ": "QM-",
  "ขั้นตอนการปฏิบัติงาน": "QP-",
  "วิธีการทำงาน": "WI-",
  "แบบฟอร์ม": "FM-",
};

export type DocStatus = "ร่าง" | "รออนุมัติ" | "ใช้งาน" | "ยกเลิก";

export type DocRevision = { rev: number; date: string; change: string; by: string; approvedBy: string };

/** ฉบับที่กำลังเขียนหรือรออนุมัติ — ฉบับที่ใช้อยู่ยังใช้ต่อจนกว่าฉบับนี้จะอนุมัติ */
export type DocDraft = { rev: number; change: string; by: string; date: string; submitted: boolean };

export type QmDocument = {
  code: string;
  title: string;
  type: DocType;
  clause: string;
  owner: string;
  /** ฉบับที่ใช้อยู่ — -1 คือยังไม่เคยอนุมัติฉบับไหน */
  rev: number;
  status: DocStatus;
  effective?: string;
  /** ทบทวนความเหมาะสมทุกปี (ข้อ 7.5.2) */
  reviewDue?: string;
  draft?: DocDraft;
  history: DocRevision[];
  obsoleteReason?: string;
};

/** ทุกฉบับถูกทบทวนในการประชุมทบทวนโดยฝ่ายบริหารเมื่อ 2026-01-20 ยกเว้นที่ออกฉบับใหม่หลังจากนั้น */
const MANAGEMENT_REVIEW = "2026-01-20";

const issued = (code: string, title: string, type: DocType, clause: string, owner: string, revs: [string, string][], reviewed = MANAGEMENT_REVIEW): QmDocument => {
  const history = revs.map(([date, change], i) => ({ rev: i, date, change, by: owner === "ฝ่ายผลิต" ? "อนุชา ทองดี" : "สุภาพร แก้วมณี", approvedBy: QMR }));
  const last = history[history.length - 1];
  const since = last.date > reviewed ? last.date : reviewed;
  return { code, title, type, clause, owner, rev: last.rev, status: "ใช้งาน", effective: last.date, reviewDue: addMonths(since, 12), history };
};

export const DOCUMENTS: QmDocument[] = [
  issued("QM-01", "คู่มือคุณภาพ", "คู่มือคุณภาพ", "4.4", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"], ["2025-11-03", "ปรับขอบเขตให้รวมงานพ่นสี"]]),
  issued("QP-01", "การควบคุมเอกสารและบันทึก", "ขั้นตอนการปฏิบัติงาน", "7.5", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"]]),
  issued("QP-02", "การตรวจติดตามภายใน", "ขั้นตอนการปฏิบัติงาน", "9.2", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"], ["2026-02-10", "เพิ่มเกณฑ์ความเป็นอิสระของผู้ตรวจ"]]),
  issued("QP-03", "การควบคุมผลิตภัณฑ์ที่ไม่เป็นไปตามข้อกำหนด", "ขั้นตอนการปฏิบัติงาน", "8.7", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"]]),
  issued("QP-04", "การแก้ไขและการป้องกัน", "ขั้นตอนการปฏิบัติงาน", "10.2", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"]]),
  issued("QP-05", "การตรวจรับวัตถุดิบ", "ขั้นตอนการปฏิบัติงาน", "8.4", "ฝ่ายประกันคุณภาพ", [["2025-02-01", "ออกใช้ครั้งแรก"], ["2025-10-07", "เพิ่มแผนสุ่มตัวอย่างตามขนาดล็อต"]], "2025-10-07"),
  issued("QP-06", "การสอบเทียบเครื่องมือวัด", "ขั้นตอนการปฏิบัติงาน", "7.1.5", "ฝ่ายประกันคุณภาพ", [["2025-02-01", "ออกใช้ครั้งแรก"]]),
  issued("WI-01", "วิธีการเชื่อมโครงชั้นวาง", "วิธีการทำงาน", "8.5", "ฝ่ายผลิต", [["2025-03-12", "ออกใช้ครั้งแรก"], ["2026-06-20", "เปลี่ยนลวดเชื่อมเป็น ER70S-6"]]),
  issued("WI-02", "การวัดความหนาเหล็กแผ่นและเหล็กเส้น", "วิธีการทำงาน", "8.6", "ฝ่ายประกันคุณภาพ", [["2025-03-12", "ออกใช้ครั้งแรก"]]),
  // แบบฟอร์มที่ระบบพิมพ์ออกมา — เลขที่มุมกระดาษอ่านฉบับจากบัญชีนี้ แก้ฟอร์มแล้วใบที่พิมพ์เปลี่ยนตาม
  issued("FM-01", "บัญชีรายชื่อเอกสารควบคุม", "แบบฟอร์ม", "7.5", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"]]),
  issued("FM-02", "ใบรายงานผลการตรวจสอบ", "แบบฟอร์ม", "8.6", "ฝ่ายประกันคุณภาพ", [["2025-02-01", "ออกใช้ครั้งแรก"], ["2025-10-07", "เพิ่มช่องจำนวนตัวอย่างตามขนาดล็อต"]], "2025-10-07"),
  issued("FM-03", "ใบรับรองคุณภาพสินค้า", "แบบฟอร์ม", "8.6", "ฝ่ายประกันคุณภาพ", [["2025-02-01", "ออกใช้ครั้งแรก"]], "2025-10-07"),
  issued("FM-04", "ใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด", "แบบฟอร์ม", "8.7", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"]]),
  issued("FM-05", "ใบขอให้ดำเนินการแก้ไขและป้องกัน", "แบบฟอร์ม", "10.2", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"]]),
  issued("FM-06", "รายงานการตรวจติดตามภายใน", "แบบฟอร์ม", "9.2", "ฝ่ายประกันคุณภาพ", [["2025-01-15", "ออกใช้ครั้งแรก"], ["2026-02-10", "เพิ่มช่องระดับของสิ่งที่พบ"]]),
  issued("FM-07", "บันทึกประวัติการสอบเทียบเครื่องมือวัด", "แบบฟอร์ม", "7.1.5", "ฝ่ายประกันคุณภาพ", [["2025-02-01", "ออกใช้ครั้งแรก"]]),
  {
    code: "WI-03", title: "วิธีการพ่นสีฝุ่นและอบ", type: "วิธีการทำงาน", clause: "8.5", owner: "ฝ่ายผลิต",
    rev: -1, status: "รออนุมัติ", history: [],
    draft: { rev: 0, change: "ออกใช้ครั้งแรก — กำหนดอุณหภูมิอบ 200°C 15 นาที", by: "อนุชา ทองดี", date: "2026-09-18", submitted: true },
  },
];

export const docByCode = (code: string) => {
  const d = DOCUMENTS.find((x) => x.code === code);
  if (!d) throw new Error(`ไม่พบเอกสาร ${code}`);
  return d;
};

/** เอกสารที่ถึงรอบทบทวนภายใน 30 วัน หรือเลยรอบมาแล้ว */
export const reviewDue = () =>
  DOCUMENTS.filter((d) => d.status === "ใช้งาน" && d.reviewDue && d.reviewDue <= addDays(TODAY, 30));

export const awaitingApproval = () => DOCUMENTS.filter((d) => d.draft?.submitted);

export type DocInput = { type: DocType; title: string; clause: string; owner: string; by: string; change: string };

export function docErrors(input: DocInput): Errors {
  const e: Errors = {};
  if (input.title.trim().length < 4) e.title = "ใส่ชื่อเอกสาร";
  else if (DOCUMENTS.some((d) => d.status !== "ยกเลิก" && d.title === input.title.trim())) e.title = "มีเอกสารชื่อนี้ใช้อยู่แล้ว";
  if (!CLAUSES.some((c) => c.code === input.clause)) e.clause = "เลือกข้อกำหนดที่เอกสารนี้รองรับ";
  if (!DEPARTMENTS.includes(input.owner)) e.owner = "เลือกฝ่ายเจ้าของเอกสาร";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้จัดทำ";
  return e;
}

export const nextDocCode = (type: DocType) => {
  const prefix = DOC_PREFIX[type];
  const nums = DOCUMENTS.filter((d) => d.code.startsWith(prefix)).map((d) => Number(d.code.slice(prefix.length)));
  return `${prefix}${String(Math.max(0, ...nums) + 1).padStart(2, "0")}`;
};

export function createDocument(input: DocInput): QmDocument {
  assertValid(docErrors(input));
  return commit(() => {
    const d: QmDocument = {
      code: nextDocCode(input.type),
      title: input.title.trim(),
      type: input.type,
      clause: input.clause,
      owner: input.owner,
      rev: -1,
      status: "ร่าง",
      history: [],
      draft: { rev: 0, change: input.change.trim() || "ออกใช้ครั้งแรก", by: input.by, date: TODAY, submitted: false },
    };
    DOCUMENTS.push(d);
    return d;
  });
}

export function submitDocument(code: string) {
  const d = docByCode(code);
  if (!d.draft || d.draft.submitted) throw new Error(`${code} ไม่มีฉบับร่างที่รอส่ง`);
  return commit(() => {
    d.draft!.submitted = true;
    if (d.rev < 0) d.status = "รออนุมัติ";
    return d;
  });
}

/** อนุมัติก่อนออกใช้ (ข้อ 7.5.2) — ผู้อนุมัติต้องไม่ใช่คนเขียน */
export function approveDocument(code: string, approver: string, date = TODAY) {
  const d = docByCode(code);
  if (!d.draft?.submitted) throw new Error(`${code} ไม่มีฉบับที่รออนุมัติ`);
  if (approver === d.draft.by) throw new Error("ผู้อนุมัติต้องไม่ใช่ผู้จัดทำเอกสาร");
  if (!PEOPLE.includes(approver)) throw new Error("เลือกผู้อนุมัติ");
  const draft = d.draft;
  return commit(() => {
    d.history.push({ rev: draft.rev, date, change: draft.change, by: draft.by, approvedBy: approver });
    d.rev = draft.rev;
    d.status = "ใช้งาน";
    d.effective = date;
    d.reviewDue = addMonths(date, 12);
    d.draft = undefined;
    return d;
  });
}

/** ส่งฉบับกลับไปแก้ — ฉบับที่ใช้อยู่ไม่เปลี่ยน */
export function returnDocument(code: string) {
  const d = docByCode(code);
  if (!d.draft?.submitted) throw new Error(`${code} ไม่มีฉบับที่รออนุมัติ`);
  return commit(() => {
    d.draft!.submitted = false;
    if (d.rev < 0) d.status = "ร่าง";
    return d;
  });
}

export function reviseDocument(code: string, change: string, by: string) {
  const d = docByCode(code);
  if (d.status !== "ใช้งาน") throw new Error(`${code} ${d.status} แก้ไขฉบับใหม่ไม่ได้`);
  if (d.draft) throw new Error(`${code} มีฉบับแก้ไข Rev.${String(d.draft.rev).padStart(2, "0")} ค้างอยู่แล้ว`);
  if (change.trim().length < 5) throw new Error("บอกว่าแก้อะไร อย่างน้อยหนึ่งประโยค");
  if (!PEOPLE.includes(by)) throw new Error("เลือกผู้จัดทำ");
  return commit(() => {
    d.draft = { rev: d.rev + 1, change: change.trim(), by, date: TODAY, submitted: false };
    return d;
  });
}

/** ทบทวนแล้วยังเหมาะสม — ต่อรอบทบทวนอีกหนึ่งปี ไม่ออกฉบับใหม่ */
export function confirmReview(code: string, date = TODAY) {
  const d = docByCode(code);
  if (d.status !== "ใช้งาน") throw new Error(`${code} ไม่ได้ใช้งานอยู่`);
  return commit(() => {
    d.reviewDue = addMonths(date, 12);
    return d;
  });
}

export function obsoleteDocument(code: string, reason: string) {
  const d = docByCode(code);
  if (d.status === "ยกเลิก") throw new Error(`${code} ยกเลิกไปแล้ว`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลที่ยกเลิก");
  return commit(() => {
    d.status = "ยกเลิก";
    d.obsoleteReason = reason.trim();
    d.draft = undefined;
    return d;
  });
}

export const revLabel = (rev: number) => (rev < 0 ? "—" : `Rev.${String(rev).padStart(2, "0")}`);

/* ============================================================ inspection */

export type Characteristic = {
  name: string;
  method: string;
  kind: "วัดค่า" | "ตรวจพินิจ";
  unit?: string;
  lsl?: number;
  usl?: number;
};

/** แผนการตรวจต่อวัสดุ — วัดค่าต้องอยู่ในช่วง LSL–USL ตรวจพินิจต้องไม่พบจุดบกพร่อง */
export const PLANS: Record<string, Characteristic[]> = {
  "MAT-1001": [
    { name: "ความหนา", method: "ไมโครมิเตอร์ QC-MC-01", kind: "วัดค่า", unit: "มม.", lsl: 2.85, usl: 3.15 },
    { name: "ความกว้าง", method: "ตลับเมตร QC-TM-01", kind: "วัดค่า", unit: "มม.", lsl: 1218, usl: 1222 },
    { name: "สนิมและรอยบุบ", method: "ตรวจด้วยสายตา", kind: "ตรวจพินิจ" },
  ],
  "MAT-1002": [
    { name: "เส้นผ่านศูนย์กลาง", method: "เวอร์เนียร์ QC-VC-01", kind: "วัดค่า", unit: "มม.", lsl: 11.8, usl: 12.2 },
    { name: "ความตรงของเส้น", method: "ตรวจด้วยสายตา", kind: "ตรวจพินิจ" },
  ],
  "MAT-1003": [
    { name: "ความหนืด", method: "ถ้วยวัดความหนืด Ford #4", kind: "วัดค่า", unit: "วินาที", lsl: 18, usl: 24 },
    { name: "สีตรงตามแผ่นเทียบ RAL 7035", method: "เทียบแผ่นสี", kind: "ตรวจพินิจ" },
  ],
  "MAT-2002": [{ name: "เสียงและการหมุน", method: "หมุนด้วยมือ", kind: "ตรวจพินิจ" }],
  "FG-5001": [
    { name: "ความสูงรวม", method: "ตลับเมตร QC-TM-01", kind: "วัดค่า", unit: "มม.", lsl: 1795, usl: 1805 },
    { name: "ความหนาสีเคลือบ", method: "เครื่องวัดความหนาสี QC-CT-01", kind: "วัดค่า", unit: "ไมครอน", lsl: 60, usl: 120 },
    { name: "รับน้ำหนัก 150 กก. ต่อชั้น 10 นาที", method: "วางน้ำหนักทดสอบ", kind: "ตรวจพินิจ" },
  ],
  "FG-5002": [
    { name: "ความยาวหน้าโต๊ะ", method: "ตลับเมตร QC-TM-01", kind: "วัดค่า", unit: "มม.", lsl: 1198, usl: 1202 },
    { name: "ความหนาสีเคลือบ", method: "เครื่องวัดความหนาสี QC-CT-01", kind: "วัดค่า", unit: "ไมครอน", lsl: 60, usl: 120 },
    { name: "ความเรียบหน้าโต๊ะ", method: "ไม้บรรทัดเหล็กและฟิลเลอร์เกจ", kind: "ตรวจพินิจ" },
  ],
  "FG-5003": [
    { name: "ความสูงมือจับ", method: "ตลับเมตร QC-TM-01", kind: "วัดค่า", unit: "มม.", lsl: 895, usl: 905 },
    { name: "ล้อหมุนคล่องและเบรกล็อก", method: "ทดสอบด้วยมือ", kind: "ตรวจพินิจ" },
    { name: "รอยเชื่อม", method: "ตรวจด้วยสายตา", kind: "ตรวจพินิจ" },
  ],
};

export const planOf = (material: string) => PLANS[material] ?? [];

/** ขนาดตัวอย่างตามขนาดล็อต — ล็อตเล็กตรวจทุกชิ้น */
export function sampleSize(lot: number) {
  if (lot <= 8) return lot;
  if (lot <= 50) return 8;
  if (lot <= 150) return 13;
  if (lot <= 500) return 20;
  return 32;
}

export type LotOrigin = "ตรวจรับ" | "ตรวจก่อนส่ง";
export type Decision = "ผ่าน" | "ไม่ผ่าน" | "ยอมรับแบบมีเงื่อนไข";
export const DECISIONS: Decision[] = ["ผ่าน", "ยอมรับแบบมีเงื่อนไข", "ไม่ผ่าน"];

export type Result = { characteristic: string; min?: number; max?: number; defects?: number; ok: boolean };

export type InspectionLot = {
  no: string;
  origin: LotOrigin;
  /** ใบรับของ (GR-…) หรือใบรับสินค้าผลิตเสร็จ / ใบสั่งผลิต */
  source: string;
  /** ใบสั่งซื้อหรือใบสั่งผลิตที่ของนี้มาจาก */
  ref: string;
  material: string;
  qty: number;
  sample: number;
  date: string;
  vendor?: string;
  status: "รอตรวจ" | "รอตัดสิน" | "ตัดสินแล้ว";
  results: Result[];
  inspector?: string;
  inspectedOn?: string;
  decision?: Decision;
  decidedBy?: string;
  decidedOn?: string;
  note?: string;
  ncr?: string;
};

const lot = (l: Omit<InspectionLot, "sample" | "results"> & { results?: Result[] }): InspectionLot => ({
  sample: sampleSize(l.qty),
  results: [],
  ...l,
});

const measured = (characteristic: string, min: number, max: number, c: Characteristic): Result => ({
  characteristic, min, max, ok: min >= (c.lsl ?? -Infinity) && max <= (c.usl ?? Infinity),
});
const visual = (characteristic: string, defects: number): Result => ({ characteristic, defects, ok: defects === 0 });
const P = (m: string, i: number) => PLANS[m][i];

export const LOTS: InspectionLot[] = [
  lot({
    no: "IL-2569-0041", origin: "ตรวจรับ", source: "GR-2569-201", ref: "PO-2569-115", material: "MAT-1001", qty: 90, date: "2026-09-03", vendor: "V-001",
    status: "ตัดสินแล้ว", inspector: "สุภาพร แก้วมณี", inspectedOn: "2026-09-03", decision: "ผ่าน", decidedBy: "สุภาพร แก้วมณี", decidedOn: "2026-09-03",
    results: [measured("ความหนา", 2.93, 3.06, P("MAT-1001", 0)), measured("ความกว้าง", 1219, 1221, P("MAT-1001", 1)), visual("สนิมและรอยบุบ", 0)],
  }),
  lot({
    no: "IL-2569-0042", origin: "ตรวจรับ", source: "GR-2569-201", ref: "PO-2569-115", material: "MAT-1002", qty: 150, date: "2026-09-03", vendor: "V-001",
    status: "ตัดสินแล้ว", inspector: "สุภาพร แก้วมณี", inspectedOn: "2026-09-04", decision: "ผ่าน", decidedBy: "สุภาพร แก้วมณี", decidedOn: "2026-09-04",
    results: [measured("เส้นผ่านศูนย์กลาง", 11.86, 12.12, P("MAT-1002", 0)), visual("ความตรงของเส้น", 0)],
  }),
  lot({
    no: "IL-2569-0043", origin: "ตรวจรับ", source: "GR-2569-206", ref: "PO-2569-118", material: "MAT-1002", qty: 200, date: "2026-09-19", vendor: "V-002",
    status: "ตัดสินแล้ว", inspector: "สุภาพร แก้วมณี", inspectedOn: "2026-09-19", decision: "ไม่ผ่าน", decidedBy: QMR, decidedOn: "2026-09-19",
    results: [measured("เส้นผ่านศูนย์กลาง", 11.62, 12.05, P("MAT-1002", 0)), visual("ความตรงของเส้น", 3)],
    note: "เส้นผ่านศูนย์กลางต่ำกว่าเกณฑ์ 6 จาก 20 ตัวอย่าง คัดแยกทั้งล็อตแล้วพบไม่ผ่าน 60 เส้น", ncr: "NCR-2569-014",
  }),
  lot({ no: "IL-2569-0044", origin: "ตรวจรับ", source: "GR-2569-207", ref: "PO-2569-119", material: "MAT-1003", qty: 14, date: "2026-09-20", vendor: "V-003", status: "รอตรวจ" }),
  lot({
    no: "IL-2569-0039", origin: "ตรวจก่อนส่ง", source: "PO-P-3298", ref: "PO-P-3298", material: "FG-5001", qty: 30, date: "2026-09-19",
    status: "ตัดสินแล้ว", inspector: "สุภาพร แก้วมณี", inspectedOn: "2026-09-19", decision: "ผ่าน", decidedBy: "สุภาพร แก้วมณี", decidedOn: "2026-09-19",
    results: [measured("ความสูงรวม", 1797, 1803, P("FG-5001", 0)), measured("ความหนาสีเคลือบ", 72, 104, P("FG-5001", 1)), visual("รับน้ำหนัก 150 กก. ต่อชั้น 10 นาที", 0)],
  }),
  lot({
    no: "IL-2569-0040", origin: "ตรวจก่อนส่ง", source: "PO-P-3299", ref: "PO-P-3299", material: "FG-5002", qty: 16, date: "2026-09-21",
    status: "ตัดสินแล้ว", inspector: "สุภาพร แก้วมณี", inspectedOn: "2026-09-21", decision: "ยอมรับแบบมีเงื่อนไข", decidedBy: QMR, decidedOn: "2026-09-21",
    results: [measured("ความยาวหน้าโต๊ะ", 1199, 1201, P("FG-5002", 0)), measured("ความหนาสีเคลือบ", 55, 98, P("FG-5002", 1)), visual("ความเรียบหน้าโต๊ะ", 0)],
    note: "สีเคลือบบางกว่าเกณฑ์ที่ขาโต๊ะด้านใน ไม่กระทบการใช้งาน ลูกค้า C-103 ยอมรับทางอีเมล 21/09",
  }),
];

export const lotByNo = (no: string) => {
  const l = LOTS.find((x) => x.no === no);
  if (!l) throw new Error(`ไม่พบล็อตตรวจ ${no}`);
  return l;
};

export const vendorOfPo = (po: string) => PURCHASE_ORDERS.find((p) => p.no === po)?.vendor;

export type Pending = { origin: LotOrigin; source: string; ref: string; material: string; qty: number; date: string; vendor?: string };

/** ใบรับตั้งแต่วันนี้ย้อนหลังหนึ่งเดือนที่มีแผนตรวจแต่ยังไม่เปิดล็อต */
const PENDING_SINCE = addDays(TODAY, -30);

/**
 * ของที่เข้ามาแล้วแต่ยังไม่ได้ตรวจ — อ่านจากใบรับของของจัดซื้อและใบรับสินค้าผลิตเสร็จ
 * ทุกครั้งที่หน้าจอวาด ใบรับที่เพิ่งบันทึกในระบบอื่นจึงขึ้นที่นี่ทันที
 */
export function pendingInspections(): Pending[] {
  const has = (source: string, material: string) => LOTS.some((l) => l.source === source && l.material === material);
  const out: Pending[] = [];
  for (const gr of GOODS_RECEIPTS) {
    if (gr.date < PENDING_SINCE) continue;
    for (const line of gr.lines) {
      if (!PLANS[line.material] || has(gr.no, line.material)) continue;
      out.push({ origin: "ตรวจรับ", source: gr.no, ref: gr.po, material: line.material, qty: line.qty, date: gr.date, vendor: vendorOfPo(gr.po) });
    }
  }
  for (const mv of PP_MOVEMENTS) {
    if (mv.kind !== "รับเข้าคลัง") continue;
    for (const line of mv.lines) {
      if (!PLANS[line.material] || has(mv.no, line.material)) continue;
      out.push({ origin: "ตรวจก่อนส่ง", source: mv.no, ref: mv.order, material: line.material, qty: line.qty, date: mv.date });
    }
  }
  return out;
}

export const nextLotNo = () => nextNo(LOTS.map((l) => l.no), `IL-${YEAR}-`, 4);

export function createLot(p: Pending): InspectionLot {
  if (!PLANS[p.material]) throw new Error(`${materialName(p.material)} ยังไม่มีแผนการตรวจ`);
  if (LOTS.some((l) => l.source === p.source && l.material === p.material)) throw new Error(`${p.source} เปิดล็อตตรวจไปแล้ว`);
  return commit(() => {
    const l = lot({ no: nextLotNo(), origin: p.origin, source: p.source, ref: p.ref, material: p.material, qty: p.qty, date: TODAY, vendor: p.vendor, status: "รอตรวจ" });
    LOTS.push(l);
    return l;
  });
}

export type ResultInput = { characteristic: string; min?: number; max?: number; defects?: number };

export function resultErrors(no: string, results: ResultInput[]): Errors {
  const l = lotByNo(no);
  const e: Errors = {};
  for (const c of planOf(l.material)) {
    const r = results.find((x) => x.characteristic === c.name);
    if (c.kind === "วัดค่า") {
      if (r?.min === undefined || r?.max === undefined || !Number.isFinite(r.min) || !Number.isFinite(r.max)) e[c.name] = "ใส่ค่าต่ำสุดและสูงสุดที่วัดได้";
      else if (r.min > r.max) e[c.name] = "ค่าต่ำสุดต้องไม่เกินค่าสูงสุด";
    } else if (r?.defects === undefined || !Number.isInteger(r.defects) || r.defects < 0) e[c.name] = "ใส่จำนวนชิ้นที่พบข้อบกพร่อง (0 ถ้าไม่พบ)";
    else if (r.defects > l.sample) e[c.name] = `พบได้ไม่เกินจำนวนตัวอย่าง ${l.sample} ชิ้น`;
  }
  return e;
}

/** ผลของแต่ละคุณลักษณะตัดสินจากเกณฑ์ในแผน ไม่ใช่จากผู้ตรวจ */
export function judge(material: string, results: ResultInput[]): Result[] {
  return planOf(material).map((c) => {
    const r = results.find((x) => x.characteristic === c.name) ?? { characteristic: c.name };
    return c.kind === "วัดค่า"
      ? measured(c.name, r.min ?? NaN, r.max ?? NaN, c)
      : visual(c.name, r.defects ?? 0);
  });
}

export function recordResults(no: string, results: ResultInput[], inspector: string, date = TODAY) {
  const l = lotByNo(no);
  if (l.status === "ตัดสินแล้ว") throw new Error(`${no} ตัดสินผลไปแล้ว`);
  assertValid(resultErrors(no, results));
  if (!PEOPLE.includes(inspector)) throw new Error("เลือกผู้ตรวจ");
  return commit(() => {
    l.results = judge(l.material, results);
    l.inspector = inspector;
    l.inspectedOn = date;
    l.status = "รอตัดสิน";
    return l;
  });
}

export const allOk = (l: InspectionLot) => l.results.length > 0 && l.results.every((r) => r.ok);

export function decisionErrors(no: string, decision: Decision, by: string, note: string): Errors {
  const l = lotByNo(no);
  const e: Errors = {};
  if (l.status !== "รอตัดสิน") e.decision = l.status === "รอตรวจ" ? "บันทึกผลตรวจก่อนตัดสิน" : `${no} ตัดสินไปแล้ว`;
  else if (decision === "ผ่าน" && !allOk(l)) e.decision = "มีคุณลักษณะที่ไม่ผ่านเกณฑ์ ตัดสินผ่านไม่ได้ — เลือกไม่ผ่านหรือยอมรับแบบมีเงื่อนไข";
  if (!PEOPLE.includes(by)) e.by = "เลือกผู้ตัดสิน";
  // ยอมรับของที่ไม่ตรงข้อกำหนดเป็นการผ่อนผัน (ข้อ 8.7.1 ง) ต้องมีผู้มีอำนาจและเหตุผล
  if (decision === "ยอมรับแบบมีเงื่อนไข" && by !== QMR) e.by = `การยอมรับแบบมีเงื่อนไขต้องอนุมัติโดย ${QMR} (QMR)`;
  if (decision !== "ผ่าน" && note.trim().length < 10) e.note = "บอกสิ่งที่พบและเหตุผลของการตัดสิน";
  return e;
}

/** ตัดสินผลการตรวจ — ไม่ผ่านเปิด NCR ให้เองทันที */
export function decideLot(no: string, decision: Decision, by: string, note = "", date = TODAY) {
  assertValid(decisionErrors(no, decision, by, note));
  const l = lotByNo(no);
  return commit(() => {
    l.decision = decision;
    l.decidedBy = by;
    l.decidedOn = date;
    l.status = "ตัดสินแล้ว";
    l.note = note.trim() || undefined;
    let ncr: Ncr | undefined;
    if (decision === "ไม่ผ่าน") {
      const failed = l.results.filter((r) => !r.ok).map((r) => r.characteristic).join(", ");
      ncr = pushNcr({
        date, source: l.origin, ref: l.no, material: l.material, qty: l.qty, vendor: l.vendor,
        description: `${materialName(l.material)} ไม่ผ่านการ${l.origin} (${failed}) — ${note.trim()}`,
        severity: l.origin === "ตรวจก่อนส่ง" ? "รุนแรง" : "ปานกลาง", reportedBy: by,
      });
      l.ncr = ncr.no;
    }
    return { lot: l, ncr };
  });
}

/* =================================================================== ncr */

export const NCR_SOURCES = ["ตรวจรับ", "ระหว่างผลิต", "ตรวจก่อนส่ง", "ข้อร้องเรียนลูกค้า", "ตรวจติดตามภายใน", "สอบเทียบเครื่องมือ"] as const;
export type NcrSource = (typeof NCR_SOURCES)[number];
export const SEVERITIES = ["รุนแรง", "ปานกลาง", "เล็กน้อย"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const DISPOSITIONS = ["ซ่อมหรือทำใหม่", "คัดแยก", "ส่งคืนผู้ขาย", "ใช้ตามสภาพ (ผ่อนผัน)", "ทำลาย"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export type Ncr = {
  no: string;
  date: string;
  source: NcrSource;
  /** ล็อตตรวจ ใบส่งของ ใบสั่งผลิต ผลตรวจติดตาม หรือเครื่องมือวัด ที่เป็นต้นเรื่อง */
  ref: string;
  material?: string;
  qty: number;
  vendor?: string;
  customer?: string;
  description: string;
  severity: Severity;
  reportedBy: string;
  status: "รอสั่งการ" | "ดำเนินการ" | "ปิดแล้ว";
  disposition?: Disposition;
  dispositionBy?: string;
  dispositionNote?: string;
  /** เลขที่เอกสารเคลื่อนไหวสต็อกของคลังวัสดุ เมื่อสั่งทำลายหรือส่งคืน */
  stockDoc?: string;
  capa?: string;
  closedOn?: string;
  closedBy?: string;
};

export const NCRS: Ncr[] = [
  {
    no: "NCR-2569-012", date: "2026-08-22", source: "ระหว่างผลิต", ref: "PO-P-3296", material: "FG-5002", qty: 3,
    description: "โต๊ะ 3 ตัวรอยเชื่อมขาไม่เต็มแนว พบที่สถานีประกอบ", severity: "ปานกลาง", reportedBy: "อนุชา ทองดี",
    status: "ปิดแล้ว", disposition: "ซ่อมหรือทำใหม่", dispositionBy: QMR, dispositionNote: "เชื่อมซ่อมและตรวจซ้ำผ่านทั้ง 3 ตัว",
    closedOn: "2026-08-25", closedBy: QMR,
  },
  {
    no: "NCR-2569-013", date: "2026-09-10", source: "ข้อร้องเรียนลูกค้า", ref: "DO-2569-0299", material: "FG-5001", qty: 2, customer: "C-102",
    description: "ลูกค้าแจ้งชั้นวาง 2 ชุดสีถลอกที่มุม เกิดระหว่างขนส่ง", severity: "เล็กน้อย", reportedBy: "ชลธิชา มั่นคง",
    status: "ดำเนินการ", disposition: "ซ่อมหรือทำใหม่", dispositionBy: QMR, dispositionNote: "ส่งช่างเข้าไปพ่นซ่อมที่หน้างานลูกค้า 26/09", capa: "CAR-2569-008",
  },
  {
    no: "NCR-2569-014", date: "2026-09-19", source: "ตรวจรับ", ref: "IL-2569-0043", material: "MAT-1002", qty: 60, vendor: "V-002",
    description: "เหล็กเส้นกลม 12 มม. ไม่ผ่านการตรวจรับ (เส้นผ่านศูนย์กลาง, ความตรงของเส้น) — คัดแยกทั้งล็อต 200 เส้น พบไม่ผ่าน 60 เส้น",
    severity: "ปานกลาง", reportedBy: QMR, status: "รอสั่งการ",
  },
];

export const ncrByNo = (no: string) => {
  const n = NCRS.find((x) => x.no === no);
  if (!n) throw new Error(`ไม่พบ ${no}`);
  return n;
};

export const nextNcrNo = () => nextNo(NCRS.map((n) => n.no), `NCR-${YEAR}-`, 3);

function pushNcr(input: Omit<Ncr, "no" | "status">): Ncr {
  const n: Ncr = { ...input, no: nextNcrNo(), status: "รอสั่งการ" };
  NCRS.push(n);
  return n;
}

export type NcrInput = { source: NcrSource; ref: string; material: string; qty: number; description: string; severity: Severity; reportedBy: string };

export function ncrErrors(input: NcrInput): Errors {
  const e: Errors = {};
  if (input.ref.trim().length < 3) e.ref = "ใส่เอกสารต้นเรื่อง เช่น เลขใบสั่งผลิตหรือล็อต";
  else if (input.source === "ระหว่างผลิต" && !productionOrderExists(input.ref.trim())) e.ref = "ไม่พบใบสั่งผลิตเลขนี้ในระบบวางแผนการผลิต";
  if (input.material && !MATERIALS.some((m) => m.code === input.material)) e.material = "เลือกวัสดุหรือสินค้า";
  if (!(input.qty > 0) || !Number.isInteger(input.qty)) e.qty = "จำนวนที่พบเป็นจำนวนเต็มมากกว่าศูนย์";
  if (input.description.trim().length < 10) e.description = "อธิบายสิ่งที่พบให้คนอื่นอ่านแล้วเข้าใจ";
  if (!PEOPLE.includes(input.reportedBy)) e.reportedBy = "เลือกผู้รายงาน";
  return e;
}

export function createNcr(input: NcrInput): Ncr {
  assertValid(ncrErrors(input));
  return commit(() =>
    pushNcr({ date: TODAY, source: input.source, ref: input.ref.trim(), material: input.material || undefined, qty: input.qty, description: input.description.trim(), severity: input.severity, reportedBy: input.reportedBy }),
  );
}

export type ComplaintInput = { delivery: string; material: string; qty: number; description: string; severity: Severity; reportedBy: string };

export const customerOfDelivery = (no: string) => {
  const d = DELIVERIES.find((x) => x.no === no);
  return d ? SALES_ORDERS.find((s) => s.no === d.so)?.customer : undefined;
};

/** ใบส่งของที่ถึงมือลูกค้าแล้ว — ข้อร้องเรียนอ้างได้เฉพาะของที่ลูกค้าได้รับจริง */
export const DELIVERY_OPTIONS = () =>
  DELIVERIES.filter((d) => d.status === "ส่งถึงแล้ว").map((d) => ({
    value: d.no,
    label: `${d.no} · ${customerName(customerOfDelivery(d.no))} · ${d.deliveredOn ?? d.date}`,
  }));

/** ข้อร้องเรียนลูกค้า (ข้อ 9.1.2) — อ้างใบส่งของจริงของฝ่ายขาย ส่งเกินที่ส่งไปไม่ได้ */
export function complaintErrors(input: ComplaintInput): Errors {
  const e: Errors = {};
  const d = DELIVERIES.find((x) => x.no === input.delivery);
  if (!d) e.delivery = "เลือกใบส่งของที่ลูกค้าร้องเรียน";
  else {
    const line = d.lines.find((l) => l.material === input.material);
    if (!line) e.material = "เลือกสินค้าที่อยู่ในใบส่งของนี้";
    else if (!(input.qty > 0) || !Number.isInteger(input.qty) || input.qty > line.qty) e.qty = `จำนวน 1–${line.qty} ตามที่ส่งไป`;
  }
  if (input.description.trim().length < 10) e.description = "เล่าสิ่งที่ลูกค้าแจ้งตามจริง";
  if (!PEOPLE.includes(input.reportedBy)) e.reportedBy = "เลือกผู้รับเรื่อง";
  return e;
}

export function createComplaint(input: ComplaintInput): Ncr {
  assertValid(complaintErrors(input));
  return commit(() =>
    pushNcr({
      date: TODAY, source: "ข้อร้องเรียนลูกค้า", ref: input.delivery, material: input.material, qty: input.qty,
      customer: customerOfDelivery(input.delivery), description: input.description.trim(), severity: input.severity, reportedBy: input.reportedBy,
    }),
  );
}

/** ของอยู่ในคลังเรา — สั่งทำลายหรือส่งคืนแล้วต้องตัดสต็อกจริง */
const inOurStock = (n: Ncr) => ["ตรวจรับ", "ระหว่างผลิต", "ตรวจก่อนส่ง"].includes(n.source) && !!n.material;

export type DispositionInput = { disposition: Disposition; by: string; note: string };

export function dispositionErrors(no: string, input: DispositionInput): Errors {
  const n = ncrByNo(no);
  const e: Errors = {};
  if (n.status !== "รอสั่งการ") e.disposition = `${no} ${n.status === "ปิดแล้ว" ? "ปิดไปแล้ว" : "สั่งการไปแล้ว"}`;
  if (input.disposition === "ส่งคืนผู้ขาย" && !n.vendor) e.disposition = "ส่งคืนผู้ขายได้เฉพาะของที่มาจากการตรวจรับ";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้สั่งการ";
  if (input.disposition === "ใช้ตามสภาพ (ผ่อนผัน)" && input.by !== QMR) e.by = `การผ่อนผันต้องอนุมัติโดย ${QMR} (QMR)`;
  if (input.note.trim().length < 5) e.note = "บอกสิ่งที่ต้องทำ";
  if (!e.disposition && inOurStock(n) && (input.disposition === "ทำลาย" || input.disposition === "ส่งคืนผู้ขาย")) {
    const m = MATERIALS.find((x) => x.code === n.material);
    if (m && m.stock < n.qty) e.disposition = `สต็อก ${m.name} เหลือ ${m.stock} ${m.unit} น้อยกว่า ${n.qty} ที่จะตัดออก`;
  }
  return e;
}

/** สั่งการ (ข้อ 8.7.1) — ทำลายหรือส่งคืนตัดสต็อกผ่านคลังวัสดุ ใต้เลข NCR เดียวกัน */
export function disposeNcr(no: string, input: DispositionInput) {
  assertValid(dispositionErrors(no, input));
  const n = ncrByNo(no);
  return commit(() => {
    if (inOurStock(n) && (input.disposition === "ทำลาย" || input.disposition === "ส่งคืนผู้ขาย")) {
      const move = postStockMove({
        kind: input.disposition === "ทำลาย" ? "ตัดของเสีย" : "ปรับยอดลด",
        material: n.material!, qty: n.qty, department: "ฝ่ายประกันคุณภาพ", date: TODAY,
        reason: `${input.disposition === "ทำลาย" ? "ทำลาย" : "ส่งคืนผู้ขาย"}ตาม ${n.no}`,
      });
      n.stockDoc = move.doc;
    }
    n.disposition = input.disposition;
    n.dispositionBy = input.by;
    n.dispositionNote = input.note.trim();
    n.status = "ดำเนินการ";
    return n;
  });
}

export function closeNcrErrors(no: string): Errors {
  const n = ncrByNo(no);
  const e: Errors = {};
  if (n.status === "ปิดแล้ว") e.close = `${no} ปิดไปแล้ว`;
  else if (!n.disposition) e.close = "สั่งการก่อนปิด";
  else if (n.severity === "รุนแรง" && !n.capa) e.close = "NCR รุนแรงต้องเปิดใบขอให้แก้ไข (CAR) หาสาเหตุก่อนปิด";
  return e;
}

export function closeNcr(no: string, by: string, date = TODAY) {
  assertValid(closeNcrErrors(no));
  if (!PEOPLE.includes(by)) throw new Error("เลือกผู้ปิดเรื่อง");
  const n = ncrByNo(no);
  return commit(() => {
    n.status = "ปิดแล้ว";
    n.closedOn = date;
    n.closedBy = by;
    return n;
  });
}

/* ================================================================== capa */

export const CAUSE_CATEGORIES = ["คน", "เครื่องจักร", "วัสดุ", "วิธีการ", "การวัด", "สภาพแวดล้อม"] as const;
export type CauseCategory = (typeof CAUSE_CATEGORIES)[number];

export type CapaAction = { what: string; owner: string; due: string; doneOn?: string };

export type Capa = {
  no: string;
  date: string;
  kind: "แก้ไข" | "ป้องกัน";
  /** NCR หรือผลตรวจติดตามที่เป็นต้นเรื่อง */
  ref: string;
  problem: string;
  owner: string;
  rootCause?: { category: CauseCategory; whys: string[] };
  actions: CapaAction[];
  status: "วิเคราะห์สาเหตุ" | "ดำเนินการ" | "ติดตามผล" | "ปิดแล้ว";
  verification?: { date: string; effective: boolean; note: string; by: string };
};

export const CAPAS: Capa[] = [
  {
    no: "CAR-2569-007", date: "2026-07-30", kind: "แก้ไข", ref: "IA-2569-02 #1", owner: "ปิยะนุช ใจดี",
    problem: "ไม่มีหลักฐานการประเมินผู้ขายรายใหม่ก่อนออกใบสั่งซื้อครั้งแรก",
    rootCause: { category: "วิธีการ", whys: ["ออกใบสั่งซื้อให้ผู้ขายใหม่ก่อนประเมิน", "ขั้นตอนไม่ได้กำหนดว่าต้องประเมินก่อนสั่งครั้งแรก", "QP-05 เขียนเฉพาะการตรวจรับ ไม่ครอบคลุมการคัดเลือกผู้ขาย"] },
    actions: [
      { what: "เพิ่มขั้นตอนประเมินผู้ขายใหม่ใน QP-05", owner: "ปิยะนุช ใจดี", due: "2026-08-15", doneOn: "2026-08-12" },
      { what: "ประเมินผู้ขายที่ใช้อยู่ย้อนหลังให้ครบ", owner: "ปิยะนุช ใจดี", due: "2026-08-31", doneOn: "2026-08-29" },
    ],
    status: "ปิดแล้ว",
    verification: { date: "2026-09-15", effective: true, note: "สุ่มใบสั่งซื้อผู้ขายใหม่ 3 ใบ มีผลประเมินก่อนสั่งครบ", by: QMR },
  },
  {
    no: "CAR-2569-008", date: "2026-09-11", kind: "แก้ไข", ref: "NCR-2569-013", owner: "วรวุฒิ พึ่งบุญ",
    problem: "สินค้าสีถลอกระหว่างขนส่งถึงลูกค้า",
    rootCause: { category: "วิธีการ", whys: ["มุมชั้นวางเสียดสีกันในรถ", "บรรจุโดยไม่มีมุมกันกระแทก", "ไม่มีวิธีการทำงานเรื่องการบรรจุสินค้าสำเร็จรูป"] },
    actions: [
      { what: "จัดทำ WI การบรรจุสินค้าสำเร็จรูปพร้อมมุมกันกระแทก", owner: "วรวุฒิ พึ่งบุญ", due: "2026-09-20" },
      { what: "อบรมพนักงานคลังเรื่องการบรรจุ", owner: "วรวุฒิ พึ่งบุญ", due: "2026-09-30" },
    ],
    status: "ดำเนินการ",
  },
];

export const capaByNo = (no: string) => {
  const c = CAPAS.find((x) => x.no === no);
  if (!c) throw new Error(`ไม่พบ ${no}`);
  return c;
};

export const nextCapaNo = () => nextNo(CAPAS.map((c) => c.no), `CAR-${YEAR}-`, 3);
export const overdueActions = (c: Capa) => c.actions.filter((a) => !a.doneOn && a.due < TODAY);
export const openCapas = () => CAPAS.filter((c) => c.status !== "ปิดแล้ว");

export type CapaInput = { kind: Capa["kind"]; ref: string; problem: string; owner: string };

export function capaErrors(input: CapaInput): Errors {
  const e: Errors = {};
  if (input.ref.trim().length < 3) e.ref = "ใส่ต้นเรื่อง เช่น เลข NCR หรือผลตรวจติดตาม";
  if (input.problem.trim().length < 10) e.problem = "บอกปัญหาที่ต้องแก้";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบ";
  return e;
}

/** เปิด CAR — ถ้าต้นเรื่องเป็น NCR หรือผลตรวจติดตาม จะผูกกลับไปที่ต้นเรื่องด้วย */
export function openCapa(input: CapaInput): Capa {
  assertValid(capaErrors(input));
  return commit(() => {
    const c: Capa = { no: nextCapaNo(), date: TODAY, kind: input.kind, ref: input.ref.trim(), problem: input.problem.trim(), owner: input.owner, actions: [], status: "วิเคราะห์สาเหตุ" };
    CAPAS.push(c);
    const ncr = NCRS.find((n) => n.no === c.ref);
    if (ncr) ncr.capa = c.no;
    for (const a of AUDITS) for (const f of a.findings) if (`${a.no} #${f.id}` === c.ref) f.capa = c.no;
    return c;
  });
}

/** หาสาเหตุราก (ข้อ 10.2.1 ข) — ถามทำไมอย่างน้อยสามชั้นก่อนสรุป */
export function rootCauseErrors(input: { category: CauseCategory; whys: string[] }): Errors {
  const e: Errors = {};
  if (!CAUSE_CATEGORIES.includes(input.category)) e.category = "เลือกกลุ่มสาเหตุ";
  if (input.whys.filter((w) => w.trim().length >= 5).length < 3) e.whys = "ถามทำไมให้ได้อย่างน้อยสามชั้น";
  return e;
}

export function recordRootCause(no: string, input: { category: CauseCategory; whys: string[] }) {
  const c = capaByNo(no);
  if (c.status === "ปิดแล้ว") throw new Error(`${no} ปิดไปแล้ว`);
  assertValid(rootCauseErrors(input));
  return commit(() => {
    c.rootCause = { category: input.category, whys: input.whys.map((w) => w.trim()).filter(Boolean) };
    if (c.status === "วิเคราะห์สาเหตุ" && c.actions.length > 0) c.status = "ดำเนินการ";
    return c;
  });
}

export function actionErrors(input: CapaAction): Errors {
  const e: Errors = {};
  if (input.what.trim().length < 5) e.what = "บอกสิ่งที่ต้องทำ";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบ";
  if (!isDate(input.due)) e.due = "ใส่กำหนดเสร็จ";
  else if (input.due < TODAY) e.due = "กำหนดเสร็จต้องไม่ย้อนหลัง";
  return e;
}

export function addCapaAction(no: string, input: CapaAction) {
  const c = capaByNo(no);
  if (c.status === "ปิดแล้ว" || c.status === "ติดตามผล") throw new Error(`${no} ${c.status} เพิ่มมาตรการไม่ได้`);
  assertValid(actionErrors(input));
  return commit(() => {
    c.actions.push({ what: input.what.trim(), owner: input.owner, due: input.due });
    if (c.status === "วิเคราะห์สาเหตุ" && c.rootCause) c.status = "ดำเนินการ";
    return c;
  });
}

export function completeCapaAction(no: string, index: number, date = TODAY) {
  const c = capaByNo(no);
  const a = c.actions[index];
  if (!a) throw new Error("ไม่พบมาตรการนี้");
  if (a.doneOn) throw new Error("มาตรการนี้ทำเสร็จแล้ว");
  if (!c.rootCause) throw new Error("บันทึกสาเหตุรากก่อน");
  return commit(() => {
    a.doneOn = date;
    if (c.actions.every((x) => x.doneOn)) c.status = "ติดตามผล";
    return c;
  });
}

/** ติดตามประสิทธิผล (ข้อ 10.2.1 ง) — ไม่ได้ผลคือกลับไปหาสาเหตุใหม่ ไม่ใช่ปิดทิ้ง */
export function verifyCapa(no: string, input: { effective: boolean; note: string; by: string }, date = TODAY) {
  const c = capaByNo(no);
  if (c.status !== "ติดตามผล") throw new Error("ทำมาตรการให้ครบก่อนติดตามผล");
  if (input.note.trim().length < 10) throw new Error("บอกหลักฐานที่ใช้ตัดสินว่าได้ผลหรือไม่");
  if (!PEOPLE.includes(input.by)) throw new Error("เลือกผู้ติดตามผล");
  if (input.by === c.owner) throw new Error("ผู้ติดตามผลต้องไม่ใช่ผู้รับผิดชอบ CAR");
  return commit(() => {
    c.verification = { date, effective: input.effective, note: input.note.trim(), by: input.by };
    c.status = input.effective ? "ปิดแล้ว" : "วิเคราะห์สาเหตุ";
    return c;
  });
}

/* ================================================================= audit */

export const FINDING_TYPES = ["ข้อบกพร่องหลัก", "ข้อบกพร่องย่อย", "ข้อสังเกต"] as const;
export type FindingType = (typeof FINDING_TYPES)[number];
export type Finding = { id: number; clause: string; type: FindingType; detail: string; capa?: string };

export type Audit = {
  no: string;
  /** ฝ่ายที่ถูกตรวจ */
  area: string;
  clauses: string[];
  auditor: string;
  planned: string;
  status: "ตามแผน" | "กำลังตรวจ" | "ปิดแล้ว";
  findings: Finding[];
  performedOn?: string;
  closedOn?: string;
};

export const AUDITS: Audit[] = [
  { no: "IA-2569-01", area: "ฝ่ายผลิต", clauses: ["8.5", "7.1.5"], auditor: "ปิยะนุช ใจดี", planned: "2026-03-18", status: "ปิดแล้ว", performedOn: "2026-03-18", closedOn: "2026-04-02", findings: [{ id: 1, clause: "8.5", type: "ข้อสังเกต", detail: "ป้ายชี้บ่งสถานะงานระหว่างผลิตบางจุดซีดจางอ่านยาก" }] },
  { no: "IA-2569-02", area: "ฝ่ายจัดซื้อ", clauses: ["8.4"], auditor: "อนุชา ทองดี", planned: "2026-07-24", status: "ปิดแล้ว", performedOn: "2026-07-24", closedOn: "2026-09-15", findings: [{ id: 1, clause: "8.4", type: "ข้อบกพร่องย่อย", detail: "ไม่มีหลักฐานการประเมินผู้ขายรายใหม่ก่อนสั่งซื้อครั้งแรก", capa: "CAR-2569-007" }] },
  { no: "IA-2569-03", area: "ฝ่ายคลังสินค้า", clauses: ["8.5", "7.5"], auditor: "สุภาพร แก้วมณี", planned: "2026-10-08", status: "ตามแผน", findings: [] },
  { no: "IA-2569-04", area: "ฝ่ายประกันคุณภาพ", clauses: ["7.5", "9.1.2", "10.2"], auditor: "ชลธิชา มั่นคง", planned: "2026-11-12", status: "ตามแผน", findings: [] },
];

export const auditByNo = (no: string) => {
  const a = AUDITS.find((x) => x.no === no);
  if (!a) throw new Error(`ไม่พบ ${no}`);
  return a;
};

export const nextAuditNo = () => nextNo(AUDITS.map((a) => a.no), `IA-${YEAR}-`, 2);

export type AuditInput = { area: string; clauses: string[]; auditor: string; planned: string };

/** ผู้ตรวจต้องไม่ตรวจงานของตัวเอง (ข้อ 9.2.2 ค) — ระบบตรวจให้ ไม่ต้องจำ */
export function auditErrors(input: AuditInput): Errors {
  const e: Errors = {};
  if (!DEPARTMENTS.includes(input.area)) e.area = "เลือกฝ่ายที่จะตรวจ";
  if (input.clauses.length === 0) e.clauses = "เลือกข้อกำหนดที่จะตรวจอย่างน้อยหนึ่งข้อ";
  const who = QM_TEAM.find((p) => p.name === input.auditor);
  if (!who) e.auditor = "เลือกผู้ตรวจ";
  else if (!who.auditor) e.auditor = `${who.name} ยังไม่ผ่านการอบรมผู้ตรวจติดตามภายใน`;
  else if (who.dept === input.area) e.auditor = "ผู้ตรวจต้องไม่ตรวจฝ่ายของตัวเอง";
  if (!isDate(input.planned)) e.planned = "ใส่วันที่ตรวจ";
  else if (input.planned < TODAY) e.planned = "วันที่ตรวจต้องไม่ย้อนหลัง";
  return e;
}

export function planAudit(input: AuditInput): Audit {
  assertValid(auditErrors(input));
  return commit(() => {
    const a: Audit = { no: nextAuditNo(), area: input.area, clauses: [...input.clauses], auditor: input.auditor, planned: input.planned, status: "ตามแผน", findings: [] };
    AUDITS.push(a);
    return a;
  });
}

export function startAudit(no: string, date = TODAY) {
  const a = auditByNo(no);
  if (a.status !== "ตามแผน") throw new Error(`${no} ${a.status}`);
  return commit(() => {
    a.status = "กำลังตรวจ";
    a.performedOn = date;
    return a;
  });
}

export function findingErrors(no: string, input: { clause: string; type: FindingType; detail: string }): Errors {
  const a = auditByNo(no);
  const e: Errors = {};
  if (a.status !== "กำลังตรวจ") e.detail = "เริ่มการตรวจก่อนบันทึกสิ่งที่พบ";
  if (!CLAUSES.some((c) => c.code === input.clause)) e.clause = "เลือกข้อกำหนด";
  if (input.detail.trim().length < 10) e.detail = "เขียนสิ่งที่พบพร้อมหลักฐาน";
  return e;
}

export function addFinding(no: string, input: { clause: string; type: FindingType; detail: string }) {
  assertValid(findingErrors(no, input));
  const a = auditByNo(no);
  return commit(() => {
    const f: Finding = { id: a.findings.length + 1, clause: input.clause, type: input.type, detail: input.detail.trim() };
    a.findings.push(f);
    return f;
  });
}

/** ข้อบกพร่องต้องมี CAR ก่อนปิดการตรวจ ข้อสังเกตไม่ต้อง */
export const findingsWithoutCapa = (a: Audit) => a.findings.filter((f) => f.type !== "ข้อสังเกต" && !f.capa);

export function closeAudit(no: string, date = TODAY) {
  const a = auditByNo(no);
  if (a.status !== "กำลังตรวจ") throw new Error(`${no} ${a.status} ปิดไม่ได้`);
  const open = findingsWithoutCapa(a);
  if (open.length > 0) throw new Error(`เปิด CAR ให้ข้อบกพร่องอีก ${open.length} ข้อก่อนปิดการตรวจ`);
  return commit(() => {
    a.status = "ปิดแล้ว";
    a.closedOn = date;
    return a;
  });
}

/* =========================================================== calibration */

export type CalRecord = { date: string; by: string; certNo: string; result: "ผ่าน" | "ไม่ผ่าน"; error: string; note?: string };

export type Gauge = {
  code: string;
  name: string;
  range: string;
  resolution: string;
  location: string;
  intervalMonths: number;
  lastCal: string;
  status: "ใช้งาน" | "พักใช้";
  records: CalRecord[];
};

export const GAUGES: Gauge[] = [
  { code: "QC-VC-01", name: "เวอร์เนียร์คาลิปเปอร์", range: "0–150 มม.", resolution: "0.02 มม.", location: "ห้อง QC", intervalMonths: 12, lastCal: "2026-01-20", status: "ใช้งาน", records: [{ date: "2026-01-20", by: "บจก. ไทยแคลิเบรชั่น (ISO/IEC 17025)", certNo: "TC-26-00418", result: "ผ่าน", error: "+0.01 มม." }] },
  { code: "QC-MC-01", name: "ไมโครมิเตอร์", range: "0–25 มม.", resolution: "0.001 มม.", location: "ห้อง QC", intervalMonths: 12, lastCal: "2025-09-10", status: "ใช้งาน", records: [{ date: "2025-09-10", by: "บจก. ไทยแคลิเบรชั่น (ISO/IEC 17025)", certNo: "TC-25-03177", result: "ผ่าน", error: "+0.002 มม." }] },
  { code: "QC-CT-01", name: "เครื่องวัดความหนาสีเคลือบ", range: "0–1,500 ไมครอน", resolution: "1 ไมครอน", location: "สายพ่นสี", intervalMonths: 6, lastCal: "2026-04-05", status: "ใช้งาน", records: [{ date: "2026-04-05", by: "ภายใน (แผ่นมาตรฐาน)", certNo: "IC-2569-011", result: "ผ่าน", error: "−2 ไมครอน" }] },
  { code: "QC-TM-01", name: "ตลับเมตร", range: "0–5 ม.", resolution: "1 มม.", location: "สายประกอบ", intervalMonths: 12, lastCal: "2026-06-02", status: "ใช้งาน", records: [{ date: "2026-06-02", by: "ภายใน (เทียบบรรทัดมาตรฐาน)", certNo: "IC-2569-024", result: "ผ่าน", error: "0 มม." }] },
  { code: "QC-SC-01", name: "ตาชั่งตั้งพื้น", range: "0–300 กก.", resolution: "0.1 กก.", location: "คลังสินค้า", intervalMonths: 12, lastCal: "2025-12-15", status: "ใช้งาน", records: [{ date: "2025-12-15", by: "สำนักงานกลางชั่งตวงวัด", certNo: "CBW-68-2210", result: "ผ่าน", error: "+0.1 กก." }] },
];

export const gaugeByCode = (code: string) => {
  const g = GAUGES.find((x) => x.code === code);
  if (!g) throw new Error(`ไม่พบเครื่องมือ ${code}`);
  return g;
};

export const nextDue = (g: Gauge) => addMonths(g.lastCal, g.intervalMonths);

export type CalState = "พักใช้" | "เกินกำหนด" | "ใกล้ครบ" | "ปกติ";

export function calState(g: Gauge): CalState {
  if (g.status === "พักใช้") return "พักใช้";
  const due = nextDue(g);
  if (due < TODAY) return "เกินกำหนด";
  if (due <= addDays(TODAY, 30)) return "ใกล้ครบ";
  return "ปกติ";
}

export type GaugeInput = { code: string; name: string; range: string; resolution: string; location: string; intervalMonths: number; lastCal: string };

export function gaugeErrors(input: GaugeInput): Errors {
  const e: Errors = {};
  if (!/^[A-Z]{2}-[A-Z]{2}-\d{2}$/.test(input.code.trim())) e.code = "รหัสรูปแบบ QC-XX-00";
  else if (GAUGES.some((g) => g.code === input.code.trim())) e.code = "รหัสนี้มีอยู่แล้ว";
  if (input.name.trim().length < 3) e.name = "ใส่ชื่อเครื่องมือ";
  if (input.range.trim().length < 2) e.range = "ใส่ช่วงการวัด";
  if (input.location.trim().length < 2) e.location = "ใส่ที่ใช้งาน";
  if (![3, 6, 12, 24].includes(input.intervalMonths)) e.intervalMonths = "เลือกรอบสอบเทียบ";
  if (!isDate(input.lastCal) || input.lastCal > TODAY) e.lastCal = "วันที่สอบเทียบล่าสุดต้องไม่เกินวันนี้";
  return e;
}

export function addGauge(input: GaugeInput): Gauge {
  assertValid(gaugeErrors(input));
  return commit(() => {
    const g: Gauge = { ...input, code: input.code.trim(), name: input.name.trim(), status: "ใช้งาน", records: [] };
    GAUGES.push(g);
    return g;
  });
}

export type CalInput = { date: string; by: string; certNo: string; result: "ผ่าน" | "ไม่ผ่าน"; error: string; note: string };

export function calErrors(code: string, input: CalInput): Errors {
  const g = gaugeByCode(code);
  const e: Errors = {};
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่สอบเทียบต้องไม่เกินวันนี้";
  else if (input.date < g.lastCal) e.date = "วันที่ต้องไม่ก่อนการสอบเทียบครั้งล่าสุด";
  if (input.by.trim().length < 3) e.by = "ผู้สอบเทียบหรือห้องปฏิบัติการ";
  if (input.certNo.trim().length < 3) e.certNo = "เลขที่ใบรับรองผล";
  if (input.error.trim().length < 1) e.error = "ค่าความคลาดเคลื่อนที่วัดได้";
  if (input.result === "ไม่ผ่าน" && input.note.trim().length < 10) e.note = "บอกสิ่งที่พบ — ใช้ประเมินผลการวัดที่ผ่านมา";
  return e;
}

/**
 * บันทึกผลสอบเทียบ — ไม่ผ่านคือพักใช้เครื่องมือ แล้วเปิด NCR ให้ทบทวนผลการวัด
 * ตั้งแต่สอบเทียบครั้งก่อน (ข้อ 7.1.5.2) เพราะของที่วัดด้วยเครื่องนี้อาจผ่านมาโดยไม่ควรผ่าน
 */
export function recordCalibration(code: string, input: CalInput) {
  assertValid(calErrors(code, input));
  const g = gaugeByCode(code);
  return commit(() => {
    const previous = g.lastCal;
    g.records.push({ date: input.date, by: input.by.trim(), certNo: input.certNo.trim(), result: input.result, error: input.error.trim(), note: input.note.trim() || undefined });
    let ncr: Ncr | undefined;
    if (input.result === "ผ่าน") {
      g.lastCal = input.date;
      g.status = "ใช้งาน";
    } else {
      g.status = "พักใช้";
      const used = LOTS.filter((l) => l.inspectedOn && l.inspectedOn >= previous && planOf(l.material).some((c) => c.method.includes(code)));
      ncr = pushNcr({
        date: input.date, source: "สอบเทียบเครื่องมือ", ref: code, qty: Math.max(1, used.length),
        description: `${g.name} ${code} สอบเทียบไม่ผ่าน (${input.error.trim()}) — ${input.note.trim()} ทบทวนผลตรวจ ${used.length} ล็อตที่วัดด้วยเครื่องนี้ตั้งแต่ ${previous}${used.length ? `: ${used.map((l) => l.no).join(", ")}` : ""}`,
        severity: "ปานกลาง", reportedBy: QMR,
      });
    }
    return { gauge: g, ncr };
  });
}

/* ============================================================ objectives */

const rate = (hit: number, of: number) => (of === 0 ? 100 : Math.round((hit / of) * 1000) / 10);

/**
 * วัตถุประสงค์คุณภาพ (ข้อ 6.2) — วัดจากงานจริงในระบบ ไม่ใช่ตัวเลขที่กรอกตอนทบทวน
 * ฝ่ายบริหารจึงเห็นค่าเดียวกับที่หน้าจออื่นใช้ทำงาน
 */
export function objectives() {
  const decided = (o: LotOrigin) => LOTS.filter((l) => l.origin === o && l.status === "ตัดสินแล้ว");
  const passed = (o: LotOrigin) => decided(o).filter((l) => l.decision === "ผ่าน").length;
  const complaints = NCRS.filter((n) => n.source === "ข้อร้องเรียนลูกค้า" && n.date.slice(0, 7) === TODAY.slice(0, 7)).length;
  const actions = CAPAS.flatMap((c) => c.actions);
  const dueActions = actions.filter((a) => a.due <= TODAY);
  const onTime = dueActions.filter((a) => a.doneOn && a.doneOn <= a.due).length;
  const active = GAUGES.filter((g) => g.status === "ใช้งาน");
  const current = active.filter((g) => nextDue(g) >= TODAY).length;
  return [
    { name: "ของเข้าผ่านการตรวจรับ", clause: "8.4", target: 95, actual: rate(passed("ตรวจรับ"), decided("ตรวจรับ").length), unit: "%", better: "higher" as const },
    { name: "สินค้าผ่านการตรวจก่อนส่งครั้งแรก", clause: "8.6", target: 98, actual: rate(passed("ตรวจก่อนส่ง"), decided("ตรวจก่อนส่ง").length), unit: "%", better: "higher" as const },
    { name: "ข้อร้องเรียนลูกค้าเดือนนี้", clause: "9.1.2", target: 2, actual: complaints, unit: "เรื่อง", better: "lower" as const },
    { name: "มาตรการแก้ไขเสร็จตามกำหนด", clause: "10.2", target: 90, actual: rate(onTime, dueActions.length), unit: "%", better: "higher" as const },
    { name: "เครื่องมือวัดอยู่ในรอบสอบเทียบ", clause: "7.1.5", target: 100, actual: rate(current, active.length), unit: "%", better: "higher" as const },
  ].map((o) => ({ ...o, met: o.better === "higher" ? o.actual >= o.target : o.actual <= o.target }));
}

/** ผู้ขายตามอัตราล็อตที่ไม่ผ่าน — ข้อมูลตั้งต้นของการประเมินผู้ขาย (ข้อ 8.4.1) */
export function vendorQuality() {
  return VENDORS.map((v) => {
    const lots = LOTS.filter((l) => l.vendor === v.code && l.status === "ตัดสินแล้ว");
    const rejected = lots.filter((l) => l.decision === "ไม่ผ่าน").length;
    return { code: v.code, name: v.name, lots: lots.length, rejected, rate: rate(rejected, lots.length) };
  }).filter((v) => v.lots > 0);
}

/** NCR ระหว่างผลิตอ้างใบสั่งผลิตของระบบวางแผนการผลิต — เลขที่พิมพ์ต้องมีอยู่จริง */
export function productionOrderExists(no: string) {
  return ORDERS.some((o) => o.no === no);
}
