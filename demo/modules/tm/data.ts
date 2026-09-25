import { COMPANY, EMPLOYEES, TODAY, tenureYears } from "../pa/data";
import type { Employee } from "../pa/data";
import { commit } from "../kit";

/**
 * Time and leave for one payroll period.
 *
 * The roster says what somebody was meant to work; the punches say what actually
 * happened. Attendance is the difference between the two, so neither can be
 * invented independently — the month of punches below is derived from the roster
 * with a fixed wobble, and a day covered by an approved leave has no punch at all.
 *
 * Every change goes through a named function at the bottom of this file, inside
 * commit(): approving a leave, correcting a punch, swapping a shift. The arrays
 * stay the same objects, so the payroll alerts, the overview and the report all
 * see the change without being told.
 */

export { TODAY };

/** ผู้ออกเอกสาร — หัวกระดาษของใบลาและหนังสือเตือน อ่านจากทะเบียนพนักงาน บริษัทเดียวกันทุกโมดูล */
export { COMPANY };

export const PERIOD_START = "2026-09-01";
export const PERIOD_END = TODAY;

export const SHIFTS = [
  { code: "A", name: "กะเช้า", start: "08:00", end: "17:00", breakMin: 60, color: "sky" },
  { code: "B", name: "กะบ่าย", start: "13:00", end: "22:00", breakMin: 60, color: "violet" },
  { code: "N", name: "กะดึก", start: "22:00", end: "07:00", breakMin: 60, color: "slate" },
  { code: "O", name: "วันหยุด", start: "—", end: "—", breakMin: 0, color: "emerald" },
  { code: "S", name: "กะเสริม", start: "09:00", end: "15:00", breakMin: 30, color: "amber" },
];

export const WEEK_DAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

/** ตารางกะรายสัปดาห์: employeeId -> กะของแต่ละวัน เรียงจันทร์ถึงอาทิตย์ */
export const ROSTER: Record<number, string[]> = {
  1: ["A", "A", "A", "A", "A", "O", "O"],
  2: ["A", "A", "A", "A", "A", "O", "O"],
  3: ["B", "B", "B", "B", "B", "O", "O"],
  4: ["A", "A", "A", "A", "A", "O", "O"],
  5: ["N", "N", "N", "O", "O", "N", "N"],
  6: ["A", "A", "B", "B", "A", "O", "O"],
  7: ["A", "A", "A", "A", "A", "S", "O"],
};

export type Holiday = { date: string; name: string };

export const HOLIDAYS: Holiday[] = [
  { date: "2026-10-13", name: "วันนวมินทรมหาราช" },
  { date: "2026-10-23", name: "วันปิยมหาราช" },
  { date: "2026-12-05", name: "วันพ่อแห่งชาติ" },
  { date: "2026-12-10", name: "วันรัฐธรรมนูญ" },
];

export const LEAVE_TYPES = [
  { name: "ลาป่วย", quota: 30, paid: true },
  { name: "ลาพักร้อน", quota: 6, paid: true },
  { name: "ลากิจ", quota: 3, paid: true },
  { name: "ลาคลอด", quota: 98, paid: true },
  { name: "ลาไม่รับค่าจ้าง", quota: 0, paid: false },
];

export const LEAVE_STATUSES = ["รออนุมัติ", "อนุมัติแล้ว", "ไม่อนุมัติ", "ยกเลิก"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export type Leave = {
  id: number;
  employeeId: number;
  type: string;
  from: string;
  to: string;
  days: number;
  status: LeaveStatus;
  reason: string;
  filedAt: string;
  decidedBy?: string;
  note?: string;
  /** ลาป่วยตั้งแต่สามวันทำงานต้องมีใบรับรองแพทย์ */
  certificate?: boolean;
};

export const LEAVES: Leave[] = [
  { id: 1, employeeId: 3, type: "ลาป่วย", from: "2026-09-22", to: "2026-09-23", days: 2, status: "รออนุมัติ", reason: "ไข้หวัด มีใบรับรองแพทย์", filedAt: "2026-09-21" },
  { id: 2, employeeId: 6, type: "ลาพักร้อน", from: "2026-10-06", to: "2026-10-10", days: 4, status: "รออนุมัติ", reason: "เดินทางต่างจังหวัดกับครอบครัว", filedAt: "2026-09-15" },
  { id: 3, employeeId: 2, type: "ลากิจ", from: "2026-09-18", to: "2026-09-18", days: 1, status: "อนุมัติแล้ว", reason: "ธุระที่อำเภอ", filedAt: "2026-09-14", decidedBy: "หัวหน้าฝ่ายบัญชี" },
  { id: 4, employeeId: 5, type: "ลาพักร้อน", from: "2026-09-29", to: "2026-10-03", days: 3, status: "รออนุมัติ", reason: "", filedAt: "2026-09-19" },
  { id: 5, employeeId: 1, type: "ลาป่วย", from: "2026-09-08", to: "2026-09-08", days: 1, status: "อนุมัติแล้ว", reason: "ปวดหลัง", filedAt: "2026-09-08", decidedBy: "กรรมการผู้จัดการ" },
  { id: 6, employeeId: 4, type: "ลากิจ", from: "2026-09-11", to: "2026-09-12", days: 1, status: "ไม่อนุมัติ", reason: "ธุระส่วนตัว", filedAt: "2026-09-07", decidedBy: "หัวหน้าฝ่ายบุคคล", note: "ตรงกับวันปิดงบเดือน ขอให้เลื่อนเป็นสัปดาห์ถัดไป" },
  { id: 7, employeeId: 7, type: "ลาไม่รับค่าจ้าง", from: "2026-09-21", to: "2026-09-21", days: 1, status: "อนุมัติแล้ว", reason: "ธุระส่วนตัว", filedAt: "2026-09-17", decidedBy: "กรรมการผู้จัดการ" },
  { id: 8, employeeId: 6, type: "ลาป่วย", from: "2026-09-03", to: "2026-09-03", days: 1, status: "อนุมัติแล้ว", reason: "ไมเกรน", filedAt: "2026-09-03", decidedBy: "หัวหน้าฝ่ายขาย" },
  { id: 9, employeeId: 3, type: "ลาพักร้อน", from: "2026-09-15", to: "2026-09-16", days: 2, status: "อนุมัติแล้ว", reason: "งานบวชญาติ", filedAt: "2026-09-08", decidedBy: "ผู้จัดการคลัง" },
];

export const empName = (id: number) => EMPLOYEES.find((e) => e.id === id)?.name ?? "—";

/** Shifts are referenced by roster and punch codes that must exist. */
export const shiftOf = (code: string) => {
  const s = SHIFTS.find((x) => x.code === code);
  if (!s) throw new Error(`ไม่รู้จักกะ ${code}`);
  return s;
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const hhmmOf = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
};

/** Monday is 0, to line up with WEEK_DAYS and the roster arrays. */
export const dowIndex = (iso: string) => (new Date(iso + "T00:00:00").getDay() + 6) % 7;

/**
 * Dates are parsed and formatted in local time, both ways.
 *
 * `new Date("2026-09-01T00:00:00")` is local midnight, and `toISOString()` on it
 * is the previous day anywhere east of UTC — which would shift the whole roster
 * by one and put the last day of the period outside it.
 */
const isoOf = (d: Date) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    out.push(isoOf(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const PERIOD_DAYS = daysBetween(PERIOD_START, PERIOD_END);

export const isHoliday = (iso: string) => HOLIDAYS.some((h) => h.date === iso);

/** An approved leave replaces the working day, so it must not also be a punch. */
export const leaveOn = (employeeId: number, iso: string) =>
  LEAVES.find(
    (l) => l.employeeId === employeeId && l.status === "อนุมัติแล้ว" && iso >= l.from && iso <= l.to
  );

export type Punch = {
  id: number;
  employeeId: number;
  date: string;
  shift: string;
  in: string | null;
  out: string | null;
};

/**
 * A fixed wobble, not a random one.
 *
 * The month has to look like attendance rather than a straight line, but it also
 * has to be the same month on every render — a table that reshuffles when React
 * re-renders is worse than one that is obviously fake.
 */
const wobble = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

function buildPunches(): Punch[] {
  const out: Punch[] = [];
  let id = 1;
  for (const employeeId of Object.keys(ROSTER).map(Number)) {
    PERIOD_DAYS.forEach((date, dayNo) => {
      const code = ROSTER[employeeId][dowIndex(date)];
      if (code === "O" || isHoliday(date) || leaveOn(employeeId, date)) return;

      const s = shiftOf(code);
      const seed = employeeId * 97 + dayNo;
      const r = wobble(seed);

      // Roughly one absence per person per month, and no punch at all for it.
      if (r < 0.055) {
        out.push({ id: id++, employeeId, date, shift: code, in: null, out: null });
        return;
      }

      const late = r < 0.2 ? 6 + Math.floor(wobble(seed + 1) * 26) : -Math.floor(wobble(seed + 2) * 9);
      const ot = wobble(seed + 3) < 0.22 ? 35 + Math.floor(wobble(seed + 4) * 85) : Math.floor(wobble(seed + 5) * 14);

      let planned = toMin(s.end) - toMin(s.start);
      if (planned < 0) planned += 1440;

      out.push({
        id: id++,
        employeeId,
        date,
        shift: code,
        in: hhmmOf(toMin(s.start) + late),
        out: hhmmOf(toMin(s.start) + late + planned + ot),
      });
    });
  }
  return out;
}

export const PUNCHES: Punch[] = buildPunches();

/**
 * สายเกิน 15 นาที นับเป็นมาสาย · อยู่เกินกะเกิน 30 นาที นับเป็นล่วงเวลา
 *
 * A day an approved leave covers is a leave day whatever the clock says: a leave
 * approved after the day was punched (sick leave filed on return, say) turns
 * the absence into leave rather than leaving both on the record.
 */
export function judge(p: Punch) {
  if (leaveOn(p.employeeId, p.date)) return { state: "ลา", lateMin: 0, otMin: 0, workedMin: 0 };
  if (!p.in || !p.out) return { state: "ขาดงาน", lateMin: 0, otMin: 0, workedMin: 0 };
  const s = shiftOf(p.shift);
  const lateMin = Math.max(0, toMin(p.in) - toMin(s.start));
  let worked = toMin(p.out) - toMin(p.in);
  if (worked < 0) worked += 24 * 60;
  let planned = toMin(s.end) - toMin(s.start);
  if (planned < 0) planned += 24 * 60;
  const otMin = Math.max(0, worked - planned);
  return {
    state: lateMin > 15 ? "มาสาย" : "ปกติ",
    lateMin,
    otMin: otMin > 30 ? otMin : 0,
    workedMin: worked - s.breakMin,
  };
}

export const hhmm = (min: number) => Math.floor(min / 60) + " ชม. " + (min % 60) + " น.";

export const punchesOn = (date: string) => PUNCHES.filter((p) => p.date === date);
export const punchesOf = (employeeId: number) => PUNCHES.filter((p) => p.employeeId === employeeId);

/**
 * The week a person works when nobody has set one: กะเช้า on the days their
 * contract names. Somebody hired through the personnel register is on the roster
 * from that moment, on this week, until a supervisor sets another.
 */
export const defaultWeek = (e: Employee): string[] =>
  e.contract.workDays === "จันทร์–เสาร์" ? ["A", "A", "A", "A", "A", "A", "O"] : ["A", "A", "A", "A", "A", "O", "O"];

/** ตารางกะของคนหนึ่ง: ที่จัดไว้ หรือกะตั้งต้นตามสัญญาจ้างสำหรับคนที่ยังทำงานอยู่ · คนที่ออกแล้วไม่มี */
export function rosterOf(employeeId: number): string[] | undefined {
  const own = ROSTER[employeeId];
  if (own) return own;
  const e = EMPLOYEES.find((x) => x.id === employeeId);
  return e && e.status !== "ลาออก" ? defaultWeek(e) : undefined;
}

/** Whether the roster template puts this person to work on a date, holidays aside. */
const templateWorks = (employeeId: number, iso: string) => {
  const code = rosterOf(employeeId)?.[dowIndex(iso)];
  return code !== undefined && code !== "O" && !isHoliday(iso);
};

/**
 * Days in the period this person was rostered to work at all.
 *
 * Read from the day records rather than from today's roster: a roster edited
 * this afternoon changes next week, not the days already worked. A leave day has
 * no record when the leave was approved before the day, so those come from the
 * roster the way the records themselves did.
 */
export const scheduledDays = (employeeId: number) =>
  PERIOD_DAYS.filter(
    (d) =>
      PUNCHES.some((p) => p.employeeId === employeeId && p.date === d) ||
      (leaveOn(employeeId, d) !== undefined && templateWorks(employeeId, d))
  );

export type Attendance = {
  scheduled: number;
  worked: number;
  late: number;
  absent: number;
  leaveDays: number;
  otMin: number;
  workedMin: number;
  rate: number;
};

export function attendanceOf(employeeId: number, leaves: Leave[] = LEAVES): Attendance {
  const mine = punchesOf(employeeId).map((p) => ({ p, j: judge(p) }));
  const days = scheduledDays(employeeId);
  const scheduled = days.length;
  const absent = mine.filter((x) => x.j.state === "ขาดงาน").length;
  const onLeave = (d: string) =>
    leaves.some((l) => l.employeeId === employeeId && l.status === "อนุมัติแล้ว" && d >= l.from && d <= l.to);
  return {
    scheduled,
    worked: mine.filter((x) => x.j.state === "ปกติ" || x.j.state === "มาสาย").length,
    late: mine.filter((x) => x.j.state === "มาสาย").length,
    absent,
    leaveDays: days.filter(onLeave).length,
    otMin: mine.reduce((n, x) => n + x.j.otMin, 0),
    workedMin: mine.reduce((n, x) => n + x.j.workedMin, 0),
    rate: scheduled === 0 ? 100 : Math.round(((scheduled - absent) / scheduled) * 100),
  };
}

/** Leave days already taken against a quota, from whichever list is current. */
export const usedLeave = (employeeId: number, type: string, leaves: Leave[] = LEAVES) =>
  leaves
    .filter((l) => l.employeeId === employeeId && l.type === type && l.status === "อนุมัติแล้ว")
    .reduce((n, l) => n + l.days, 0);

/**
 * Kept for code that imported it; it was worked out once, at load. Screens read
 * rostered() instead, so somebody hired and given a roster later appears.
 */
export const ROSTERED = EMPLOYEES.filter((e) => ROSTER[e.id]);

/** ทุกคนที่ยังทำงานอยู่ อ่านใหม่ทุกครั้ง — พนักงานที่เพิ่งรับเข้าขึ้นตารางทันทีด้วยกะตั้งต้น */
export const rostered = (): Employee[] => EMPLOYEES.filter((e) => e.status !== "ลาออก");

/** คนที่ยังใช้กะตั้งต้นตามสัญญา ยังไม่มีใครจัดกะให้ — ส่วนใหญ่คือพนักงานที่เพิ่งรับเข้า */
export const unrostered = (): Employee[] => EMPLOYEES.filter((e) => e.status !== "ลาออก" && !ROSTER[e.id]);

/* ================================================================ rules */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A running number the way the paper forms print it: LV-2569-0010. */
const runningNo = (prefix: string, n: number, iso: string = TODAY) =>
  `${prefix}-${Number(iso.slice(0, 4)) + 543}-${String(n).padStart(4, "0")}`;

const nextId = (list: { id: number }[]) => Math.max(0, ...list.map((x) => x.id)) + 1;

const firstError = (errors: Record<string, string>) => {
  const message = Object.values(errors)[0];
  if (message) throw new Error(message);
};

const employeeById = (id: number) => {
  const e = EMPLOYEES.find((x) => x.id === id);
  if (!e) throw new Error(`ไม่พบพนักงาน ${id}`);
  return e;
};

/** กะของคนหนึ่งในวันหนึ่ง: กะที่สลับไว้แล้วมาก่อน ไม่มีจึงอ่านจากตารางกะรายสัปดาห์ */
export function shiftOn(employeeId: number, iso: string): string | undefined {
  const swap = SHIFT_SWAPS.find(
    (s) => s.status === "อนุมัติแล้ว" && s.date === iso && (s.employeeId === employeeId || s.withEmployeeId === employeeId)
  );
  if (swap) return swap.employeeId === employeeId ? swap.withShift : swap.shift;
  return rosterOf(employeeId)?.[dowIndex(iso)];
}

/** Whether somebody is due at work on a date: rostered, not a day off, not a company holiday. */
export const isWorkday = (employeeId: number, iso: string) => {
  const code = shiftOn(employeeId, iso);
  return code !== undefined && code !== "O" && !isHoliday(iso);
};

/** Minutes of work a shift plans, its break taken off. */
export const plannedMinutes = (code: string) => {
  if (code === "O") return 0;
  const s = shiftOf(code);
  let mins = toMin(s.end) - toMin(s.start);
  if (mins < 0) mins += 1440;
  return mins - s.breakMin;
};

export const weekOf = (iso: string) => addDays(iso, -dowIndex(iso));

/* ---------------------------------------------------------------- leave */

export const leaveNo = (l: Leave) => runningNo("LV", l.id, l.filedAt);

export const leaveTypeOf = (name: string) => {
  const t = LEAVE_TYPES.find((x) => x.name === name);
  if (!t) throw new Error(`ไม่รู้จักประเภทลา ${name}`);
  return t;
};

/**
 * พักร้อนตามอายุงาน: ครบหนึ่งปีได้หกวันทำงานตามกฎหมายคุ้มครองแรงงาน
 * แล้วเพิ่มตามนโยบายบริษัทเมื่ออายุงานถึงสามปีและห้าปี
 */
export const ANNUAL_LEAVE_STEPS = [
  { years: 5, days: 10 },
  { years: 3, days: 8 },
  { years: 1, days: 6 },
];

/** สิทธิ์ลาต่อปีของคนหนึ่ง — พักร้อนคิดตามอายุงาน ประเภทอื่นเท่ากันทุกคน */
export function leaveQuota(employeeId: number, type: string): number {
  const t = leaveTypeOf(type);
  if (type !== "ลาพักร้อน") return t.quota;
  const years = tenureYears(employeeById(employeeId));
  return ANNUAL_LEAVE_STEPS.find((s) => years >= s.years)?.days ?? 0;
}

export type LeaveBalance = {
  quota: number;
  /** วันที่อนุมัติไปแล้วในปี */
  used: number;
  /** วันที่ยื่นไว้และรอพิจารณา — กันไว้จากสิทธิ์แล้ว */
  pending: number;
  /** สิทธิ์ที่เหลือหลังหักวันที่อนุมัติแล้ว */
  left: number;
  /** ลาไม่รับค่าจ้างไม่มีเพดาน */
  limited: boolean;
};

export function leaveBalance(employeeId: number, type: string, year: string = TODAY.slice(0, 4)): LeaveBalance {
  const t = leaveTypeOf(type);
  const quota = leaveQuota(employeeId, type);
  const mine = LEAVES.filter((l) => l.employeeId === employeeId && l.type === type && l.from.startsWith(year));
  const days = (status: LeaveStatus) => mine.filter((l) => l.status === status).reduce((n, l) => n + l.days, 0);
  const used = days("อนุมัติแล้ว");
  return { quota, used, pending: days("รออนุมัติ"), left: quota - used, limited: t.paid };
}

/**
 * วันลาที่หักสิทธิ์: เฉพาะวันที่ต้องมาทำงานตามตารางกะ วันหยุดประจำสัปดาห์และวันหยุด
 * บริษัทไม่นับ · ลาคลอดนับต่อเนื่องทุกวันรวมวันหยุด ตามกฎหมายคุ้มครองแรงงาน
 */
export function leaveDaysOf(employeeId: number, type: string, from: string, to: string): number {
  const days = daysBetween(from, to);
  if (type === "ลาคลอด") return days.length;
  return days.filter((d) => isWorkday(employeeId, d)).length;
}

export type LeaveDraft = {
  employeeId: number;
  type: string;
  from: string;
  to: string;
  reason: string;
  certificate: boolean;
};

/**
 * What is wrong with a leave request, keyed by the field that is wrong.
 *
 * A request that would take more than is left is refused here rather than
 * warned about: days already waiting for a decision are held against the
 * balance, so two requests cannot each fit on their own and overdraw together.
 */
export function leaveErrors(d: LeaveDraft, editingId?: number): Record<string, string> {
  const e: Record<string, string> = {};
  const employee = EMPLOYEES.find((x) => x.id === d.employeeId);
  if (!employee || employee.status === "ลาออก") e.employeeId = "เลือกพนักงานที่ยังทำงานอยู่";
  if (!LEAVE_TYPES.some((t) => t.name === d.type)) e.type = "เลือกประเภทการลา";
  if (!ISO_DATE.test(d.from)) e.from = "เลือกวันที่เริ่มลา";
  else if (d.from < PERIOD_START) e.from = `ยื่นลาย้อนหลังได้ถึงวันต้นงวด ${PERIOD_START}`;
  if (!ISO_DATE.test(d.to)) e.to = "เลือกวันที่สิ้นสุด";
  else if (!e.from && d.to < d.from) e.to = "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่ม";
  if (d.reason.trim().length < 5) e.reason = "เขียนเหตุผลอย่างน้อย 5 ตัวอักษร";
  if (e.employeeId || e.type || e.from || e.to) return e;

  const days = leaveDaysOf(d.employeeId, d.type, d.from, d.to);
  if (days === 0) {
    e.to = "ช่วงนี้ไม่มีวันทำงานตามตารางกะ จึงไม่ต้องยื่นลา";
    return e;
  }

  const clash = LEAVES.find(
    (l) =>
      l.id !== editingId &&
      l.employeeId === d.employeeId &&
      (l.status === "รออนุมัติ" || l.status === "อนุมัติแล้ว") &&
      l.from <= d.to &&
      d.from <= l.to
  );
  if (clash) e.from = `ซ้อนกับใบลา ${leaveNo(clash)} (${clash.type} ${clash.from} ถึง ${clash.to})`;

  const b = leaveBalance(d.employeeId, d.type, d.from.slice(0, 4));
  if (b.limited && !clash) {
    const self = editingId === undefined ? undefined : LEAVES.find((l) => l.id === editingId);
    const held = b.pending - (self && self.type === d.type && self.status === "รออนุมัติ" ? self.days : 0);
    const available = b.left - held;
    if (b.quota === 0 && d.type === "ลาพักร้อน") e.to = "อายุงานยังไม่ครบหนึ่งปี จึงยังไม่มีสิทธิ์ลาพักร้อน";
    else if (days > available) {
      e.to = `เกินสิทธิ์คงเหลือ · ${d.type} ใช้ได้อีก ${Math.max(0, available)} วัน แต่ช่วงนี้มี ${days} วันทำงาน`;
    }
  }

  if (d.type === "ลาป่วย" && days >= 3 && !d.certificate) {
    e.certificate = "ลาป่วยตั้งแต่ 3 วันทำงานขึ้นไปต้องมีใบรับรองแพทย์";
  }
  return e;
}

/** ยื่นใบลาใหม่ — เข้าคิวรออนุมัติ เลขที่ต่อจากใบล่าสุด */
export function fileLeave(d: LeaveDraft): Leave {
  firstError(leaveErrors(d));
  return commit(() => {
    const leave: Leave = {
      id: nextId(LEAVES),
      employeeId: d.employeeId,
      type: d.type,
      from: d.from,
      to: d.to,
      days: leaveDaysOf(d.employeeId, d.type, d.from, d.to),
      status: "รออนุมัติ",
      reason: d.reason.trim(),
      filedAt: TODAY,
      certificate: d.certificate || undefined,
    };
    LEAVES.push(leave);
    return leave;
  });
}

const leaveById = (id: number) => {
  const l = LEAVES.find((x) => x.id === id);
  if (!l) throw new Error(`ไม่พบใบลา ${id}`);
  return l;
};

/** แก้ใบลาที่ยังรออนุมัติ — ใบที่พิจารณาแล้วแก้ไม่ได้ ต้องยกเลิกแล้วยื่นใหม่ */
export function updateLeave(id: number, d: LeaveDraft): Leave {
  const leave = leaveById(id);
  if (leave.status !== "รออนุมัติ") throw new Error("แก้ได้เฉพาะใบลาที่ยังรออนุมัติ");
  firstError(leaveErrors(d, id));
  return commit(() => {
    leave.employeeId = d.employeeId;
    leave.type = d.type;
    leave.from = d.from;
    leave.to = d.to;
    leave.days = leaveDaysOf(d.employeeId, d.type, d.from, d.to);
    leave.reason = d.reason.trim();
    leave.certificate = d.certificate || undefined;
    return leave;
  });
}

export function approveLeave(id: number, by = "คุณ"): Leave {
  const leave = leaveById(id);
  if (leave.status !== "รออนุมัติ") throw new Error(`ใบลานี้${leave.status}แล้ว`);
  return commit(() => {
    leave.status = "อนุมัติแล้ว";
    leave.decidedBy = by;
    return leave;
  });
}

export function rejectLeave(id: number, reason: string, by = "คุณ"): Leave {
  const leave = leaveById(id);
  if (leave.status !== "รออนุมัติ") throw new Error(`ใบลานี้${leave.status}แล้ว`);
  if (reason.trim().length < 5) throw new Error("ระบุเหตุผลที่ไม่อนุมัติอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    leave.status = "ไม่อนุมัติ";
    leave.decidedBy = by;
    leave.note = reason.trim();
    return leave;
  });
}

/** ยกเลิกได้ขณะรออนุมัติ หรืออนุมัติแล้วแต่ยังไม่ถึงวันลา — วันที่ลาไปแล้วยกเลิกย้อนหลังไม่ได้ */
export const canCancelLeave = (l: Leave) =>
  l.status === "รออนุมัติ" || (l.status === "อนุมัติแล้ว" && l.from > TODAY);

export function cancelLeave(id: number, reason: string): Leave {
  const leave = leaveById(id);
  if (!canCancelLeave(leave)) throw new Error("ใบลานี้ยกเลิกไม่ได้ เพราะพิจารณาไม่อนุมัติไปแล้วหรือถึงวันลาแล้ว");
  if (reason.trim().length < 5) throw new Error("ระบุเหตุผลที่ยกเลิกอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    leave.status = "ยกเลิก";
    leave.note = `ยกเลิกเมื่อ ${TODAY} · ${reason.trim()}`;
    return leave;
  });
}

/* ---------------------------------------------------------- punch fixes */

export type RequestStatus = "รออนุมัติ" | "อนุมัติแล้ว" | "ไม่อนุมัติ";

/**
 * คำขอแก้เวลาตอกบัตร — เวลาในบันทึกยังเป็นของเดิมจนกว่าหัวหน้าจะอนุมัติ
 * `before` เก็บเวลาเดิมไว้ให้ตรวจย้อนหลังได้ว่าแก้จากอะไรเป็นอะไร
 */
export type PunchFix = {
  id: number;
  punchId: number;
  employeeId: number;
  date: string;
  in: string;
  out: string;
  before: { in: string | null; out: string | null };
  reason: string;
  status: RequestStatus;
  filedAt: string;
  decidedBy?: string;
  note?: string;
};

const punchById = (id: number) => {
  const p = PUNCHES.find((x) => x.id === id);
  if (!p) throw new Error(`ไม่พบบันทึกเวลา ${id}`);
  return p;
};

/** Seed requests point at real day records, found by what they are rather than by id. */
const seedPunch = (employeeId: number, date: string) => {
  const p = PUNCHES.find((x) => x.employeeId === employeeId && x.date === date);
  if (!p) throw new Error(`ไม่มีบันทึกเวลาของพนักงาน ${employeeId} วันที่ ${date}`);
  return p;
};

const fixSeed = (
  id: number,
  employeeId: number,
  date: string,
  times: { in: string; out?: string },
  rest: Pick<PunchFix, "reason" | "status" | "filedAt" | "decidedBy" | "note">
): PunchFix => {
  const p = seedPunch(employeeId, date);
  return {
    id,
    punchId: p.id,
    employeeId,
    date,
    in: times.in,
    out: times.out ?? p.out ?? shiftOf(p.shift).end,
    before: { in: p.in, out: p.out },
    ...rest,
  };
};

export const PUNCH_FIXES: PunchFix[] = [
  fixSeed(1, 1, "2026-09-07", { in: "07:56" }, {
    reason: "สแกนหน้าไม่ผ่านตอนเช้า ต้องสแกนซ้ำหลังประชุม",
    status: "ไม่อนุมัติ",
    filedAt: "2026-09-09",
    decidedBy: "กรรมการผู้จัดการ",
    note: "ไม่พบบันทึกการสแกนที่ล้มเหลวในเครื่อง ขอให้แจ้งฝ่ายบุคคลภายในวันเดียวกันครั้งต่อไป",
  }),
  fixSeed(2, 4, "2026-09-08", { in: "07:55" }, {
    reason: "เครื่องสแกนหน้าชั้น 2 ขัดข้องช่วงเช้า เข้างานจริง 07:55 มีรปภ.ยืนยัน",
    status: "รออนุมัติ",
    filedAt: "2026-09-08",
  }),
  fixSeed(3, 1, "2026-09-17", { in: "08:00", out: "18:10" }, {
    reason: "ไปพบลูกค้าที่ระยองทั้งวัน ไม่ได้เข้าออฟฟิศจึงไม่ได้ตอกบัตร",
    status: "รออนุมัติ",
    filedAt: "2026-09-18",
  }),
];

export const fixesOf = (punchId: number) => PUNCH_FIXES.filter((f) => f.punchId === punchId);
export const pendingFixOf = (punchId: number) =>
  PUNCH_FIXES.find((f) => f.punchId === punchId && f.status === "รออนุมัติ");

export type PunchFixDraft = { punchId: number; in: string; out: string; reason: string };

export function punchFixErrors(d: PunchFixDraft): Record<string, string> {
  const e: Record<string, string> = {};
  const p = PUNCHES.find((x) => x.id === d.punchId);
  if (!p) return { in: "ไม่พบบันทึกเวลาของวันนี้" };
  if (leaveOn(p.employeeId, p.date)) e.in = "วันนี้เป็นวันลาที่อนุมัติแล้ว ไม่ต้องแก้เวลา";
  if (!HH_MM.test(d.in)) e.in = "กรอกเวลาเข้าแบบ ชช:นน เช่น 08:00";
  if (!HH_MM.test(d.out)) e.out = "กรอกเวลาออกแบบ ชช:นน เช่น 17:00";
  else if (d.in === d.out) e.out = "เวลาออกต้องไม่เท่ากับเวลาเข้า";
  if (!e.in && !e.out && d.in === p.in && d.out === p.out) e.in = "เวลาเหมือนในบันทึกอยู่แล้ว";
  if (pendingFixOf(p.id)) e.in = "วันนี้มีคำขอแก้เวลารออนุมัติอยู่แล้ว";
  if (d.reason.trim().length < 5) e.reason = "เขียนเหตุผลอย่างน้อย 5 ตัวอักษร หัวหน้าต้องใช้ประกอบการพิจารณา";
  return e;
}

/** ยื่นคำขอแก้เวลา — ผลของวันนั้นยังไม่เปลี่ยนจนกว่าจะอนุมัติ */
export function requestPunchFix(d: PunchFixDraft): PunchFix {
  firstError(punchFixErrors(d));
  const p = punchById(d.punchId);
  return commit(() => {
    const fix: PunchFix = {
      id: nextId(PUNCH_FIXES),
      punchId: p.id,
      employeeId: p.employeeId,
      date: p.date,
      in: d.in,
      out: d.out,
      before: { in: p.in, out: p.out },
      reason: d.reason.trim(),
      status: "รออนุมัติ",
      filedAt: TODAY,
    };
    PUNCH_FIXES.push(fix);
    return fix;
  });
}

const fixById = (id: number) => {
  const f = PUNCH_FIXES.find((x) => x.id === id);
  if (!f) throw new Error(`ไม่พบคำขอแก้เวลา ${id}`);
  return f;
};

/** อนุมัติแล้วเวลาในบันทึกจึงเปลี่ยน — สาย ขาด และล่วงเวลาของวันนั้นคิดใหม่จากเวลาที่แก้ */
export function approvePunchFix(id: number, by = "คุณ"): PunchFix {
  const fix = fixById(id);
  if (fix.status !== "รออนุมัติ") throw new Error(`คำขอนี้${fix.status}แล้ว`);
  const p = punchById(fix.punchId);
  return commit(() => {
    p.in = fix.in;
    p.out = fix.out;
    fix.status = "อนุมัติแล้ว";
    fix.decidedBy = by;
    return fix;
  });
}

export function rejectPunchFix(id: number, reason: string, by = "คุณ"): PunchFix {
  const fix = fixById(id);
  if (fix.status !== "รออนุมัติ") throw new Error(`คำขอนี้${fix.status}แล้ว`);
  if (reason.trim().length < 5) throw new Error("ระบุเหตุผลที่ไม่อนุมัติอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    fix.status = "ไม่อนุมัติ";
    fix.decidedBy = by;
    fix.note = reason.trim();
    return fix;
  });
}

/* -------------------------------------------------------------- overtime */

/** ล่วงเวลารวมทำงานในวันหยุด ไม่เกินสัปดาห์ละ 36 ชั่วโมง ตามกฎกระทรวง */
export const OT_WEEKLY_CAP = 36;

/** คำขอทำงานล่วงเวลา — จ่ายเฉพาะชั่วโมงที่อนุมัติ วันทำงาน 1.5 เท่า วันหยุด 3 เท่า */
export type OtRequest = {
  id: number;
  employeeId: number;
  date: string;
  hours: number;
  rate: number;
  reason: string;
  status: RequestStatus;
  filedAt: string;
  decidedBy?: string;
  note?: string;
};

export const OT_REQUESTS: OtRequest[] = [
  { id: 1, employeeId: 2, date: "2026-09-10", hours: 2.5, rate: 1.5, reason: "ปิดงบประจำเดือนสิงหาคมให้ทันส่งผู้สอบบัญชี", status: "อนุมัติแล้ว", filedAt: "2026-09-09", decidedBy: "หัวหน้าฝ่ายบัญชี" },
  { id: 2, employeeId: 4, date: "2026-09-15", hours: 2, rate: 1.5, reason: "เตรียมข้อมูลเงินเดือนงวดกันยายน", status: "อนุมัติแล้ว", filedAt: "2026-09-14", decidedBy: "กรรมการผู้จัดการ" },
  { id: 3, employeeId: 3, date: "2026-09-24", hours: 3, rate: 1.5, reason: "ตรวจนับสต็อกปลายเดือนก่อนปิดงวด", status: "รออนุมัติ", filedAt: "2026-09-22" },
  { id: 4, employeeId: 5, date: "2026-09-25", hours: 4, rate: 3, reason: "ซ่อมบำรุงเครื่องจักรประจำไตรมาสในวันหยุดของกะ", status: "รออนุมัติ", filedAt: "2026-09-21" },
];

/** วันที่ไม่ต้องมาทำงาน — วันหยุดของกะหรือวันหยุดบริษัท — ล่วงเวลาคิด 3 เท่า */
export const otRateOn = (employeeId: number, iso: string) => (isWorkday(employeeId, iso) ? 1.5 : 3);

export type OtDraft = { employeeId: number; date: string; hours: string; reason: string };

export function otErrors(d: OtDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!rosterOf(d.employeeId)) e.employeeId = "เลือกพนักงานที่ยังทำงานอยู่";
  if (!ISO_DATE.test(d.date)) e.date = "เลือกวันที่ทำล่วงเวลา";
  else if (d.date < PERIOD_START) e.date = `ขอย้อนหลังได้ถึงวันต้นงวด ${PERIOD_START}`;
  else if (d.date > addDays(TODAY, 30)) e.date = "ขอล่วงหน้าได้ไม่เกิน 30 วัน";
  const hours = Number(d.hours);
  if (d.hours.trim() === "" || !Number.isFinite(hours) || hours <= 0) e.hours = "กรอกจำนวนชั่วโมงมากกว่า 0";
  else if (hours * 2 !== Math.round(hours * 2)) e.hours = "กรอกเป็นช่วงครึ่งชั่วโมง เช่น 2 หรือ 2.5";
  else if (hours > 12) e.hours = "ขอได้ไม่เกิน 12 ชั่วโมงต่อวัน";
  if (d.reason.trim().length < 5) e.reason = "เขียนงานที่ต้องทำอย่างน้อย 5 ตัวอักษร";
  if (e.employeeId || e.date || e.hours) return e;

  if (leaveOn(d.employeeId, d.date)) e.date = "วันนี้เป็นวันลาที่อนุมัติแล้ว";
  const live = OT_REQUESTS.filter(
    (o) => o.employeeId === d.employeeId && (o.status === "รออนุมัติ" || o.status === "อนุมัติแล้ว")
  );
  if (live.some((o) => o.date === d.date)) e.date = "วันนี้มีคำขอล่วงเวลาอยู่แล้ว";
  const week = weekOf(d.date);
  const inWeek = live.filter((o) => weekOf(o.date) === week).reduce((n, o) => n + o.hours, 0);
  if (inWeek + hours > OT_WEEKLY_CAP) {
    e.hours = `สัปดาห์นี้จะรวมเป็น ${inWeek + hours} ชม. เกินเพดาน ${OT_WEEKLY_CAP} ชม. ต่อสัปดาห์ตามกฎหมาย`;
  }
  return e;
}

export function requestOt(d: OtDraft): OtRequest {
  firstError(otErrors(d));
  return commit(() => {
    const ot: OtRequest = {
      id: nextId(OT_REQUESTS),
      employeeId: d.employeeId,
      date: d.date,
      hours: Number(d.hours),
      rate: otRateOn(d.employeeId, d.date),
      reason: d.reason.trim(),
      status: "รออนุมัติ",
      filedAt: TODAY,
    };
    OT_REQUESTS.push(ot);
    return ot;
  });
}

const otById = (id: number) => {
  const o = OT_REQUESTS.find((x) => x.id === id);
  if (!o) throw new Error(`ไม่พบคำขอล่วงเวลา ${id}`);
  return o;
};

export function approveOt(id: number, by = "คุณ"): OtRequest {
  const ot = otById(id);
  if (ot.status !== "รออนุมัติ") throw new Error(`คำขอนี้${ot.status}แล้ว`);
  return commit(() => {
    ot.status = "อนุมัติแล้ว";
    ot.decidedBy = by;
    return ot;
  });
}

export function rejectOt(id: number, reason: string, by = "คุณ"): OtRequest {
  const ot = otById(id);
  if (ot.status !== "รออนุมัติ") throw new Error(`คำขอนี้${ot.status}แล้ว`);
  if (reason.trim().length < 5) throw new Error("ระบุเหตุผลที่ไม่อนุมัติอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    ot.status = "ไม่อนุมัติ";
    ot.decidedBy = by;
    ot.note = reason.trim();
    return ot;
  });
}

/** ชั่วโมงล่วงเวลาที่อนุมัติแล้วในงวด — ยอดที่ฝ่ายเงินเดือนใช้จ่าย */
export const approvedOtHours = (employeeId: number) =>
  OT_REQUESTS.filter(
    (o) => o.employeeId === employeeId && o.status === "อนุมัติแล้ว" && o.date >= PERIOD_START && o.date <= PERIOD_END
  ).reduce((n, o) => n + o.hours, 0);

/* ----------------------------------------------------------- the roster */

/** เวลาทำงานปกติไม่เกินสัปดาห์ละ 48 ชั่วโมง ตามกฎหมายคุ้มครองแรงงาน */
export const WEEKLY_HOURS_CAP = 48;

export function rosterErrors(week: string[]): Record<string, string> {
  if (week.length !== 7 || week.some((c) => !SHIFTS.some((s) => s.code === c))) {
    return { week: "เลือกกะให้ครบทั้งเจ็ดวัน" };
  }
  if (!week.includes("O")) return { week: "ต้องมีวันหยุดประจำสัปดาห์อย่างน้อย 1 วัน ตามกฎหมายคุ้มครองแรงงาน" };
  if (week.every((c) => c === "O")) return { week: "ต้องมีวันทำงานอย่างน้อย 1 วัน" };
  const minutes = week.reduce((n, c) => n + plannedMinutes(c), 0);
  if (minutes > WEEKLY_HOURS_CAP * 60) {
    return { week: `เวลาทำงานตามแผน ${hhmm(minutes)} เกิน ${WEEKLY_HOURS_CAP} ชั่วโมงต่อสัปดาห์` };
  }
  return {};
}

/** จัดตารางกะให้คนหนึ่งทั้งสัปดาห์ — ใช้กับพนักงานใหม่หรือเปลี่ยนรูปแบบกะทั้งชุด */
export function assignRoster(employeeId: number, week: string[]): string[] {
  const e = employeeById(employeeId);
  if (e.status === "ลาออก") throw new Error(`${e.name} ลาออกแล้ว`);
  firstError(rosterErrors(week));
  return commit(() => {
    ROSTER[employeeId] = [...week];
    return ROSTER[employeeId];
  });
}

/** เปลี่ยนกะวันเดียวในตารางรายสัปดาห์ — มีผลกับสัปดาห์ถัดไป วันที่ทำไปแล้วไม่เปลี่ยน */
export function setRosterShift(employeeId: number, dow: number, code: string): string[] {
  const week = rosterOf(employeeId);
  if (!week) throw new Error(`${empName(employeeId)} ไม่ได้ทำงานอยู่แล้ว`);
  const next = week.map((c, i) => (i === dow ? code : c));
  firstError(rosterErrors(next));
  return commit(() => {
    // A default week is written down the first time somebody changes it.
    ROSTER[employeeId] ??= next;
    ROSTER[employeeId][dow] = code;
    return ROSTER[employeeId];
  });
}

/* ---------------------------------------------------------- shift swaps */

/** คำขอสลับกะของสองคนในวันเดียว — อนุมัติแล้ว shiftOn() ของวันนั้นจึงสลับกัน */
export type ShiftSwap = {
  id: number;
  date: string;
  employeeId: number;
  shift: string;
  withEmployeeId: number;
  withShift: string;
  reason: string;
  status: RequestStatus;
  filedAt: string;
  decidedBy?: string;
  note?: string;
};

export const SHIFT_SWAPS: ShiftSwap[] = [
  { id: 1, date: "2026-09-25", employeeId: 3, shift: "B", withEmployeeId: 7, withShift: "A", reason: "พาแม่ไปตรวจที่โรงพยาบาลช่วงบ่าย ขอสลับไปเข้ากะเช้า", status: "รออนุมัติ", filedAt: "2026-09-21" },
  { id: 2, date: "2026-09-30", employeeId: 6, shift: "B", withEmployeeId: 1, withShift: "A", reason: "นัดประชุมลูกค้าที่ชลบุรีช่วงเช้า", status: "อนุมัติแล้ว", filedAt: "2026-09-18", decidedBy: "กรรมการผู้จัดการ" },
];

export type SwapDraft = { employeeId: number; withEmployeeId: number; date: string; reason: string };

export function swapErrors(d: SwapDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!rosterOf(d.employeeId)) e.employeeId = "เลือกพนักงานที่ยังทำงานอยู่";
  if (!rosterOf(d.withEmployeeId)) e.withEmployeeId = "เลือกพนักงานที่ยังทำงานอยู่";
  else if (d.withEmployeeId === d.employeeId) e.withEmployeeId = "เลือกคนที่จะสลับด้วยให้เป็นอีกคน";
  if (!ISO_DATE.test(d.date)) e.date = "เลือกวันที่จะสลับกะ";
  else if (d.date <= TODAY) e.date = "สลับกะได้เฉพาะวันที่ยังไม่ถึง";
  else if (d.date > addDays(TODAY, 30)) e.date = "สลับล่วงหน้าได้ไม่เกิน 30 วัน";
  if (d.reason.trim().length < 5) e.reason = "เขียนเหตุผลอย่างน้อย 5 ตัวอักษร";
  if (e.employeeId || e.withEmployeeId || e.date) return e;

  if (isHoliday(d.date)) e.date = "วันนี้เป็นวันหยุดบริษัท ไม่ต้องสลับกะ";
  else if (shiftOn(d.employeeId, d.date) === shiftOn(d.withEmployeeId, d.date)) {
    e.withEmployeeId = "สองคนนี้เข้ากะเดียวกันในวันนั้นอยู่แล้ว";
  }
  const busy = SHIFT_SWAPS.find(
    (s) =>
      s.date === d.date &&
      (s.status === "รออนุมัติ" || s.status === "อนุมัติแล้ว") &&
      [s.employeeId, s.withEmployeeId].some((id) => id === d.employeeId || id === d.withEmployeeId)
  );
  if (busy) e.date = "วันนี้มีคำขอสลับกะของคนใดคนหนึ่งอยู่แล้ว";
  if (leaveOn(d.employeeId, d.date) || leaveOn(d.withEmployeeId, d.date)) e.date = "มีคนหนึ่งลาในวันนั้น";
  return e;
}

export function requestSwap(d: SwapDraft): ShiftSwap {
  firstError(swapErrors(d));
  return commit(() => {
    const swap: ShiftSwap = {
      id: nextId(SHIFT_SWAPS),
      date: d.date,
      employeeId: d.employeeId,
      shift: shiftOn(d.employeeId, d.date)!,
      withEmployeeId: d.withEmployeeId,
      withShift: shiftOn(d.withEmployeeId, d.date)!,
      reason: d.reason.trim(),
      status: "รออนุมัติ",
      filedAt: TODAY,
    };
    SHIFT_SWAPS.push(swap);
    return swap;
  });
}

const swapById = (id: number) => {
  const s = SHIFT_SWAPS.find((x) => x.id === id);
  if (!s) throw new Error(`ไม่พบคำขอสลับกะ ${id}`);
  return s;
};

export function approveSwap(id: number, by = "คุณ"): ShiftSwap {
  const swap = swapById(id);
  if (swap.status !== "รออนุมัติ") throw new Error(`คำขอนี้${swap.status}แล้ว`);
  return commit(() => {
    swap.status = "อนุมัติแล้ว";
    swap.decidedBy = by;
    return swap;
  });
}

export function rejectSwap(id: number, reason: string, by = "คุณ"): ShiftSwap {
  const swap = swapById(id);
  if (swap.status !== "รออนุมัติ") throw new Error(`คำขอนี้${swap.status}แล้ว`);
  if (reason.trim().length < 5) throw new Error("ระบุเหตุผลที่ไม่อนุมัติอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    swap.status = "ไม่อนุมัติ";
    swap.decidedBy = by;
    swap.note = reason.trim();
    return swap;
  });
}

/* ------------------------------------------------------------- holidays */

export function holidayErrors(d: Holiday): Record<string, string> {
  const e: Record<string, string> = {};
  if (!ISO_DATE.test(d.date)) e.date = "เลือกวันที่";
  else if (d.date <= TODAY) e.date = "เพิ่มได้เฉพาะวันที่ยังไม่ถึง วันที่ผ่านมาแล้วมีบันทึกเวลาอยู่";
  else if (isHoliday(d.date)) e.date = "วันนี้เป็นวันหยุดอยู่แล้ว";
  if (d.name.trim().length < 3) e.name = "ตั้งชื่อวันหยุด";
  return e;
}

/** ประกาศวันหยุดบริษัท — วันนั้นไม่นับเป็นวันทำงาน ไม่หักสิทธิ์ลา และล่วงเวลาคิด 3 เท่า */
export function addHoliday(d: Holiday): Holiday {
  firstError(holidayErrors(d));
  return commit(() => {
    const h = { date: d.date, name: d.name.trim() };
    HOLIDAYS.push(h);
    HOLIDAYS.sort((a, b) => a.date.localeCompare(b.date));
    return h;
  });
}

export function removeHoliday(date: string): void {
  const at = HOLIDAYS.findIndex((h) => h.date === date);
  if (at < 0) throw new Error(`ไม่มีวันหยุดวันที่ ${date}`);
  if (date <= TODAY) throw new Error("วันหยุดที่ผ่านมาแล้วลบไม่ได้");
  commit(() => HOLIDAYS.splice(at, 1));
}

/* ------------------------------------------------------------ follow-up */

export const FOLLOW_UP_KINDS = ["แจ้งเตือน", "ตักเตือนด้วยวาจา", "หนังสือเตือน"] as const;
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

export const FOLLOW_UP_TOPICS = ["มาสาย", "ขาดงาน", "ลืมตอกบัตร", "ออกก่อนเวลา"] as const;
export type FollowUpTopic = (typeof FOLLOW_UP_TOPICS)[number];

/**
 * การติดตามการเข้างาน: ข้อความเตือน การตักเตือนด้วยวาจา และหนังสือเตือน
 * หนังสือเตือนมีผลหนึ่งปีนับจากวันที่ทำผิด ตามมาตรา 119 พ.ร.บ.คุ้มครองแรงงาน
 */
export type FollowUp = {
  id: number;
  no: string;
  employeeId: number;
  date: string;
  kind: FollowUpKind;
  topic: FollowUpTopic;
  detail: string;
  by: string;
};

export const FOLLOW_UPS: FollowUp[] = [
  { id: 1, no: "FU-2569-0001", employeeId: 1, date: "2026-09-08", kind: "แจ้งเตือน", topic: "มาสาย", detail: "มาสายวันที่ 2 และ 7 ก.ย. เกินเกณฑ์ 15 นาที ขอให้เข้างานตรงเวลาตามกะ", by: "ฝ่ายบุคคล" },
  { id: 2, no: "FU-2569-0002", employeeId: 3, date: "2026-09-08", kind: "ตักเตือนด้วยวาจา", topic: "ขาดงาน", detail: "ขาดงานวันที่ 7 ก.ย. โดยไม่แจ้งหัวหน้าล่วงหน้า ได้ชี้แจงขั้นตอนการแจ้งลาแล้ว", by: "ผู้จัดการคลัง" },
];

export type FollowUpDraft = { employeeId: number; kind: FollowUpKind; topic: FollowUpTopic; detail: string };

export function followUpErrors(d: FollowUpDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!EMPLOYEES.some((x) => x.id === d.employeeId)) e.employeeId = "เลือกพนักงาน";
  if (!FOLLOW_UP_KINDS.includes(d.kind)) e.kind = "เลือกรูปแบบการติดตาม";
  if (!FOLLOW_UP_TOPICS.includes(d.topic)) e.topic = "เลือกเรื่อง";
  if (d.detail.trim().length < 10) e.detail = "เขียนรายละเอียดอย่างน้อย 10 ตัวอักษร ให้ระบุวันที่และสิ่งที่เกิดขึ้น";
  return e;
}

export function recordFollowUp(d: FollowUpDraft, by = "คุณ"): FollowUp {
  firstError(followUpErrors(d));
  return commit(() => {
    const id = nextId(FOLLOW_UPS);
    const f: FollowUp = {
      id,
      no: runningNo("FU", id),
      employeeId: d.employeeId,
      date: TODAY,
      kind: d.kind,
      topic: d.topic,
      detail: d.detail.trim(),
      by,
    };
    FOLLOW_UPS.push(f);
    return f;
  });
}

export const followUpsOf = (employeeId: number) =>
  FOLLOW_UPS.filter((f) => f.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
