import { commit } from "../kit";
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

export const REQ_KINDS = ["ตำแหน่งว่าง", "อัตราเพิ่ม"] as const;
export type RequisitionKind = (typeof REQ_KINDS)[number];

export type Requisition = {
  id: string;
  positionId: number;
  openedAt: string;
  wantedBy: string;
  /** รออนุมัติ → อนุมัติแล้ว → กำลังสรรหา → ปิดแล้ว เมื่อมอบหมายคนเข้าตำแหน่ง หรือ ไม่อนุมัติ */
  status: "รออนุมัติ" | "อนุมัติแล้ว" | "กำลังสรรหา" | "ไม่อนุมัติ" | "ปิดแล้ว";
  reason: string;
  /** ตำแหน่งว่าง: หาคนมานั่งที่นั่งที่มีอยู่ · อัตราเพิ่ม: อนุมัติแล้วได้ที่นั่งใหม่และแผนเพิ่มหนึ่งอัตรา */
  kind: RequisitionKind;
  decidedAt?: string;
  decisionNote?: string;
  filledBy?: number;
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
  { id: "REQ-2569-004", positionId: 9, openedAt: "2026-09-02", wantedBy: "2026-11-01", status: "กำลังสรรหา", reason: "ผู้ดำรงตำแหน่งเดิมลาออก งานจัดซื้อค้างอยู่ที่ฝ่ายบัญชี", kind: "ตำแหน่งว่าง", decidedAt: "2026-09-04" },
  { id: "REQ-2569-005", positionId: 8, openedAt: "2026-08-18", wantedBy: "2026-10-15", status: "อนุมัติแล้ว", reason: "สายการผลิตยังไม่มีหัวหน้าประจำ ช่างเทคนิครายงานตรงถึงผู้บริหาร", kind: "ตำแหน่งว่าง", decidedAt: "2026-08-25" },
  { id: "REQ-2569-006", positionId: 10, openedAt: "2026-09-15", wantedBy: "2027-01-05", status: "รออนุมัติ", reason: "เตรียมรับช่วงการบริหารตามแผนสืบทอดตำแหน่ง", kind: "ตำแหน่งว่าง" },
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

/* ================================================================ changes */

/**
 * Who sits where, as decided in this module.
 *
 * A seat listed here has its holder set by an assignment (null means it was
 * emptied on purpose); a seat not listed falls back to the register's job
 * title, which is how the seeded chart and a promotion keyed in the personnel
 * module both show up without anybody assigning them twice. The register itself
 * belongs to personnel records — this module only reads it.
 */
export const HOLDERS: Record<number, number | null> = {};

/** รักษาการ: someone covering a vacant seat on top of their own until a date. */
export type Acting = { employeeId: number; since: string; until: string };
export const ACTING: Record<number, Acting> = {};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export type Errors = Record<string, string>;
const hasErrors = (e: Errors) => Object.keys(e).length > 0;
const fail = (what: string, e: Errors) => new Error(`${what}: ${Object.values(e).join(" · ")}`);
const activeEmployee = (id: number) => EMPLOYEES.find((e) => e.id === id && e.status !== "ลาออก");

/** The holder of a seat today, resolved the one way every screen resolves it. */
export function holderFor(p: Position): Employee | undefined {
  if (p.id in HOLDERS) {
    const id = HOLDERS[p.id];
    return id === null ? undefined : activeEmployee(id);
  }
  // Someone assigned to a seat explicitly is not also claimed by a title match.
  const pinned = new Set(Object.values(HOLDERS).filter((x): x is number => x !== null));
  return EMPLOYEES.find((e) => e.position === p.title && e.status !== "ลาออก" && !pinned.has(e.id));
}

export const actingFor = (p: Position): (Acting & { employee: Employee }) | undefined => {
  const a = ACTING[p.id];
  const employee = a ? activeEmployee(a.employeeId) : undefined;
  return a && employee ? { ...a, employee } : undefined;
};

/** A seat with everything the screens ask of it worked out once. */
export type Seat = {
  position: Position;
  unit: OrgUnit;
  holder: Employee | undefined;
  acting: (Acting & { employee: Employee }) | undefined;
  gaps: string[];
  direct: number;
  /** Seats below this one at any depth, and how many of them have somebody in them. */
  team: number;
  staff: number;
};

export function seats(): Seat[] {
  return POSITIONS.map((position) => {
    const holder = holderFor(position);
    const under = reportsUnder(position.id);
    return {
      position,
      unit: unitOf(position.unitId),
      holder,
      acting: holder ? undefined : actingFor(position),
      gaps: gapsOf(position, holder),
      direct: directReports(position.id).length,
      team: under.length,
      staff: under.filter((p) => holderFor(p) !== undefined).length,
    };
  });
}

export const vacancies = () => POSITIONS.filter((p) => !holderFor(p)).length;

/** Units under this one at any depth — where a unit may not be moved to. */
export function unitsUnder(id: number): OrgUnit[] {
  const kids = childUnits(id);
  return [...kids, ...kids.flatMap((u) => unitsUnder(u.id))];
}

/* ----------------------------------------------------------------- units */

export type UnitInput = { name: string; parentId: number; plannedHeadcount: number; costCentre: string };

export function nextUnitCode(): string {
  const top = Math.max(0, ...ORG_UNITS.map((u) => Number(u.code.slice(4))));
  return "ORG-" + String(top + 10).padStart(3, "0");
}

export function unitErrors(i: UnitInput, id?: number): Errors {
  const out: Errors = {};
  const name = i.name.trim();
  if (name.length < 3) out.name = "ตั้งชื่อหน่วยงานอย่างน้อย 3 ตัวอักษร";
  else if (ORG_UNITS.some((u) => u.name === name && u.id !== id)) out.name = "มีหน่วยงานชื่อนี้อยู่แล้ว";
  const parent = ORG_UNITS.find((u) => u.id === i.parentId);
  if (!parent) out.parentId = "เลือกหน่วยงานต้นสังกัด";
  else if (id !== undefined && (i.parentId === id || unitsUnder(id).some((u) => u.id === i.parentId))) {
    out.parentId = "ย้ายไปอยู่ใต้หน่วยงานของตัวเองไม่ได้";
  }
  if (!Number.isInteger(i.plannedHeadcount) || i.plannedHeadcount < 0) out.plannedHeadcount = "อัตรากำลังเป็นจำนวนเต็มตั้งแต่ 0";
  if (!/^CC-\d{3}$/.test(i.costCentre)) out.costCentre = "รูปแบบ CC-000";
  else if (ORG_UNITS.some((u) => u.costCentre === i.costCentre && u.id !== id)) out.costCentre = "ศูนย์ต้นทุนนี้ใช้กับหน่วยงานอื่นแล้ว";
  return out;
}

export function createUnit(i: UnitInput): OrgUnit {
  const errors = unitErrors(i);
  if (hasErrors(errors)) throw fail("เพิ่มหน่วยงานไม่ได้", errors);
  const unit: OrgUnit = {
    id: Math.max(0, ...ORG_UNITS.map((u) => u.id)) + 1,
    code: nextUnitCode(),
    name: i.name.trim(),
    parentId: i.parentId,
    plannedHeadcount: i.plannedHeadcount,
    costCentre: i.costCentre,
    openedAt: TODAY,
  };
  return commit(() => {
    ORG_UNITS.push(unit);
    return unit;
  });
}

/** Rename or move a unit. The top of the chart stays where it is. */
export function updateUnit(id: number, i: UnitInput) {
  const u = unitOf(id);
  if (u.parentId === null) throw new Error("หน่วยงานสูงสุดย้ายหรือเปลี่ยนต้นสังกัดไม่ได้");
  const errors = unitErrors(i, id);
  if (hasErrors(errors)) throw fail("แก้ไขหน่วยงานไม่ได้", errors);
  commit(() => {
    u.name = i.name.trim();
    u.parentId = i.parentId;
    u.plannedHeadcount = i.plannedHeadcount;
    u.costCentre = i.costCentre;
  });
}

export function setPlannedHeadcount(unitId: number, planned: number) {
  const u = unitOf(unitId);
  if (!Number.isInteger(planned) || planned < 0) throw new Error("อัตรากำลังเป็นจำนวนเต็มตั้งแต่ 0");
  commit(() => {
    u.plannedHeadcount = planned;
  });
}

/* ------------------------------------------------------------- positions */

export type PositionInput = {
  unitId: number;
  title: string;
  level: Level;
  reportsTo: number | null;
  duties: string[];
  qualifications: string[];
};

export function nextPositionCode(): string {
  const top = Math.max(0, ...POSITIONS.map((p) => Number(p.code.slice(4))));
  return "POS-" + String(top + 1).padStart(3, "0");
}

export function positionErrors(i: PositionInput, id?: number): Errors {
  const out: Errors = {};
  if (i.title.trim().length < 2) out.title = "ตั้งชื่อตำแหน่ง";
  if (!ORG_UNITS.some((u) => u.id === i.unitId)) out.unitId = "เลือกหน่วยงาน";
  if (!LEVELS.includes(i.level)) out.level = "เลือกระดับ";
  if (i.reportsTo !== null && !POSITIONS.some((p) => p.id === i.reportsTo)) out.reportsTo = "เลือกตำแหน่งที่รายงาน";
  else if (id !== undefined && i.reportsTo !== null && (i.reportsTo === id || reportsUnder(id).some((p) => p.id === i.reportsTo))) {
    out.reportsTo = "รายงานต่อตัวเองหรือลูกทีมของตัวเองไม่ได้";
  }
  if (i.duties.filter((d) => d.trim()).length === 0) out.duties = "ใส่หน้าที่หลักอย่างน้อยหนึ่งข้อ";
  return out;
}

const clean = (list: string[]) => [...new Set(list.map((x) => x.trim()).filter(Boolean))];

/** A new seat starts empty: nobody holds a seat until somebody is assigned to it. */
export function createPosition(i: PositionInput): Position {
  const errors = positionErrors(i);
  if (hasErrors(errors)) throw fail("สร้างตำแหน่งไม่ได้", errors);
  const p: Position = {
    id: Math.max(0, ...POSITIONS.map((x) => x.id)) + 1,
    code: nextPositionCode(),
    unitId: i.unitId,
    title: i.title.trim(),
    level: i.level,
    reportsTo: i.reportsTo,
    duties: clean(i.duties),
    qualifications: clean(i.qualifications),
  };
  return commit(() => {
    POSITIONS.push(p);
    HOLDERS[p.id] = null;
    return p;
  });
}

/**
 * Edit a seat. Its holder is pinned first, because renaming a seat that is
 * matched to the register by job title would otherwise empty it.
 */
export function updatePosition(id: number, i: PositionInput) {
  const p = positionOf(id);
  const errors = positionErrors(i, id);
  if (hasErrors(errors)) throw fail("แก้ไขตำแหน่งไม่ได้", errors);
  commit(() => {
    if (!(id in HOLDERS)) HOLDERS[id] = holderFor(p)?.id ?? null;
    p.unitId = i.unitId;
    p.title = i.title.trim();
    p.level = i.level;
    p.reportsTo = i.reportsTo;
    p.duties = clean(i.duties);
    p.qualifications = clean(i.qualifications);
  });
}

export function setQualifications(positionId: number, list: string[]) {
  const p = positionOf(positionId);
  if (clean(list).length === 0) throw new Error("ตำแหน่งต้องมีคุณสมบัติอย่างน้อยหนึ่งข้อ");
  commit(() => {
    p.qualifications = clean(list);
  });
}

/** Record that a person now meets a requirement — a course passed, a licence obtained. */
export function grantSkill(employeeId: number, skill: string) {
  if (!activeEmployee(employeeId)) throw new Error("ไม่พบพนักงานที่ยังทำงานอยู่");
  if (!skill.trim()) throw new Error("ระบุคุณสมบัติ");
  commit(() => {
    const has = (EMPLOYEE_SKILLS[employeeId] ??= []);
    if (!has.includes(skill.trim())) has.push(skill.trim());
  });
}

/* ------------------------------------------------------------ assignment */

const OPEN_REQ: Requisition["status"][] = ["รออนุมัติ", "อนุมัติแล้ว", "กำลังสรรหา"];

/**
 * Put a person in a seat.
 *
 * They leave whatever seat they held before — one person, one seat; covering a
 * second one is an acting assignment. Any open requisition for the seat closes,
 * because the vacancy it asked for is filled.
 */
export function assignHolder(positionId: number, employeeId: number) {
  const p = positionOf(positionId);
  const e = activeEmployee(employeeId);
  if (!e) throw new Error("มอบหมายได้เฉพาะพนักงานที่ยังทำงานอยู่");
  commit(() => {
    for (const other of POSITIONS) {
      if (other.id !== p.id && holderFor(other)?.id === e.id) HOLDERS[other.id] = null;
    }
    HOLDERS[p.id] = e.id;
    delete ACTING[p.id];
    for (const r of REQUISITIONS) {
      if (r.positionId === p.id && OPEN_REQ.includes(r.status)) {
        r.status = "ปิดแล้ว";
        r.decidedAt = TODAY;
        r.filledBy = e.id;
      }
    }
  });
}

export function releaseHolder(positionId: number) {
  const p = positionOf(positionId);
  if (!holderFor(p)) throw new Error(`${p.title} ว่างอยู่แล้ว`);
  commit(() => {
    HOLDERS[p.id] = null;
  });
}

export function actingErrors(positionId: number, employeeId: number, until: string): Errors {
  const out: Errors = {};
  const p = positionOf(positionId);
  if (holderFor(p)) out.positionId = "รักษาการได้เฉพาะตำแหน่งที่ว่าง";
  if (!activeEmployee(employeeId)) out.employeeId = "เลือกพนักงานที่ยังทำงานอยู่";
  if (!isDate(until) || until <= TODAY) out.until = "วันสิ้นสุดรักษาการต้องหลังวันนี้";
  return out;
}

export function assignActing(positionId: number, employeeId: number, until: string) {
  const errors = actingErrors(positionId, employeeId, until);
  if (hasErrors(errors)) throw fail("มอบหมายรักษาการไม่ได้", errors);
  commit(() => {
    ACTING[positionId] = { employeeId, since: TODAY, until };
  });
}

export function endActing(positionId: number) {
  if (!ACTING[positionId]) throw new Error("ตำแหน่งนี้ไม่มีผู้รักษาการ");
  commit(() => {
    delete ACTING[positionId];
  });
}

/* ---------------------------------------------------------- requisitions */

export type RequisitionInput = { positionId: number; kind: RequisitionKind; wantedBy: string; reason: string };

export function nextRequisitionId(): string {
  const prefix = `REQ-${Number(TODAY.slice(0, 4)) + 543}-`;
  const top = Math.max(0, ...REQUISITIONS.filter((r) => r.id.startsWith(prefix)).map((r) => Number(r.id.slice(prefix.length))));
  return prefix + String(top + 1).padStart(3, "0");
}

export const openRequisitionFor = (positionId: number) =>
  REQUISITIONS.find((r) => r.positionId === positionId && OPEN_REQ.includes(r.status));

export function requisitionErrors(i: RequisitionInput): Errors {
  const out: Errors = {};
  const p = POSITIONS.find((x) => x.id === i.positionId);
  if (!p) out.positionId = "เลือกตำแหน่งที่ต้องการเปิดคำขอ";
  else if (i.kind === "ตำแหน่งว่าง" && holderFor(p)) out.positionId = "ตำแหน่งนี้มีผู้ดำรงอยู่ — ขอเป็นอัตราเพิ่มแทน";
  else if (i.kind === "ตำแหน่งว่าง" && openRequisitionFor(p.id)) out.positionId = `มีคำขอ ${openRequisitionFor(p.id)!.id} เปิดอยู่แล้ว`;
  if (!isDate(i.wantedBy) || i.wantedBy < TODAY) out.wantedBy = "วันที่ต้องการคนต้องไม่ก่อนวันนี้";
  if (i.reason.trim().length < 10) out.reason = "เขียนเหตุผลอย่างน้อย 10 ตัวอักษร";
  return out;
}

export function openRequisition(i: RequisitionInput): Requisition {
  const errors = requisitionErrors(i);
  if (hasErrors(errors)) throw fail("เปิดคำขอไม่ได้", errors);
  const r: Requisition = {
    id: nextRequisitionId(), positionId: i.positionId, openedAt: TODAY, wantedBy: i.wantedBy,
    status: "รออนุมัติ", reason: i.reason.trim(), kind: i.kind,
  };
  return commit(() => {
    REQUISITIONS.push(r);
    return r;
  });
}

const requisitionOf = (id: string) => {
  const r = REQUISITIONS.find((x) => x.id === id);
  if (!r) throw new Error(`ไม่พบคำขอ ${id}`);
  return r;
};

/**
 * Approve a request. An additional headcount becomes a real seat: a copy of
 * the requested one, empty, in the same unit, whose plan grows by one.
 */
export function approveRequisition(id: string): Requisition {
  const r = requisitionOf(id);
  if (r.status !== "รออนุมัติ") throw new Error(`คำขอ ${id} ${r.status}แล้ว`);
  return commit(() => {
    if (r.kind === "อัตราเพิ่ม") {
      const model = positionOf(r.positionId);
      const seat: Position = {
        ...model,
        id: Math.max(0, ...POSITIONS.map((x) => x.id)) + 1,
        code: nextPositionCode(),
        duties: [...model.duties],
        qualifications: [...model.qualifications],
      };
      POSITIONS.push(seat);
      HOLDERS[seat.id] = null;
      unitOf(seat.unitId).plannedHeadcount += 1;
      r.positionId = seat.id;
    }
    r.status = "อนุมัติแล้ว";
    r.decidedAt = TODAY;
    return r;
  });
}

export function rejectRequisition(id: string, note: string): Requisition {
  const r = requisitionOf(id);
  if (r.status !== "รออนุมัติ") throw new Error(`คำขอ ${id} ${r.status}แล้ว`);
  if (note.trim().length < 5) throw new Error("ระบุเหตุผลที่ไม่อนุมัติอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    r.status = "ไม่อนุมัติ";
    r.decidedAt = TODAY;
    r.decisionNote = note.trim();
    return r;
  });
}

export function startRecruiting(id: string): Requisition {
  const r = requisitionOf(id);
  if (r.status !== "อนุมัติแล้ว") throw new Error("เริ่มสรรหาได้เมื่อคำขออนุมัติแล้ว");
  return commit(() => {
    r.status = "กำลังสรรหา";
    return r;
  });
}
