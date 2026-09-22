import { MATERIALS, material } from "../mm/data";

/** ผังคลัง — เลขคลัง → ประเภทพื้นที่ → ช่องเก็บ ตามลำดับชั้นที่ SAP ใช้ */
export const WAREHOUSE = { code: "WH-01", name: "คลังกลาง บางพลี" };

export const STORAGE_TYPES = [
  { code: "REC", name: "พื้นที่รับของ", purpose: "พักของที่เพิ่งรับเข้า รอจัดเก็บ" },
  { code: "BLK", name: "พื้นที่เก็บกอง", purpose: "ของหนักปริมาณมาก หยิบเป็นพาเลท" },
  { code: "PCK", name: "พื้นที่หยิบของ", purpose: "ชั้นหยิบทีละชิ้น เติมของอัตโนมัติ" },
  { code: "SHP", name: "พื้นที่จ่ายออก", purpose: "พักของที่หยิบแล้ว รอขึ้นรถ" },
];

/** ช่องเก็บแต่ละช่องมีเพดานน้ำหนักของตัวเอง — เกินคือห้ามจัดเก็บ */
export const BINS = [
  { code: "A-01-03", type: "BLK", maxKg: 2000, material: "MAT-1001", qty: 240, kgPerUnit: 7.2 },
  { code: "A-01-07", type: "BLK", maxKg: 2000, material: "MAT-1002", qty: 86, kgPerUnit: 8.9 },
  { code: "B-02-01", type: "BLK", maxKg: 1200, material: "MAT-1003", qty: 34, kgPerUnit: 18 },
  { code: "C-01-12", type: "PCK", maxKg: 300, material: "MAT-2001", qty: 18, kgPerUnit: 4.5 },
  { code: "C-02-04", type: "PCK", maxKg: 300, material: "MAT-2002", qty: 320, kgPerUnit: 0.11 },
  { code: "C-03-02", type: "PCK", maxKg: 300, material: "MAT-4001", qty: 6, kgPerUnit: 12 },
  { code: "D-01-01", type: "PCK", maxKg: 200, material: "MAT-3001", qty: 640, kgPerUnit: 0.08 },
  { code: "D-02-06", type: "BLK", maxKg: 800, material: "MAT-3002", qty: 1420, kgPerUnit: 0.25 },
  { code: "E-01-01", type: "BLK", maxKg: 2500, material: "FG-5001", qty: 34, kgPerUnit: 28 },
  { code: "E-01-04", type: "BLK", maxKg: 2500, material: "FG-5002", qty: 12, kgPerUnit: 41 },
  { code: "E-02-02", type: "BLK", maxKg: 2500, material: "FG-5003", qty: 5, kgPerUnit: 62 },
  { code: "REC-01", type: "REC", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0 },
  { code: "REC-02", type: "REC", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0 },
  { code: "SHP-01", type: "SHP", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0 },
];

/** ของที่มาถึงท่ารับ รอสั่งจัดเก็บเข้าช่อง */
export const INBOUND = [
  { no: "TO-IN-4401", material: "MAT-1002", qty: 200, from: "REC-01", suggestBin: "A-01-07", status: "รอจัดเก็บ" },
  { no: "TO-IN-4402", material: "MAT-1003", qty: 14, from: "REC-01", suggestBin: "B-02-01", status: "รอจัดเก็บ" },
  { no: "TO-IN-4399", material: "MAT-2002", qty: 100, from: "REC-02", suggestBin: "C-02-04", status: "จัดเก็บแล้ว" },
];

/** งานหยิบของ — ไล่ตามลำดับช่องเพื่อไม่ต้องเดินย้อน */
export const PICKS = [
  { no: "TO-PK-7712", ref: "DO-2569-0302", material: "FG-5003", qty: 6, bin: "E-02-02", to: "SHP-01", status: "รอหยิบ" },
  { no: "TO-PK-7711", ref: "DO-2569-0303", material: "FG-5001", qty: 3, bin: "E-01-01", to: "SHP-01", status: "หยิบแล้ว" },
  { no: "TO-PK-7710", ref: "PO-P-3301", material: "MAT-1001", qty: 40, bin: "A-01-03", to: "SHP-01", status: "หยิบแล้ว" },
  { no: "TO-PK-7713", ref: "PO-P-3301", material: "MAT-1002", qty: 114, bin: "A-01-07", to: "SHP-01", status: "รอหยิบ" },
];

export const TRANSFERS = [
  { no: "TO-MV-2201", material: "MAT-2002", qty: 80, from: "C-02-04", to: "D-02-06", reason: "ย้ายลงพื้นที่เก็บกอง ช่องหยิบเต็ม", date: "2026-09-19" },
  { no: "TO-MV-2202", material: "MAT-3001", qty: 200, from: "D-02-06", to: "D-01-01", reason: "เติมของเข้าช่องหยิบ", date: "2026-09-20" },
];

/** ตรวจนับ — นับจริงเทียบกับที่ระบบบอก */
export const COUNTS = [
  { bin: "C-01-12", material: "MAT-2001", system: 18, counted: 15, date: "2026-09-20", by: "อนุชา" },
  { bin: "C-02-04", material: "MAT-2002", system: 320, counted: 320, date: "2026-09-20", by: "อนุชา" },
  { bin: "D-01-01", material: "MAT-3001", system: 640, counted: 652, date: "2026-09-21", by: "ธีรศักดิ์" },
  { bin: "E-01-04", material: "FG-5002", system: 12, counted: 12, date: "2026-09-21", by: "ธีรศักดิ์" },
];

export type Bin = (typeof BINS)[number];
export type Count = (typeof COUNTS)[number];

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
