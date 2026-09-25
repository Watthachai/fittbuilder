import { commit } from "../kit";
import { TODAY } from "../pa/data";
import { COMPANY } from "../company";

export { TODAY };

/** ปี พ.ศ. ของวันนี้ — ส่วนกลางของเลขเอกสาร เช่น PR-2569-045 */
const YEAR = Number(TODAY.slice(0, 4)) + 543;

export { COMPANY };

export const MATERIAL_GROUPS = ["วัตถุดิบ", "อะไหล่", "วัสดุสิ้นเปลือง", "บรรจุภัณฑ์", "สินค้าสำเร็จรูป"];

/** กลุ่มที่โรงงานผลิตเอง — ไม่เปิดใบขอซื้อ และฝ่ายขายกับฝ่ายผลิตอ่านกลุ่มนี้เป็นรายการสินค้า */
export const MADE_IN_HOUSE = "สินค้าสำเร็จรูป";

export const UNITS = ["แผ่น", "เส้น", "ถัง", "กล่อง", "ตัว", "คู่", "ใบ", "ชุด", "คัน", "ม้วน", "กิโลกรัม", "ลิตร"];

export const PAYMENT_TERMS = ["เงินสด", "เครดิต 30 วัน", "เครดิต 45 วัน", "เครดิต 60 วัน"];

/** หน่วยงานที่เปิดใบขอซื้อหรือเบิกวัสดุได้ */
export const REQUESTERS = ["ฝ่ายผลิต", "ฝ่ายซ่อมบำรุง", "ฝ่ายคลัง", "ฝ่ายขาย", "ฝ่ายบริหาร"];

export type Material = {
  code: string;
  name: string;
  group: string;
  unit: string;
  /** ราคามาตรฐานต่อหน่วย ใช้ตีมูลค่าสต็อก */
  price: number;
  stock: number;
  /** จุดสั่งซื้อ — คงเหลือต่ำกว่านี้ต้องเปิดใบขอซื้อ */
  reorder: number;
  /** สต็อกขั้นต่ำ — ต่ำกว่านี้คือเสี่ยงของขาดก่อนของใหม่มาถึง */
  safety: number;
  bin: string;
};

export const MATERIALS: Material[] = [
  { code: "MAT-1001", name: "เหล็กแผ่นรีดร้อน 3 มม.", group: "วัตถุดิบ", unit: "แผ่น", price: 1850, stock: 240, reorder: 120, safety: 60, bin: "A-01-03" },
  { code: "MAT-1002", name: "เหล็กเส้นกลม 12 มม.", group: "วัตถุดิบ", unit: "เส้น", price: 420, stock: 86, reorder: 150, safety: 75, bin: "A-01-07" },
  { code: "MAT-1003", name: "สีพ่นอุตสาหกรรม สีเทา", group: "วัตถุดิบ", unit: "ถัง", price: 2400, stock: 34, reorder: 20, safety: 10, bin: "B-02-01" },
  { code: "MAT-2001", name: "น็อตหัวหกเหลี่ยม M8", group: "อะไหล่", unit: "กล่อง", price: 380, stock: 18, reorder: 40, safety: 20, bin: "C-01-12" },
  { code: "MAT-2002", name: "ตลับลูกปืน 6204", group: "อะไหล่", unit: "ตัว", price: 145, stock: 320, reorder: 100, safety: 50, bin: "C-02-04" },
  { code: "MAT-3001", name: "ถุงมือผ้าเคลือบยาง", group: "วัสดุสิ้นเปลือง", unit: "คู่", price: 35, stock: 640, reorder: 200, safety: 100, bin: "D-01-01" },
  { code: "MAT-3002", name: "กล่องกระดาษลูกฟูก 40x30", group: "บรรจุภัณฑ์", unit: "ใบ", price: 12, stock: 1420, reorder: 500, safety: 250, bin: "D-02-06" },
  { code: "MAT-4001", name: "มอเตอร์ไฟฟ้า 1 แรงม้า", group: "อะไหล่", unit: "ตัว", price: 5600, stock: 6, reorder: 10, safety: 4, bin: "C-03-02" },
  { code: "FG-5001", name: "ชั้นวางเหล็ก 4 ชั้น", group: "สินค้าสำเร็จรูป", unit: "ชุด", price: 7976, stock: 34, reorder: 15, safety: 8, bin: "E-01-01" },
  { code: "FG-5002", name: "โต๊ะทำงานเหล็ก 120 ซม.", group: "สินค้าสำเร็จรูป", unit: "ตัว", price: 9381, stock: 12, reorder: 10, safety: 5, bin: "E-01-04" },
  { code: "FG-5003", name: "รถเข็นอุตสาหกรรม", group: "สินค้าสำเร็จรูป", unit: "คัน", price: 12990, stock: 5, reorder: 6, safety: 3, bin: "E-02-02" },
];

/**
 * สินค้าที่ขายได้ — ชนิดหนึ่งในแฟ้มวัสดุ ไม่ใช่รายการแยกอีกชุด
 *
 * ฝ่ายขาย ฝ่ายผลิต และบัญชีต้นทุนถืออาร์เรย์นี้ไว้ตัวเดียวกัน วัสดุใหม่ในกลุ่มนี้
 * จึงถูกใส่เข้าไปในอาร์เรย์เดิม (addMaterial) แทนการสร้างรายการใหม่
 */
export const FINISHED_GOODS = MATERIALS.filter((m) => m.group === MADE_IN_HOUSE);

export type Vendor = {
  code: string;
  name: string;
  contact: string;
  terms: string;
  leadDays: number;
  taxId: string;
  phone: string;
  address: string;
  /** ระงับการสั่งซื้อ — ใบสั่งซื้อใหม่เลือกผู้ขายรายนี้ไม่ได้ ใบเดิมยังรับของได้ */
  blocked: boolean;
  blockReason?: string;
};

export const VENDORS: Vendor[] = [
  { code: "V-001", name: "บจก. เหล็กไทยรุ่งเรือง", contact: "คุณสมศักดิ์", terms: "เครดิต 30 วัน", leadDays: 7, taxId: "0105542000123", phone: "02-337-1234", address: "99/9 ถนนบางนา-ตราด กม.18 ตำบลบางโฉลง อำเภอบางพลี จังหวัดสมุทรปราการ 10540", blocked: false },
  { code: "V-002", name: "หจก. ศรีชัยค้าวัสดุ", contact: "คุณมาลี", terms: "เครดิต 45 วัน", leadDays: 10, taxId: "0103548000987", phone: "02-421-5566", address: "45 ถนนเพชรเกษม แขวงหนองค้างพลู เขตหนองแขม กรุงเทพฯ 10160", blocked: false },
  { code: "V-003", name: "บจก. อุตสาหกรรมสีไทย", contact: "คุณวิชัย", terms: "เงินสด", leadDays: 3, taxId: "0105535000456", phone: "02-703-8899", address: "120 หมู่ 3 ถนนสุขุมวิท ตำบลท้ายบ้าน อำเภอเมือง จังหวัดสมุทรปราการ 10280", blocked: false },
  { code: "V-004", name: "บจก. ยนต์ภัณฑ์สากล", contact: "คุณนภา", terms: "เครดิต 30 วัน", leadDays: 14, taxId: "0105551000789", phone: "02-294-7700", address: "7/21 ถนนพระราม 3 แขวงบางโพงพาง เขตยานนาวา กรุงเทพฯ 10120", blocked: false },
];

export type InfoRecord = { material: string; vendor: string; price: number; leadDays: number };

/** ราคาและเวลาส่งที่ผู้ขายแต่ละรายเคยให้ไว้กับวัสดุตัวหนึ่ง */
export const INFO_RECORDS: InfoRecord[] = [
  { material: "MAT-1001", vendor: "V-001", price: 1850, leadDays: 7 },
  { material: "MAT-1001", vendor: "V-002", price: 1920, leadDays: 5 },
  { material: "MAT-1002", vendor: "V-001", price: 420, leadDays: 7 },
  { material: "MAT-1003", vendor: "V-003", price: 2400, leadDays: 3 },
  { material: "MAT-2001", vendor: "V-002", price: 380, leadDays: 10 },
  { material: "MAT-2002", vendor: "V-004", price: 145, leadDays: 14 },
  { material: "MAT-4001", vendor: "V-004", price: 5600, leadDays: 14 },
];

export type PrLine = { material: string; qty: number; price: number };
export type PrStatus = "รออนุมัติ" | "อนุมัติแล้ว" | "ไม่อนุมัติ" | "แปลงเป็นใบสั่งซื้อแล้ว";

export type Requisition = {
  no: string;
  /** รายการแรกของใบ ไว้แสดงในรายการย่อ — ตัวจริงอยู่ที่ lines และถูกตั้งจาก lines ทุกครั้ง */
  material: string;
  qty: number;
  needBy: string;
  requester: string;
  status: PrStatus;
  date: string;
  /** ราคาในใบขอซื้อเป็นราคาประมาณ ใช้ตัดสินว่าใครมีอำนาจอนุมัติ */
  lines: PrLine[];
  note: string;
  approvedBy?: string;
  rejectReason?: string;
  /** ใบสั่งซื้อที่แปลงไป */
  po?: string;
};

export const REQUISITIONS: Requisition[] = [
  { no: "PR-2569-041", material: "MAT-2001", qty: 60, needBy: "2026-10-02", requester: "ฝ่ายผลิต", status: "รออนุมัติ", date: "2026-09-18", lines: [{ material: "MAT-2001", qty: 60, price: 380 }], note: "" },
  { no: "PR-2569-042", material: "MAT-4001", qty: 8, needBy: "2026-10-09", requester: "ฝ่ายซ่อมบำรุง", status: "รออนุมัติ", date: "2026-09-19", lines: [{ material: "MAT-4001", qty: 8, price: 5600 }], note: "สำรองไว้เปลี่ยนสายพานลำเลียง" },
  { no: "PR-2569-043", material: "MAT-1002", qty: 200, needBy: "2026-09-30", requester: "ฝ่ายผลิต", status: "แปลงเป็นใบสั่งซื้อแล้ว", date: "2026-09-10", lines: [{ material: "MAT-1002", qty: 200, price: 420 }], note: "", approvedBy: "วรรณา ศรีสวัสดิ์", po: "PO-2569-118" },
  { no: "PR-2569-044", material: "MAT-3002", qty: 800, needBy: "2026-10-15", requester: "ฝ่ายคลัง", status: "รออนุมัติ", date: "2026-09-21", lines: [{ material: "MAT-3002", qty: 800, price: 12 }], note: "" },
];

export type PoLine = { material: string; qty: number; price: number };
export type PoStatus = "ร่าง" | "รอรับของ" | "รับของบางส่วน" | "รับของครบแล้ว" | "ปิดยอดค้างรับ" | "ยกเลิก";

export type PurchaseOrder = {
  no: string;
  vendor: string;
  date: string;
  lines: PoLine[];
  status: PoStatus;
  /** วันที่ผู้ขายรับปากว่าจะส่ง — ใช้วัดการส่งตรงเวลา */
  deliverBy: string;
  note: string;
  pr?: string;
  approvedBy?: string;
  cancelReason?: string;
  closeReason?: string;
};

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  { no: "PO-2569-101", vendor: "V-001", date: "2026-07-08", lines: [{ material: "MAT-1001", qty: 120, price: 1850 }], status: "รับของครบแล้ว", deliverBy: "2026-07-15", note: "", approvedBy: "ประเสริฐ วงศ์ใหญ่" },
  { no: "PO-2569-104", vendor: "V-002", date: "2026-07-21", lines: [{ material: "MAT-2001", qty: 80, price: 380 }, { material: "MAT-3001", qty: 400, price: 35 }], status: "รับของครบแล้ว", deliverBy: "2026-07-31", note: "", approvedBy: "สุรชัย แสงทอง" },
  { no: "PO-2569-109", vendor: "V-003", date: "2026-08-05", lines: [{ material: "MAT-1003", qty: 30, price: 2400 }], status: "รับของครบแล้ว", deliverBy: "2026-08-08", note: "", approvedBy: "วรรณา ศรีสวัสดิ์" },
  { no: "PO-2569-112", vendor: "V-004", date: "2026-08-14", lines: [{ material: "MAT-2002", qty: 200, price: 145 }], status: "รับของครบแล้ว", deliverBy: "2026-08-28", note: "", approvedBy: "สุรชัย แสงทอง" },
  { no: "PO-2569-115", vendor: "V-001", date: "2026-08-27", lines: [{ material: "MAT-1001", qty: 90, price: 1850 }, { material: "MAT-1002", qty: 150, price: 420 }], status: "รับของครบแล้ว", deliverBy: "2026-09-03", note: "", approvedBy: "ประเสริฐ วงศ์ใหญ่" },
  { no: "PO-2569-118", vendor: "V-001", date: "2026-09-12", lines: [{ material: "MAT-1002", qty: 200, price: 420 }], status: "รับของครบแล้ว", deliverBy: "2026-09-19", note: "", pr: "PR-2569-043", approvedBy: "วรรณา ศรีสวัสดิ์" },
  { no: "PO-2569-119", vendor: "V-003", date: "2026-09-15", lines: [{ material: "MAT-1003", qty: 20, price: 2400 }], status: "รับของบางส่วน", deliverBy: "2026-09-18", note: "", approvedBy: "สุรชัย แสงทอง" },
  { no: "PO-2569-120", vendor: "V-004", date: "2026-09-18", lines: [{ material: "MAT-2002", qty: 100, price: 145 }, { material: "MAT-4001", qty: 4, price: 5600 }], status: "รอรับของ", deliverBy: "2026-10-02", note: "", approvedBy: "สุรชัย แสงทอง" },
  { no: "PO-2569-121", vendor: "V-002", date: "2026-09-19", lines: [{ material: "MAT-2001", qty: 40, price: 380 }], status: "รอรับของ", deliverBy: "2026-09-29", note: "", approvedBy: "สุรชัย แสงทอง" },
];

export type GoodsReceipt = {
  no: string;
  po: string;
  date: string;
  lines: { material: string; qty: number }[];
  /** เลขที่ใบส่งของของผู้ขาย — ใช้ตรวจตอนผู้ขายวางบิล */
  deliveryNote?: string;
  receivedBy?: string;
};

/** ของที่รับเข้าจริงต่อใบสั่งซื้อ — เทียบกับที่สั่งเพื่อจับของขาด */
export const GOODS_RECEIPTS: GoodsReceipt[] = [
  { no: "GR-2569-180", po: "PO-2569-101", date: "2026-07-15", lines: [{ material: "MAT-1001", qty: 120 }] },
  { no: "GR-2569-186", po: "PO-2569-104", date: "2026-07-31", lines: [{ material: "MAT-2001", qty: 80 }, { material: "MAT-3001", qty: 400 }] },
  { no: "GR-2569-191", po: "PO-2569-109", date: "2026-08-08", lines: [{ material: "MAT-1003", qty: 30 }] },
  { no: "GR-2569-197", po: "PO-2569-112", date: "2026-08-28", lines: [{ material: "MAT-2002", qty: 200 }] },
  { no: "GR-2569-201", po: "PO-2569-115", date: "2026-09-03", lines: [{ material: "MAT-1001", qty: 90 }, { material: "MAT-1002", qty: 150 }] },
  { no: "GR-2569-206", po: "PO-2569-118", date: "2026-09-19", lines: [{ material: "MAT-1002", qty: 200 }] },
  { no: "GR-2569-207", po: "PO-2569-119", date: "2026-09-20", lines: [{ material: "MAT-1003", qty: 14 }] },
];

export type SupplierInvoice = {
  no: string;
  po: string;
  vendor: string;
  date: string;
  /** มูลค่าก่อนภาษีมูลค่าเพิ่ม — ฝ่ายบัญชีบวกภาษีซื้อเอง */
  amount: number;
  /** จ่ายแล้วหรือยัง — ฝ่ายบัญชีเป็นคนเปลี่ยน ระบบจัดซื้อไม่แตะ */
  paid: boolean;
  /** ระงับจ่ายเพราะตรวจสามทางไม่ผ่าน — ใบที่ยังระงับอยู่ห้ามจ่าย */
  blocked: boolean;
  blockReason?: string;
  releasedAt?: string;
};

/** ใบแจ้งหนี้จากผู้ขาย — paid บอกว่าจ่ายไปแล้วหรือยังค้างอยู่ */
export const INVOICES: SupplierInvoice[] = [
  { no: "INV-87102", po: "PO-2569-101", vendor: "V-001", date: "2026-07-16", amount: 222000, paid: true, blocked: false },
  { no: "INV-87340", po: "PO-2569-104", vendor: "V-002", date: "2026-08-01", amount: 44400, paid: true, blocked: false },
  { no: "INV-87588", po: "PO-2569-109", vendor: "V-003", date: "2026-08-09", amount: 72000, paid: true, blocked: false },
  { no: "INV-87901", po: "PO-2569-112", vendor: "V-004", date: "2026-08-29", amount: 29000, paid: true, blocked: false },
  { no: "INV-88060", po: "PO-2569-115", vendor: "V-001", date: "2026-09-04", amount: 229500, paid: true, blocked: false },
  { no: "INV-88214", po: "PO-2569-118", vendor: "V-001", date: "2026-09-20", amount: 84000, paid: false, blocked: false },
  { no: "INV-88301", po: "PO-2569-119", vendor: "V-003", date: "2026-09-21", amount: 48000, paid: false, blocked: true, blockReason: "วางบิลรวม 48,000 ฿ แต่รับของจริง 33,600 ฿ เกินเกณฑ์ที่ยอมให้ต่าง 336 ฿" },
];

export type StockMove = {
  date: string;
  material: string;
  qty: number;
  reason: string;
  /** เลขที่เอกสาร — ใบรับสินค้า ใบเบิกวัสดุ หรือใบปรับปรุงสต็อก */
  doc?: string;
  kind?: string;
  department?: string;
};

/** การเคลื่อนไหวสต็อก — รับเข้าเป็นบวก จ่ายออกเป็นลบ */
export const STOCK_MOVES: StockMove[] = [
  { date: "2026-09-03", material: "MAT-1001", qty: 90, reason: "รับจากใบสั่งซื้อ PO-2569-115", doc: "GR-2569-201" },
  { date: "2026-09-03", material: "MAT-1002", qty: 150, reason: "รับจากใบสั่งซื้อ PO-2569-115", doc: "GR-2569-201" },
  { date: "2026-09-08", material: "MAT-1001", qty: -35, reason: "เบิกเข้าสายการผลิต" },
  { date: "2026-09-10", material: "MAT-2002", qty: -18, reason: "เบิกซ่อมบำรุง" },
  { date: "2026-09-12", material: "MAT-3002", qty: -220, reason: "เบิกใช้บรรจุสินค้า" },
  { date: "2026-09-15", material: "MAT-1001", qty: -55, reason: "เบิกเข้าสายการผลิต" },
  { date: "2026-09-19", material: "MAT-1002", qty: 200, reason: "รับจากใบสั่งซื้อ PO-2569-118", doc: "GR-2569-206" },
  { date: "2026-09-19", material: "MAT-1001", qty: -40, reason: "เบิกเข้าสายการผลิต" },
  { date: "2026-09-20", material: "MAT-1003", qty: 14, reason: "รับจากใบสั่งซื้อ PO-2569-119", doc: "GR-2569-207" },
  { date: "2026-09-20", material: "MAT-3001", qty: -60, reason: "เบิกใช้ประจำเดือน" },
  { date: "2026-09-21", material: "MAT-1002", qty: -114, reason: "เบิกเข้าสายการผลิต" },
  { date: "2026-09-21", material: "MAT-2001", qty: -22, reason: "เบิกซ่อมบำรุง" },
];

export type VendorReview = {
  no: string;
  vendor: string;
  date: string;
  period: string;
  /** คะแนน 1–5 ต่อเกณฑ์ */
  quality: number;
  delivery: number;
  price: number;
  service: number;
  note: string;
  by: string;
};

/** ผลประเมินผู้ขายรายงวด — คะแนนที่คนให้ ต่างจากตัวเลขส่งครบที่ระบบนับเอง */
export const VENDOR_REVIEWS: VendorReview[] = [
  { no: "VE-2569-001", vendor: "V-001", date: "2026-07-05", period: "ไตรมาส 2/2569", quality: 5, delivery: 4, price: 4, service: 4, note: "เหล็กได้มาตรฐาน มอก. ทุกล็อต", by: "วรรณา ศรีสวัสดิ์" },
  { no: "VE-2569-002", vendor: "V-002", date: "2026-07-05", period: "ไตรมาส 2/2569", quality: 4, delivery: 3, price: 5, service: 3, note: "ราคาดี แต่ต้องโทรตามของบ่อย", by: "วรรณา ศรีสวัสดิ์" },
  { no: "VE-2569-003", vendor: "V-003", date: "2026-07-06", period: "ไตรมาส 2/2569", quality: 4, delivery: 5, price: 3, service: 4, note: "", by: "วรรณา ศรีสวัสดิ์" },
  { no: "VE-2569-004", vendor: "V-004", date: "2026-07-06", period: "ไตรมาส 2/2569", quality: 3, delivery: 3, price: 4, service: 3, note: "ใบกำกับภาษีมาช้า", by: "วรรณา ศรีสวัสดิ์" },
];

/**
 * ผู้มีอำนาจอนุมัติการจัดซื้อ วงเงินคิดจากมูลค่าก่อนภาษีมูลค่าเพิ่ม
 * ใบที่เกินวงเงินของคนหนึ่งต้องขึ้นไปหาคนที่วงเงินสูงกว่า
 */
export const APPROVERS = [
  { name: "สุรชัย แสงทอง", role: "หัวหน้าแผนกจัดซื้อ", limit: 50000 },
  { name: "วรรณา ศรีสวัสดิ์", role: "ผู้จัดการฝ่ายจัดซื้อ", limit: 200000 },
  { name: "ประเสริฐ วงศ์ใหญ่", role: "กรรมการผู้จัดการ", limit: Infinity },
];

export type Approver = (typeof APPROVERS)[number];

/** ยอดวางบิลต่างจากมูลค่าของที่รับจริงได้ไม่เกิน 1% และไม่เกิน 1,000 บาท — เกินนี้ระงับจ่าย */
export const MATCH_TOLERANCE = { rate: 0.01, cap: 1000 };

/** จำนวนวันรอของเมื่อยังไม่มีผู้ขายรายใดเคยเสนอราคาวัสดุตัวนั้น */
export const DEFAULT_LEAD_DAYS = 7;

/**
 * Lookups throw rather than return undefined. Every code in this system comes
 * from a document that already references a real record, so a miss is a broken
 * reference, not a case to handle — and a screen that renders "—" for it hides
 * exactly the fault worth seeing.
 */
export const material = (code: string) => {
  const m = MATERIALS.find((x) => x.code === code);
  if (!m) throw new Error(`ไม่พบวัสดุ ${code}`);
  return m;
};

export const vendor = (code: string) => {
  const v = VENDORS.find((x) => x.code === code);
  if (!v) throw new Error(`ไม่พบผู้ขาย ${code}`);
  return v;
};

export const requisition = (no: string) => {
  const r = REQUISITIONS.find((x) => x.no === no);
  if (!r) throw new Error(`ไม่พบใบขอซื้อ ${no}`);
  return r;
};

export const purchaseOrder = (no: string) => {
  const p = PURCHASE_ORDERS.find((x) => x.no === no);
  if (!p) throw new Error(`ไม่พบใบสั่งซื้อ ${no}`);
  return p;
};

export const approver = (name: string) => {
  const a = APPROVERS.find((x) => x.name === name);
  if (!a) throw new Error(`ไม่พบผู้อนุมัติ ${name}`);
  return a;
};

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";
export const poTotal = (po: { lines: PoLine[] }) => po.lines.reduce((n, l) => n + l.qty * l.price, 0);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "2026-09-22" บวกจำนวนวัน */
export function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* --------------------------------------------------------------- numbers */

/** เลขเอกสารถัดไปในชุดเดียวกัน: ["PR-2569-043", "PR-2569-044"] กับ "PR-2569-" → "PR-2569-045" */
export function nextNumber(existing: readonly string[], prefix: string, width = 3): string {
  const tails = existing.filter((n) => n.startsWith(prefix)).map((n) => n.slice(prefix.length)).filter((t) => /^\d+$/.test(t));
  const last = tails.reduce((max, t) => Math.max(max, Number(t)), 0);
  const digits = tails.length ? Math.max(...tails.map((t) => t.length)) : width;
  return prefix + String(last + 1).padStart(digits, "0");
}

export const nextRequisitionNo = () => nextNumber(REQUISITIONS.map((r) => r.no), `PR-${YEAR}-`);
export const nextOrderNo = () => nextNumber(PURCHASE_ORDERS.map((p) => p.no), `PO-${YEAR}-`);
export const nextReceiptNo = () => nextNumber(GOODS_RECEIPTS.map((g) => g.no), `GR-${YEAR}-`);
export const nextVendorCode = () => nextNumber(VENDORS.map((v) => v.code), "V-");

/** เลขชุดของรหัสวัสดุแต่ละกลุ่ม — วัสดุสิ้นเปลืองกับบรรจุภัณฑ์ใช้ชุดเดียวกันมาแต่เดิม */
const MATERIAL_SERIES: Record<string, string> = {
  วัตถุดิบ: "MAT-1",
  อะไหล่: "MAT-2",
  วัสดุสิ้นเปลือง: "MAT-3",
  บรรจุภัณฑ์: "MAT-3",
  สินค้าสำเร็จรูป: "FG-5",
};

export function nextMaterialCode(group: string) {
  const series = MATERIAL_SERIES[group];
  if (!series) throw new Error(`ไม่รู้จักกลุ่มวัสดุ ${group}`);
  return nextNumber(MATERIALS.map((m) => m.code), series);
}

/** ข้อความผิดข้อแรก — ฟังก์ชันที่เปลี่ยนข้อมูลตรวจกฎชุดเดียวกับที่ฟอร์มแสดง แล้วหยุดทันทีถ้าไม่ผ่าน */
function assertValid(problems: Record<string, string>) {
  const first = Object.values(problems)[0];
  if (first) throw new Error(first);
}

/** แก้ฟิลด์ของระเบียนในที่เดิม โดยให้ TypeScript ตรวจว่าค่าที่ใส่เป็นชนิดของฟิลด์นั้นจริง */
const patch = <T extends object>(record: T, values: Partial<T>) => Object.assign(record, values);

/* ------------------------------------------------------------- approvals */

/** ผู้อนุมัติคนแรกที่วงเงินพอ — ระบบเสนอให้ส่งไปหาคนนี้ */
export function approverFor(amount: number) {
  const a = APPROVERS.find((x) => x.limit >= amount);
  if (!a) throw new Error(`ไม่มีผู้อนุมัติสำหรับยอด ${amount}`);
  return a;
}

export const limitText = (a: Approver) => (a.limit === Infinity ? "ไม่จำกัดวงเงิน" : `วงเงินไม่เกิน ${baht(a.limit)}`);

/** เหตุที่คนนี้อนุมัติยอดนี้ไม่ได้ — undefined คืออนุมัติได้ */
export function approvalProblem(name: string, amount: number): string | undefined {
  const a = approver(name);
  if (a.limit >= amount) return undefined;
  return `${a.name} อนุมัติได้${limitText(a)} ใบนี้ ${baht(amount)} ต้องให้${approverFor(amount).role}อนุมัติ`;
}

/* ----------------------------------------------------------- master data */

export type MaterialInput = Pick<Material, "name" | "group" | "unit" | "price" | "reorder" | "safety" | "bin">;

/** ข้อผิดของแฟ้มวัสดุ แยกตามช่อง — ว่างคือบันทึกได้ */
export function materialProblems(input: MaterialInput, code?: string): Record<string, string> {
  const e: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 3) e.name = "ใส่ชื่อวัสดุให้ชัดพอที่ฝ่ายจัดซื้อจะสั่งถูก";
  else if (MATERIALS.some((m) => m.code !== code && m.name === name)) e.name = "มีวัสดุชื่อนี้ในแฟ้มแล้ว";
  if (!MATERIAL_GROUPS.includes(input.group)) e.group = "เลือกกลุ่มวัสดุ";
  if (!UNITS.includes(input.unit)) e.unit = "เลือกหน่วยนับ";
  if (!(input.price > 0)) e.price = "ราคาต่อหน่วยต้องมากกว่าศูนย์";
  if (!Number.isInteger(input.reorder) || input.reorder < 0) e.reorder = "จุดสั่งซื้อต้องเป็นจำนวนเต็มไม่ติดลบ";
  if (!Number.isInteger(input.safety) || input.safety < 0) e.safety = "สต็อกขั้นต่ำต้องเป็นจำนวนเต็มไม่ติดลบ";
  else if (input.safety > input.reorder) e.safety = "สต็อกขั้นต่ำต้องไม่เกินจุดสั่งซื้อ";
  if (!/^[A-Z]-\d{2}-\d{2}$/.test(input.bin)) e.bin = "รูปแบบช่องเก็บ เช่น A-01-03";
  return e;
}

export function addMaterial(input: MaterialInput): Material {
  assertValid(materialProblems(input));
  return commit(() => {
    const m: Material = { ...input, code: nextMaterialCode(input.group), name: input.name.trim(), stock: 0 };
    MATERIALS.push(m);
    if (m.group === MADE_IN_HOUSE) FINISHED_GOODS.push(m);
    return m;
  });
}

/** หน่วยนับเปลี่ยนไม่ได้เมื่อมีของหรือมีเอกสารอ้างถึงแล้ว — ตัวเลขเก่าจะกลายเป็นคนละหน่วย */
export const unitLocked = (code: string) =>
  material(code).stock !== 0 ||
  STOCK_MOVES.some((m) => m.material === code) ||
  PURCHASE_ORDERS.some((p) => p.lines.some((l) => l.material === code)) ||
  REQUISITIONS.some((r) => r.lines.some((l) => l.material === code));

export function updateMaterial(code: string, input: MaterialInput) {
  const m = material(code);
  assertValid(materialProblems(input, code));
  if ((m.group === MADE_IN_HOUSE) !== (input.group === MADE_IN_HOUSE)) {
    throw new Error("ย้ายวัสดุเข้าหรือออกจากกลุ่มสินค้าสำเร็จรูปไม่ได้ ฝ่ายขายและฝ่ายผลิตอ้างถึงกลุ่มนี้อยู่");
  }
  if (input.unit !== m.unit && unitLocked(code)) throw new Error(`เปลี่ยนหน่วยนับของ ${m.name} ไม่ได้ เพราะมีของหรือมีเอกสารอ้างถึงแล้ว`);
  commit(() => patch(m, { ...input, name: input.name.trim() }));
}

export type VendorInput = Pick<Vendor, "name" | "contact" | "phone" | "address" | "terms" | "leadDays" | "taxId">;

export function vendorProblems(input: VendorInput, code?: string): Record<string, string> {
  const e: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 3) e.name = "ใส่ชื่อผู้ขายตามหนังสือรับรองบริษัท";
  else if (VENDORS.some((v) => v.code !== code && v.name === name)) e.name = "มีผู้ขายชื่อนี้ในแฟ้มแล้ว";
  if (!/^\d{13}$/.test(input.taxId)) e.taxId = "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก";
  else if (VENDORS.some((v) => v.code !== code && v.taxId === input.taxId)) e.taxId = "เลขนี้เป็นของผู้ขายรายอื่นในแฟ้มแล้ว";
  if (input.contact.trim().length < 2) e.contact = "ใส่ชื่อผู้ติดต่อ";
  if (!/^0\d{1,2}-\d{3}-\d{4}$/.test(input.phone)) e.phone = "รูปแบบ 02-123-4567 หรือ 081-234-5678";
  if (input.address.trim().length < 10) e.address = "ใส่ที่อยู่ตามใบกำกับภาษี ใช้พิมพ์บนใบสั่งซื้อ";
  if (!PAYMENT_TERMS.includes(input.terms)) e.terms = "เลือกเงื่อนไขชำระ";
  if (!Number.isInteger(input.leadDays) || input.leadDays < 0 || input.leadDays > 120) e.leadDays = "เวลาส่งของ 0–120 วัน";
  return e;
}

export function addVendor(input: VendorInput): Vendor {
  assertValid(vendorProblems(input));
  return commit(() => {
    const v: Vendor = { ...input, code: nextVendorCode(), name: input.name.trim(), contact: input.contact.trim(), address: input.address.trim(), blocked: false };
    VENDORS.push(v);
    return v;
  });
}

export function updateVendor(code: string, input: VendorInput) {
  const v = vendor(code);
  assertValid(vendorProblems(input, code));
  commit(() => patch(v, { ...input, name: input.name.trim(), contact: input.contact.trim(), address: input.address.trim() }));
}

export function blockVendor(code: string, reason: string) {
  const v = vendor(code);
  if (v.blocked) throw new Error(`${v.name} ถูกระงับอยู่แล้ว`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลที่ระงับ อย่างน้อย 5 ตัวอักษร");
  commit(() => patch(v, { blocked: true, blockReason: reason.trim() }));
}

export function unblockVendor(code: string) {
  const v = vendor(code);
  if (!v.blocked) throw new Error(`${v.name} ไม่ได้ถูกระงับ`);
  commit(() => patch(v, { blocked: false, blockReason: undefined }));
}

export function quoteProblems(input: InfoRecord): Record<string, string> {
  const e: Record<string, string> = {};
  if (!MATERIALS.some((m) => m.code === input.material)) e.material = "เลือกวัสดุ";
  else if (material(input.material).group === MADE_IN_HOUSE) e.material = "สินค้าสำเร็จรูปผลิตเอง ไม่ได้ซื้อ";
  if (!VENDORS.some((v) => v.code === input.vendor)) e.vendor = "เลือกผู้ขาย";
  if (!(input.price > 0)) e.price = "ราคาต้องมากกว่าศูนย์";
  if (!Number.isInteger(input.leadDays) || input.leadDays < 0) e.leadDays = "เวลาส่งของต้องเป็นจำนวนวันเต็ม";
  return e;
}

/** ราคาที่ผู้ขายเสนอ — รายเดิมกับวัสดุเดิมคือปรับราคา ไม่ใช่เพิ่มแถวซ้ำ */
export function saveQuote(input: InfoRecord): InfoRecord {
  assertValid(quoteProblems(input));
  return commit(() => {
    const existing = INFO_RECORDS.find((r) => r.material === input.material && r.vendor === input.vendor);
    if (existing) return patch(existing, { price: input.price, leadDays: input.leadDays });
    const r = { ...input };
    INFO_RECORDS.push(r);
    return r;
  });
}

/* ------------------------------------------------------ document lines */

/** กฎของรายการในเอกสารซื้อ: มีอย่างน้อยหนึ่งบรรทัด เลือกวัสดุครบ ไม่ซ้ำ จำนวนและราคามากกว่าศูนย์ */
function lineProblem(lines: { material: string; qty: number; price: number }[]): string | undefined {
  if (lines.length === 0) return "ต้องมีอย่างน้อยหนึ่งรายการ";
  if (lines.some((l) => !MATERIALS.some((m) => m.code === l.material))) return "เลือกวัสดุให้ครบทุกบรรทัด";
  if (lines.some((l) => material(l.material).group === MADE_IN_HOUSE)) return "สินค้าสำเร็จรูปผลิตเอง ไม่ต้องขอซื้อหรือสั่งซื้อ";
  if (new Set(lines.map((l) => l.material)).size !== lines.length) return "มีวัสดุซ้ำกัน รวมเป็นบรรทัดเดียว";
  if (lines.some((l) => !(l.qty > 0))) return "จำนวนต้องมากกว่าศูนย์ทุกบรรทัด";
  if (lines.some((l) => !(l.price > 0))) return "ราคาต่อหน่วยต้องมากกว่าศูนย์ทุกบรรทัด";
  return undefined;
}

/* ---------------------------------------------------------- requisitions */

export type RequisitionInput = { requester: string; needBy: string; note: string; lines: PrLine[] };

export const requisitionValue = (pr: { lines: PrLine[] }) => pr.lines.reduce((n, l) => n + l.qty * l.price, 0);

export function requisitionProblems(input: RequisitionInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!REQUESTERS.includes(input.requester)) e.requester = "เลือกหน่วยงานที่ขอซื้อ";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.needBy)) e.needBy = "ใส่วันที่ต้องการของ";
  else if (input.needBy < TODAY) e.needBy = "วันที่ต้องการต้องไม่ย้อนหลัง";
  const lines = lineProblem(input.lines);
  if (lines) e.lines = lines;
  return e;
}

export function createRequisition(input: RequisitionInput): Requisition {
  assertValid(requisitionProblems(input));
  return commit(() => {
    const pr: Requisition = {
      no: nextRequisitionNo(),
      material: input.lines[0].material,
      qty: input.lines[0].qty,
      needBy: input.needBy,
      requester: input.requester,
      status: "รออนุมัติ",
      date: TODAY,
      lines: input.lines.map((l) => ({ ...l })),
      note: input.note.trim(),
    };
    REQUISITIONS.push(pr);
    return pr;
  });
}

/** แก้ได้เฉพาะใบที่ยังรออนุมัติ — อนุมัติไปแล้วคือยอดที่ผู้อนุมัติเห็น */
export function updateRequisition(no: string, input: RequisitionInput) {
  const pr = requisition(no);
  if (pr.status !== "รออนุมัติ") throw new Error(`${no} ${pr.status} แก้ไขไม่ได้`);
  assertValid(requisitionProblems(input));
  commit(() =>
    patch(pr, {
      requester: input.requester,
      needBy: input.needBy,
      note: input.note.trim(),
      lines: input.lines.map((l) => ({ ...l })),
      material: input.lines[0].material,
      qty: input.lines[0].qty,
    })
  );
}

export function approveRequisition(no: string, approverName: string) {
  const pr = requisition(no);
  if (pr.status !== "รออนุมัติ") throw new Error(`${no} ${pr.status} อนุมัติซ้ำไม่ได้`);
  const problem = approvalProblem(approverName, requisitionValue(pr));
  if (problem) throw new Error(problem);
  commit(() => patch(pr, { status: "อนุมัติแล้ว", approvedBy: approverName }));
}

export function rejectRequisition(no: string, reason: string) {
  const pr = requisition(no);
  if (pr.status !== "รออนุมัติ") throw new Error(`${no} ${pr.status} ไม่อนุมัติไม่ได้`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลที่ไม่อนุมัติ อย่างน้อย 5 ตัวอักษร");
  commit(() => patch(pr, { status: "ไม่อนุมัติ", rejectReason: reason.trim() }));
}

/** แปลงใบขอซื้อที่อนุมัติแล้วเป็นใบสั่งซื้อร่าง — ใบขอซื้อชี้ไปที่ใบสั่งซื้อ และใบสั่งซื้อชี้กลับ */
export function convertRequisition(no: string, input: OrderInput): PurchaseOrder {
  const pr = requisition(no);
  if (pr.status !== "อนุมัติแล้ว") throw new Error(`${no} ต้องอนุมัติก่อนจึงแปลงเป็นใบสั่งซื้อได้`);
  assertValid(orderProblems(input));
  return commit(() => {
    const po = newOrder(input, no);
    PURCHASE_ORDERS.push(po);
    patch(pr, { status: "แปลงเป็นใบสั่งซื้อแล้ว", po: po.no });
    return po;
  });
}

/* -------------------------------------------------------- purchase orders */

export type OrderInput = { vendor: string; date: string; deliverBy: string; note: string; lines: PoLine[] };

/** ใบสั่งซื้อที่ยังรอของอยู่ — รับของได้ */
export const RECEIVABLE: PoStatus[] = ["รอรับของ", "รับของบางส่วน"];
/** ใบสั่งซื้อที่ส่งผู้ขายแล้ว — เป็นภาระผูกพันที่นับเป็นยอดซื้อ */
const COMMITTED: PoStatus[] = ["รอรับของ", "รับของบางส่วน", "รับของครบแล้ว", "ปิดยอดค้างรับ"];
/** ใบที่ผู้ขายส่งของมาแล้วอย่างน้อยหนึ่งครั้ง หรือปิดไปแล้ว — ใช้วัดอัตราส่งครบ */
const CLOSED: PoStatus[] = ["รับของบางส่วน", "รับของครบแล้ว", "ปิดยอดค้างรับ"];

export function orderProblems(input: OrderInput): Record<string, string> {
  const e: Record<string, string> = {};
  const v = VENDORS.find((x) => x.code === input.vendor);
  if (!v) e.vendor = "เลือกผู้ขาย";
  else if (v.blocked) e.vendor = `${v.name} ถูกระงับการสั่งซื้อ`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) e.date = "ใส่วันที่สั่ง";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliverBy)) e.deliverBy = "ใส่วันที่ให้ผู้ขายส่งของ";
  else if (input.deliverBy < input.date) e.deliverBy = "กำหนดส่งต้องไม่ก่อนวันที่สั่ง";
  const lines = lineProblem(input.lines);
  if (lines) e.lines = lines;
  return e;
}

function newOrder(input: OrderInput, pr?: string): PurchaseOrder {
  return {
    no: nextOrderNo(),
    vendor: input.vendor,
    date: input.date,
    lines: input.lines.map((l) => ({ ...l })),
    status: "ร่าง",
    deliverBy: input.deliverBy,
    note: input.note.trim(),
    ...(pr ? { pr } : {}),
  };
}

/** ใบสั่งซื้อใหม่เริ่มเป็นร่างเสมอ — ส่งผู้ขายได้เมื่อผู้มีอำนาจตามวงเงินลงนาม */
export function createPurchaseOrder(input: OrderInput): PurchaseOrder {
  assertValid(orderProblems(input));
  return commit(() => {
    const po = newOrder(input);
    PURCHASE_ORDERS.push(po);
    return po;
  });
}

export function updatePurchaseOrder(no: string, input: OrderInput) {
  const po = purchaseOrder(no);
  if (po.status !== "ร่าง") throw new Error(`${no} ส่งผู้ขายไปแล้ว แก้ไขไม่ได้`);
  assertValid(orderProblems(input));
  commit(() =>
    patch(po, {
      vendor: input.vendor,
      date: input.date,
      deliverBy: input.deliverBy,
      note: input.note.trim(),
      lines: input.lines.map((l) => ({ ...l })),
    })
  );
}

export function sendPurchaseOrder(no: string, approverName: string) {
  const po = purchaseOrder(no);
  if (po.status !== "ร่าง") throw new Error(`${no} ส่งผู้ขายไปแล้ว`);
  if (vendor(po.vendor).blocked) throw new Error(`${vendor(po.vendor).name} ถูกระงับการสั่งซื้อ`);
  const problem = approvalProblem(approverName, poTotal(po));
  if (problem) throw new Error(problem);
  commit(() => patch(po, { status: "รอรับของ", approvedBy: approverName }));
}

/** ยกเลิกได้เมื่อยังไม่มีของเข้าและยังไม่มีบิล — มีแล้วต้องปิดยอดค้างรับแทน */
export const canCancel = (po: PurchaseOrder) =>
  (po.status === "ร่าง" || po.status === "รอรับของ") && receiptsOf(po.no).length === 0 && invoicesOf(po.no).length === 0;

export function cancelPurchaseOrder(no: string, reason: string) {
  const po = purchaseOrder(no);
  if (!canCancel(po)) throw new Error(`${no} มีการรับของหรือวางบิลแล้ว ยกเลิกไม่ได้`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลที่ยกเลิก อย่างน้อย 5 ตัวอักษร");
  commit(() => {
    patch(po, { status: "ยกเลิก", cancelReason: reason.trim() });
    // ใบขอซื้อต้นทางกลับไปรอหาแหล่งซื้อใหม่ ความต้องการของยังอยู่
    const pr = REQUISITIONS.find((r) => r.po === no);
    if (pr) patch(pr, { status: "อนุมัติแล้ว", po: undefined });
  });
}

/** ผู้ขายส่งส่วนที่เหลือไม่ได้ — ปิดใบไว้ที่ยอดที่รับจริง ของที่ค้างไม่นับเป็นของที่กำลังมา */
export function closePurchaseOrder(no: string, reason: string) {
  const po = purchaseOrder(no);
  if (po.status !== "รับของบางส่วน") throw new Error(`ปิดยอดค้างรับได้เฉพาะใบที่รับของบางส่วน`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลที่ปิดยอด อย่างน้อย 5 ตัวอักษร");
  commit(() => patch(po, { status: "ปิดยอดค้างรับ", closeReason: reason.trim() }));
}

/* ---------------------------------------------------------- goods receipt */

export const receiptsOf = (poNo: string) => GOODS_RECEIPTS.filter((g) => g.po === poNo);
export const invoicesOf = (poNo: string) => INVOICES.filter((i) => i.po === poNo);

export const receivedQty = (poNo: string, code: string) =>
  receiptsOf(poNo).reduce((n, g) => n + (g.lines.find((l) => l.material === code)?.qty ?? 0), 0);

/** ที่สั่งแต่ยังไม่ได้รับ ของบรรทัดหนึ่ง */
export function outstandingQty(po: PurchaseOrder, code: string) {
  const line = po.lines.find((l) => l.material === code);
  if (!line) throw new Error(`${po.no} ไม่มี ${code}`);
  return Math.max(0, line.qty - receivedQty(po.no, code));
}

export type ReceiptInput = {
  po: string;
  date: string;
  deliveryNote: string;
  receivedBy: string;
  lines: { material: string; qty: number }[];
};

export function receiptProblems(input: ReceiptInput): Record<string, string> {
  const e: Record<string, string> = {};
  const po = PURCHASE_ORDERS.find((p) => p.no === input.po);
  if (!po) {
    e.po = "เลือกใบสั่งซื้อ";
    return e;
  }
  if (!RECEIVABLE.includes(po.status)) e.po = `${po.no} ${po.status} รับของไม่ได้`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) e.date = "ใส่วันที่รับของ";
  else if (input.date > TODAY) e.date = "รับของล่วงหน้าไม่ได้";
  else if (input.date < po.date) e.date = "วันที่รับต้องไม่ก่อนวันที่สั่ง";
  if (input.deliveryNote.trim().length < 3) e.deliveryNote = "ใส่เลขที่ใบส่งของของผู้ขาย ใช้ตรวจตอนวางบิล";
  if (input.receivedBy.trim().length < 2) e.receivedBy = "ใส่ชื่อผู้ตรวจรับ";
  for (const l of input.lines) {
    if (!po.lines.some((x) => x.material === l.material)) e.lines = `${l.material} ไม่อยู่ในใบสั่งซื้อ`;
    else if (!(l.qty >= 0)) e["line:" + l.material] = "จำนวนต้องไม่ติดลบ";
    else if (l.qty > outstandingQty(po, l.material)) e["line:" + l.material] = `รับเกินยอดค้างรับ ${outstandingQty(po, l.material)}`;
  }
  if (!e.lines && !input.lines.some((l) => l.qty > 0)) e.lines = "ใส่จำนวนที่รับอย่างน้อยหนึ่งรายการ";
  return e;
}

/**
 * รับของเข้าตามใบสั่งซื้อ: ออกใบรับสินค้า เพิ่มสต็อก บันทึกความเคลื่อนไหว
 * แล้วเลื่อนสถานะใบสั่งซื้อตามยอดที่รับครบหรือยังค้าง
 */
export function postGoodsReceipt(input: ReceiptInput): GoodsReceipt {
  assertValid(receiptProblems(input));
  const po = purchaseOrder(input.po);
  return commit(() => {
    const gr: GoodsReceipt = {
      no: nextReceiptNo(),
      po: po.no,
      date: input.date,
      lines: input.lines.filter((l) => l.qty > 0).map((l) => ({ material: l.material, qty: l.qty })),
      deliveryNote: input.deliveryNote.trim(),
      receivedBy: input.receivedBy.trim(),
    };
    GOODS_RECEIPTS.push(gr);
    for (const l of gr.lines) {
      material(l.material).stock += l.qty;
      STOCK_MOVES.push({ date: gr.date, material: l.material, qty: l.qty, reason: `รับจากใบสั่งซื้อ ${po.no}`, doc: gr.no, kind: "รับเข้า" });
    }
    po.status = po.lines.every((l) => outstandingQty(po, l.material) === 0) ? "รับของครบแล้ว" : "รับของบางส่วน";
    return gr;
  });
}

/* -------------------------------------------------------------- invoices */

export const toleranceFor = (received: number) => round2(Math.min(received * MATCH_TOLERANCE.rate, MATCH_TOLERANCE.cap));

export const receivedValue = (po: PurchaseOrder) =>
  round2(po.lines.reduce((n, l) => n + receivedQty(po.no, l.material) * l.price, 0));

export const invoicedValue = (poNo: string) => round2(invoicesOf(poNo).reduce((n, i) => n + i.amount, 0));

/**
 * ตรวจสามทางของยอดวางบิลก้อนใหม่: รวมกับที่วางไปแล้วต้องไม่เกินมูลค่าของที่รับจริง
 * เกินเกณฑ์ที่ยอมให้ต่าง — วางน้อยกว่าไม่ผิด เพราะผู้ขายวางบิลเป็นงวดได้
 */
export function checkInvoice(poNo: string, amount: number) {
  const po = purchaseOrder(poNo);
  const received = receivedValue(po);
  const billed = round2(invoicedValue(poNo) + amount);
  const tolerance = toleranceFor(received);
  const over = round2(billed - received);
  return { received, billed, tolerance, over, ok: over <= tolerance };
}

const blockReasonOf = (c: ReturnType<typeof checkInvoice>) =>
  c.received === 0
    ? "ยังไม่มีการรับของตามใบสั่งซื้อนี้"
    : `วางบิลรวม ${baht(c.billed)} แต่รับของจริง ${baht(c.received)} เกินเกณฑ์ที่ยอมให้ต่าง ${baht(c.tolerance)}`;

/** ใบสั่งซื้อที่วางบิลได้: ส่งผู้ขายแล้วและยังไม่ถูกยกเลิก */
export const INVOICEABLE: PoStatus[] = ["รอรับของ", "รับของบางส่วน", "รับของครบแล้ว", "ปิดยอดค้างรับ"];

export type InvoiceInput = { no: string; po: string; date: string; amount: number };

export function invoiceProblems(input: InvoiceInput): Record<string, string> {
  const e: Record<string, string> = {};
  const no = input.no.trim();
  if (no.length < 3) e.no = "ใส่เลขที่ใบกำกับภาษีหรือใบแจ้งหนี้ของผู้ขาย";
  else if (INVOICES.some((i) => i.no === no)) e.no = "เลขที่นี้บันทึกไว้แล้ว ระวังตั้งหนี้ซ้ำ";
  const po = PURCHASE_ORDERS.find((p) => p.no === input.po);
  if (!po) e.po = "เลือกใบสั่งซื้อ";
  else if (!INVOICEABLE.includes(po.status)) e.po = `${po.no} ${po.status} วางบิลไม่ได้`;
  if (!(input.amount > 0)) e.amount = "มูลค่าต้องมากกว่าศูนย์";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) e.date = "ใส่วันที่ในใบกำกับภาษี";
  else if (input.date > TODAY) e.date = "วันที่ต้องไม่เลยวันนี้";
  else if (po && input.date < po.date) e.date = "วันที่ต้องไม่ก่อนวันที่สั่งซื้อ";
  return e;
}

/** ตั้งหนี้ตามใบแจ้งหนี้ของผู้ขาย — ไม่ผ่านตรวจสามทางก็บันทึก แต่ระงับจ่ายไว้พร้อมเหตุผล */
export function recordInvoice(input: InvoiceInput): SupplierInvoice {
  assertValid(invoiceProblems(input));
  const po = purchaseOrder(input.po);
  const check = checkInvoice(po.no, input.amount);
  return commit(() => {
    const inv: SupplierInvoice = {
      no: input.no.trim(),
      po: po.no,
      vendor: po.vendor,
      date: input.date,
      amount: round2(input.amount),
      paid: false,
      blocked: !check.ok,
      ...(check.ok ? {} : { blockReason: blockReasonOf(check) }),
    };
    INVOICES.push(inv);
    return inv;
  });
}

/** ปลดระงับได้เมื่อสาเหตุหมดไปแล้ว — เช่น รับของส่วนที่ขาดครบ ยอดทั้งใบจึงกลับมาตรงกัน */
export const canRelease = (inv: SupplierInvoice) => inv.blocked && checkInvoice(inv.po, 0).ok;

export function releaseInvoice(no: string) {
  const inv = INVOICES.find((i) => i.no === no);
  if (!inv) throw new Error(`ไม่พบใบแจ้งหนี้ ${no}`);
  if (!inv.blocked) throw new Error(`${no} ไม่ได้ถูกระงับจ่าย`);
  if (!canRelease(inv)) throw new Error(`${no} ยอดวางบิลยังเกินของที่รับจริง ปลดระงับไม่ได้`);
  commit(() => patch(inv, { blocked: false, blockReason: undefined, releasedAt: TODAY }));
}

/** สามทางตรง: สั่งเท่าไร รับเท่าไร วางบิลเท่าไร — ไม่ตรงเกินเกณฑ์คือห้ามจ่าย */
export function threeWayMatch(po: PurchaseOrder) {
  const ordered = poTotal(po);
  const received = receivedValue(po);
  const invoice = invoicedValue(po.no);
  const tolerance = toleranceFor(received);
  return {
    ordered, received, invoice, tolerance,
    shortLines: po.lines.filter((l) => receivedQty(po.no, l.material) < l.qty)
      .map((l) => ({ ...l, got: receivedQty(po.no, l.material) })),
    matched: invoice > 0 && Math.abs(invoice - received) <= tolerance,
  };
}

/** สถานะการวางบิลของใบสั่งซื้อ อ่านได้ในคำเดียว */
export function matchStatusOf(po: PurchaseOrder): { label: string; tone: "idle" | "ok" | "bad" | "info" } {
  const m = threeWayMatch(po);
  if (m.invoice === 0) return { label: "ยังไม่วางบิล", tone: "idle" };
  if (invoicesOf(po.no).some((i) => i.blocked)) return { label: "ระงับจ่าย", tone: "bad" };
  if (m.matched) return { label: "ตรงกัน จ่ายได้", tone: "ok" };
  if (m.invoice < m.received) return { label: "วางบิลบางส่วน", tone: "info" };
  return { label: "ไม่ตรง ยังจ่ายไม่ได้", tone: "bad" };
}

/* ---------------------------------------------------------- stock moves */

export const MOVE_KINDS = ["เบิกใช้", "ตัดของเสีย", "ปรับยอดเพิ่ม", "ปรับยอดลด"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];
const OUTWARD: readonly MoveKind[] = ["เบิกใช้", "ตัดของเสีย", "ปรับยอดลด"];

export type MoveInput = { kind: MoveKind; material: string; qty: number; department: string; reason: string; date: string };

export function moveProblems(input: MoveInput): Record<string, string> {
  const e: Record<string, string> = {};
  const m = MATERIALS.find((x) => x.code === input.material);
  if (!m) e.material = "เลือกวัสดุ";
  if (!(input.qty > 0)) e.qty = "จำนวนต้องมากกว่าศูนย์";
  else if (m && OUTWARD.includes(input.kind) && input.qty > m.stock) e.qty = `คงเหลือมีเพียง ${m.stock} ${m.unit} สต็อกติดลบไม่ได้`;
  if (input.kind === "เบิกใช้" && !REQUESTERS.includes(input.department)) e.department = "เลือกหน่วยงานที่เบิก";
  if (input.reason.trim().length < 3) e.reason = input.kind === "เบิกใช้" ? "ใส่ว่าเบิกไปใช้ทำอะไร" : "ใส่สาเหตุ ผู้ตรวจสอบบัญชีจะถามหา";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) e.date = "ใส่วันที่";
  else if (input.date > TODAY) e.date = "บันทึกล่วงหน้าไม่ได้";
  return e;
}

/** เบิกใช้ออกใบเบิกวัสดุ (IS) ส่วนตัดของเสียและปรับยอดออกใบปรับปรุงสต็อก (AJ) */
export function postStockMove(input: MoveInput): StockMove {
  assertValid(moveProblems(input));
  const m = material(input.material);
  const docs = STOCK_MOVES.map((x) => x.doc ?? "");
  return commit(() => {
    const signed = OUTWARD.includes(input.kind) ? -input.qty : input.qty;
    const move: StockMove = {
      date: input.date,
      material: m.code,
      qty: signed,
      reason: input.kind === "เบิกใช้" ? `เบิกโดย${input.department} · ${input.reason.trim()}` : `${input.kind} · ${input.reason.trim()}`,
      doc: nextNumber(docs, input.kind === "เบิกใช้" ? `IS-${YEAR}-` : `AJ-${YEAR}-`),
      kind: input.kind,
      ...(input.kind === "เบิกใช้" ? { department: input.department } : {}),
    };
    STOCK_MOVES.push(move);
    m.stock += signed;
    return move;
  });
}

export const movesOf = (code: string) => STOCK_MOVES.filter((m) => m.material === code);

export type DeliveryIssueInput = { ref: string; date: string; lines: { material: string; qty: number }[] };

/**
 * การตัดสต็อกของใบส่งของที่ยังไม่ถูกกลับรายการ — การกลับรายการแต่ละครั้งหักล้าง
 * การตัดที่เก่าที่สุดที่ยังค้างอยู่ทีละบรรทัด ตามลำดับที่บันทึก
 */
const outstandingIssues = (ref: string) => {
  const issued = STOCK_MOVES.filter((m) => m.doc === ref && m.kind === "ส่งของ");
  const reversed = STOCK_MOVES.filter((m) => m.doc === ref && m.kind === "กลับรายการส่งของ").length;
  return issued.slice(reversed);
};

/**
 * ตัดสต็อกตามใบส่งของของฝ่ายขาย ทั้งใบหรือไม่ตัดเลย
 *
 * ฝ่ายขายเขียนอาร์เรย์ของจัดซื้อเองไม่ได้ จึงเรียกผ่านฟังก์ชันนี้ ทุกบรรทัดต้องมีของพอ
 * ก่อนตัดบรรทัดแรก — ส่งได้ครึ่งใบแล้วสต็อกหายครึ่งเดียวคือตัวเลขที่ไม่มีใครตามได้
 */
export function issueForDelivery(input: DeliveryIssueInput): StockMove[] {
  const ref = input.ref.trim();
  if (ref.length < 3) throw new Error("ต้องมีเลขที่ใบส่งของ");
  if (outstandingIssues(ref).length > 0) throw new Error(`${ref} ตัดสต็อกไปแล้ว`);
  if (input.lines.length === 0) throw new Error(`${ref} ไม่มีรายการที่ต้องส่ง`);
  const need = new Map<string, number>();
  for (const l of input.lines) {
    if (!(l.qty > 0)) throw new Error(`จำนวนที่ส่งของ ${l.material} ต้องมากกว่าศูนย์`);
    need.set(l.material, (need.get(l.material) ?? 0) + l.qty);
  }
  for (const [code, qty] of need) {
    const m = material(code);
    if (qty > m.stock) throw new Error(`${m.name} คงเหลือ ${m.stock} ${m.unit} ไม่พอส่ง ${qty} ตาม ${ref}`);
  }
  return commit(() =>
    input.lines.map((l) => {
      const move: StockMove = { date: input.date, material: l.material, qty: -l.qty, reason: `ส่งของตามใบส่งของ ${ref}`, doc: ref, kind: "ส่งของ" };
      STOCK_MOVES.push(move);
      material(l.material).stock -= l.qty;
      return move;
    })
  );
}

/** กลับรายการตัดสต็อกของใบส่งของที่ถูกยกเลิก — ของกลับเข้าคลังเท่าที่ตัดไป */
export function reverseDeliveryIssue(ref: string, date: string = TODAY): StockMove[] {
  const issued = outstandingIssues(ref);
  if (issued.length === 0) throw new Error(`${ref} ไม่มีการตัดสต็อกที่กลับรายการได้`);
  return commit(() =>
    issued.map((m) => {
      const back: StockMove = { date, material: m.material, qty: -m.qty, reason: `กลับรายการส่งของ ${ref}`, doc: ref, kind: "กลับรายการส่งของ" };
      STOCK_MOVES.push(back);
      material(m.material).stock += -m.qty;
      return back;
    })
  );
}

/* --------------------------------------------------------------- reorder */

export const belowReorder = () => MATERIALS.filter((m) => m.stock < m.reorder);

/** ระดับเติมของ: สั่งเติมให้ถึงสองเท่าของจุดสั่งซื้อ */
export const maxLevel = (m: Material) => m.reorder * 2;

/** ของที่กำลังมา — ค้างรับในใบสั่งซื้อที่ยังเปิด บวกใบขอซื้อที่ยังไม่แปลง จะได้ไม่สั่งซ้ำ */
export function onOrderQty(code: string) {
  const ordered = PURCHASE_ORDERS.filter((p) => p.status === "ร่าง" || RECEIVABLE.includes(p.status))
    .filter((p) => p.lines.some((l) => l.material === code))
    .reduce((n, p) => n + outstandingQty(p, code), 0);
  const requested = REQUISITIONS.filter((r) => r.status === "รออนุมัติ" || r.status === "อนุมัติแล้ว")
    .reduce((n, r) => n + r.lines.filter((l) => l.material === code).reduce((s, l) => s + l.qty, 0), 0);
  return ordered + requested;
}

/**
 * รายการเสนอสั่งซื้อ: วัสดุที่ต่ำกว่าจุดสั่งซื้อ หักของที่กำลังมาแล้ว ยังไม่ถึงจุดสั่งซื้อ
 * จึงเสนอให้สั่งเติมถึงระดับเติมของ สินค้าสำเร็จรูปผลิตเองจึงไม่เสนอซื้อ
 */
export function reorderPlan() {
  return belowReorder().map((m) => {
    const onOrder = onOrderQty(m.code);
    const made = m.group === MADE_IN_HOUSE;
    const short = m.stock + onOrder < m.reorder;
    return {
      m,
      onOrder,
      made,
      urgent: m.stock < m.safety,
      qty: made || !short ? 0 : maxLevel(m) - m.stock - onOrder,
      best: bestPriceFor(m.code),
    };
  });
}

/** เปิดใบขอซื้อจากรายการเสนอสั่งซื้อในคลิกเดียว — ราคาประมาณจากราคาดีที่สุดที่เคยได้ */
export function requisitionFromReorder(codes: string[]): Requisition {
  const plan = reorderPlan().filter((p) => codes.includes(p.m.code) && p.qty > 0);
  if (plan.length === 0) throw new Error("ไม่มีรายการที่ต้องสั่งเพิ่ม");
  const lead = Math.max(...plan.map((p) => p.best?.leadDays ?? DEFAULT_LEAD_DAYS));
  return createRequisition({
    requester: "ฝ่ายคลัง",
    needBy: addDays(TODAY, lead),
    note: "เปิดจากรายการเสนอสั่งซื้อ คงเหลือต่ำกว่าจุดสั่งซื้อ",
    lines: plan.map((p) => ({ material: p.m.code, qty: p.qty, price: p.best?.price ?? p.m.price })),
  });
}

/* --------------------------------------------------------- vendor review */

export const REVIEW_CRITERIA = [
  { key: "quality", label: "คุณภาพสินค้า" },
  { key: "delivery", label: "ส่งตรงเวลาและครบ" },
  { key: "price", label: "ราคาและเงื่อนไข" },
  { key: "service", label: "บริการและเอกสาร" },
] as const;

export type ReviewInput = Omit<VendorReview, "no" | "date">;

/** คะแนนเต็มร้อย: เฉลี่ยสี่เกณฑ์ที่ให้ 1–5 */
export const reviewScore = (r: Pick<VendorReview, "quality" | "delivery" | "price" | "service">) =>
  Math.round(((r.quality + r.delivery + r.price + r.service) / 4) * 20);

export const gradeOf = (score: number): "A" | "B" | "C" => (score >= 80 ? "A" : score >= 60 ? "B" : "C");

export const GRADE_MEANING: Record<"A" | "B" | "C", string> = {
  A: "ผู้ขายหลัก สั่งต่อได้",
  B: "ใช้ต่อได้ ต้องติดตาม",
  C: "ควรหาแหล่งซื้อใหม่",
};

/** งวดประเมินของวันนี้ — ไตรมาสตามปี พ.ศ. */
export const currentPeriod = () => `ไตรมาส ${Math.floor((Number(TODAY.slice(5, 7)) - 1) / 3) + 1}/${YEAR}`;

export const reviewsOf = (code: string) =>
  VENDOR_REVIEWS.filter((r) => r.vendor === code).sort((a, b) => a.date.localeCompare(b.date));

export const latestReview = (code: string) => reviewsOf(code).at(-1);

export function reviewProblems(input: ReviewInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!VENDORS.some((v) => v.code === input.vendor)) e.vendor = "เลือกผู้ขาย";
  else if (VENDOR_REVIEWS.some((r) => r.vendor === input.vendor && r.period === input.period)) e.vendor = `ประเมินผู้ขายรายนี้ใน${input.period}ไปแล้ว`;
  for (const c of REVIEW_CRITERIA) {
    const v = input[c.key];
    if (!Number.isInteger(v) || v < 1 || v > 5) e[c.key] = "ให้คะแนน 1–5";
  }
  if (input.by.trim().length < 2) e.by = "ใส่ชื่อผู้ประเมิน";
  return e;
}

export function recordVendorReview(input: ReviewInput): VendorReview {
  assertValid(reviewProblems(input));
  return commit(() => {
    const r: VendorReview = { ...input, note: input.note.trim(), no: nextNumber(VENDOR_REVIEWS.map((x) => x.no), `VE-${YEAR}-`), date: TODAY };
    VENDOR_REVIEWS.push(r);
    return r;
  });
}

/** คะแนนด้านการส่งมอบที่ประวัติจริงชี้ — จากอัตราส่งตรงเวลาและส่งครบ ตัวที่แย่กว่าเป็นตัวตัดสิน */
export function suggestedDeliveryScore(code: string): number | null {
  const s = vendorScore(code);
  const rates = [s.onTime, s.fillRate].filter((x): x is number => x !== null);
  if (rates.length === 0) return null;
  const worst = Math.min(...rates);
  return worst >= 95 ? 5 : worst >= 85 ? 4 : worst >= 70 ? 3 : worst >= 50 ? 2 : 1;
}

/** คะแนนผู้ขาย: ส่งตรงเวลากี่ครั้ง ส่งของครบกี่ครั้ง */
export function vendorScore(code: string) {
  const pos = PURCHASE_ORDERS.filter((p) => p.vendor === code && COMMITTED.includes(p.status));
  const closed = pos.filter((p) => CLOSED.includes(p.status));
  const complete = closed.filter((p) => threeWayMatch(p).shortLines.length === 0);
  const deliveries = pos.flatMap((p) => receiptsOf(p.no).map((g) => g.date <= p.deliverBy));
  return {
    orders: pos.length,
    value: pos.reduce((n, p) => n + poTotal(p), 0),
    fillRate: closed.length ? Math.round((complete.length / closed.length) * 100) : null,
    onTime: deliveries.length ? Math.round((deliveries.filter(Boolean).length / deliveries.length) * 100) : null,
  };
}

/** ใบสั่งซื้อที่อ้างถึงใบขอซื้อใบนั้น — ใช้ปิดสถานะใบขอซื้อ */
export const poFor = (prNo: string) => PURCHASE_ORDERS.find((p) => p.pr === prNo);

/** ยอดสั่งซื้อรายเดือน เรียงจากเก่าไปใหม่ — นับเฉพาะใบที่ส่งผู้ขายแล้ว */
export function spendByMonth() {
  const committed = PURCHASE_ORDERS.filter((p) => COMMITTED.includes(p.status));
  const months = [...new Set(committed.map((p) => p.date.slice(0, 7)))].sort();
  return months.map((m) => ({
    month: m,
    value: committed.filter((p) => p.date.slice(0, 7) === m).reduce((n, p) => n + poTotal(p), 0),
    orders: committed.filter((p) => p.date.slice(0, 7) === m).length,
  }));
}

/** มูลค่าสต็อกแยกตามกลุ่มวัสดุ */
export const stockByGroup = () =>
  MATERIAL_GROUPS.map((g) => ({
    group: g,
    value: MATERIALS.filter((m) => m.group === g).reduce((n, m) => n + m.stock * m.price, 0),
    items: MATERIALS.filter((m) => m.group === g).length,
  })).filter((x) => x.items > 0);

export const stockValue = () => MATERIALS.reduce((n, m) => n + m.stock * m.price, 0);

/** ราคาที่ดีที่สุดที่เคยได้สำหรับวัสดุตัวหนึ่ง */
export const bestPriceFor = (code: string) => {
  const rows = INFO_RECORDS.filter((r) => r.material === code);
  return rows.length ? rows.reduce((best, r) => (r.price < best.price ? r : best)) : undefined;
};

/** ราคาที่ผู้ขายรายนี้เคยเสนอให้วัสดุตัวนี้ ถ้าไม่เคยใช้ราคามาตรฐานในแฟ้มวัสดุ */
export const priceFrom = (vendorCode: string, code: string) =>
  INFO_RECORDS.find((r) => r.vendor === vendorCode && r.material === code)?.price ?? material(code).price;
