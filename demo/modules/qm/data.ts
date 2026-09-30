import { commit } from "../kit";
import {
  COMPANY, PEOPLE, QMR, TODAY, YEAR, addDays, addMonths, assertValid, carOf, contributeReviewInput, isDate, nextNo, rate,
} from "../ims/data";
import type { Errors } from "../ims/data";
import {
  GOODS_RECEIPTS, INFO_RECORDS, MATERIALS, PURCHASE_ORDERS, VENDORS, blockVendor, gradeOf, latestReview, postStockMove,
  reviewScore, unblockVendor, vendorScore,
} from "../mm/data";
import { ORDERS, PP_MOVEMENTS } from "../pp/data";
import { CUSTOMERS, DELIVERIES, QUOTATIONS, SALES_ORDERS, isCancelled, salesOrder } from "../sd/data";

export { COMPANY, TODAY };
export type { Errors };

/**
 * บริหารคุณภาพตาม ISO 9001:2015 — ส่วนที่เป็นงานคุณภาพหน้างาน ส่วนที่ใช้ร่วมกับมาตรฐานอื่น
 * (เอกสาร ตรวจติดตาม CAR บุคลากร) อยู่ในระบบบริหารบูรณาการ
 *
 * ของที่ตรวจมาจากเอกสารจริงของระบบอื่น: ล็อตตรวจรับมาจากใบรับของของจัดซื้อ
 * ล็อตตรวจก่อนส่งมาจากการรับสินค้าผลิตเสร็จ ข้อร้องเรียนอ้างใบส่งของของฝ่ายขาย
 * ของที่ตัดสินให้ทำลายหรือส่งคืนผู้ขายตัดสต็อกผ่านฟังก์ชันของคลังวัสดุ และผู้ส่งมอบที่ถูก
 * ระงับจะสั่งซื้อไม่ได้เพราะระงับผ่านระบบจัดซื้อ — โมดูลนี้ไม่เขียนข้อมูลของโมดูลอื่นตรง ๆ
 */

export const materialName = (code: string) => MATERIALS.find((m) => m.code === code)?.name ?? code;
export const materialUnit = (code: string) => MATERIALS.find((m) => m.code === code)?.unit ?? "";
export const vendorName = (code?: string) => (code ? VENDORS.find((v) => v.code === code)?.name ?? code : "—");
export const customerName = (code?: string) => (code ? CUSTOMERS.find((c) => c.code === code)?.name ?? code : "—");

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
    return c.kind === "วัดค่า" ? measured(c.name, r.min ?? NaN, r.max ?? NaN, c) : visual(c.name, r.defects ?? 0);
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
    status: "ดำเนินการ", disposition: "ซ่อมหรือทำใหม่", dispositionBy: QMR, dispositionNote: "ส่งช่างเข้าไปพ่นซ่อมที่หน้างานลูกค้า 26/09",
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

/** CAR ของ NCR ใบนี้ — หาจากเลขต้นเรื่องของ CAR ในระบบบริหารบูรณาการ ไม่เก็บซ้ำสองที่ */
export const carOfNcr = (n: Ncr) => carOf(n.no);

export const nextNcrNo = () => nextNo(NCRS.map((n) => n.no), `NCR-${YEAR}-`, 3);

function pushNcr(input: Omit<Ncr, "no" | "status">): Ncr {
  const n: Ncr = { ...input, no: nextNcrNo(), status: "รอสั่งการ" };
  NCRS.push(n);
  return n;
}

export type NcrInput = { source: NcrSource; ref: string; material: string; qty: number; description: string; severity: Severity; reportedBy: string };

/** NCR ระหว่างผลิตอ้างใบสั่งผลิตของระบบวางแผนการผลิต — เลขที่พิมพ์ต้องมีอยู่จริง */
export const productionOrderExists = (no: string) => ORDERS.some((o) => o.no === no);

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
  else if (n.severity === "รุนแรง" && !carOfNcr(n)) e.close = "NCR รุนแรงต้องเปิดใบขอให้แก้ไข (CAR) หาสาเหตุก่อนปิด";
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

/* ================================================ customer requirements */

export const REVIEW_CHECKS = [
  { key: "spec", label: "ข้อกำหนดสินค้าชัดเจนและทำได้ตามแบบ" },
  { key: "capacity", label: "กำลังการผลิตและวัตถุดิบเพียงพอ" },
  { key: "delivery", label: "ส่งทันวันที่ลูกค้าต้องการ" },
  { key: "legal", label: "เป็นไปตามกฎหมายและมาตรฐานที่เกี่ยวข้อง" },
] as const;
export type CheckKey = (typeof REVIEW_CHECKS)[number]["key"];

export type RequirementReview = {
  /** ใบเสนอราคาหรือใบสั่งขายที่ทบทวน */
  doc: string;
  date: string;
  by: string;
  checks: Record<CheckKey, boolean>;
  special: string;
  result: "รับได้" | "รับได้แบบมีเงื่อนไข" | "รับไม่ได้";
  note: string;
};

const allYes: Record<CheckKey, boolean> = { spec: true, capacity: true, delivery: true, legal: true };

export const REQUIREMENT_REVIEWS: RequirementReview[] = [
  { doc: "SO-2569-0412", date: "2026-09-14", by: "ชลธิชา มั่นคง", checks: allYes, special: "", result: "รับได้", note: "" },
  { doc: "SO-2569-0413", date: "2026-09-17", by: "ชลธิชา มั่นคง", checks: allYes, special: "ส่งพร้อมใบรับรองคุณภาพ", result: "รับได้", note: "" },
  { doc: "QT-2569-0231", date: "2026-09-16", by: "ชลธิชา มั่นคง", checks: { ...allYes, delivery: false }, special: "", result: "รับได้แบบมีเงื่อนไข", note: "ลูกค้าขอรับใน 5 วัน ทำได้ 10 วัน ลูกค้ายอมรับทางอีเมล" },
  { doc: "SO-2569-0414", date: "2026-09-19", by: "ชลธิชา มั่นคง", checks: allYes, special: "", result: "รับได้", note: "ทบทวนแล้วตอนเสนอราคา QT-2569-0231" },
];

/** ข้อตกลงกับลูกค้าที่ต้องทบทวนก่อนผูกพัน (ข้อ 8.2.3) — ใบเสนอราคาที่ยังรอลูกค้าและใบสั่งขายที่ยังไม่ยกเลิก */
export function commitments() {
  const quotes = QUOTATIONS.filter((q) => q.status !== "ยกเลิก").map((q) => ({ doc: q.no, kind: "ใบเสนอราคา" as const, customer: q.customer, date: q.date, lines: q.lines, shipBy: undefined as string | undefined }));
  const orders = SALES_ORDERS.filter((so) => !isCancelled(so)).map((so) => ({ doc: so.no, kind: "ใบสั่งขาย" as const, customer: so.customer, date: so.date, lines: so.lines, shipBy: so.shipBy }));
  return [...quotes, ...orders].sort((a, b) => b.date.localeCompare(a.date));
}

export const reviewOf = (doc: string) => REQUIREMENT_REVIEWS.find((r) => r.doc === doc);
export const unreviewed = () => commitments().filter((c) => !reviewOf(c.doc));

/** ใบสั่งขายที่ยืนยันกับลูกค้าไปก่อนทบทวน — ผู้ตรวจประเมินจะถามทุกใบ */
export const confirmedBeforeReview = () =>
  unreviewed().filter((c) => c.kind === "ใบสั่งขาย" && salesOrder(c.doc).status === "ยืนยันแล้ว");

/** สต็อกที่พร้อมส่งต่อรายการ — ข้อมูลช่วยตัดสินเรื่องกำลังการผลิต */
export const stockCover = (lines: { material: string; qty: number }[]) =>
  lines.map((l) => ({ material: l.material, qty: l.qty, stock: MATERIALS.find((m) => m.code === l.material)?.stock ?? 0 }));

export type RequirementInput = Omit<RequirementReview, "date">;

export function requirementErrors(input: RequirementInput): Errors {
  const e: Errors = {};
  if (!commitments().some((c) => c.doc === input.doc)) e.doc = "เลือกใบเสนอราคาหรือใบสั่งขาย";
  else if (reviewOf(input.doc)) e.doc = `${input.doc} ทบทวนแล้ว`;
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้ทบทวน";
  const failed = REVIEW_CHECKS.filter((c) => !input.checks[c.key]);
  if (input.result === "รับได้" && failed.length > 0) e.result = `ยังมีข้อที่ไม่ผ่าน (${failed.map((c) => c.label).join(", ")}) — รับได้แบบมีเงื่อนไขหรือรับไม่ได้`;
  if (input.result !== "รับได้" && input.note.trim().length < 10) e.note = "บอกเงื่อนไขหรือเหตุผล และลูกค้ารับทราบอย่างไร";
  return e;
}

export function reviewRequirement(input: RequirementInput, date = TODAY) {
  assertValid(requirementErrors(input));
  return commit(() => {
    const r: RequirementReview = { ...input, date, special: input.special.trim(), note: input.note.trim(), checks: { ...input.checks } };
    REQUIREMENT_REVIEWS.push(r);
    return r;
  });
}

/* ================================================== design and development */

export const DESIGN_STAGES = ["ข้อมูลเข้า", "ผลการออกแบบ", "ทบทวนการออกแบบ", "ทวนสอบ", "รับรองความใช้ได้", "ส่งมอบสู่การผลิต"] as const;
export type DesignStage = (typeof DESIGN_STAGES)[number];

export type StageRecord = { stage: DesignStage; date: string; by: string; evidence: string; participants?: string[] };
export type DesignChange = { date: string; change: string; reason: string; approvedBy: string; reverified: boolean };

export type DesignProject = {
  no: string;
  product: string;
  customer?: string;
  owner: string;
  started: string;
  target: string;
  records: StageRecord[];
  changes: DesignChange[];
};

export const DESIGNS: DesignProject[] = [
  {
    no: "DP-2569-01", product: "ชั้นวางเหล็กรับน้ำหนักสูง 5 ชั้น (HD-500)", owner: "ศักดิ์ชัย วงศ์ไทย", started: "2026-03-02", target: "2026-08-31",
    records: [
      { stage: "ข้อมูลเข้า", date: "2026-03-05", by: "ศักดิ์ชัย วงศ์ไทย", evidence: "รับน้ำหนัก 250 กก./ชั้น สูง 2,000 มม. ถอดประกอบได้ ตาม มอก. 1167 และคำขอของลูกค้าคลังสินค้า 3 ราย" },
      { stage: "ผลการออกแบบ", date: "2026-04-10", by: "ศักดิ์ชัย วงศ์ไทย", evidence: "แบบ HD-500 Rev.A รายการวัสดุ และข้อกำหนดการเชื่อม" },
      { stage: "ทบทวนการออกแบบ", date: "2026-04-18", by: "ศักดิ์ชัย วงศ์ไทย", evidence: "ปรับเสาเป็น 2.0 มม. ตามข้อเสนอฝ่ายผลิต ลดรอยเชื่อม 4 จุด", participants: ["ศักดิ์ชัย วงศ์ไทย", "อนุชา ทองดี", "สุภาพร แก้วมณี"] },
      { stage: "ทวนสอบ", date: "2026-06-02", by: "สุภาพร แก้วมณี", evidence: "ทดสอบรับน้ำหนัก 375 กก./ชั้น (1.5 เท่า) 24 ชั่วโมง ไม่เสียรูปถาวร รายงาน TR-26-014" },
      { stage: "รับรองความใช้ได้", date: "2026-07-20", by: "ชลธิชา มั่นคง", evidence: "ลูกค้า C-101 ทดลองใช้ 20 ชุดในคลังจริง 6 สัปดาห์ ไม่มีข้อร้องเรียน" },
      { stage: "ส่งมอบสู่การผลิต", date: "2026-08-15", by: "ศักดิ์ชัย วงศ์ไทย", evidence: "ส่งแบบ รายการวัสดุ และ WI การเชื่อมให้ฝ่ายผลิต" },
    ],
    changes: [{ date: "2026-09-05", change: "เปลี่ยนแผ่นรองชั้นเป็นเหล็ก 1.2 มม.", reason: "ลดน้ำหนักขนส่งตามคำขอลูกค้า", approvedBy: QMR, reverified: true }],
  },
  {
    no: "DP-2569-02", product: "รถเข็นอุตสาหกรรมพื้นยกได้ (TR-LIFT)", owner: "ศักดิ์ชัย วงศ์ไทย", started: "2026-07-01", target: "2026-12-15",
    records: [
      { stage: "ข้อมูลเข้า", date: "2026-07-06", by: "ศักดิ์ชัย วงศ์ไทย", evidence: "ยกพื้นได้ 300–800 มม. รับ 200 กก. เบรกล็อกล้อหน้า ใช้มือเดียวปรับระดับ" },
      { stage: "ผลการออกแบบ", date: "2026-08-28", by: "ศักดิ์ชัย วงศ์ไทย", evidence: "แบบ TR-LIFT Rev.A และการคำนวณแรงไฮดรอลิก" },
    ],
    changes: [],
  },
];

export const designByNo = (no: string) => {
  const d = DESIGNS.find((x) => x.no === no);
  if (!d) throw new Error(`ไม่พบ ${no}`);
  return d;
};

/** ขั้นถัดไปที่ต้องทำ — ออกแบบข้ามขั้นไม่ได้ (ข้อ 8.3.4) */
export const nextStage = (d: DesignProject): DesignStage | undefined => DESIGN_STAGES[d.records.length];
export const released = (d: DesignProject) => d.records.some((r) => r.stage === "ส่งมอบสู่การผลิต");

export const nextDesignNo = () => nextNo(DESIGNS.map((d) => d.no), `DP-${YEAR}-`, 2);

export type DesignInput = { product: string; owner: string; target: string; inputs: string };

export function designErrors(input: DesignInput): Errors {
  const e: Errors = {};
  if (input.product.trim().length < 5) e.product = "ใส่ชื่อผลิตภัณฑ์ที่ออกแบบ";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบการออกแบบ";
  if (!isDate(input.target) || input.target <= TODAY) e.target = "ใส่กำหนดเสร็จในอนาคต";
  if (input.inputs.trim().length < 20) e.inputs = "ข้อมูลเข้าต้องครบ: หน้าที่ใช้งาน สมรรถนะ กฎหมายและมาตรฐานที่เกี่ยวข้อง (ข้อ 8.3.3)";
  return e;
}

/** เปิดโครงการออกแบบ — ข้อมูลเข้าคือขั้นแรกเสมอ */
export function startDesign(input: DesignInput): DesignProject {
  assertValid(designErrors(input));
  return commit(() => {
    const d: DesignProject = {
      no: nextDesignNo(), product: input.product.trim(), owner: input.owner, started: TODAY, target: input.target,
      records: [{ stage: "ข้อมูลเข้า", date: TODAY, by: input.owner, evidence: input.inputs.trim() }], changes: [],
    };
    DESIGNS.push(d);
    return d;
  });
}

export type StageInput = { by: string; evidence: string; participants: string[] };

export function stageErrors(no: string, input: StageInput): Errors {
  const d = designByNo(no);
  const stage = nextStage(d);
  const e: Errors = {};
  if (!stage) e.evidence = `${no} ส่งมอบสู่การผลิตแล้ว — แก้ไขแบบผ่านการควบคุมการเปลี่ยนแปลง`;
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้บันทึก";
  if (input.evidence.trim().length < 15) e.evidence = e.evidence ?? "บอกหลักฐาน เช่น เลขรายงานทดสอบ ผลที่ได้";
  // ทบทวนต้องมีคนจากหน้าที่อื่น ทวนสอบและรับรองต้องไม่ใช่คนออกแบบตรวจงานตัวเอง (ข้อ 8.3.4)
  if (stage === "ทบทวนการออกแบบ" && new Set(input.participants).size < 2) e.participants = "การทบทวนต้องมีผู้เข้าร่วมจากหน้าที่อื่นอย่างน้อยหนึ่งคน";
  if ((stage === "ทวนสอบ" || stage === "รับรองความใช้ได้") && input.by === d.owner) e.by = "ผู้ทวนสอบหรือรับรองต้องไม่ใช่ผู้ออกแบบ";
  return e;
}

export function recordStage(no: string, input: StageInput, date = TODAY) {
  assertValid(stageErrors(no, input));
  const d = designByNo(no);
  const stage = nextStage(d)!;
  return commit(() => {
    d.records.push({ stage, date, by: input.by, evidence: input.evidence.trim(), participants: stage === "ทบทวนการออกแบบ" ? [...new Set(input.participants)] : undefined });
    return d;
  });
}

export function changeErrors(no: string, input: Omit<DesignChange, "date">): Errors {
  const d = designByNo(no);
  const e: Errors = {};
  if (!released(d)) e.change = "ยังไม่ส่งมอบสู่การผลิต — แก้ในขั้นผลการออกแบบได้เลย";
  if (input.change.trim().length < 5) e.change = e.change ?? "บอกสิ่งที่เปลี่ยน";
  if (input.reason.trim().length < 5) e.reason = "บอกเหตุผล";
  if (input.approvedBy !== QMR) e.approvedBy = `การเปลี่ยนแปลงแบบหลังส่งมอบต้องอนุมัติโดย ${QMR}`;
  return e;
}

/** ควบคุมการเปลี่ยนแปลงแบบ (ข้อ 8.3.6) — บันทึกเหตุผล ผู้อนุมัติ และการทวนสอบซ้ำ */
export function changeDesign(no: string, input: Omit<DesignChange, "date">, date = TODAY) {
  assertValid(changeErrors(no, input));
  const d = designByNo(no);
  return commit(() => {
    d.changes.push({ date, change: input.change.trim(), reason: input.reason.trim(), approvedBy: input.approvedBy, reverified: input.reverified });
    return d;
  });
}

/* ================================================== approved suppliers */

export type SupplierStatus = "อนุมัติ" | "อนุมัติแบบมีเงื่อนไข" | "ระงับ";

export type SupplierApproval = {
  vendor: string;
  status: SupplierStatus;
  /** วัสดุที่อนุมัติให้ส่ง — นอกขอบเขตนี้ต้องประเมินเพิ่ม */
  scope: string[];
  since: string;
  nextReview: string;
  history: { date: string; status: SupplierStatus; quality: number; grade?: string; note: string; by: string }[];
};

export const APPROVALS: SupplierApproval[] = [
  { vendor: "V-001", status: "อนุมัติ", scope: ["MAT-1001", "MAT-1002"], since: "2025-01-20", nextReview: "2027-01-20", history: [{ date: "2026-01-20", status: "อนุมัติ", quality: 100, grade: "A", note: "ประเมินประจำปี ไม่มีล็อตไม่ผ่าน", by: QMR }] },
  { vendor: "V-002", status: "อนุมัติแบบมีเงื่อนไข", scope: ["MAT-1002"], since: "2025-06-02", nextReview: "2026-10-15", history: [{ date: "2026-04-15", status: "อนุมัติแบบมีเงื่อนไข", quality: 80, grade: "B", note: "ส่งของเลยกำหนดบ่อย ให้ส่งใบรับรองผลทดสอบทุกล็อต", by: QMR }] },
  { vendor: "V-003", status: "อนุมัติ", scope: ["MAT-1003"], since: "2025-02-01", nextReview: "2027-02-01", history: [{ date: "2026-02-01", status: "อนุมัติ", quality: 100, grade: "A", note: "ประเมินประจำปี", by: QMR }] },
  { vendor: "V-004", status: "อนุมัติ", scope: ["MAT-2002", "MAT-4001"], since: "2025-03-10", nextReview: "2027-03-10", history: [{ date: "2026-03-10", status: "อนุมัติ", quality: 100, grade: "B", note: "ประเมินประจำปี", by: "ปิยะนุช ใจดี" }] },
];

export const approvalOf = (vendor: string) => APPROVALS.find((a) => a.vendor === vendor);

/** คุณภาพของผู้ขายจากงานตรวจรับจริง — ล็อตผ่านครั้งแรก และ NCR ที่เปิดกับผู้ขาย */
export function supplierQuality(vendor: string) {
  const lots = LOTS.filter((l) => l.vendor === vendor && l.status === "ตัดสินแล้ว");
  const accepted = lots.filter((l) => l.decision === "ผ่าน").length;
  const ncrs = NCRS.filter((n) => n.vendor === vendor);
  return { lots: lots.length, accepted, rejected: lots.filter((l) => l.decision === "ไม่ผ่าน").length, ncrs: ncrs.length, score: rate(accepted, lots.length) };
}

/** เกรดล่าสุดจากการประเมินของฝ่ายจัดซื้อ — อ่านจากระบบจัดซื้อ ไม่ให้คะแนนซ้ำ */
export const purchasingGrade = (vendor: string) => {
  const r = latestReview(vendor);
  return r ? gradeOf(reviewScore(r)) : undefined;
};

/** ทะเบียนผู้ส่งมอบ: ผู้ขายทุกรายในระบบจัดซื้อ รายที่ยังไม่มีผลอนุมัติคือรอประเมิน */
export const supplierRegister = () =>
  VENDORS.map((v) => ({
    vendor: v,
    approval: approvalOf(v.code),
    quality: supplierQuality(v.code),
    grade: purchasingGrade(v.code),
    delivery: vendorScore(v.code).onTime,
    supplies: [...new Set(INFO_RECORDS.filter((r) => r.vendor === v.code).map((r) => r.material))],
  }));

export const awaitingApproval = () => supplierRegister().filter((s) => !s.approval);
export const approvalDue = () => APPROVALS.filter((a) => a.status !== "ระงับ" && a.nextReview <= addDays(TODAY, 30));

export type ApprovalInput = { vendor: string; status: SupplierStatus; scope: string[]; note: string; by: string };

export function approvalErrors(input: ApprovalInput): Errors {
  const e: Errors = {};
  const q = supplierQuality(input.vendor);
  if (!VENDORS.some((v) => v.code === input.vendor)) e.vendor = "เลือกผู้ขาย";
  if (input.status !== "ระงับ" && input.scope.length === 0) e.scope = "เลือกวัสดุที่อนุมัติให้ส่ง";
  if (input.status === "อนุมัติ" && q.lots > 0 && q.score < 90) e.status = `ล็อตผ่านครั้งแรก ${q.score}% ต่ำกว่า 90% — อนุมัติแบบมีเงื่อนไขหรือระงับ`;
  if (input.status === "อนุมัติ" && purchasingGrade(input.vendor) === "C") e.status = "ฝ่ายจัดซื้อประเมินเกรด C — อนุมัติเต็มไม่ได้";
  if (![QMR, "ปิยะนุช ใจดี"].includes(input.by)) e.by = `ผู้อนุมัติผู้ส่งมอบคือ ${QMR} หรือหัวหน้าฝ่ายจัดซื้อ`;
  if (input.note.trim().length < 5) e.note = "บอกเหตุผลของการตัดสิน";
  return e;
}

/**
 * ตัดสินสถานะผู้ส่งมอบ (ข้อ 8.4.1) — ระงับคือระงับการสั่งซื้อในระบบจัดซื้อด้วย
 * ปล่อยจากระงับคือยกเลิกการระงับที่นั่นด้วย สองระบบจึงไม่ขัดกัน
 */
export function evaluateSupplier(input: ApprovalInput, date = TODAY) {
  assertValid(approvalErrors(input));
  const v = VENDORS.find((x) => x.code === input.vendor)!;
  const q = supplierQuality(input.vendor);
  return commit(() => {
    let a = approvalOf(input.vendor);
    const entry = { date, status: input.status, quality: q.score, grade: purchasingGrade(input.vendor), note: input.note.trim(), by: input.by };
    if (!a) {
      a = { vendor: input.vendor, status: input.status, scope: [...input.scope], since: date, nextReview: addMonths(date, 12), history: [entry] };
      APPROVALS.push(a);
    } else {
      a.status = input.status;
      a.scope = input.status === "ระงับ" ? a.scope : [...input.scope];
      a.nextReview = addMonths(date, input.status === "อนุมัติ" ? 12 : 6);
      a.history.push(entry);
    }
    if (input.status === "ระงับ" && !v.blocked) blockVendor(v.code, `ระงับโดยฝ่ายคุณภาพ: ${input.note.trim()}`);
    if (input.status !== "ระงับ" && v.blocked) unblockVendor(v.code);
    return a;
  });
}

/* =================================================== customer satisfaction */

export const SATISFACTION_CRITERIA = [
  { key: "quality", label: "คุณภาพสินค้า" },
  { key: "delivery", label: "ส่งตรงเวลา" },
  { key: "price", label: "ราคา" },
  { key: "service", label: "บริการและการประสานงาน" },
  { key: "complaint", label: "การแก้ไขข้อร้องเรียน" },
] as const;
export type CriterionKey = (typeof SATISFACTION_CRITERIA)[number]["key"];

export type Survey = {
  no: string;
  customer: string;
  period: string;
  date: string;
  scores: Record<CriterionKey, number>;
  comment: string;
  followUp?: string;
  by: string;
};

const s = (quality: number, delivery: number, price: number, service: number, complaint: number) => ({ quality, delivery, price, service, complaint });

export const SURVEYS: Survey[] = [
  { no: "CS-2569-01", customer: "C-101", period: "ครึ่งปีแรก 2569", date: "2026-07-10", scores: s(5, 4, 4, 5, 4), comment: "ชั้นวาง HD-500 ใช้งานดี อยากให้มีสีอื่น", by: "ชลธิชา มั่นคง" },
  { no: "CS-2569-02", customer: "C-102", period: "ครึ่งปีแรก 2569", date: "2026-07-12", scores: s(4, 3, 4, 4, 3), comment: "ส่งช้า 2 ครั้งในไตรมาสที่สอง", by: "ชลธิชา มั่นคง" },
  { no: "CS-2569-03", customer: "C-103", period: "ครึ่งปีแรก 2569", date: "2026-07-15", scores: s(4, 4, 3, 4, 4), comment: "", by: "ชลธิชา มั่นคง" },
  { no: "CS-2569-04", customer: "C-105", period: "ครึ่งปีแรก 2569", date: "2026-07-18", scores: s(3, 3, 3, 3, 2), comment: "สีถลอกหลายครั้ง ตอบเรื่องช้า", followUp: "เปิด CAR เรื่องการบรรจุ และตั้งผู้ประสานงานลูกค้ารายนี้โดยตรง", by: "ชลธิชา มั่นคง" },
];

export const surveyByNo = (no: string) => {
  const v = SURVEYS.find((x) => x.no === no);
  if (!v) throw new Error(`ไม่พบ ${no}`);
  return v;
};

export const average = (sc: Record<CriterionKey, number>) =>
  Math.round((SATISFACTION_CRITERIA.reduce((n, c) => n + sc[c.key], 0) / SATISFACTION_CRITERIA.length) * 100) / 100;

/** ภาพรวมรายลูกค้า — คะแนนที่ลูกค้าให้ วางคู่ข้อร้องเรียนที่ระบบนับได้เอง */
export const satisfactionByCustomer = () =>
  CUSTOMERS.map((c) => {
    const mine = SURVEYS.filter((v) => v.customer === c.code).sort((a, b) => a.date.localeCompare(b.date));
    const last = mine[mine.length - 1];
    return { customer: c, last, score: last ? average(last.scores) : undefined, complaints: NCRS.filter((n) => n.customer === c.code).length };
  });

export const overallSatisfaction = () => {
  const latest = satisfactionByCustomer().filter((x) => x.score !== undefined);
  return latest.length ? Math.round((latest.reduce((n, x) => n + x.score!, 0) / latest.length) * 100) / 100 : undefined;
};

export const nextSurveyNo = () => nextNo(SURVEYS.map((v) => v.no), `CS-${YEAR}-`, 2);
export const currentHalf = () => `${Number(TODAY.slice(5, 7)) <= 6 ? "ครึ่งปีแรก" : "ครึ่งปีหลัง"} ${YEAR}`;

export type SurveyInput = Omit<Survey, "no" | "date">;

export function surveyErrors(input: SurveyInput): Errors {
  const e: Errors = {};
  if (!CUSTOMERS.some((c) => c.code === input.customer)) e.customer = "เลือกลูกค้า";
  else if (SURVEYS.some((v) => v.customer === input.customer && v.period === input.period)) e.customer = `ลูกค้ารายนี้ตอบแบบสำรวจ${input.period}แล้ว`;
  if (SATISFACTION_CRITERIA.some((c) => !(Number.isInteger(input.scores[c.key]) && input.scores[c.key] >= 1 && input.scores[c.key] <= 5))) e.scores = "ให้คะแนน 1–5 ทุกข้อ";
  else if (average(input.scores) < 3.5 && (input.followUp ?? "").trim().length < 10) e.followUp = "คะแนนเฉลี่ยต่ำกว่า 3.5 ต้องบอกสิ่งที่จะทำต่อ";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้บันทึก";
  return e;
}

export function recordSurvey(input: SurveyInput, date = TODAY) {
  assertValid(surveyErrors(input));
  return commit(() => {
    const v: Survey = { ...input, no: nextSurveyNo(), date, comment: input.comment.trim(), followUp: input.followUp?.trim() || undefined, scores: { ...input.scores } };
    SURVEYS.push(v);
    return v;
  });
}

/* ============================================================ indicators */

/**
 * ตัวชี้วัดคุณภาพที่ระบบวัดเองจากงานจริง — ภาพรวมของระบบนี้และวาระทบทวนโดยฝ่ายบริหาร
 * ใช้ค่าเดียวกับที่หน้าจออื่นใช้ทำงาน
 */
export function indicators() {
  const decided = (o: LotOrigin) => LOTS.filter((l) => l.origin === o && l.status === "ตัดสินแล้ว");
  const passed = (o: LotOrigin) => decided(o).filter((l) => l.decision === "ผ่าน").length;
  const complaints = NCRS.filter((n) => n.source === "ข้อร้องเรียนลูกค้า" && n.date.slice(0, 7) === TODAY.slice(0, 7)).length;
  const active = GAUGES.filter((g) => g.status === "ใช้งาน");
  const current = active.filter((g) => nextDue(g) >= TODAY).length;
  const reviewed = commitments().filter((c) => reviewOf(c.doc)).length;
  return [
    { name: "ของเข้าผ่านการตรวจรับ", clause: "9001:8.4", target: 95, actual: rate(passed("ตรวจรับ"), decided("ตรวจรับ").length), unit: "%", better: "higher" as const },
    { name: "สินค้าผ่านการตรวจก่อนส่งครั้งแรก", clause: "9001:8.6", target: 98, actual: rate(passed("ตรวจก่อนส่ง"), decided("ตรวจก่อนส่ง").length), unit: "%", better: "higher" as const },
    { name: "ข้อร้องเรียนลูกค้าเดือนนี้", clause: "9001:9.1.2", target: 2, actual: complaints, unit: "เรื่อง", better: "lower" as const },
    { name: "ข้อตกลงกับลูกค้าที่ทบทวนแล้ว", clause: "9001:8.2", target: 100, actual: rate(reviewed, commitments().length), unit: "%", better: "higher" as const },
    { name: "เครื่องมือวัดอยู่ในรอบสอบเทียบ", clause: "9001:7.1.5", target: 100, actual: rate(current, active.length), unit: "%", better: "higher" as const },
  ].map((o) => ({ ...o, met: o.better === "higher" ? o.actual >= o.target : o.actual <= o.target }));
}

/* ======================================================== review inputs */

const toneOf = (bad: boolean, warn = false) => (bad ? "bad" : warn ? "warn" : "ok") as "bad" | "warn" | "ok";

contributeReviewInput({
  key: "qm-customers", std: ["ISO 9001", "IATF 16949"], input: "ค 1", title: "ความพึงพอใจและข้อร้องเรียนของลูกค้า",
  facts: () => {
    const avg = overallSatisfaction();
    const complaints = NCRS.filter((n) => n.source === "ข้อร้องเรียนลูกค้า" && n.date.slice(0, 4) === TODAY.slice(0, 4)).length;
    return [
      { label: "คะแนนความพึงพอใจเฉลี่ย", value: avg === undefined ? "ยังไม่มีผลสำรวจ" : `${avg} / 5`, tone: avg === undefined ? "idle" : toneOf(avg < 3.5, avg < 4) },
      { label: "ข้อร้องเรียนปีนี้", value: `${complaints} เรื่อง`, tone: toneOf(false, complaints > 0) },
    ];
  },
});

contributeReviewInput({
  key: "qm-conformity", std: ["ISO 9001", "IATF 16949"], input: "ค 3", title: "ผลการตรวจสอบและสิ่งที่ไม่เป็นไปตามข้อกำหนด",
  facts: () =>
    indicators()
      .filter((i) => i.unit === "%")
      .slice(0, 2)
      .map((i) => ({ label: i.name, value: `${i.actual}% (เป้า ${i.target}%)`, tone: toneOf(!i.met) }))
      .concat([{ label: "NCR ยังไม่ปิด", value: `${NCRS.filter((n) => n.status !== "ปิดแล้ว").length} เรื่อง`, tone: toneOf(false, NCRS.some((n) => n.status === "รอสั่งการ")) }]),
});

contributeReviewInput({
  key: "qm-suppliers", std: ["ISO 9001", "IATF 16949"], input: "ค 7", title: "ผลงานของผู้ส่งมอบภายนอก",
  facts: () => [
    { label: "ผู้ส่งมอบที่อนุมัติ", value: `${APPROVALS.filter((a) => a.status === "อนุมัติ").length} ราย`, tone: "ok" },
    { label: "มีเงื่อนไขหรือระงับ", value: `${APPROVALS.filter((a) => a.status !== "อนุมัติ").length} ราย`, tone: toneOf(false, APPROVALS.some((a) => a.status !== "อนุมัติ")) },
    { label: "ผู้ขายที่ยังไม่ผ่านการประเมิน", value: `${awaitingApproval().length} ราย`, tone: toneOf(awaitingApproval().length > 0) },
  ],
});

contributeReviewInput({
  key: "qm-resources", std: ["ISO 9001", "IATF 16949"], input: "ง", title: "ความพร้อมของเครื่องมือวัด",
  facts: () => {
    const late = GAUGES.filter((g) => calState(g) === "เกินกำหนด" || calState(g) === "พักใช้").length;
    return [{ label: "เครื่องมือเกินกำหนดหรือพักใช้", value: `${late} จาก ${GAUGES.length} ชิ้น`, tone: toneOf(late > 0) }];
  },
});
