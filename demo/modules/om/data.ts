import { EMPLOYEES, TODAY } from "../pa/data";
import type { Employee } from "../pa/data";

/**
 * The organisation as seats, not as people.
 *
 * A seat outlives whoever sits in it, so everything here is keyed on the seat:
 * the reporting line, the pay band, the qualifications. Who holds it today is a
 * question for the personnel register, which is why `holderOf` reaches into
 * `../pa/data` instead of this file keeping a second staff list.
 */

export const LEVELS = ["ผู้บริหาร", "ผู้จัดการ", "หัวหน้างาน", "อาวุโส", "ปฏิบัติการ"] as const;
export type Level = (typeof LEVELS)[number];

export type OrgUnit = {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  /** Seats this unit is allowed to have, counting only its own — not its children's. */
  plannedHeadcount: number;
  costCentre: string;
  openedAt: string;
};

export type Position = {
  id: number;
  unitId: number;
  code: string;
  title: string;
  level: Level;
  /** The seat this one reports to, by id. Null means it answers to nobody inside. */
  reportsTo: number | null;
  duties: string[];
  qualifications: string[];
};

export type Requisition = {
  id: string;
  positionId: number;
  openedAt: string;
  wantedBy: string;
  status: "รออนุมัติ" | "อนุมัติแล้ว" | "กำลังสรรหา";
  reason: string;
};

export { TODAY };

export const ORG_UNITS: OrgUnit[] = [
  { id: 7, code: "ORG-000", name: "บริษัท ตัวอย่างอุตสาหกรรม", parentId: null, plannedHeadcount: 1, costCentre: "CC-000", openedAt: "2018-01-02" },
  { id: 1, code: "ORG-110", name: "ฝ่ายขาย", parentId: 7, plannedHeadcount: 2, costCentre: "CC-110", openedAt: "2018-01-02" },
  { id: 5, code: "ORG-120", name: "ฝ่ายผลิต", parentId: 7, plannedHeadcount: 3, costCentre: "CC-120", openedAt: "2018-01-02" },
  { id: 3, code: "ORG-130", name: "ฝ่ายคลัง", parentId: 7, plannedHeadcount: 2, costCentre: "CC-130", openedAt: "2018-06-01" },
  { id: 6, code: "ORG-140", name: "ฝ่ายจัดซื้อ", parentId: 7, plannedHeadcount: 1, costCentre: "CC-140", openedAt: "2019-01-07" },
  { id: 2, code: "ORG-210", name: "ฝ่ายบัญชี", parentId: 7, plannedHeadcount: 1, costCentre: "CC-210", openedAt: "2018-01-02" },
  { id: 4, code: "ORG-220", name: "ฝ่ายบุคคล", parentId: 7, plannedHeadcount: 1, costCentre: "CC-220", openedAt: "2020-02-03" },
];

export const POSITIONS: Position[] = [
  {
    id: 10, unitId: 7, code: "POS-001", title: "กรรมการผู้จัดการ", level: "ผู้บริหาร", reportsTo: null,
    duties: ["กำหนดทิศทางและเป้าหมายประจำปี", "อนุมัติงบประมาณและอัตรากำลัง", "รายงานผลต่อคณะกรรมการ"],
    qualifications: ["บริหารธุรกิจระดับปริญญาโท", "ประสบการณ์บริหาร 10 ปี", "อ่านงบการเงินได้"],
  },
  {
    id: 1, unitId: 1, code: "POS-011", title: "หัวหน้าฝ่ายขาย", level: "หัวหน้างาน", reportsTo: 10,
    duties: ["วางเป้าหมายยอดขายรายไตรมาส", "ดูแลทีมขายและลูกค้ารายใหญ่", "อนุมัติส่วนลดในกรอบที่กำหนด"],
    qualifications: ["ประสบการณ์ขาย 5 ปี", "บริหารทีม", "เจรจาต่อรอง"],
  },
  {
    id: 2, unitId: 1, code: "POS-012", title: "พนักงานขาย", level: "ปฏิบัติการ", reportsTo: 1,
    duties: ["เสนอราคาและติดตามใบสั่งขาย", "ดูแลลูกค้าในเขตที่รับผิดชอบ", "สรุปยอดขายรายสัปดาห์"],
    qualifications: ["สื่อสารดี", "ใช้ CRM ได้"],
  },
  {
    id: 8, unitId: 5, code: "POS-021", title: "หัวหน้าสายการผลิต", level: "หัวหน้างาน", reportsTo: 10,
    duties: ["จัดลำดับใบสั่งผลิตตามกำลังการผลิต", "ควบคุมคุณภาพและของเสีย", "ดูแลความปลอดภัยในสายการผลิต"],
    qualifications: ["วางแผนผลิต", "บริหารทีม", "ควบคุมคุณภาพ"],
  },
  {
    id: 7, unitId: 5, code: "POS-022", title: "ช่างเทคนิค", level: "ปฏิบัติการ", reportsTo: 8,
    duties: ["เดินเครื่องจักรตามใบสั่งผลิต", "ซ่อมบำรุงตามแผนประจำเดือน", "บันทึกผลผลิตและของเสีย"],
    qualifications: ["ซ่อมบำรุงเครื่องจักร", "ความปลอดภัย"],
  },
  {
    id: 4, unitId: 3, code: "POS-031", title: "ผู้จัดการคลัง", level: "ผู้จัดการ", reportsTo: 10,
    duties: ["วางผังพื้นที่จัดเก็บ", "อนุมัติการย้ายและตัดจ่ายสต็อก", "ดูแลรอบการตรวจนับ"],
    qualifications: ["บริหารคลัง 5 ปี", "ระบบ WMS"],
  },
  {
    id: 5, unitId: 3, code: "POS-032", title: "พนักงานคลังสินค้า", level: "ปฏิบัติการ", reportsTo: 4,
    duties: ["รับเข้าและจัดเก็บตามใบสั่งจัดเก็บ", "หยิบของตามใบสั่งหยิบ", "ตรวจนับตามรอบ"],
    qualifications: ["ขับโฟล์คลิฟท์", "นับสต็อก"],
  },
  {
    id: 9, unitId: 6, code: "POS-041", title: "เจ้าหน้าที่จัดซื้อ", level: "ปฏิบัติการ", reportsTo: 10,
    duties: ["เปิดใบสั่งซื้อจากใบขอซื้อ", "เทียบราคาและเลือกผู้ขาย", "ติดตามกำหนดส่งของ"],
    qualifications: ["เจรจาต่อรอง", "ประเมินผู้ขาย"],
  },
  {
    id: 3, unitId: 2, code: "POS-051", title: "นักบัญชีอาวุโส", level: "อาวุโส", reportsTo: 10,
    duties: ["ลงบัญชีและกระทบยอดรายเดือน", "ปิดงบและจัดทำงบการเงิน", "ยื่นภาษีตามกำหนด"],
    qualifications: ["บัญชีบัณฑิต", "ปิดงบได้", "ภาษีนิติบุคคล"],
  },
  {
    id: 6, unitId: 4, code: "POS-061", title: "เจ้าหน้าที่บุคคล", level: "ปฏิบัติการ", reportsTo: 10,
    duties: ["ดูแลทะเบียนพนักงานและสัญญาจ้าง", "สรรหาและปฐมนิเทศพนักงานใหม่", "รวบรวมเวลาทำงานส่งเงินเดือน"],
    qualifications: ["กฎหมายแรงงาน", "สรรหา"],
  },
];

/** The pay range each level is graded at. A seat inherits the band of its level. */
export const BANDS: Record<Level, { min: number; max: number }> = {
  ผู้บริหาร: { min: 120000, max: 180000 },
  ผู้จัดการ: { min: 45000, max: 60000 },
  หัวหน้างาน: { min: 32000, max: 48000 },
  อาวุโส: { min: 30000, max: 45000 },
  ปฏิบัติการ: { min: 15000, max: 28000 },
};

export const REQUISITIONS: Requisition[] = [
  { id: "REQ-2569-004", positionId: 9, openedAt: "2026-09-02", wantedBy: "2026-11-01", status: "กำลังสรรหา", reason: "ผู้ดำรงตำแหน่งเดิมลาออก งานจัดซื้อค้างอยู่ที่ฝ่ายบัญชี" },
  { id: "REQ-2569-005", positionId: 8, openedAt: "2026-08-18", wantedBy: "2026-10-15", status: "อนุมัติแล้ว", reason: "สายการผลิตยังไม่มีหัวหน้าประจำ ช่างเทคนิครายงานตรงถึงผู้บริหาร" },
  { id: "REQ-2569-006", positionId: 10, openedAt: "2026-09-15", wantedBy: "2027-01-05", status: "รออนุมัติ", reason: "เตรียมรับช่วงการบริหารตามแผนสืบทอดตำแหน่ง" },
];

/** Skills each person actually holds — compared against what the seat requires. */
export const EMPLOYEE_SKILLS: Record<number, string[]> = {
  1: ["ประสบการณ์ขาย 5 ปี", "บริหารทีม", "เจรจาต่อรอง"],
  2: ["บัญชีบัณฑิต", "ปิดงบได้"],
  3: ["นับสต็อก"],
  4: ["กฎหมายแรงงาน", "สรรหา"],
  5: ["ซ่อมบำรุงเครื่องจักร"],
  6: ["สื่อสารดี", "ใช้ CRM ได้"],
  7: ["บริหารคลัง 5 ปี", "ระบบ WMS"],
};

export const unitOf = (id: number): OrgUnit => {
  const u = ORG_UNITS.find((x) => x.id === id);
  if (!u) throw new Error(`ไม่พบหน่วยงาน ${id}`);
  return u;
};

export const positionOf = (id: number): Position => {
  const p = POSITIONS.find((x) => x.id === id);
  if (!p) throw new Error(`ไม่พบตำแหน่ง ${id}`);
  return p;
};

export const ROOT_UNIT = ORG_UNITS.find((u) => u.parentId === null)!;

export const childUnits = (id: number) => ORG_UNITS.filter((u) => u.parentId === id);

export const seatsOf = (unitId: number) => POSITIONS.filter((p) => p.unitId === unitId);

/** Who sits in a seat today. The personnel register is the only source. */
export const holderOf = (title: string): Employee | undefined =>
  EMPLOYEES.find((e) => e.position === title && e.status !== "ลาออก");

export const directReports = (positionId: number) => POSITIONS.filter((p) => p.reportsTo === positionId);

/** The reporting line from a seat up to the top, nearest manager first. */
export function chainAbove(positionId: number): Position[] {
  const out: Position[] = [];
  let at = positionOf(positionId).reportsTo;
  while (at !== null) {
    const p = positionOf(at);
    out.push(p);
    at = p.reportsTo;
  }
  return out;
}

/** Seats below this one, at every depth — what "the whole team" means for a manager. */
export function reportsUnder(positionId: number): Position[] {
  const direct = directReports(positionId);
  return [...direct, ...direct.flatMap((p) => reportsUnder(p.id))];
}

export const bandOf = (p: Position) => BANDS[p.level];

/** Where a salary sits inside its band: below, inside, or above. */
export function bandStanding(p: Position, salary: number): "ต่ำกว่ากรอบ" | "อยู่ในกรอบ" | "สูงกว่ากรอบ" {
  const b = bandOf(p);
  if (salary < b.min) return "ต่ำกว่ากรอบ";
  if (salary > b.max) return "สูงกว่ากรอบ";
  return "อยู่ในกรอบ";
}

export const skillsOf = (employeeId: number) => EMPLOYEE_SKILLS[employeeId] ?? [];

/** Requirements the seat asks for that the current holder does not have. */
export function gapsOf(p: Position, holder: Employee | undefined): string[] {
  if (!holder) return p.qualifications;
  const has = skillsOf(holder.id);
  return p.qualifications.filter((q) => !has.includes(q));
}

export const requisitionFor = (positionId: number) => REQUISITIONS.find((r) => r.positionId === positionId);

export const baht = (n: number) => n.toLocaleString("th-TH") + " ฿";

export function daysSince(date: string): number {
  return Math.round((new Date(TODAY).getTime() - new Date(date).getTime()) / 86_400_000);
}
