export const MATERIALS = [
  { code: "MAT-1001", name: "เหล็กแผ่นรีดร้อน 3 มม.", group: "วัตถุดิบ", unit: "แผ่น", price: 1850, stock: 240, reorder: 120, bin: "A-01-03" },
  { code: "MAT-1002", name: "เหล็กเส้นกลม 12 มม.", group: "วัตถุดิบ", unit: "เส้น", price: 420, stock: 86, reorder: 150, bin: "A-01-07" },
  { code: "MAT-1003", name: "สีพ่นอุตสาหกรรม สีเทา", group: "วัตถุดิบ", unit: "ถัง", price: 2400, stock: 34, reorder: 20, bin: "B-02-01" },
  { code: "MAT-2001", name: "น็อตหัวหกเหลี่ยม M8", group: "อะไหล่", unit: "กล่อง", price: 380, stock: 18, reorder: 40, bin: "C-01-12" },
  { code: "MAT-2002", name: "ตลับลูกปืน 6204", group: "อะไหล่", unit: "ตัว", price: 145, stock: 320, reorder: 100, bin: "C-02-04" },
  { code: "MAT-3001", name: "ถุงมือผ้าเคลือบยาง", group: "วัสดุสิ้นเปลือง", unit: "คู่", price: 35, stock: 640, reorder: 200, bin: "D-01-01" },
  { code: "MAT-3002", name: "กล่องกระดาษลูกฟูก 40x30", group: "บรรจุภัณฑ์", unit: "ใบ", price: 12, stock: 1420, reorder: 500, bin: "D-02-06" },
  { code: "MAT-4001", name: "มอเตอร์ไฟฟ้า 1 แรงม้า", group: "อะไหล่", unit: "ตัว", price: 5600, stock: 6, reorder: 10, bin: "C-03-02" },
  { code: "FG-5001", name: "ชั้นวางเหล็ก 4 ชั้น", group: "สินค้าสำเร็จรูป", unit: "ชุด", price: 7976, stock: 34, reorder: 15, bin: "E-01-01" },
  { code: "FG-5002", name: "โต๊ะทำงานเหล็ก 120 ซม.", group: "สินค้าสำเร็จรูป", unit: "ตัว", price: 9381, stock: 12, reorder: 10, bin: "E-01-04" },
  { code: "FG-5003", name: "รถเข็นอุตสาหกรรม", group: "สินค้าสำเร็จรูป", unit: "คัน", price: 12990, stock: 5, reorder: 6, bin: "E-02-02" },
];

/** สินค้าที่ขายได้ — ชนิดหนึ่งในแฟ้มวัสดุ ไม่ใช่รายการแยกอีกชุด */
export const FINISHED_GOODS = MATERIALS.filter((m) => m.group === "สินค้าสำเร็จรูป");

export const VENDORS = [
  { code: "V-001", name: "บจก. เหล็กไทยรุ่งเรือง", contact: "คุณสมศักดิ์", terms: "เครดิต 30 วัน", leadDays: 7, taxId: "0105542000123" },
  { code: "V-002", name: "หจก. ศรีชัยค้าวัสดุ", contact: "คุณมาลี", terms: "เครดิต 45 วัน", leadDays: 10, taxId: "0103548000987" },
  { code: "V-003", name: "บจก. อุตสาหกรรมสีไทย", contact: "คุณวิชัย", terms: "เงินสด", leadDays: 3, taxId: "0105535000456" },
  { code: "V-004", name: "บจก. ยนต์ภัณฑ์สากล", contact: "คุณนภา", terms: "เครดิต 30 วัน", leadDays: 14, taxId: "0105551000789" },
];

/** ราคาและเวลาส่งที่ผู้ขายแต่ละรายเคยให้ไว้กับวัสดุตัวหนึ่ง */
export const INFO_RECORDS = [
  { material: "MAT-1001", vendor: "V-001", price: 1850, leadDays: 7 },
  { material: "MAT-1001", vendor: "V-002", price: 1920, leadDays: 5 },
  { material: "MAT-1002", vendor: "V-001", price: 420, leadDays: 7 },
  { material: "MAT-1003", vendor: "V-003", price: 2400, leadDays: 3 },
  { material: "MAT-2001", vendor: "V-002", price: 380, leadDays: 10 },
  { material: "MAT-2002", vendor: "V-004", price: 145, leadDays: 14 },
  { material: "MAT-4001", vendor: "V-004", price: 5600, leadDays: 14 },
];

export const REQUISITIONS = [
  { no: "PR-2569-041", material: "MAT-2001", qty: 60, needBy: "2026-10-02", requester: "ฝ่ายผลิต", status: "รออนุมัติ" },
  { no: "PR-2569-042", material: "MAT-4001", qty: 8, needBy: "2026-10-09", requester: "ฝ่ายซ่อมบำรุง", status: "รออนุมัติ" },
  { no: "PR-2569-043", material: "MAT-1002", qty: 200, needBy: "2026-09-30", requester: "ฝ่ายผลิต", status: "แปลงเป็นใบสั่งซื้อแล้ว" },
  { no: "PR-2569-044", material: "MAT-3002", qty: 800, needBy: "2026-10-15", requester: "ฝ่ายคลัง", status: "รออนุมัติ" },
];

export const PURCHASE_ORDERS = [
  { no: "PO-2569-118", vendor: "V-001", date: "2026-09-12", lines: [{ material: "MAT-1002", qty: 200, price: 420 }], status: "รับของครบแล้ว" },
  { no: "PO-2569-119", vendor: "V-003", date: "2026-09-15", lines: [{ material: "MAT-1003", qty: 20, price: 2400 }], status: "รับของบางส่วน" },
  { no: "PO-2569-120", vendor: "V-004", date: "2026-09-18", lines: [{ material: "MAT-2002", qty: 100, price: 145 }, { material: "MAT-4001", qty: 4, price: 5600 }], status: "รอรับของ" },
  { no: "PO-2569-121", vendor: "V-002", date: "2026-09-19", lines: [{ material: "MAT-2001", qty: 40, price: 380 }], status: "รอรับของ" },
];

/** ของที่รับเข้าจริงต่อใบสั่งซื้อ — เทียบกับที่สั่งเพื่อจับของขาด */
export const GOODS_RECEIPTS = [
  { no: "GR-2569-206", po: "PO-2569-118", date: "2026-09-19", lines: [{ material: "MAT-1002", qty: 200 }] },
  { no: "GR-2569-207", po: "PO-2569-119", date: "2026-09-20", lines: [{ material: "MAT-1003", qty: 14 }] },
];

export const INVOICES = [
  { no: "INV-88214", po: "PO-2569-118", vendor: "V-001", date: "2026-09-20", amount: 84000 },
  { no: "INV-88301", po: "PO-2569-119", vendor: "V-003", date: "2026-09-21", amount: 48000 },
];

/** การเคลื่อนไหวสต็อก — รับเข้าเป็นบวก จ่ายออกเป็นลบ */
export const STOCK_MOVES = [
  { date: "2026-09-19", material: "MAT-1002", qty: 200, reason: "รับจากใบสั่งซื้อ PO-2569-118" },
  { date: "2026-09-19", material: "MAT-1001", qty: -40, reason: "เบิกเข้าสายการผลิต" },
  { date: "2026-09-20", material: "MAT-1003", qty: 14, reason: "รับจากใบสั่งซื้อ PO-2569-119" },
  { date: "2026-09-20", material: "MAT-3001", qty: -60, reason: "เบิกใช้ประจำเดือน" },
  { date: "2026-09-21", material: "MAT-1002", qty: -114, reason: "เบิกเข้าสายการผลิต" },
  { date: "2026-09-21", material: "MAT-2001", qty: -22, reason: "เบิกซ่อมบำรุง" },
];

export type Material = (typeof MATERIALS)[number];
export type Vendor = (typeof VENDORS)[number];
export type PurchaseOrder = (typeof PURCHASE_ORDERS)[number];

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

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";
export const poTotal = (po: PurchaseOrder) => po.lines.reduce((n, l) => n + l.qty * l.price, 0);

/** สามทางตรง: สั่งเท่าไร รับเท่าไร วางบิลเท่าไร — ไม่ตรงคือห้ามจ่าย */
export function threeWayMatch(po: PurchaseOrder) {
  const ordered = poTotal(po);
  const gr = GOODS_RECEIPTS.filter((g) => g.po === po.no);
  const receivedQty = (code: string) =>
    gr.reduce((n, g) => n + (g.lines.find((l) => l.material === code)?.qty ?? 0), 0);
  const received = po.lines.reduce((n, l) => n + receivedQty(l.material) * l.price, 0);
  const invoice = INVOICES.filter((i) => i.po === po.no).reduce((n, i) => n + i.amount, 0);
  return {
    ordered, received, invoice,
    shortLines: po.lines.filter((l) => receivedQty(l.material) < l.qty)
      .map((l) => ({ ...l, got: receivedQty(l.material) })),
    matched: invoice > 0 && invoice === received,
  };
}

/** คะแนนผู้ขาย: ส่งตรงเวลากี่ครั้ง ส่งของครบกี่ครั้ง */
export function vendorScore(code: string) {
  const pos = PURCHASE_ORDERS.filter((p) => p.vendor === code);
  const complete = pos.filter((p) => threeWayMatch(p).shortLines.length === 0 && p.status !== "รอรับของ");
  const closed = pos.filter((p) => p.status !== "รอรับของ");
  return {
    orders: pos.length,
    value: pos.reduce((n, p) => n + poTotal(p), 0),
    fillRate: closed.length ? Math.round((complete.length / closed.length) * 100) : null,
  };
}
