import { EMPLOYEES, TODAY } from "../pa/data";

/**
 * Time and leave for one payroll period.
 *
 * The roster says what somebody was meant to work; the punches say what actually
 * happened. Attendance is the difference between the two, so neither can be
 * invented independently — the month of punches below is derived from the roster
 * with a fixed wobble, and a day covered by an approved leave has no punch at all.
 */

export { TODAY };

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

export const HOLIDAYS = [
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

export const LEAVE_STATUSES = ["รออนุมัติ", "อนุมัติแล้ว", "ไม่อนุมัติ"] as const;
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
};

export const LEAVES: Leave[] = [
  { id: 1, employeeId: 3, type: "ลาป่วย", from: "2026-09-22", to: "2026-09-23", days: 2, status: "รออนุมัติ", reason: "ไข้หวัด มีใบรับรองแพทย์", filedAt: "2026-09-21" },
  { id: 2, employeeId: 6, type: "ลาพักร้อน", from: "2026-10-06", to: "2026-10-10", days: 5, status: "รออนุมัติ", reason: "เดินทางต่างจังหวัดกับครอบครัว", filedAt: "2026-09-15" },
  { id: 3, employeeId: 2, type: "ลากิจ", from: "2026-09-18", to: "2026-09-18", days: 1, status: "อนุมัติแล้ว", reason: "ธุระที่อำเภอ", filedAt: "2026-09-14", decidedBy: "หัวหน้าฝ่ายบัญชี" },
  { id: 4, employeeId: 5, type: "ลาพักร้อน", from: "2026-09-29", to: "2026-10-03", days: 5, status: "รออนุมัติ", reason: "", filedAt: "2026-09-19" },
  { id: 5, employeeId: 1, type: "ลาป่วย", from: "2026-09-08", to: "2026-09-08", days: 1, status: "อนุมัติแล้ว", reason: "ปวดหลัง", filedAt: "2026-09-08", decidedBy: "กรรมการผู้จัดการ" },
  { id: 6, employeeId: 4, type: "ลากิจ", from: "2026-09-11", to: "2026-09-12", days: 2, status: "ไม่อนุมัติ", reason: "ธุระส่วนตัว", filedAt: "2026-09-07", decidedBy: "หัวหน้าฝ่ายบุคคล", note: "ตรงกับวันปิดงบเดือน ขอให้เลื่อนเป็นสัปดาห์ถัดไป" },
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

/** สายเกิน 15 นาที นับเป็นมาสาย · อยู่เกินกะเกิน 30 นาที นับเป็นล่วงเวลา */
export function judge(p: Punch) {
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

/** Days in the period this person was rostered to work at all. */
export const scheduledDays = (employeeId: number) =>
  PERIOD_DAYS.filter((d) => ROSTER[employeeId]?.[dowIndex(d)] !== "O" && !isHoliday(d));

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
  const scheduled = scheduledDays(employeeId).length;
  const absent = mine.filter((x) => x.j.state === "ขาดงาน").length;
  const leaveDays = leaves
    .filter((l) => l.employeeId === employeeId && l.status === "อนุมัติแล้ว" && l.from <= PERIOD_END)
    .reduce((n, l) => n + daysBetween(l.from, l.to < PERIOD_END ? l.to : PERIOD_END).length, 0);
  const worked = mine.filter((x) => x.j.state !== "ขาดงาน").length;
  return {
    scheduled,
    worked,
    late: mine.filter((x) => x.j.state === "มาสาย").length,
    absent,
    leaveDays,
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

export const ROSTERED = EMPLOYEES.filter((e) => ROSTER[e.id]);
