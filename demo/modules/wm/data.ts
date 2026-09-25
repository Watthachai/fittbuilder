import { commit } from "../kit";
import { GOODS_RECEIPTS, MATERIALS, TODAY, material, nextNumber } from "../mm/data";

/** ปี พ.ศ. ของวันนี้ — ส่วนกลางของเลขเอกสาร เช่น GI-2569-001 */
const YEAR = Number(TODAY.slice(0, 4)) + 543;

/** ผังคลัง — เลขคลัง → ประเภทพื้นที่ → ช่องเก็บ ตามลำดับชั้นที่ SAP ใช้ */
export const WAREHOUSE = { code: "WH-01", name: "คลังกลาง บางพลี" };

export const STORAGE_TYPES = [
  { code: "REC", name: "พื้นที่รับของ", purpose: "พักของที่เพิ่งรับเข้า รอจัดเก็บ" },
  { code: "BLK", name: "พื้นที่เก็บกอง", purpose: "ของหนักปริมาณมาก หยิบเป็นพาเลท" },
  { code: "PCK", name: "พื้นที่หยิบของ", purpose: "ชั้นหยิบทีละชิ้น เติมของอัตโนมัติ" },
  { code: "SHP", name: "พื้นที่จ่ายออก", purpose: "พักของที่หยิบแล้ว รอขึ้นรถ" },
];

/** พื้นที่ที่เก็บของจริง — ท่ารับและท่าจ่ายเป็นที่พักระหว่างทาง ไม่ใช่ที่เก็บ */
export const STORABLE = ["BLK", "PCK"];

export type Bin = {
  code: string;
  type: string;
  maxKg: number;
  material: string | null;
  qty: number;
  kgPerUnit: number;
  /** วันที่ของล็อตที่เก่าที่สุดในช่อง — หยิบช่องที่เก่ากว่าก่อน (เข้าก่อนออกก่อน) */
  since: string | null;
};

/** ช่องเก็บแต่ละช่องมีเพดานน้ำหนักของตัวเอง — เกินคือห้ามจัดเก็บ */
export const BINS: Bin[] = [
  { code: "A-01-03", type: "BLK", maxKg: 2000, material: "MAT-1001", qty: 240, kgPerUnit: 7.2, since: "2026-07-15" },
  { code: "A-01-07", type: "BLK", maxKg: 2000, material: "MAT-1002", qty: 86, kgPerUnit: 8.9, since: "2026-09-03" },
  { code: "B-02-01", type: "BLK", maxKg: 1200, material: "MAT-1003", qty: 34, kgPerUnit: 18, since: "2026-08-08" },
  { code: "C-01-12", type: "PCK", maxKg: 300, material: "MAT-2001", qty: 18, kgPerUnit: 4.5, since: "2026-07-31" },
  { code: "C-02-04", type: "PCK", maxKg: 300, material: "MAT-2002", qty: 320, kgPerUnit: 0.11, since: "2026-08-28" },
  { code: "C-03-02", type: "PCK", maxKg: 300, material: "MAT-4001", qty: 6, kgPerUnit: 12, since: "2026-06-20" },
  { code: "D-01-01", type: "PCK", maxKg: 200, material: "MAT-3001", qty: 640, kgPerUnit: 0.08, since: "2026-07-31" },
  { code: "D-02-06", type: "BLK", maxKg: 800, material: "MAT-3002", qty: 1420, kgPerUnit: 0.25, since: "2026-06-10" },
  { code: "E-01-01", type: "BLK", maxKg: 2500, material: "FG-5001", qty: 34, kgPerUnit: 28, since: "2026-09-19" },
  { code: "E-01-04", type: "BLK", maxKg: 2500, material: "FG-5002", qty: 12, kgPerUnit: 41, since: "2026-09-20" },
  { code: "E-02-02", type: "BLK", maxKg: 2500, material: "FG-5003", qty: 5, kgPerUnit: 62, since: "2026-09-12" },
  { code: "A-02-01", type: "BLK", maxKg: 2000, material: null, qty: 0, kgPerUnit: 0, since: null },
  { code: "A-02-02", type: "BLK", maxKg: 2000, material: null, qty: 0, kgPerUnit: 0, since: null },
  { code: "C-03-05", type: "PCK", maxKg: 300, material: null, qty: 0, kgPerUnit: 0, since: null },
  { code: "REC-01", type: "REC", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0, since: null },
  { code: "REC-02", type: "REC", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0, since: null },
  { code: "SHP-01", type: "SHP", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0, since: null },
];

/** น้ำหนักต่อหน่วยของวัสดุ — คลังเป็นเจ้าของตัวเลขนี้ วัสดุใหม่ได้น้ำหนักตอนจัดเก็บครั้งแรก */
export const UNIT_WEIGHTS: Record<string, number> = {
  "MAT-1001": 7.2,
  "MAT-1002": 8.9,
  "MAT-1003": 18,
  "MAT-2001": 4.5,
  "MAT-2002": 0.11,
  "MAT-3001": 0.08,
  "MAT-3002": 0.25,
  "MAT-4001": 12,
  "FG-5001": 28,
  "FG-5002": 41,
  "FG-5003": 62,
};

export type PutawayTask = {
  no: string;
  material: string;
  qty: number;
  from: string;
  suggestBin: string;
  status: "รอจัดเก็บ" | "จัดเก็บแล้ว";
  /** ใบรับสินค้าจากจัดซื้อที่เป็นต้นเรื่อง */
  gr?: string;
  /** ช่องที่เก็บจริง — อาจไม่ใช่ช่องที่ระบบเสนอ */
  bin?: string;
  doneAt?: string;
};

/** ของที่มาถึงท่ารับ รอสั่งจัดเก็บเข้าช่อง */
export const INBOUND: PutawayTask[] = [
  { no: "TO-IN-4401", material: "MAT-1002", qty: 200, from: "REC-01", suggestBin: "A-01-07", status: "รอจัดเก็บ", gr: "GR-2569-206" },
  { no: "TO-IN-4402", material: "MAT-1003", qty: 14, from: "REC-01", suggestBin: "B-02-01", status: "รอจัดเก็บ", gr: "GR-2569-207" },
  { no: "TO-IN-4399", material: "MAT-2002", qty: 100, from: "REC-02", suggestBin: "C-02-04", status: "จัดเก็บแล้ว", bin: "C-02-04", doneAt: "2026-09-19" },
];

/** ใบรับสินค้าตั้งแต่วันนี้ไปต้องผ่านใบสั่งจัดเก็บ — ใบก่อนหน้านั้นเก็บเข้าช่องไปก่อนเปิดใช้ระบบคลัง */
export const PUTAWAY_SINCE = "2026-09-19";

export type PickTask = {
  no: string;
  ref: string;
  material: string;
  qty: number;
  bin: string;
  to: string;
  status: "รอหยิบ" | "หยิบแล้ว" | "จ่ายออกแล้ว";
  /** จำนวนที่หยิบได้จริง — น้อยกว่าที่สั่งคือหยิบขาด */
  picked?: number;
  /** ใบจ่ายสินค้าที่ตัดของออกจากคลัง */
  gi?: string;
};

/** งานหยิบของ — ไล่ตามลำดับช่องเพื่อไม่ต้องเดินย้อน */
export const PICKS: PickTask[] = [
  { no: "TO-PK-7712", ref: "DO-2569-0302", material: "FG-5003", qty: 6, bin: "E-02-02", to: "SHP-01", status: "รอหยิบ" },
  { no: "TO-PK-7711", ref: "DO-2569-0303", material: "FG-5001", qty: 3, bin: "E-01-01", to: "SHP-01", status: "หยิบแล้ว", picked: 3 },
  { no: "TO-PK-7710", ref: "PO-P-3301", material: "MAT-1001", qty: 40, bin: "A-01-03", to: "SHP-01", status: "หยิบแล้ว", picked: 40 },
  { no: "TO-PK-7713", ref: "PO-P-3301", material: "MAT-1002", qty: 114, bin: "A-01-07", to: "SHP-01", status: "รอหยิบ" },
];

export type GoodsIssue = { no: string; ref: string; date: string; lines: { material: string; qty: number }[] };

/** ใบจ่ายสินค้า — ของที่หยิบแล้วออกจากคลังไปตามเอกสารต้นเรื่อง */
export const GOODS_ISSUES: GoodsIssue[] = [];

export type Transfer = { no: string; material: string; qty: number; from: string; to: string; reason: string; date: string };

export const TRANSFERS: Transfer[] = [
  { no: "TO-MV-2201", material: "MAT-2002", qty: 80, from: "C-02-04", to: "D-02-06", reason: "ย้ายลงพื้นที่เก็บกอง ช่องหยิบเต็ม", date: "2026-09-19" },
  { no: "TO-MV-2202", material: "MAT-3001", qty: 200, from: "D-02-06", to: "D-01-01", reason: "เติมของเข้าช่องหยิบ", date: "2026-09-20" },
];

export type CountSheet = {
  no: string;
  date: string;
  scope: string;
  counter: string;
  status: "รอนับ" | "นับแล้ว";
  /** ช่องและวัสดุที่ต้องนับ — ใบนับไม่บอกจำนวนในระบบ ผู้นับต้องนับจริง */
  lines: { bin: string; material: string }[];
};

/** ใบตรวจนับ — ออกก่อนเดินนับ แล้วบันทึกผลกลับเข้ามา */
export const COUNT_SHEETS: CountSheet[] = [
  {
    no: "PI-2569-012", date: "2026-09-20", scope: "นับวนรอบ ช่องหยิบและสินค้าสำเร็จรูป", counter: "อนุชา", status: "นับแล้ว",
    lines: [
      { bin: "C-01-12", material: "MAT-2001" },
      { bin: "C-02-04", material: "MAT-2002" },
      { bin: "D-01-01", material: "MAT-3001" },
      { bin: "E-01-04", material: "FG-5002" },
    ],
  },
];

export type CountStatus = "ตรงกัน" | "รออนุมัติ" | "อนุมัติแล้ว" | "ปรับยอดแล้ว";

export type Count = {
  bin: string;
  material: string;
  system: number;
  counted: number;
  date: string;
  by: string;
  /** ใบตรวจนับที่เป็นต้นเรื่อง */
  doc: string;
  /** ผลต่างต้องอนุมัติก่อนปรับยอด — ตรงกันไม่ต้องทำอะไร */
  status: CountStatus;
  approvedBy?: string;
  /** สาเหตุของผลต่างที่ผู้อนุมัติยอมรับ */
  reason?: string;
  postedAt?: string;
};

/** ตรวจนับ — นับจริงเทียบกับที่ระบบบอก */
export const COUNTS: Count[] = [
  { bin: "C-01-12", material: "MAT-2001", system: 18, counted: 15, date: "2026-09-20", by: "อนุชา", doc: "PI-2569-012", status: "รออนุมัติ" },
  { bin: "C-02-04", material: "MAT-2002", system: 320, counted: 320, date: "2026-09-20", by: "อนุชา", doc: "PI-2569-012", status: "ตรงกัน" },
  { bin: "D-01-01", material: "MAT-3001", system: 640, counted: 652, date: "2026-09-21", by: "ธีรศักดิ์", doc: "PI-2569-012", status: "รออนุมัติ" },
  { bin: "E-01-04", material: "FG-5002", system: 12, counted: 12, date: "2026-09-21", by: "ธีรศักดิ์", doc: "PI-2569-012", status: "ตรงกัน" },
];

/** พนักงานคลังที่เดินนับได้ */
export const COUNTERS = ["อนุชา", "ธีรศักดิ์", "ณัฐพล"];

/** ผู้อนุมัติผลต่างจากการตรวจนับ — ต้องไม่ใช่คนที่นับช่องนั้นเอง */
export const COUNT_APPROVERS = [
  { name: "ธีรศักดิ์", role: "ผู้จัดการคลัง" },
  { name: "วิภาดา", role: "นักบัญชีอาวุโส" },
];

export const bin = (code: string) => {
  const b = BINS.find((x) => x.code === code);
  if (!b) throw new Error(`ไม่รู้จักช่องเก็บ ${code}`);
  return b;
};

export const storageType = (code: string) => {
  const t = STORAGE_TYPES.find((x) => x.code === code);
  if (!t) throw new Error(`ไม่รู้จักพื้นที่จัดเก็บ ${code}`);
  return t;
};

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

/** น้ำหนักที่ช่องรับอยู่ตอนนี้ เทียบเพดานของช่องนั้น */
export function binLoad(b: Bin) {
  const kg = b.qty * b.kgPerUnit;
  return { kg, pct: Math.round((kg / b.maxKg) * 100), full: kg > b.maxKg };
}

/** ช่องว่างในพื้นที่เดียวกันที่ยังรับน้ำหนักไหว — ใช้เสนอที่จัดเก็บ */
export function freeBins(typeCode: string) {
  return BINS.filter((b) => b.type === typeCode && (!b.material || binLoad(b).pct < 80));
}

export const variance = (c: Count) => c.counted - c.system;
export function varianceValue(c: Count) {
  return variance(c) * (material(c.material)?.price ?? 0);
}

/** ผลนับหนึ่งแถวระบุด้วยใบตรวจนับกับช่อง — ช่องเดียวนับได้หลายรอบ */
export const countKey = (c: Count) => `${c.doc}/${c.bin}`;

export const countOf = (doc: string, binCode: string) => {
  const c = COUNTS.find((x) => x.doc === doc && x.bin === binCode);
  if (!c) throw new Error(`ไม่พบผลนับ ${doc} ช่อง ${binCode}`);
  return c;
};

export const countSheet = (no: string) => {
  const s = COUNT_SHEETS.find((x) => x.no === no);
  if (!s) throw new Error(`ไม่พบใบตรวจนับ ${no}`);
  return s;
};

/** ข้อความผิดข้อแรก — ฟังก์ชันที่เปลี่ยนข้อมูลตรวจกฎชุดเดียวกับที่ฟอร์มแสดง */
function assertValid(problems: Record<string, string>) {
  const first = Object.values(problems)[0];
  if (first) throw new Error(first);
}

/** ช่องว่างลง: ไม่มีของก็ไม่มีวัสดุ ไม่มีน้ำหนัก ไม่มีวันที่ล็อต */
function emptyIfZero(b: Bin) {
  if (b.qty !== 0) return;
  b.material = null;
  b.kgPerUnit = 0;
  b.since = null;
}

/* ------------------------------------------------------------------ bins */

/** จองไว้ให้งานหยิบที่ยังไม่ได้หยิบ — ย้ายหรือหยิบซ้ำจากส่วนนี้ไม่ได้ */
export const reservedIn = (b: Bin) => PICKS.filter((p) => p.bin === b.code && p.status === "รอหยิบ").reduce((n, p) => n + p.qty, 0);
export const available = (b: Bin) => Math.max(0, b.qty - reservedIn(b));

/** ช่องที่มีวัสดุตัวนี้ เรียงล็อตเก่าก่อน — ลำดับที่ต้องหยิบ */
export const binsHolding = (code: string) =>
  BINS.filter((b) => b.material === code && b.qty > 0).sort((a, b) => (a.since ?? "").localeCompare(b.since ?? "") || a.code.localeCompare(b.code));

export const stockInWarehouse = (code: string) => BINS.filter((b) => b.material === code).reduce((n, b) => n + b.qty, 0);

/** ช่องนี้รับวัสดุตัวนี้ได้ไหม: ต้องเป็นพื้นที่เก็บ และว่างหรือมีตัวเดียวกันอยู่ */
export const canHold = (b: Bin, code: string) => STORABLE.includes(b.type) && (b.material === null || b.material === code);

/** น้ำหนักในช่องหลังรับเพิ่ม */
export const kgAfter = (b: Bin, qty: number, kgPerUnit: number) => b.qty * b.kgPerUnit + qty * kgPerUnit;

/**
 * ช่องที่จัดเก็บของก้อนนี้ได้ เรียงตามที่ควรเลือก: ช่องที่รับน้ำหนักไหวก่อน,
 * ช่องที่มีของตัวเดียวกันอยู่แล้วก่อนช่องว่าง, พื้นที่เก็บกองก่อนช่องหยิบ
 */
export function putawayCandidates(code: string, qty: number, kgPerUnit = UNIT_WEIGHTS[code] ?? 0) {
  return BINS.filter((b) => canHold(b, code))
    .map((b) => ({ bin: b, kg: kgAfter(b, qty, kgPerUnit), fits: kgAfter(b, qty, kgPerUnit) <= b.maxKg }))
    .sort(
      (x, y) =>
        Number(y.fits) - Number(x.fits) ||
        Number(y.bin.material === code) - Number(x.bin.material === code) ||
        STORABLE.indexOf(x.bin.type) - STORABLE.indexOf(y.bin.type) ||
        x.bin.code.localeCompare(y.bin.code)
    );
}

export type BinInput = { code: string; type: string; maxKg: number };

export function binProblems(input: BinInput, editing?: Bin): Record<string, string> {
  const e: Record<string, string> = {};
  const code = input.code.trim().toUpperCase();
  if (!editing) {
    const pattern = STORABLE.includes(input.type) ? /^[A-Z]-\d{2}-\d{2}$/ : /^(REC|SHP)-\d{2}$/;
    if (!pattern.test(code)) e.code = STORABLE.includes(input.type) ? "รูปแบบ พื้นที่-แถว-ช่อง เช่น A-02-03" : "รูปแบบ REC-03 หรือ SHP-02";
    else if (BINS.some((b) => b.code === code)) e.code = "มีช่องรหัสนี้แล้ว";
  }
  if (!STORAGE_TYPES.some((t) => t.code === input.type)) e.type = "เลือกพื้นที่จัดเก็บ";
  else if (editing && editing.type !== input.type && editing.material) e.type = "ช่องที่มีของอยู่ย้ายพื้นที่ไม่ได้ ย้ายของออกก่อน";
  if (!Number.isInteger(input.maxKg) || input.maxKg <= 0) e.maxKg = "เพดานน้ำหนักต้องเป็นจำนวนเต็มกิโลกรัม";
  else if (editing && binLoad(editing).kg > input.maxKg) e.maxKg = `ตอนนี้ช่องรับอยู่ ${Math.round(binLoad(editing).kg)} กก. ลดเพดานต่ำกว่านี้ไม่ได้`;
  return e;
}

export function addBin(input: BinInput): Bin {
  assertValid(binProblems(input));
  return commit(() => {
    const b: Bin = { code: input.code.trim().toUpperCase(), type: input.type, maxKg: input.maxKg, material: null, qty: 0, kgPerUnit: 0, since: null };
    BINS.push(b);
    return b;
  });
}

export function updateBin(code: string, input: Omit<BinInput, "code">) {
  const b = bin(code);
  assertValid(binProblems({ ...input, code }, b));
  commit(() => {
    b.type = input.type;
    b.maxKg = input.maxKg;
  });
}

/* --------------------------------------------------------------- putaway */

/** ใบรับสินค้าจากจัดซื้อที่ยังไม่ได้ออกใบสั่งจัดเก็บ */
export const pendingReceipts = () =>
  GOODS_RECEIPTS.filter((g) => g.date >= PUTAWAY_SINCE && !INBOUND.some((t) => t.gr === g.no));

/** ออกใบสั่งจัดเก็บจากใบรับสินค้า หนึ่งใบต่อหนึ่งรายการ พร้อมช่องที่ระบบเสนอ */
export function createPutawayTasks(grNo: string): PutawayTask[] {
  const gr = pendingReceipts().find((g) => g.no === grNo);
  if (!gr) throw new Error(`${grNo} ไม่ได้รอสั่งจัดเก็บ`);
  const suggestions = gr.lines.map((l) => {
    const first = putawayCandidates(l.material, l.qty)[0];
    if (!first) throw new Error(`ไม่มีช่องที่รับ ${material(l.material).name} ได้ เพิ่มช่องเก็บก่อน`);
    return first.bin.code;
  });
  return commit(() =>
    gr.lines.map((l, i) => {
      const task: PutawayTask = {
        no: nextNumber(INBOUND.map((t) => t.no), "TO-IN-"),
        material: l.material,
        qty: l.qty,
        from: "REC-01",
        suggestBin: suggestions[i],
        status: "รอจัดเก็บ",
        gr: gr.no,
      };
      INBOUND.push(task);
      return task;
    })
  );
}

/** เหตุที่เก็บงานนี้เข้าช่องนั้นไม่ได้ — undefined คือเก็บได้ */
export function putawayProblem(task: PutawayTask, binCode: string, kgPerUnit?: number): string | undefined {
  if (task.status !== "รอจัดเก็บ") return `${task.no} จัดเก็บไปแล้ว`;
  const w = UNIT_WEIGHTS[task.material] ?? kgPerUnit;
  if (!(w !== undefined && w > 0)) return "ใส่น้ำหนักต่อหน่วยของวัสดุนี้ก่อน ใช้คิดเพดานช่อง";
  const b = BINS.find((x) => x.code === binCode);
  if (!b) return "เลือกช่องเก็บ";
  if (!canHold(b, task.material)) return `${b.code} มีของอื่นอยู่หรือไม่ใช่พื้นที่เก็บ`;
  const kg = kgAfter(b, task.qty, w);
  if (kg > b.maxKg) return `${b.code} จะรับน้ำหนัก ${Math.round(kg).toLocaleString("th-TH")} กก. เกินเพดาน ${b.maxKg.toLocaleString("th-TH")} กก.`;
  return undefined;
}

/** ยืนยันจัดเก็บ: ของเข้าช่องที่เลือก งานออกจากคิวท่ารับ */
export function confirmPutaway(no: string, binCode: string, kgPerUnit?: number) {
  const task = INBOUND.find((t) => t.no === no);
  if (!task) throw new Error(`ไม่พบใบสั่งจัดเก็บ ${no}`);
  const problem = putawayProblem(task, binCode, kgPerUnit);
  if (problem) throw new Error(problem);
  const b = bin(binCode);
  commit(() => {
    const w = UNIT_WEIGHTS[task.material] ?? kgPerUnit!;
    UNIT_WEIGHTS[task.material] = w;
    if (b.material === null) {
      b.material = task.material;
      b.kgPerUnit = w;
      b.since = TODAY;
    }
    b.qty += task.qty;
    task.status = "จัดเก็บแล้ว";
    task.bin = b.code;
    task.doneAt = TODAY;
  });
}

/* ---------------------------------------------------------------- picking */

/** แบ่งจำนวนที่ต้องหยิบลงช่อง ล็อตเก่าก่อน ใช้เฉพาะส่วนที่ยังไม่ถูกจอง */
export function allocate(code: string, qty: number) {
  const picks: { bin: string; qty: number }[] = [];
  let left = qty;
  for (const b of binsHolding(code)) {
    if (left <= 0) break;
    const take = Math.min(available(b), left);
    if (take > 0) {
      picks.push({ bin: b.code, qty: take });
      left -= take;
    }
  }
  return { picks, short: Math.max(0, left) };
}

export type PickListInput = { ref: string; lines: { material: string; qty: number }[] };

export function pickListProblems(input: PickListInput): Record<string, string> {
  const e: Record<string, string> = {};
  const ref = input.ref.trim();
  if (ref.length < 3) e.ref = "ใส่เลขที่ใบส่งของหรือใบสั่งผลิตที่ต้องจ่ายของ";
  else if (PICKS.some((p) => p.ref === ref && p.status !== "จ่ายออกแล้ว")) e.ref = `มีใบหยิบของ ${ref} ค้างอยู่ ปิดใบเดิมก่อน`;
  if (input.lines.length === 0) e.lines = "ต้องมีอย่างน้อยหนึ่งรายการ";
  else if (input.lines.some((l) => !MATERIALS.some((m) => m.code === l.material))) e.lines = "เลือกวัสดุให้ครบทุกบรรทัด";
  else if (new Set(input.lines.map((l) => l.material)).size !== input.lines.length) e.lines = "มีวัสดุซ้ำกัน รวมเป็นบรรทัดเดียว";
  else
    for (const l of input.lines) {
      if (!(Number.isInteger(l.qty) && l.qty > 0)) e["line:" + l.material] = "จำนวนต้องเป็นจำนวนเต็มมากกว่าศูนย์";
      else {
        const { short } = allocate(l.material, l.qty);
        if (short > 0) e["line:" + l.material] = `ในคลังมีให้หยิบ ${l.qty - short} ${material(l.material).unit}`;
      }
    }
  return e;
}

/** ออกใบหยิบสินค้า: แต่ละรายการแตกเป็นงานหยิบตามช่อง ล็อตเก่าก่อน */
export function createPickList(input: PickListInput): PickTask[] {
  assertValid(pickListProblems(input));
  const ref = input.ref.trim();
  const plan = input.lines.flatMap((l) => allocate(l.material, l.qty).picks.map((p) => ({ ...p, material: l.material })));
  return commit(() =>
    plan.map((p) => {
      const task: PickTask = {
        no: nextNumber(PICKS.map((x) => x.no), "TO-PK-"),
        ref,
        material: p.material,
        qty: p.qty,
        bin: p.bin,
        to: "SHP-01",
        status: "รอหยิบ",
      };
      PICKS.push(task);
      return task;
    })
  );
}

/** เหตุที่ยืนยันหยิบจำนวนนี้ไม่ได้ — undefined คือได้ */
export function pickProblem(task: PickTask, picked: number): string | undefined {
  if (task.status !== "รอหยิบ") return `${task.no} หยิบไปแล้ว`;
  if (!(Number.isInteger(picked) && picked >= 0)) return "จำนวนต้องเป็นจำนวนเต็มไม่ติดลบ";
  if (picked > task.qty) return `หยิบเกินใบสั่งหยิบ (${task.qty}) ไม่ได้`;
  const b = bin(task.bin);
  if (b.material !== task.material || picked > b.qty) return `ในช่อง ${b.code} มีอยู่ ${b.material === task.material ? b.qty : 0}`;
  return undefined;
}

/** ยืนยันการหยิบด้วยจำนวนที่หยิบได้จริง — ของออกจากช่องไปพักที่ท่าจ่าย */
export function confirmPick(no: string, picked: number) {
  const task = PICKS.find((p) => p.no === no);
  if (!task) throw new Error(`ไม่พบใบสั่งหยิบ ${no}`);
  const problem = pickProblem(task, picked);
  if (problem) throw new Error(problem);
  const b = bin(task.bin);
  commit(() => {
    b.qty -= picked;
    emptyIfZero(b);
    task.status = "หยิบแล้ว";
    task.picked = picked;
  });
}

/** เหตุที่ยืนยันหยิบครบทั้งใบไม่ได้ — undefined คือทุกช่องมีของพอ */
export function fullPickProblem(ref: string): string | undefined {
  const open = PICKS.filter((p) => p.ref === ref && p.status === "รอหยิบ");
  if (open.length === 0) return `${ref} ไม่มีงานรอหยิบ`;
  for (const p of open) {
    const need = open.filter((x) => x.bin === p.bin).reduce((n, x) => n + x.qty, 0);
    const b = bin(p.bin);
    if (b.material !== p.material || b.qty < need) return `ช่อง ${b.code} มีของไม่พอ ยืนยันทีละรายการด้วยจำนวนที่หยิบได้จริง`;
  }
  return undefined;
}

/** ยืนยันหยิบครบทุกงานของใบหยิบหนึ่งใบ — ใช้ได้เมื่อทุกช่องมีของพอ */
export function confirmPickList(ref: string) {
  const problem = fullPickProblem(ref);
  if (problem) throw new Error(problem);
  const open = PICKS.filter((p) => p.ref === ref && p.status === "รอหยิบ");
  commit(() => {
    for (const p of open) {
      const b = bin(p.bin);
      b.qty -= p.qty;
      emptyIfZero(b);
      p.status = "หยิบแล้ว";
      p.picked = p.qty;
    }
  });
}

export type PickListStatus = "รอหยิบ" | "หยิบครบ รอจ่ายออก" | "จ่ายออกแล้ว";

/** ใบหยิบสินค้า — งานหยิบรวมตามเอกสารต้นเรื่อง ใบใหม่อยู่บน */
export function pickLists() {
  const refs = [...new Set([...PICKS].reverse().map((p) => p.ref))];
  return refs.map((ref) => {
    const tasks = PICKS.filter((p) => p.ref === ref).sort((a, b) => a.bin.localeCompare(b.bin));
    const status: PickListStatus = tasks.some((t) => t.status === "รอหยิบ")
      ? "รอหยิบ"
      : tasks.every((t) => t.status === "จ่ายออกแล้ว")
        ? "จ่ายออกแล้ว"
        : "หยิบครบ รอจ่ายออก";
    return { ref, tasks, status, gi: tasks.find((t) => t.gi)?.gi };
  });
}

/** ตัดจ่ายออก: ของที่หยิบมาพักไว้ออกจากคลัง ออกใบจ่ายสินค้าตามจำนวนที่หยิบได้จริง */
export function postGoodsIssue(ref: string): GoodsIssue {
  const tasks = PICKS.filter((p) => p.ref === ref);
  if (tasks.length === 0) throw new Error(`ไม่พบใบหยิบของ ${ref}`);
  if (tasks.some((t) => t.status === "รอหยิบ")) throw new Error(`${ref} ยังหยิบไม่ครบ ตัดจ่ายออกไม่ได้`);
  const staged = tasks.filter((t) => t.status === "หยิบแล้ว");
  if (staged.length === 0) throw new Error(`${ref} จ่ายออกไปแล้ว`);
  const qtyOf = (t: PickTask) => t.picked ?? t.qty;
  const codes = [...new Set(staged.map((t) => t.material))];
  return commit(() => {
    const gi: GoodsIssue = {
      no: nextNumber(GOODS_ISSUES.map((g) => g.no), `GI-${YEAR}-`),
      ref,
      date: TODAY,
      lines: codes.map((c) => ({ material: c, qty: staged.filter((t) => t.material === c).reduce((n, t) => n + qtyOf(t), 0) })),
    };
    GOODS_ISSUES.push(gi);
    for (const t of staged) {
      t.status = "จ่ายออกแล้ว";
      t.gi = gi.no;
    }
    return gi;
  });
}

/* -------------------------------------------------------------- transfers */

export type TransferInput = { from: string; to: string; qty: number; reason: string };

export function transferProblems(input: TransferInput): Record<string, string> {
  const e: Record<string, string> = {};
  const from = BINS.find((b) => b.code === input.from);
  if (!from || !from.material || from.qty === 0) {
    e.from = "เลือกช่องต้นทางที่มีของ";
    return e;
  }
  if (!(Number.isInteger(input.qty) && input.qty > 0)) e.qty = "จำนวนต้องเป็นจำนวนเต็มมากกว่าศูนย์";
  else if (input.qty > available(from)) e.qty = `ย้ายได้ไม่เกิน ${available(from)}${reservedIn(from) ? ` (จองให้งานหยิบไว้ ${reservedIn(from)})` : ""}`;
  const to = BINS.find((b) => b.code === input.to);
  if (!to) e.to = "เลือกช่องปลายทาง";
  else if (to.code === from.code) e.to = "ปลายทางต้องเป็นคนละช่อง";
  else if (!canHold(to, from.material)) e.to = `${to.code} มีของอื่นอยู่หรือไม่ใช่พื้นที่เก็บ`;
  else if (input.qty > 0 && kgAfter(to, input.qty, from.kgPerUnit) > to.maxKg) e.to = `${to.code} จะเกินเพดาน ${to.maxKg.toLocaleString("th-TH")} กก.`;
  if (input.reason.trim().length < 3) e.reason = "ใส่เหตุผลที่ย้าย";
  return e;
}

/** ย้ายของระหว่างช่อง ยอดรวมในคลังไม่เปลี่ยน วันที่ล็อตย้ายตามของไปด้วย */
export function transferStock(input: TransferInput): Transfer {
  assertValid(transferProblems(input));
  const from = bin(input.from);
  const to = bin(input.to);
  const code = from.material!;
  return commit(() => {
    if (to.material === null) {
      to.material = code;
      to.kgPerUnit = from.kgPerUnit;
      to.since = from.since;
    } else if (from.since && (!to.since || from.since < to.since)) {
      to.since = from.since;
    }
    to.qty += input.qty;
    from.qty -= input.qty;
    emptyIfZero(from);
    const t: Transfer = {
      no: nextNumber(TRANSFERS.map((x) => x.no), "TO-MV-"),
      material: code,
      qty: input.qty,
      from: from.code,
      to: to.code,
      reason: input.reason.trim(),
      date: TODAY,
    };
    TRANSFERS.push(t);
    return t;
  });
}

/* --------------------------------------------------------------- counting */

/** ช่องที่อยู่ในใบตรวจนับที่ยังไม่ได้นับ — ออกใบซ้ำไม่ได้ */
export const binsUnderCount = () => new Set(COUNT_SHEETS.filter((s) => s.status === "รอนับ").flatMap((s) => s.lines.map((l) => l.bin)));

export type CountSheetInput = { bins: string[]; scope: string; counter: string };

export function countSheetProblems(input: CountSheetInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (input.bins.length === 0) e.bins = "เลือกช่องที่จะนับอย่างน้อยหนึ่งช่อง";
  else if (input.bins.some((c) => !BINS.find((b) => b.code === c)?.material)) e.bins = "นับได้เฉพาะช่องที่มีของ";
  else if (input.bins.some((c) => binsUnderCount().has(c))) e.bins = "บางช่องอยู่ในใบตรวจนับที่ยังไม่ได้นับ";
  if (input.scope.trim().length < 3) e.scope = "ใส่ชื่อรอบนับ เช่น นับวนรอบสัปดาห์ที่ 39";
  if (!COUNTERS.includes(input.counter)) e.counter = "เลือกผู้นับ";
  return e;
}

export function createCountSheet(input: CountSheetInput): CountSheet {
  assertValid(countSheetProblems(input));
  return commit(() => {
    const sheet: CountSheet = {
      no: nextNumber(COUNT_SHEETS.map((s) => s.no), `PI-${YEAR}-`),
      date: TODAY,
      scope: input.scope.trim(),
      counter: input.counter,
      status: "รอนับ",
      lines: [...input.bins].sort().map((c) => ({ bin: c, material: bin(c).material! })),
    };
    COUNT_SHEETS.push(sheet);
    return sheet;
  });
}

export function countEntryProblems(no: string, counted: Record<string, number>): Record<string, string> {
  const e: Record<string, string> = {};
  const sheet = countSheet(no);
  if (sheet.status !== "รอนับ") e.sheet = `${no} บันทึกผลไปแล้ว`;
  for (const l of sheet.lines) {
    const n = counted[l.bin];
    if (!(Number.isInteger(n) && n >= 0)) e["bin:" + l.bin] = "ใส่จำนวนที่นับได้ เป็นจำนวนเต็ม";
  }
  return e;
}

/**
 * บันทึกผลนับ: จำนวนในระบบถูกอ่าน ณ ตอนบันทึก แล้วเทียบกับที่นับได้
 * ตรงกันจบในตัว ต่างกันต้องรออนุมัติก่อนปรับยอด
 */
export function enterCounts(no: string, counted: Record<string, number>): Count[] {
  assertValid(countEntryProblems(no, counted));
  const sheet = countSheet(no);
  return commit(() => {
    const rows = sheet.lines.map((l) => {
      const b = bin(l.bin);
      const system = b.material === l.material ? b.qty : 0;
      const c: Count = {
        bin: l.bin,
        material: l.material,
        system,
        counted: counted[l.bin],
        date: TODAY,
        by: sheet.counter,
        doc: sheet.no,
        status: counted[l.bin] === system ? "ตรงกัน" : "รออนุมัติ",
      };
      COUNTS.push(c);
      return c;
    });
    sheet.status = "นับแล้ว";
    return rows;
  });
}

/** เหตุที่คนนี้อนุมัติผลต่างนี้ไม่ได้ — undefined คืออนุมัติได้ */
export function countApprovalProblem(c: Count, approverName: string, reason: string): string | undefined {
  if (c.status !== "รออนุมัติ") return `ผลนับนี้${c.status}`;
  if (!COUNT_APPROVERS.some((a) => a.name === approverName)) return "เลือกผู้อนุมัติ";
  if (approverName === c.by) return `${approverName} เป็นผู้นับช่องนี้เอง อนุมัติผลของตัวเองไม่ได้`;
  if (reason.trim().length < 5) return "ใส่สาเหตุของผลต่าง อย่างน้อย 5 ตัวอักษร";
  return undefined;
}

export function approveCount(doc: string, binCode: string, approverName: string, reason: string) {
  const c = countOf(doc, binCode);
  const problem = countApprovalProblem(c, approverName, reason);
  if (problem) throw new Error(problem);
  commit(() => {
    c.status = "อนุมัติแล้ว";
    c.approvedBy = approverName;
    c.reason = reason.trim();
  });
}

/** ปรับยอดในช่องด้วยผลต่างที่อนุมัติแล้ว — ยังไม่อนุมัติคือปรับไม่ได้ */
export function postCountAdjustment(doc: string, binCode: string) {
  const c = countOf(doc, binCode);
  if (c.status !== "อนุมัติแล้ว") throw new Error(`ผลนับ ${doc} ช่อง ${binCode} ต้องอนุมัติก่อนปรับยอด`);
  const b = bin(binCode);
  if (b.material !== null && b.material !== c.material) throw new Error(`ช่อง ${b.code} มีของอื่นอยู่แล้ว ปรับยอดไม่ได้`);
  const next = (b.material === c.material ? b.qty : 0) + variance(c);
  if (next < 0) throw new Error(`ปรับแล้วช่อง ${b.code} จะติดลบ ตรวจนับใหม่`);
  commit(() => {
    if (b.material === null && next > 0) {
      b.material = c.material;
      b.kgPerUnit = UNIT_WEIGHTS[c.material] ?? 0;
      b.since = TODAY;
    }
    b.qty = next;
    emptyIfZero(b);
    c.status = "ปรับยอดแล้ว";
    c.postedAt = TODAY;
  });
}

/** ผลต่างที่ยังต้องจัดการ — รออนุมัติหรือรอปรับยอด */
export const openVariances = () => COUNTS.filter((c) => c.status === "รออนุมัติ" || c.status === "อนุมัติแล้ว");
