import { EMPLOYEES } from "../pa/data";

/** กะที่บริษัทประกาศใช้ — ผูกกับพนักงานผ่าน ROSTER */
export const SHIFTS = [
  { code: "A", name: "กะเช้า", start: "08:00", end: "17:00", breakMin: 60, color: "sky" },
  { code: "B", name: "กะบ่าย", start: "13:00", end: "22:00", breakMin: 60, color: "violet" },
  { code: "N", name: "กะดึก", start: "22:00", end: "07:00", breakMin: 60, color: "slate" },
  { code: "O", name: "วันหยุด", start: "—", end: "—", breakMin: 0, color: "emerald" },
];

export const WEEK_DAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

/** ตารางกะรายสัปดาห์: employeeId -> กะของแต่ละวัน */
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

/** ตอกบัตรจริงของสัปดาห์นี้ — null = ยังไม่ตอก */
export const PUNCHES = [
  { id: 1, employeeId: 1, date: "2026-09-21", shift: "A", in: "07:52", out: "17:14" },
  { id: 2, employeeId: 2, date: "2026-09-21", shift: "A", in: "08:19", out: "17:02" },
  { id: 3, employeeId: 3, date: "2026-09-21", shift: "B", in: "12:55", out: "22:40" },
  { id: 4, employeeId: 4, date: "2026-09-21", shift: "A", in: "07:45", out: "18:30" },
  { id: 5, employeeId: 5, date: "2026-09-21", shift: "N", in: "21:58", out: "07:05" },
  { id: 6, employeeId: 6, date: "2026-09-21", shift: "A", in: "08:41", out: "17:00" },
  { id: 7, employeeId: 7, date: "2026-09-21", shift: "A", in: null, out: null },
  { id: 8, employeeId: 1, date: "2026-09-18", shift: "A", in: "07:58", out: "17:05" },
  { id: 9, employeeId: 2, date: "2026-09-18", shift: "A", in: "08:31", out: "17:10" },
  { id: 10, employeeId: 4, date: "2026-09-18", shift: "A", in: "07:50", out: "19:12" },
];

export const LEAVE_TYPES = [
  { name: "ลาป่วย", quota: 30, paid: true },
  { name: "ลาพักร้อน", quota: 6, paid: true },
  { name: "ลากิจ", quota: 3, paid: true },
  { name: "ลาคลอด", quota: 98, paid: true },
  { name: "ลาไม่รับค่าจ้าง", quota: 0, paid: false },
];

export const LEAVES = [
  { id: 1, employeeId: 3, type: "ลาป่วย", from: "2026-09-22", to: "2026-09-23", days: 2, status: "รออนุมัติ", reason: "ไข้หวัด มีใบรับรองแพทย์" },
  { id: 2, employeeId: 6, type: "ลาพักร้อน", from: "2026-10-06", to: "2026-10-10", days: 5, status: "รออนุมัติ", reason: "เดินทางต่างจังหวัดกับครอบครัว" },
  { id: 3, employeeId: 2, type: "ลากิจ", from: "2026-09-18", to: "2026-09-18", days: 1, status: "อนุมัติแล้ว", reason: "ธุระที่อำเภอ" },
  { id: 4, employeeId: 5, type: "ลาพักร้อน", from: "2026-09-29", to: "2026-10-03", days: 5, status: "รออนุมัติ", reason: "" },
  { id: 5, employeeId: 1, type: "ลาป่วย", from: "2026-09-08", to: "2026-09-08", days: 1, status: "อนุมัติแล้ว", reason: "" },
  { id: 6, employeeId: 4, type: "ลากิจ", from: "2026-09-11", to: "2026-09-12", days: 2, status: "ไม่อนุมัติ", reason: "ตรงกับวันปิดงบเดือน" },
  { id: 7, employeeId: 7, type: "ลาไม่รับค่าจ้าง", from: "2026-09-21", to: "2026-09-21", days: 1, status: "อนุมัติแล้ว", reason: "ธุระส่วนตัว" },
];

export const empName = (id: number) => EMPLOYEES.find((e) => e.id === id)?.name ?? "—";

/** Shifts are referenced by roster and punch codes that must exist. */
export const shiftOf = (code: string) => {
  const s = SHIFTS.find((x) => x.code === code);
  if (!s) throw new Error(`ไม่รู้จักกะ ${code}`);
  return s;
};

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** สายเกิน 15 นาที นับเป็นมาสาย · อยู่เกินกะเกิน 30 นาที นับเป็นล่วงเวลา */
export type Punch = (typeof PUNCHES)[number];

export function judge(p: Punch) {
  if (!p.in) return { state: "ขาดงาน", lateMin: 0, otMin: 0, workedMin: 0 };
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
