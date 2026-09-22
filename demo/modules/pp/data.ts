import { FINISHED_GOODS, material } from "../mm/data";

/** สินค้าที่ผลิต — อ่านจากแฟ้มวัสดุ ไม่ได้ถือรายการของตัวเอง */
export const PRODUCTS = FINISHED_GOODS;

/** สูตรการผลิต — ผลิตหนึ่งหน่วยต้องใช้วัสดุอะไรเท่าไร */
export const BOM: Record<string, { material: string; qty: number }[]> = {
  "FG-5001": [
    { material: "MAT-1001", qty: 2 },
    { material: "MAT-1002", qty: 6 },
    { material: "MAT-2001", qty: 0.5 },
    { material: "MAT-1003", qty: 0.15 },
  ],
  "FG-5002": [
    { material: "MAT-1001", qty: 3 },
    { material: "MAT-1002", qty: 4 },
    { material: "MAT-2001", qty: 0.4 },
    { material: "MAT-1003", qty: 0.2 },
  ],
  "FG-5003": [
    { material: "MAT-1001", qty: 1 },
    { material: "MAT-1002", qty: 8 },
    { material: "MAT-2002", qty: 4 },
    { material: "MAT-4001", qty: 1 },
  ],
};

export const WORK_CENTERS = [
  { code: "WC-CUT", name: "ตัดและขึ้นรูป", capacityHrs: 80, costPerHr: 420 },
  { code: "WC-WELD", name: "เชื่อมประกอบ", capacityHrs: 120, costPerHr: 520 },
  { code: "WC-PAINT", name: "พ่นสีและอบ", capacityHrs: 60, costPerHr: 380 },
  { code: "WC-ASM", name: "ประกอบขั้นสุดท้าย", capacityHrs: 100, costPerHr: 350 },
];

/** ขั้นตอนการผลิต — ผ่านศูนย์งานไหน ใช้เวลากี่ชั่วโมงต่อหน่วย */
export const ROUTING: Record<string, { wc: string; hrs: number }[]> = {
  "FG-5001": [
    { wc: "WC-CUT", hrs: 0.6 }, { wc: "WC-WELD", hrs: 1.2 },
    { wc: "WC-PAINT", hrs: 0.5 }, { wc: "WC-ASM", hrs: 0.4 },
  ],
  "FG-5002": [
    { wc: "WC-CUT", hrs: 0.8 }, { wc: "WC-WELD", hrs: 1.5 },
    { wc: "WC-PAINT", hrs: 0.6 }, { wc: "WC-ASM", hrs: 0.5 },
  ],
  "FG-5003": [
    { wc: "WC-CUT", hrs: 0.5 }, { wc: "WC-WELD", hrs: 2.0 },
    { wc: "WC-ASM", hrs: 1.0 },
  ],
};

/** ความต้องการที่รับมา — ป้อน MRP */
export const DEMAND = [
  { product: "FG-5001", qty: 40, dueDate: "2026-10-10" },
  { product: "FG-5002", qty: 25, dueDate: "2026-10-17" },
  { product: "FG-5003", qty: 12, dueDate: "2026-10-24" },
];

export const ORDERS = [
  { no: "PO-P-3301", product: "FG-5001", qty: 40, start: "2026-09-28", due: "2026-10-10", done: 28, status: "กำลังผลิต" },
  { no: "PO-P-3302", product: "FG-5002", qty: 25, start: "2026-10-05", due: "2026-10-17", done: 0, status: "ปล่อยงานแล้ว" },
  { no: "PO-P-3303", product: "FG-5003", qty: 12, start: "2026-10-14", due: "2026-10-24", done: 0, status: "วางแผนไว้" },
  { no: "PO-P-3298", product: "FG-5001", qty: 30, start: "2026-09-08", due: "2026-09-19", done: 30, status: "ปิดงานแล้ว" },
  { no: "PO-P-3299", product: "FG-5002", qty: 18, start: "2026-09-10", due: "2026-09-20", done: 16, status: "ปิดงานแล้ว" },
];

export type ProductionOrder = (typeof ORDERS)[number];

export const product = (code: string) => material(code);

export const workCenter = (code: string) => {
  const w = WORK_CENTERS.find((x) => x.code === code);
  if (!w) throw new Error(`ไม่รู้จักศูนย์งาน ${code}`);
  return w;
};

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

/**
 * กางสูตรการผลิตออกเป็นความต้องการวัสดุ แล้วหักสต็อกที่มีอยู่
 * ที่เหลือคือของที่ต้องซื้อ — ตัวเลขเดียวกับที่ฝ่ายจัดซื้อเอาไปเปิดใบขอซื้อ
 */
export function runMrp() {
  const need: Record<string, number> = {};
  for (const d of DEMAND) {
    for (const line of BOM[d.product]) {
      need[line.material] = (need[line.material] ?? 0) + line.qty * d.qty;
    }
  }
  return Object.entries(need).map(([code, required]) => {
    const m = material(code);
    const onHand = m?.stock ?? 0;
    return {
      code, name: m?.name ?? code, unit: m?.unit ?? "",
      required: Math.ceil(required), onHand,
      shortage: Math.max(0, Math.ceil(required) - onHand),
      price: m?.price ?? 0,
    };
  });
}

/** ชั่วโมงที่แต่ละศูนย์งานถูกจองไว้จากใบสั่งผลิตที่ยังไม่ปิด */
export function loadOf(code: string) {
  return ORDERS.filter((o) => o.status !== "ปิดงานแล้ว").reduce((hrs, o) => {
    const step = ROUTING[o.product].find((r) => r.wc === code);
    return hrs + (step ? step.hrs * (o.qty - o.done) : 0);
  }, 0);
}

/** ต้นทุนต่อหน่วย = วัสดุตามสูตร + ค่าแรงตามขั้นตอน */
export function unitCost(code: string) {
  const mat = BOM[code].reduce((n, l) => n + l.qty * (material(l.material)?.price ?? 0), 0);
  const lab = ROUTING[code].reduce((n, r) => n + r.hrs * workCenter(r.wc).costPerHr, 0);
  return { material: mat, labour: lab, total: mat + lab };
}
