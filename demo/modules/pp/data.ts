import { commit } from "../kit";
import { COMPANY as MM_COMPANY, FINISHED_GOODS, MATERIALS, TODAY, material, onOrderQty, postStockMove } from "../mm/data";

/** บริษัทที่ออกเอกสาร — หัวกระดาษเดียวกับเอกสารของคลังวัสดุ */
export const COMPANY = MM_COMPANY;

/** สินค้าที่ผลิต — อ่านจากแฟ้มวัสดุ ไม่ได้ถือรายการของตัวเอง */
export const PRODUCTS = FINISHED_GOODS;

/** สินค้าที่ผลิตได้ ณ ตอนนี้ — อ่านแฟ้มวัสดุทุกครั้ง เพราะฝ่ายจัดซื้อเพิ่มสินค้าใหม่ได้ระหว่างใช้งาน */
export const products = () => MATERIALS.filter((m) => m.group === "สินค้าสำเร็จรูป");

/** วัสดุที่ใส่ในสูตรการผลิตได้ — ทุกอย่างในแฟ้มวัสดุที่ไม่ใช่สินค้าสำเร็จรูป */
export const componentMaterials = () => MATERIALS.filter((m) => m.group !== "สินค้าสำเร็จรูป");

/** หนึ่งบรรทัดของสูตรการผลิต: ใช้ต่อหน่วยเท่าไร และเผื่อสูญเสียระหว่างผลิตกี่เปอร์เซ็นต์ */
export type BomLine = { material: string; qty: number; scrap: number };

/** สูตรการผลิต — ผลิตหนึ่งหน่วยต้องใช้วัสดุอะไรเท่าไร */
export const BOM: Record<string, BomLine[]> = {
  "FG-5001": [
    { material: "MAT-1001", qty: 2, scrap: 0 },
    { material: "MAT-1002", qty: 6, scrap: 0 },
    { material: "MAT-2001", qty: 0.5, scrap: 0 },
    { material: "MAT-1003", qty: 0.15, scrap: 0 },
  ],
  "FG-5002": [
    { material: "MAT-1001", qty: 3, scrap: 0 },
    { material: "MAT-1002", qty: 4, scrap: 0 },
    { material: "MAT-2001", qty: 0.4, scrap: 0 },
    { material: "MAT-1003", qty: 0.2, scrap: 0 },
  ],
  "FG-5003": [
    { material: "MAT-1001", qty: 1, scrap: 0 },
    { material: "MAT-1002", qty: 8, scrap: 0 },
    { material: "MAT-2002", qty: 4, scrap: 0 },
    { material: "MAT-4001", qty: 1, scrap: 0 },
  ],
};

/**
 * ศูนย์งาน. `capacityHrs` คือชั่วโมงที่ทำได้ในหนึ่งรอบวางแผน (สองสัปดาห์)
 * `kind` บอกว่าทำงานแบบไหน — ย้ายงานได้เฉพาะไปศูนย์งานที่ทำงานแบบเดียวกัน
 */
export type WorkCenter = { code: string; name: string; kind: string; capacityHrs: number; costPerHr: number };

export const WORK_CENTERS: WorkCenter[] = [
  { code: "WC-CUT", name: "ตัดและขึ้นรูป", kind: "ตัดและขึ้นรูป", capacityHrs: 80, costPerHr: 420 },
  { code: "WC-WELD", name: "เชื่อมประกอบ", kind: "เชื่อม", capacityHrs: 48, costPerHr: 520 },
  { code: "WC-PAINT", name: "พ่นสีและอบ", kind: "พ่นสี", capacityHrs: 60, costPerHr: 380 },
  { code: "WC-ASM", name: "ประกอบขั้นสุดท้าย", kind: "ประกอบ", capacityHrs: 100, costPerHr: 350 },
  { code: "WC-WELD2", name: "เชื่อมประกอบ สาย 2", kind: "เชื่อม", capacityHrs: 40, costPerHr: 560 },
];

export const WORK_KINDS = ["ตัดและขึ้นรูป", "เชื่อม", "พ่นสี", "ประกอบ"];

/** หนึ่งขั้นตอนการผลิต: ผ่านศูนย์งานไหน ทำอะไร ใช้เวลากี่ชั่วโมงต่อหน่วย */
export type RoutingOp = { op: string; wc: string; hrs: number; text: string };

/** ขั้นตอนการผลิต — ผ่านศูนย์งานไหน ใช้เวลากี่ชั่วโมงต่อหน่วย */
export const ROUTING: Record<string, RoutingOp[]> = {
  "FG-5001": [
    { op: "0010", wc: "WC-CUT", hrs: 0.6, text: "ตัดและพับแผ่นชั้น" },
    { op: "0020", wc: "WC-WELD", hrs: 1.2, text: "เชื่อมโครงเสาและคานรับ" },
    { op: "0030", wc: "WC-PAINT", hrs: 0.5, text: "พ่นสีฝุ่นและอบ" },
    { op: "0040", wc: "WC-ASM", hrs: 0.4, text: "ประกอบ ตรวจ และบรรจุ" },
  ],
  "FG-5002": [
    { op: "0010", wc: "WC-CUT", hrs: 0.8, text: "ตัดแผ่นท็อปและขา" },
    { op: "0020", wc: "WC-WELD", hrs: 1.5, text: "เชื่อมโครงโต๊ะ" },
    { op: "0030", wc: "WC-PAINT", hrs: 0.6, text: "พ่นสีฝุ่นและอบ" },
    { op: "0040", wc: "WC-ASM", hrs: 0.5, text: "ประกอบท็อปและบรรจุ" },
  ],
  "FG-5003": [
    { op: "0010", wc: "WC-CUT", hrs: 0.5, text: "ตัดแชสซี" },
    { op: "0020", wc: "WC-WELD", hrs: 2.0, text: "เชื่อมแชสซีและมือจับ" },
    { op: "0030", wc: "WC-ASM", hrs: 1.0, text: "ติดตั้งล้อ มอเตอร์ และทดสอบ" },
  ],
};

export const bomOf = (code: string): BomLine[] => BOM[code] ?? [];
export const routingOf = (code: string): RoutingOp[] => ROUTING[code] ?? [];

/** ความต้องการที่รับมา — ป้อน MRP */
export type Demand = { no: string; product: string; qty: number; dueDate: string; source: string };

export const DEMAND: Demand[] = [
  { no: "DM-0041", product: "FG-5001", qty: 40, dueDate: "2026-10-10", source: "ใบสั่งขายล่วงหน้า ตัวแทนภาคตะวันออก" },
  { no: "DM-0042", product: "FG-5002", qty: 25, dueDate: "2026-10-17", source: "ใบสั่งขายล่วงหน้า ลูกค้าขายตรง" },
  { no: "DM-0043", product: "FG-5003", qty: 12, dueDate: "2026-10-24", source: "ใบสั่งขายล่วงหน้า ลูกค้าขายตรง" },
  { no: "DM-0044", product: "FG-5002", qty: 30, dueDate: "2026-10-30", source: "งานประมูลเฟอร์นิเจอร์สำนักงาน" },
  { no: "DM-0045", product: "FG-5001", qty: 60, dueDate: "2026-11-06", source: "ประมาณการขายเดือน พ.ย." },
];

/* ------------------------------------------------------------ orders */

/** วางแผนไว้ → ปล่อยงานแล้ว → กำลังผลิต → ผลิตครบแล้ว → ปิดงานแล้ว · ยกเลิกได้ก่อนเริ่มเบิกหรือยืนยันงาน */
export type OrderStatus = "วางแผนไว้" | "ปล่อยงานแล้ว" | "กำลังผลิต" | "ผลิตครบแล้ว" | "ปิดงานแล้ว" | "ยกเลิก";

export const ORDER_FLOW: OrderStatus[] = ["วางแผนไว้", "ปล่อยงานแล้ว", "กำลังผลิต", "ผลิตครบแล้ว", "ปิดงานแล้ว"];
export const ORDER_STATUSES: OrderStatus[] = [...ORDER_FLOW, "ยกเลิก"];

/** วัสดุของใบสั่งหนึ่ง — คัดลอกจากสูตรตอนสร้างใบ แก้สูตรภายหลังจึงไม่กระทบใบที่เปิดไปแล้ว */
export type OrderComponent = { material: string; per: number; scrap: number; qty: number; issued: number };

export type ProductionOrder = {
  no: string;
  product: string;
  qty: number;
  start: string;
  due: string;
  /** จำนวนดีที่ยืนยันแล้วที่ขั้นตอนสุดท้าย */
  done: number;
  status: OrderStatus;
  /** จำนวนที่รับเข้าคลังสินค้าแล้ว */
  received: number;
  components: OrderComponent[];
  operations: RoutingOp[];
  /** ใบสั่งตามแผนที่แปลงมา */
  source?: string;
  releasedOn?: string;
  closedOn?: string;
  cancelReason?: string;
};

/** จำนวนวัสดุที่ต้องเบิกให้ใบสั่งหนึ่ง: ต่อหน่วย × จำนวน × (1 + เผื่อสูญเสีย) ปัดขึ้นเป็นหน่วยเต็ม */
export function requirement(per: number, qty: number, scrap: number) {
  return Math.ceil(Math.round(per * qty * (1 + scrap / 100) * 1000) / 1000);
}

function componentsFor(product: string, qty: number, issued: boolean): OrderComponent[] {
  return bomOf(product).map((l) => {
    const need = requirement(l.qty, qty, l.scrap);
    return { material: l.material, per: l.qty, scrap: l.scrap, qty: need, issued: issued ? need : 0 };
  });
}

const operationsFor = (product: string): RoutingOp[] => routingOf(product).map((r) => ({ ...r }));

export const ORDERS: ProductionOrder[] = [
  {
    no: "PO-P-3301", product: "FG-5001", qty: 40, start: "2026-09-14", due: "2026-10-10", done: 28, status: "กำลังผลิต",
    received: 28, components: componentsFor("FG-5001", 40, true), operations: operationsFor("FG-5001"), releasedOn: "2026-09-12",
  },
  {
    no: "PO-P-3302", product: "FG-5002", qty: 25, start: "2026-10-05", due: "2026-10-17", done: 0, status: "ปล่อยงานแล้ว",
    received: 0, components: componentsFor("FG-5002", 25, true), operations: operationsFor("FG-5002"), releasedOn: "2026-09-21",
  },
  {
    no: "PO-P-3303", product: "FG-5003", qty: 12, start: "2026-10-14", due: "2026-10-24", done: 0, status: "วางแผนไว้",
    received: 0, components: componentsFor("FG-5003", 12, false), operations: operationsFor("FG-5003"),
  },
  {
    no: "PO-P-3298", product: "FG-5001", qty: 30, start: "2026-09-08", due: "2026-09-19", done: 30, status: "ปิดงานแล้ว",
    received: 30, components: componentsFor("FG-5001", 30, true), operations: operationsFor("FG-5001"),
    releasedOn: "2026-09-07", closedOn: "2026-09-19",
  },
  {
    no: "PO-P-3299", product: "FG-5002", qty: 18, start: "2026-09-10", due: "2026-09-20", done: 16, status: "ปิดงานแล้ว",
    received: 16, components: componentsFor("FG-5002", 18, true), operations: operationsFor("FG-5002"),
    releasedOn: "2026-09-09", closedOn: "2026-09-21",
  },
];

/** การยืนยันงานหนึ่งครั้ง — ขั้นตอนไหน ได้ของดีเท่าไร เสียเท่าไร ใช้ชั่วโมงจริงเท่าไร */
export type Confirmation = {
  no: string; date: string; order: string; op: string; wc: string;
  yield: number; scrap: number; hrs: number; note: string;
};

export const CONFIRMATIONS: Confirmation[] = [
  { no: "CF-2569-0201", date: "2026-09-09", order: "PO-P-3298", op: "0010", wc: "WC-CUT", yield: 30, scrap: 0, hrs: 19, note: "" },
  { no: "CF-2569-0202", date: "2026-09-12", order: "PO-P-3298", op: "0020", wc: "WC-WELD", yield: 30, scrap: 0, hrs: 37.5, note: "" },
  { no: "CF-2569-0203", date: "2026-09-16", order: "PO-P-3298", op: "0030", wc: "WC-PAINT", yield: 30, scrap: 0, hrs: 15.5, note: "" },
  { no: "CF-2569-0204", date: "2026-09-18", order: "PO-P-3298", op: "0040", wc: "WC-ASM", yield: 30, scrap: 0, hrs: 12, note: "" },
  { no: "CF-2569-0205", date: "2026-09-11", order: "PO-P-3299", op: "0010", wc: "WC-CUT", yield: 18, scrap: 0, hrs: 15, note: "" },
  { no: "CF-2569-0206", date: "2026-09-14", order: "PO-P-3299", op: "0020", wc: "WC-WELD", yield: 16, scrap: 2, hrs: 29, note: "รอยเชื่อมขาโต๊ะร้าว ตรวจไม่ผ่าน" },
  { no: "CF-2569-0207", date: "2026-09-17", order: "PO-P-3299", op: "0030", wc: "WC-PAINT", yield: 16, scrap: 0, hrs: 10, note: "" },
  { no: "CF-2569-0208", date: "2026-09-19", order: "PO-P-3299", op: "0040", wc: "WC-ASM", yield: 16, scrap: 0, hrs: 8.5, note: "" },
  { no: "CF-2569-0209", date: "2026-09-15", order: "PO-P-3301", op: "0010", wc: "WC-CUT", yield: 40, scrap: 0, hrs: 25, note: "" },
  { no: "CF-2569-0210", date: "2026-09-18", order: "PO-P-3301", op: "0020", wc: "WC-WELD", yield: 34, scrap: 0, hrs: 42.5, note: "" },
  { no: "CF-2569-0211", date: "2026-09-21", order: "PO-P-3301", op: "0030", wc: "WC-PAINT", yield: 30, scrap: 0, hrs: 15, note: "" },
  { no: "CF-2569-0212", date: "2026-09-22", order: "PO-P-3301", op: "0040", wc: "WC-ASM", yield: 28, scrap: 0, hrs: 11.5, note: "" },
];

/**
 * เอกสารเบิกวัสดุเข้าใบสั่งผลิตและรับสินค้าเข้าคลังของฝ่ายผลิต
 *
 * สต็อกเป็นของคลังวัสดุ โมดูลนี้จึงไม่เขียนตัวเลขนั้นเอง แต่ลงผ่านฟังก์ชันเคลื่อนไหวสต็อก
 * ของคลังวัสดุ แล้วเก็บเลขที่เอกสารฝั่งคลัง (`stockDocs`) ไว้อ้างอิงกลับ
 */
export type GoodsMovement = {
  no: string; date: string; order: string; kind: "เบิกวัสดุ" | "รับเข้าคลัง";
  lines: { material: string; qty: number }[];
  stockDocs: string[];
};

export const PP_MOVEMENTS: GoodsMovement[] = [];

/* --------------------------------------------------------------- mrp */

export type PlannedOrder = {
  no: string; run: string; product: string; qty: number; start: string; due: string;
  demand: string; status: "ตามแผน" | "แปลงเป็นใบสั่งผลิตแล้ว"; order?: string;
};

/**
 * ข้อเสนอซื้อจาก MRP — เป็นเอกสารของฝ่ายวางแผน ไม่ใช่ใบขอซื้อ
 * ส่งให้ฝ่ายจัดซื้อพิจารณาเปิดใบขอซื้อในโมดูลจัดซื้อเอง
 */
export type PurchaseProposal = {
  no: string; run: string; material: string; qty: number; needBy: string;
  status: "เสนอซื้อ" | "ส่งฝ่ายจัดซื้อแล้ว"; sentOn?: string;
};

export type MrpRun = { no: string; date: string; planned: number; proposals: number };

export const MRP_RUNS: MrpRun[] = [{ no: "MRP-2569-011", date: "2026-09-21", planned: 2, proposals: 1 }];

export const PLANNED_ORDERS: PlannedOrder[] = [
  { no: "PLN-0107", run: "MRP-2569-011", product: "FG-5001", qty: 54, start: "2026-10-26", due: "2026-11-06", demand: "DM-0045", status: "ตามแผน" },
  { no: "PLN-0108", run: "MRP-2569-011", product: "FG-5002", qty: 18, start: "2026-10-24", due: "2026-10-30", demand: "DM-0044", status: "ตามแผน" },
];

export const PURCHASE_PROPOSALS: PurchaseProposal[] = [
  { no: "SUG-0107", run: "MRP-2569-011", material: "MAT-1002", qty: 406, needBy: "2026-10-14", status: "เสนอซื้อ" },
];

/* ------------------------------------------------------------ lookups */

export const product = (code: string) => material(code);

export const workCenter = (code: string) => {
  const w = WORK_CENTERS.find((x) => x.code === code);
  if (!w) throw new Error(`ไม่รู้จักศูนย์งาน ${code}`);
  return w;
};

export const orderByNo = (no: string) => {
  const o = ORDERS.find((x) => x.no === no);
  if (!o) throw new Error(`ไม่พบใบสั่งผลิต ${no}`);
  return o;
};

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** เลขที่เอกสารถัดไป ต่อจากเลขสูงสุดที่ออกไปแล้วในชุดเดียวกัน */
function nextNo(existing: string[], prefix: string, width: number) {
  const top = existing
    .filter((n) => n.startsWith(prefix))
    .reduce((max, n) => Math.max(max, Number(n.slice(prefix.length))), 0);
  return prefix + String(top + 1).padStart(width, "0");
}

export const nextOrderNo = () => nextNo(ORDERS.map((o) => o.no), "PO-P-", 4);

/** เอาออกจาก array เดิม — ไม่สร้าง array ใหม่ เพราะหน้าจออื่นถือตัวเดิมไว้ */
function removeWhere<T>(list: T[], drop: (x: T) => boolean) {
  for (let i = list.length - 1; i >= 0; i--) if (drop(list[i])) list.splice(i, 1);
}

/* ------------------------------------------------------------- status */

const OPEN: OrderStatus[] = ["วางแผนไว้", "ปล่อยงานแล้ว", "กำลังผลิต", "ผลิตครบแล้ว"];
const RELEASED: OrderStatus[] = ["ปล่อยงานแล้ว", "กำลังผลิต", "ผลิตครบแล้ว"];

export const isOpen = (o: ProductionOrder) => OPEN.includes(o.status);
export const isReleased = (o: ProductionOrder) => RELEASED.includes(o.status);

export const confirmationsOf = (o: ProductionOrder) => CONFIRMATIONS.filter((c) => c.order === o.no);
export const movementsOf = (o: ProductionOrder) => PP_MOVEMENTS.filter((m) => m.order === o.no);

/** ยอดยืนยันสะสมของขั้นตอนหนึ่ง */
export function progressOf(o: ProductionOrder, op: string) {
  return CONFIRMATIONS.filter((c) => c.order === o.no && c.op === op).reduce(
    (n, c) => ({ yield: n.yield + c.yield, scrap: n.scrap + c.scrap, hrs: n.hrs + c.hrs }),
    { yield: 0, scrap: 0, hrs: 0 }
  );
}

/** ของที่ส่งเข้าขั้นตอนนี้ได้แล้ว = ของดีจากขั้นก่อนหน้า (ขั้นแรกคือจำนวนสั่งผลิต) */
export function inputOf(o: ProductionOrder, index: number) {
  return index === 0 ? o.qty : progressOf(o, o.operations[index - 1].op).yield;
}

/** ของที่ยังต้องผ่านขั้นนี้ = จำนวนสั่ง − ของเสียที่ทิ้งไปก่อนถึงขั้นนี้ − ที่ขั้นนี้ยืนยันแล้ว */
export function remainingAt(o: ProductionOrder, index: number) {
  const before = o.operations.slice(0, index).reduce((n, r) => n + progressOf(o, r.op).scrap, 0);
  const here = progressOf(o, o.operations[index].op);
  return Math.max(0, o.qty - before - here.yield - here.scrap);
}

export const scrapOf = (o: ProductionOrder) => o.operations.reduce((n, r) => n + progressOf(o, r.op).scrap, 0);

/** สินค้าที่ใบนี้จะส่งเข้าคลังได้อีก — ใช้เป็นของที่กำลังจะเข้าในการวางแผน */
export const openOutput = (o: ProductionOrder) => (isOpen(o) ? Math.max(0, o.qty - scrapOf(o) - o.received) : 0);

/** ศูนย์งานอื่นที่ทำงานแบบเดียวกัน — ที่ที่ย้ายขั้นตอนนี้ไปได้ */
export const alternativesFor = (wc: string) =>
  WORK_CENTERS.filter((w) => w.kind === workCenter(wc).kind && w.code !== wc);

/** ปุ่มไหนกดได้กับใบสั่งผลิตสถานะนี้ — หน้าจอและฟังก์ชันบันทึกอ่านกฎชุดเดียวกัน */
export const can = {
  edit: (o: ProductionOrder) => o.status === "วางแผนไว้",
  release: (o: ProductionOrder) => o.status === "วางแผนไว้",
  issue: (o: ProductionOrder) => isReleased(o) && o.components.some((c) => c.issued < c.qty),
  confirm: (o: ProductionOrder) => o.status === "ปล่อยงานแล้ว" || o.status === "กำลังผลิต",
  receive: (o: ProductionOrder) => isReleased(o) && o.done > o.received,
  complete: (o: ProductionOrder) => isReleased(o),
  cancel: (o: ProductionOrder) =>
    o.status === "วางแผนไว้" ||
    (o.status === "ปล่อยงานแล้ว" && o.components.every((c) => c.issued === 0) && confirmationsOf(o).length === 0),
  reschedule: (o: ProductionOrder) => o.status === "วางแผนไว้" || o.status === "ปล่อยงานแล้ว" || o.status === "กำลังผลิต",
  move: (o: ProductionOrder) =>
    can.reschedule(o) &&
    o.operations.some((r) => progressOf(o, r.op).yield + progressOf(o, r.op).scrap === 0 && alternativesFor(r.wc).length > 0),
};

/* -------------------------------------------------------------- stock */

/** สต็อกในคลัง — ตัวเลขของคลังวัสดุ การเบิกและรับเข้าของฝ่ายผลิตลงที่นั่นแล้ว */
export const stockOf = (code: string) => material(code).stock;

/** ของที่กำลังมา — นิยามเดียวกับที่คลังวัสดุใช้วางแผนสั่งเติม: ค้างรับในใบสั่งซื้อบวกใบขอซื้อที่ยังไม่แปลง */
export const onOrderOf = (code: string) => onOrderQty(code);

/** ข้อเสนอซื้อที่ส่งให้ฝ่ายจัดซื้อแล้ว — นับเป็นของที่กำลังจะมา เพื่อไม่เสนอซ้ำ */
export const proposedOf = (code: string) =>
  PURCHASE_PROPOSALS.filter((p) => p.material === code && p.status === "ส่งฝ่ายจัดซื้อแล้ว").reduce((n, p) => n + p.qty, 0);

/**
 * ตรวจวัสดุก่อนปล่อยงาน: ของที่ยังต้องเบิกให้ใบนี้ เทียบสต็อกหักส่วนที่ใบอื่นที่ปล่อยงานแล้ว
 * จองไว้ ขาดแม้แต่รายการเดียวคือปล่อยงานไม่ได้ — สายการผลิตจะหยุดกลางทาง
 */
export function availabilityOf(o: ProductionOrder) {
  return o.components.map((c) => {
    const open = c.qty - c.issued;
    const reserved = ORDERS.filter((x) => x !== o && isReleased(x)).reduce(
      (n, x) => n + x.components.filter((k) => k.material === c.material).reduce((a, k) => a + (k.qty - k.issued), 0),
      0
    );
    const stock = stockOf(c.material);
    const available = stock - reserved;
    return { ...c, open, stock, reserved, available, short: Math.max(0, open - Math.max(0, available)) };
  });
}

/* ------------------------------------------------------------ figures */

/** ต้นทุนต่อหน่วย = วัสดุตามสูตร (รวมเผื่อสูญเสีย) + ค่าแรงตามขั้นตอน */
export function unitCost(code: string) {
  const mat = bomOf(code).reduce((n, l) => n + l.qty * (1 + l.scrap / 100) * material(l.material).price, 0);
  const lab = routingOf(code).reduce((n, r) => n + r.hrs * workCenter(r.wc).costPerHr, 0);
  return { material: mat, labour: lab, total: mat + lab };
}

/**
 * ต้นทุนของใบสั่งผลิต: วัสดุที่เบิกจริงตามราคาในแฟ้มวัสดุ บวกชั่วโมงที่ยืนยันจริงคูณอัตราศูนย์งาน
 * เทียบกับต้นทุนมาตรฐานของจำนวนที่รับเข้าคลัง — ผลต่าง = จริง − มาตรฐาน บวกคือใช้เกิน
 */
export function costOf(o: ProductionOrder) {
  const mat = o.components.reduce((n, c) => n + c.issued * material(c.material).price, 0);
  const lab = confirmationsOf(o).reduce((n, c) => n + c.hrs * workCenter(c.wc).costPerHr, 0);
  const actual = mat + lab;
  const standard = o.received * material(o.product).price;
  return { material: mat, labour: lab, actual, standard, planned: o.qty * material(o.product).price, variance: actual - standard };
}

/** รอบวางแผนกำลังการผลิต รอบละสองสัปดาห์ */
export type Bucket = { label: string; from: string; to: string };

export const BUCKETS: Bucket[] = [
  { label: "21 ก.ย. – 4 ต.ค.", from: "2026-09-21", to: "2026-10-04" },
  { label: "5 – 18 ต.ค.", from: "2026-10-05", to: "2026-10-18" },
  { label: "19 ต.ค. – 1 พ.ย.", from: "2026-10-19", to: "2026-11-01" },
  { label: "2 – 15 พ.ย.", from: "2026-11-02", to: "2026-11-15" },
];

/** รอบที่งานของใบสั่งผลิตตกอยู่ ตามวันเริ่มผลิต — งานที่ควรเริ่มไปแล้วนับเข้ารอบแรก */
export const bucketOf = (start: string) => BUCKETS.find((b) => start <= b.to);

/** ชั่วโมงที่เหลือของแต่ละขั้นตอนในใบหนึ่ง */
export const opLoadOf = (o: ProductionOrder) =>
  o.operations.map((r, i) => ({ ...r, left: remainingAt(o, i), load: r.hrs * remainingAt(o, i) }));

/** ชั่วโมงที่ศูนย์งานหนึ่งถูกจองในรอบหนึ่ง จากใบสั่งผลิตที่ยังไม่ปิด */
export function loadOf(code: string, bucket: Bucket = BUCKETS[0]) {
  return ORDERS.filter((o) => isOpen(o) && bucketOf(o.start) === bucket).reduce(
    (hrs, o) => hrs + opLoadOf(o).filter((r) => r.wc === code).reduce((n, r) => n + r.load, 0),
    0
  );
}

/** ศูนย์งานที่รับงานเกินกำลังในรอบใดรอบหนึ่ง */
export function overloads() {
  return BUCKETS.flatMap((b) =>
    WORK_CENTERS.map((w) => {
      const hrs = loadOf(w.code, b);
      return { bucket: b, w, hrs, pct: Math.round((hrs / w.capacityHrs) * 100) };
    }).filter((x) => x.pct > 100)
  );
}

/* ---------------------------------------------------------------- mrp */

/** วันเริ่มผลิตถอยจากวันส่ง: ขั้นตอนที่ช้าที่สุดทำวันละ 8 ชั่วโมง บวกเผื่อขนย้ายและตรวจ 2 วัน */
export function startFor(product: string, qty: number, due: string) {
  const slowest = Math.max(0, ...routingOf(product).map((r) => r.hrs));
  return addDays(due, -(Math.ceil((slowest * qty) / 8) + 2));
}

/**
 * ความต้องการแต่ละรายการได้รับการครอบคลุมหรือยัง เรียงตามวันส่ง
 * ของที่มี = สต็อกสินค้า + ที่ใบสั่งผลิตที่เปิดอยู่จะส่งเข้าคลังได้อีก ส่วนที่ไม่พอคือต้องผลิตเพิ่ม
 */
export function planFinished() {
  const out: { demand: Demand; covered: number; short: number; start: string }[] = [];
  for (const code of [...new Set(DEMAND.map((d) => d.product))]) {
    let available = stockOf(code) + ORDERS.filter((o) => o.product === code).reduce((n, o) => n + openOutput(o), 0);
    for (const d of DEMAND.filter((x) => x.product === code).sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
      const covered = Math.min(Math.max(0, available), d.qty);
      available -= covered;
      const short = d.qty - covered;
      out.push({ demand: d, covered, short, start: startFor(code, short, d.dueDate) });
    }
  }
  return out;
}

export type MrpRow = {
  code: string; name: string; unit: string; required: number; onHand: number; onOrder: number;
  proposed: number; shortage: number; price: number; needBy: string;
};

/**
 * กางสูตรการผลิตออกเป็นความต้องการวัสดุ แล้วหักของที่มีและของที่กำลังจะมา
 * ความต้องการมาจากสองทาง: วัสดุที่ใบสั่งผลิตที่เปิดอยู่ยังไม่ได้เบิก และสูตรของส่วนที่ต้องผลิตเพิ่ม
 * ที่เหลือคือของที่ต้องซื้อ — ตัวเลขเดียวกับที่ฝ่ายจัดซื้อเอาไปเปิดใบขอซื้อ
 */
export function runMrp(): MrpRow[] {
  const need: Record<string, { qty: number; needBy: string }> = {};
  const add = (code: string, qty: number, date: string) => {
    const at = date < TODAY ? TODAY : date;
    const cur = need[code];
    need[code] = { qty: (cur?.qty ?? 0) + qty, needBy: cur && cur.needBy < at ? cur.needBy : at };
  };
  for (const o of ORDERS.filter(isOpen)) {
    for (const c of o.components) if (c.qty > c.issued) add(c.material, c.qty - c.issued, o.start);
  }
  for (const p of planFinished().filter((x) => x.short > 0)) {
    for (const l of bomOf(p.demand.product)) add(l.material, requirement(l.qty, p.short, l.scrap), p.start);
  }
  return Object.entries(need).map(([code, n]) => {
    const m = material(code);
    const onHand = stockOf(code);
    const onOrder = onOrderOf(code);
    const proposed = proposedOf(code);
    return {
      code, name: m.name, unit: m.unit, required: n.qty, onHand, onOrder, proposed,
      shortage: Math.max(0, n.qty - onHand - onOrder - proposed), price: m.price, needBy: n.needBy,
    };
  });
}

/* ----------------------------------------------------------- mutations */

const positive = (n: number, what: string) => {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${what}ต้องมากกว่าศูนย์`);
};

/** รัน MRP: ใบสั่งตามแผนและข้อเสนอซื้อที่ยังไม่ได้ใช้ถูกแทนที่ด้วยผลรอบนี้ */
export function runMrpPlanning() {
  return commit(() => {
    const run = nextNo(MRP_RUNS.map((r) => r.no), "MRP-2569-", 3);
    removeWhere(PLANNED_ORDERS, (p) => p.status === "ตามแผน");
    removeWhere(PURCHASE_PROPOSALS, (p) => p.status === "เสนอซื้อ");
    const planned = planFinished()
      .filter((c) => c.short > 0)
      .map((c) => {
        const p: PlannedOrder = {
          no: nextNo(PLANNED_ORDERS.map((x) => x.no), "PLN-", 4), run, product: c.demand.product, qty: c.short,
          start: c.start, due: c.demand.dueDate, demand: c.demand.no, status: "ตามแผน",
        };
        PLANNED_ORDERS.push(p);
        return p;
      });
    const proposals = runMrp()
      .filter((r) => r.shortage > 0)
      .map((r) => {
        const s: PurchaseProposal = {
          no: nextNo(PURCHASE_PROPOSALS.map((x) => x.no), "SUG-", 4), run, material: r.code, qty: r.shortage,
          needBy: r.needBy, status: "เสนอซื้อ",
        };
        PURCHASE_PROPOSALS.push(s);
        return s;
      });
    const entry: MrpRun = { no: run, date: TODAY, planned: planned.length, proposals: proposals.length };
    MRP_RUNS.push(entry);
    return { run: entry, planned, proposals };
  });
}

export function addDemand(input: { product: string; qty: number; dueDate: string; source: string }) {
  positive(input.qty, "จำนวน");
  product(input.product);
  return commit(() => {
    const d: Demand = { no: nextNo(DEMAND.map((x) => x.no), "DM-", 4), ...input };
    DEMAND.push(d);
    return d;
  });
}

export function removeDemand(no: string) {
  if (!DEMAND.some((d) => d.no === no)) throw new Error(`ไม่พบความต้องการ ${no}`);
  commit(() => removeWhere(DEMAND, (d) => d.no === no));
}

/** ส่งข้อเสนอซื้อให้ฝ่ายจัดซื้อ — บันทึกว่าส่งแล้ว ฝ่ายจัดซื้อเปิดใบขอซื้อในโมดูลของตัวเอง */
export function sendProposals(nos: string[]) {
  const list = PURCHASE_PROPOSALS.filter((p) => nos.includes(p.no) && p.status === "เสนอซื้อ");
  if (list.length === 0) throw new Error("ไม่มีข้อเสนอซื้อที่รอส่ง");
  return commit(() => {
    for (const p of list) {
      p.status = "ส่งฝ่ายจัดซื้อแล้ว";
      p.sentOn = TODAY;
    }
    return list;
  });
}

export function removePlannedOrder(no: string) {
  const p = PLANNED_ORDERS.find((x) => x.no === no);
  if (!p || p.status !== "ตามแผน") throw new Error(`ลบใบสั่งตามแผน ${no} ไม่ได้`);
  commit(() => removeWhere(PLANNED_ORDERS, (x) => x.no === no));
}

export type OrderInput = { product: string; qty: number; start: string; due: string };

function checkOrder(input: OrderInput) {
  positive(input.qty, "จำนวนผลิต");
  if (!Number.isInteger(input.qty)) throw new Error("จำนวนผลิตต้องเป็นจำนวนเต็ม");
  if (input.due < input.start) throw new Error("วันส่งต้องไม่ก่อนวันเริ่มผลิต");
  if (bomOf(input.product).length === 0) throw new Error(`${product(input.product).name} ยังไม่มีสูตรการผลิต`);
  if (routingOf(input.product).length === 0) throw new Error(`${product(input.product).name} ยังไม่มีขั้นตอนการผลิต`);
}

/** เปิดใบสั่งผลิต — คัดลอกสูตรและขั้นตอน ณ วันนี้ไว้ในใบ */
export function createOrder(input: OrderInput, source?: string) {
  checkOrder(input);
  return commit(() => {
    const o: ProductionOrder = {
      no: nextOrderNo(), ...input, done: 0, status: "วางแผนไว้", received: 0,
      components: componentsFor(input.product, input.qty, false), operations: operationsFor(input.product),
      ...(source ? { source } : {}),
    };
    ORDERS.push(o);
    return o;
  });
}

/** แปลงใบสั่งตามแผนเป็นใบสั่งผลิต ปรับจำนวนและวันได้ก่อนแปลง */
export function convertPlannedOrder(no: string, input: { qty: number; start: string; due: string }) {
  const p = PLANNED_ORDERS.find((x) => x.no === no);
  if (!p || p.status !== "ตามแผน") throw new Error(`ใบสั่งตามแผน ${no} แปลงไปแล้วหรือไม่มีอยู่`);
  return commit(() => {
    const o = createOrder({ product: p.product, ...input }, p.no);
    p.status = "แปลงเป็นใบสั่งผลิตแล้ว";
    p.order = o.no;
    return o;
  });
}

/** แก้จำนวนและวันของใบที่ยังไม่ปล่อยงาน — วัสดุคิดใหม่ตามอัตราที่คัดลอกไว้ในใบ */
export function updateOrder(no: string, input: { qty: number; start: string; due: string }) {
  const o = orderByNo(no);
  if (!can.edit(o)) throw new Error(`${no} ปล่อยงานไปแล้ว แก้จำนวนไม่ได้`);
  checkOrder({ product: o.product, ...input });
  return commit(() => {
    o.qty = input.qty;
    o.start = input.start;
    o.due = input.due;
    for (const c of o.components) c.qty = requirement(c.per, input.qty, c.scrap);
    return o;
  });
}

/** เลื่อนวันผลิต — ชั่วโมงของใบย้ายไปอยู่รอบวางแผนของวันเริ่มใหม่ */
export function rescheduleOrder(no: string, start: string, due: string) {
  const o = orderByNo(no);
  if (!can.reschedule(o)) throw new Error(`${no} สถานะ${o.status} เลื่อนวันไม่ได้`);
  if (due < start) throw new Error("วันส่งต้องไม่ก่อนวันเริ่มผลิต");
  return commit(() => {
    o.start = start;
    o.due = due;
    return o;
  });
}

/** ย้ายขั้นตอนที่ยังไม่เริ่มไปศูนย์งานอื่นที่ทำงานแบบเดียวกัน */
export function moveOperation(no: string, op: string, wc: string) {
  const o = orderByNo(no);
  const step = o.operations.find((r) => r.op === op);
  if (!step) throw new Error(`${no} ไม่มีขั้นตอน ${op}`);
  if (!can.reschedule(o)) throw new Error(`${no} สถานะ${o.status} ย้ายศูนย์งานไม่ได้`);
  const p = progressOf(o, op);
  if (p.yield + p.scrap > 0) throw new Error(`ขั้นตอน ${op} เริ่มยืนยันงานไปแล้ว ย้ายศูนย์งานไม่ได้`);
  if (!alternativesFor(step.wc).some((w) => w.code === wc)) {
    throw new Error(`${workCenter(wc).name} ทำงานแบบ${workCenter(wc).kind} แทน${workCenter(step.wc).name}ไม่ได้`);
  }
  return commit(() => {
    step.wc = wc;
    return o;
  });
}

/** ปล่อยงาน — ปฏิเสธถ้าวัสดุไม่พอ */
export function releaseOrder(no: string) {
  const o = orderByNo(no);
  if (!can.release(o)) throw new Error(`${no} สถานะ${o.status} ปล่อยงานซ้ำไม่ได้`);
  const short = availabilityOf(o).filter((a) => a.short > 0);
  if (short.length > 0) {
    throw new Error(
      `วัสดุไม่พอปล่อยงาน ${no}: ` + short.map((s) => `${material(s.material).name} ขาด ${s.short} ${material(s.material).unit}`).join(", ")
    );
  }
  return commit(() => {
    o.status = "ปล่อยงานแล้ว";
    o.releasedOn = TODAY;
    return o;
  });
}

/** เบิกวัสดุเข้าใบสั่งผลิต — ไม่เกินที่ยังค้างเบิก และไม่เกินของที่มีในคลัง */
export function issueComponents(no: string, lines: { material: string; qty: number }[], date = TODAY) {
  const o = orderByNo(no);
  if (!can.issue(o)) throw new Error(`${no} สถานะ${o.status} เบิกวัสดุไม่ได้`);
  const real = lines.filter((l) => l.qty > 0);
  if (real.length === 0) throw new Error("ใส่จำนวนเบิกอย่างน้อยหนึ่งรายการ");
  for (const l of real) {
    const c = o.components.find((k) => k.material === l.material);
    if (!c) throw new Error(`${l.material} ไม่อยู่ในใบสั่งผลิต ${no}`);
    if (l.qty > c.qty - c.issued) throw new Error(`${material(l.material).name} เบิกได้อีกไม่เกิน ${c.qty - c.issued}`);
    if (l.qty > stockOf(l.material)) throw new Error(`${material(l.material).name} มีในคลังเพียง ${stockOf(l.material)}`);
  }
  return commit(() => {
    const docNo = nextNo(PP_MOVEMENTS.map((m) => m.no), "GI-P-", 4);
    const stockDocs = real.map(
      (l) =>
        postStockMove({
          kind: "เบิกใช้", material: l.material, qty: l.qty, department: "ฝ่ายผลิต", date,
          reason: `เบิกเข้าใบสั่งผลิต ${no} ตามใบเบิก ${docNo}`,
        }).doc ?? ""
    );
    const mv: GoodsMovement = {
      no: docNo, date, order: no, kind: "เบิกวัสดุ", lines: real.map((l) => ({ material: l.material, qty: l.qty })), stockDocs,
    };
    PP_MOVEMENTS.push(mv);
    for (const l of real) o.components.find((k) => k.material === l.material)!.issued += l.qty;
    return mv;
  });
}

/**
 * ยืนยันงานหนึ่งขั้นตอน — ของดีกับของเสียรวมกันต้องไม่เกินของที่ส่งเข้าขั้นนี้ได้
 * ใบเริ่มผลิตเมื่อยืนยันครั้งแรก และผลิตครบเมื่อทุกหน่วยผ่านขั้นสุดท้ายหรือถูกคัดทิ้ง
 */
export function confirmOperation(
  no: string,
  input: { op: string; yield: number; scrap: number; hrs: number; note: string; date?: string }
) {
  const o = orderByNo(no);
  if (!can.confirm(o)) throw new Error(`${no} สถานะ${o.status} ยืนยันงานไม่ได้`);
  const index = o.operations.findIndex((r) => r.op === input.op);
  if (index < 0) throw new Error(`${no} ไม่มีขั้นตอน ${input.op}`);
  if (input.yield < 0 || input.scrap < 0 || !Number.isInteger(input.yield) || !Number.isInteger(input.scrap)) {
    throw new Error("จำนวนดีและจำนวนเสียต้องเป็นจำนวนเต็มไม่ติดลบ");
  }
  positive(input.yield + input.scrap, "จำนวนที่ยืนยัน");
  positive(input.hrs, "ชั่วโมงทำงาน");
  const here = progressOf(o, input.op);
  const room = inputOf(o, index) - here.yield - here.scrap;
  if (input.yield + input.scrap > room) throw new Error(`ขั้นตอน ${input.op} ยืนยันได้อีกไม่เกิน ${room} หน่วย`);
  if (input.scrap > 0 && input.note.trim() === "") throw new Error("ระบุสาเหตุของเสีย");
  return commit(() => {
    const cf: Confirmation = {
      no: nextNo(CONFIRMATIONS.map((c) => c.no), "CF-2569-", 4), date: input.date ?? TODAY, order: no,
      op: input.op, wc: o.operations[index].wc, yield: input.yield, scrap: input.scrap, hrs: input.hrs, note: input.note.trim(),
    };
    CONFIRMATIONS.push(cf);
    const last = o.operations[o.operations.length - 1];
    o.done = progressOf(o, last.op).yield;
    o.status = o.done + scrapOf(o) >= o.qty ? "ผลิตครบแล้ว" : "กำลังผลิต";
    return cf;
  });
}

/** รับสินค้าที่ผลิตเสร็จเข้าคลัง — ได้ไม่เกินของดีที่ยืนยันแล้วแต่ยังไม่รับ */
export function receiveOutput(no: string, qty: number, date = TODAY) {
  const o = orderByNo(no);
  if (!can.receive(o)) throw new Error(`${no} ไม่มีของดีที่รอรับเข้าคลัง`);
  positive(qty, "จำนวนรับเข้า");
  if (qty > o.done - o.received) throw new Error(`รับเข้าได้อีกไม่เกิน ${o.done - o.received}`);
  return commit(() => {
    const docNo = nextNo(PP_MOVEMENTS.map((m) => m.no), "GR-P-", 4);
    // คลังวัสดุยังไม่มีประเภทรับจากการผลิต จึงลงเป็นการรับเพิ่มพร้อมอ้างใบสั่งผลิต
    const move = postStockMove({
      kind: "ปรับยอดเพิ่ม", material: o.product, qty, department: "ฝ่ายผลิต", date,
      reason: `รับสินค้าผลิตเสร็จจากใบสั่งผลิต ${no} ตามใบรับ ${docNo}`,
    });
    const mv: GoodsMovement = {
      no: docNo, date, order: no, kind: "รับเข้าคลัง", lines: [{ material: o.product, qty }], stockDocs: [move.doc ?? ""],
    };
    PP_MOVEMENTS.push(mv);
    o.received += qty;
    return mv;
  });
}

/** ปิดงานทางเทคนิค — ของดีทุกหน่วยต้องรับเข้าคลังแล้ว ส่วนที่ยังไม่ผลิตหลุดจากแผน */
export function completeOrder(no: string) {
  const o = orderByNo(no);
  if (!can.complete(o)) throw new Error(`${no} สถานะ${o.status} ปิดงานไม่ได้`);
  if (o.received < o.done) throw new Error(`รับสินค้าเข้าคลังอีก ${o.done - o.received} หน่วยก่อนปิดงาน`);
  return commit(() => {
    o.status = "ปิดงานแล้ว";
    o.closedOn = TODAY;
    return o;
  });
}

/** ยกเลิกใบสั่งผลิตที่ยังไม่เบิกวัสดุหรือยืนยันงาน */
export function cancelOrder(no: string, reason: string) {
  const o = orderByNo(no);
  if (!can.cancel(o)) throw new Error(`${no} เริ่มเบิกวัสดุหรือยืนยันงานแล้ว ยกเลิกไม่ได้ ให้ปิดงานแทน`);
  if (reason.trim() === "") throw new Error("ระบุเหตุผลที่ยกเลิก");
  return commit(() => {
    o.status = "ยกเลิก";
    o.cancelReason = reason.trim();
    o.closedOn = TODAY;
    return o;
  });
}

/* -------------------------------------------------------- master data */

function checkBomLine(line: BomLine) {
  const m = material(line.material);
  if (m.group === "สินค้าสำเร็จรูป") throw new Error(`${m.name} เป็นสินค้าสำเร็จรูป ใส่ในสูตรไม่ได้`);
  positive(line.qty, "ปริมาณต่อหน่วย");
  if (!(line.scrap >= 0 && line.scrap < 100)) throw new Error("เผื่อสูญเสียต้องอยู่ระหว่าง 0 ถึงน้อยกว่า 100%");
}

export function addBomLine(productCode: string, line: BomLine) {
  product(productCode);
  checkBomLine(line);
  if (bomOf(productCode).some((l) => l.material === line.material)) {
    throw new Error(`${material(line.material).name} อยู่ในสูตรแล้ว ให้แก้บรรทัดเดิม`);
  }
  return commit(() => {
    const entry = { ...line };
    if (BOM[productCode]) BOM[productCode].push(entry);
    else BOM[productCode] = [entry];
    return entry;
  });
}

export function updateBomLine(productCode: string, materialCode: string, patch: { qty: number; scrap: number }) {
  const l = bomOf(productCode).find((x) => x.material === materialCode);
  if (!l) throw new Error(`สูตร ${productCode} ไม่มี ${materialCode}`);
  checkBomLine({ material: materialCode, ...patch });
  return commit(() => {
    l.qty = patch.qty;
    l.scrap = patch.scrap;
    return l;
  });
}

export function removeBomLine(productCode: string, materialCode: string) {
  if (!bomOf(productCode).some((x) => x.material === materialCode)) throw new Error(`สูตร ${productCode} ไม่มี ${materialCode}`);
  commit(() => removeWhere(BOM[productCode], (x) => x.material === materialCode));
}

function checkOperation(input: { wc: string; hrs: number; text: string }) {
  workCenter(input.wc);
  positive(input.hrs, "ชั่วโมงต่อหน่วย");
  if (input.text.trim().length < 3) throw new Error("อธิบายงานของขั้นตอนนี้");
}

/** เพิ่มขั้นตอนต่อท้าย เลขขั้นตอนเว้นทีละ 10 เพื่อแทรกภายหลังได้ */
export function addOperation(productCode: string, input: { wc: string; hrs: number; text: string }) {
  product(productCode);
  checkOperation(input);
  return commit(() => {
    const top = routingOf(productCode).reduce((max, r) => Math.max(max, Number(r.op)), 0);
    const op: RoutingOp = { op: String(top + 10).padStart(4, "0"), wc: input.wc, hrs: input.hrs, text: input.text.trim() };
    if (ROUTING[productCode]) ROUTING[productCode].push(op);
    else ROUTING[productCode] = [op];
    return op;
  });
}

export function updateOperation(productCode: string, op: string, input: { wc: string; hrs: number; text: string }) {
  const r = routingOf(productCode).find((x) => x.op === op);
  if (!r) throw new Error(`ขั้นตอน ${op} ไม่มีใน ${productCode}`);
  checkOperation(input);
  return commit(() => {
    r.wc = input.wc;
    r.hrs = input.hrs;
    r.text = input.text.trim();
    return r;
  });
}

export function removeOperation(productCode: string, op: string) {
  if (!routingOf(productCode).some((x) => x.op === op)) throw new Error(`ขั้นตอน ${op} ไม่มีใน ${productCode}`);
  commit(() => removeWhere(ROUTING[productCode], (x) => x.op === op));
}

export function addWorkCenter(input: WorkCenter) {
  if (!/^WC-[A-Z0-9]+$/.test(input.code)) throw new Error("รหัสศูนย์งานต้องขึ้นต้นด้วย WC- ตามด้วยตัวพิมพ์ใหญ่หรือตัวเลข");
  if (WORK_CENTERS.some((w) => w.code === input.code)) throw new Error(`มีศูนย์งาน ${input.code} แล้ว`);
  if (input.name.trim().length < 2) throw new Error("ตั้งชื่อศูนย์งาน");
  positive(input.capacityHrs, "กำลังการผลิต");
  positive(input.costPerHr, "อัตราค่าแรง");
  return commit(() => {
    const w = { ...input, name: input.name.trim() };
    WORK_CENTERS.push(w);
    return w;
  });
}

export function updateWorkCenter(code: string, patch: { name: string; capacityHrs: number; costPerHr: number }) {
  const w = workCenter(code);
  if (patch.name.trim().length < 2) throw new Error("ตั้งชื่อศูนย์งาน");
  positive(patch.capacityHrs, "กำลังการผลิต");
  positive(patch.costPerHr, "อัตราค่าแรง");
  return commit(() => {
    w.name = patch.name.trim();
    w.capacityHrs = patch.capacityHrs;
    w.costPerHr = patch.costPerHr;
    return w;
  });
}
