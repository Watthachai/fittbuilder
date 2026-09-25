import { COMPANY as EMPLOYER, EMPLOYEES, TODAY } from "../pa/data";
import type { Employee } from "../pa/data";
import { commit } from "../kit";

/**
 * Payroll for one period, calculated rather than stored.
 *
 * The base salary and provident-fund rate are read from the personnel register,
 * because a second copy of somebody's salary is the one number in a company that
 * must never disagree with itself. What this module owns is what only payroll
 * knows: the allowances it pays, and the attendance figures keyed in for the
 * period — a company without a time system still has to enter them somewhere.
 *
 * A period is live until it is approved. Approving it freezes its payslips, so a
 * raise keyed into the personnel register tomorrow changes next month's slip and
 * never the one already paid. Every change goes through a named function at the
 * bottom of this file, inside commit(), and each one refuses a locked period.
 */

export { TODAY };

/** ผู้จ่ายเงินได้ — หัวกระดาษของสลิป ภ.ง.ด.1 สปส.1-10 และ 50 ทวิ · ชื่อและที่อยู่อ่านจากทะเบียนพนักงาน */
export const COMPANY = {
  ...EMPLOYER,
  branch: "สำนักงานใหญ่",
  /** เลขที่บัญชีนายจ้างที่สำนักงานประกันสังคม */
  ssoAccount: "1000123456",
  /** บัญชีที่บริษัทใช้โอนเงินเดือน */
  payrollBank: "กสิกรไทย",
  payrollAccount: "012-3-45678-9",
};

export type PeriodStatus = "กำลังคำนวณ" | "รอตรวจสอบ" | "อนุมัติแล้ว" | "จ่ายแล้ว";

export const PERIOD_FLOW: PeriodStatus[] = ["กำลังคำนวณ", "รอตรวจสอบ", "อนุมัติแล้ว", "จ่ายแล้ว"];

export type Period = {
  id: number;
  label: string;
  month: string;
  status: PeriodStatus;
  payDate: string;
  workDays: number;
  approvedBy?: string;
  paidAt?: string;
  /** เหตุผลล่าสุดที่งวดถูกปลดล็อกกลับมาแก้ */
  note?: string;
};

export const PERIODS: Period[] = [
  { id: 1, label: "งวดเดือนกันยายน 2569", month: "2026-09", status: "รอตรวจสอบ", payDate: "2026-09-25", workDays: 22 },
  { id: 2, label: "งวดเดือนสิงหาคม 2569", month: "2026-08", status: "จ่ายแล้ว", payDate: "2026-08-25", workDays: 21 },
  { id: 3, label: "งวดเดือนกรกฎาคม 2569", month: "2026-07", status: "จ่ายแล้ว", payDate: "2026-07-24", workDays: 23 },
];

export const periodById = (id: number): Period => {
  const p = PERIODS.find((x) => x.id === id);
  if (!p) throw new Error(`ไม่มีงวด ${id}`);
  return p;
};

/** อนุมัติแล้วคือปิดงวด — ตัวเลขทุกตัวในงวดแก้ไม่ได้อีก จนกว่าจะปลดล็อก */
export const isLocked = (p: Period) => p.status === "อนุมัติแล้ว" || p.status === "จ่ายแล้ว";

/** สวัสดิการที่จ่ายเป็นเงินเข้ารวมในสลิป */
export const BENEFIT_PLANS = [
  { code: "POS", name: "ค่าตำแหน่ง", taxable: true, note: "จ่ายตามระดับตำแหน่ง" },
  { code: "PROF", name: "ค่าวิชาชีพ", taxable: true, note: "จ่ายให้ผู้มีใบประกอบวิชาชีพ" },
  { code: "COMM", name: "ค่าคอมมิชชั่น", taxable: true, note: "คิดจากยอดขายที่เก็บเงินได้แล้ว" },
  { code: "SHIFT", name: "ค่ากะกลางคืน", taxable: true, note: "300 บาทต่อกะที่เข้าหลังสี่ทุ่ม" },
  { code: "DILI", name: "เบี้ยขยัน", taxable: true, note: "ตัดทั้งก้อนเมื่อขาดงานในงวด" },
  { code: "TRV", name: "ค่าน้ำมันรถ", taxable: false, note: "เหมาจ่าย ยกเว้นภาษีตามหลักฐาน" },
  { code: "TEL", name: "ค่าโทรศัพท์", taxable: false, note: "เหมาจ่าย ยกเว้นภาษีตามหลักฐาน" },
  { code: "MEAL", name: "ค่าอาหาร", taxable: false, note: "เหมาจ่ายรายเดือน" },
];

export const planOf = (code: string) => {
  const p = BENEFIT_PLANS.find((x) => x.code === code);
  if (!p) throw new Error(`ไม่รู้จักสวัสดิการ ${code}`);
  return p;
};

/** สวัสดิการประจำของแต่ละคน — ตรงกับรายการในแฟ้มพนักงาน */
export const BENEFITS: Record<number, Record<string, number>> = {
  1: { POS: 5000, TRV: 3000 },
  2: { PROF: 2000 },
  3: { DILI: 800 },
  4: {},
  5: { SHIFT: 3600, MEAL: 1200 },
  6: { COMM: 6500 },
  7: { POS: 4000, TRV: 3000, TEL: 500 },
};

export type Variable = {
  otHours: number;
  absentDays: number;
  unpaidDays: number;
  lateMinutes: number;
  /** ชั่วโมงล่วงเวลาในวันหยุด — คิด 3 เท่า */
  holidayOtHours?: number;
  /** ใครแก้ตัวเลขนี้เพราะอะไร */
  note?: string;
};

/**
 * ตัวเลขที่เปลี่ยนไปในแต่ละงวด — คีย์เข้ามาจากใบลงเวลาของหน่วยงาน
 * ระบบนี้ขายแยกจากโมดูลเวลาทำงานได้ จึงเก็บตัวเลขนี้ไว้เอง
 */
export const VARIABLES: Record<number, Record<number, Variable>> = {
  1: {
    1: { otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 24 },
    2: { otHours: 4, absentDays: 0, unpaidDays: 0, lateMinutes: 31 },
    3: { otHours: 18, absentDays: 1, unpaidDays: 0, lateMinutes: 0 },
    4: { otHours: 6, absentDays: 1, unpaidDays: 0, lateMinutes: 0 },
    5: { otHours: 26, absentDays: 0, unpaidDays: 0, lateMinutes: 0 },
    6: { otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 41 },
    7: { otHours: 2, absentDays: 0, unpaidDays: 1, lateMinutes: 0 },
  },
  2: {
    1: { otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 0 },
    2: { otHours: 2, absentDays: 0, unpaidDays: 0, lateMinutes: 12 },
    3: { otHours: 22, absentDays: 0, unpaidDays: 0, lateMinutes: 8 },
    4: { otHours: 3, absentDays: 0, unpaidDays: 0, lateMinutes: 0 },
    5: { otHours: 31, absentDays: 0, unpaidDays: 0, lateMinutes: 0 },
    6: { otHours: 0, absentDays: 1, unpaidDays: 0, lateMinutes: 18 },
    7: { otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 0 },
  },
  3: {
    1: { otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 6 },
    2: { otHours: 6, absentDays: 0, unpaidDays: 0, lateMinutes: 0 },
    3: { otHours: 14, absentDays: 0, unpaidDays: 0, lateMinutes: 22 },
    4: { otHours: 0, absentDays: 0, unpaidDays: 2, lateMinutes: 0 },
    5: { otHours: 19, absentDays: 1, unpaidDays: 0, lateMinutes: 0 },
    6: { otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 0 },
    7: { otHours: 4, absentDays: 0, unpaidDays: 0, lateMinutes: 0 },
  },
};

/** ขั้นภาษีเงินได้บุคคลธรรมดา — เงินได้สุทธิต่อปี */
export const TAX_BANDS = [
  { upTo: 150000, rate: 0 },
  { upTo: 300000, rate: 0.05 },
  { upTo: 500000, rate: 0.1 },
  { upTo: 750000, rate: 0.15 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: 2000000, rate: 0.25 },
  { upTo: 5000000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

export const SSO_RATE = 0.05;
export const SSO_CAP = 750;
/** ฐานค่าจ้างที่ใช้คิดเงินสมทบ ต่ำสุด 1,650 สูงสุด 15,000 บาทต่อเดือน */
export const SSO_BASE_MIN = 1650;
export const SSO_BASE_MAX = 15000;
export const PERSONAL_ALLOWANCE = 60000;
/** หักค่าใช้จ่าย 50% ของเงินได้ แต่ไม่เกิน 100,000 */
export const EXPENSE_CAP = 100000;
/** เงินสะสมกองทุนสำรองเลี้ยงชีพหักลดหย่อนได้ไม่เกิน 15% ของค่าจ้าง และไม่เกิน 500,000 */
export const PVD_DEDUCTION_RATE = 0.15;
export const PVD_DEDUCTION_CAP = 500000;

export const BANKS: Record<number, { bank: string; account: string; method: string }> = {
  1: { bank: "กสิกรไทย", account: "xxx-x-x4821-x", method: "โอนเข้าบัญชี" },
  2: { bank: "ไทยพาณิชย์", account: "xxx-x-x0173-x", method: "โอนเข้าบัญชี" },
  3: { bank: "กรุงไทย", account: "xxx-x-x9264-x", method: "โอนเข้าบัญชี" },
  4: { bank: "กสิกรไทย", account: "xxx-x-x5530-x", method: "โอนเข้าบัญชี" },
  5: { bank: "กรุงเทพ", account: "xxx-x-x1108-x", method: "โอนเข้าบัญชี" },
  6: { bank: "ไทยพาณิชย์", account: "xxx-x-x7745-x", method: "โอนเข้าบัญชี" },
  7: { bank: "—", account: "—", method: "เงินสด" },
};

/**
 * How somebody is paid. Payroll keeps its own instruction for the people it has
 * one for; anybody hired since is paid into the account on their personnel
 * record, which is where the hiring form puts it.
 */
export function bankOf(employeeId: number): { bank: string; account: string; method: string } {
  const own = BANKS[employeeId];
  if (own) return own;
  const e = employeeOf(employeeId);
  return { bank: e.admin.bankName, account: e.admin.bankAccount, method: "โอนเข้าบัญชี" };
}

/** พนักงานที่อยู่ในรอบจ่ายเงินเดือน — อ่านจากทะเบียนพนักงาน */
export const ON_PAYROLL: Employee[] = EMPLOYEES.filter((e) => e.status !== "ลาออก");

/** Read on every call, so somebody hired a minute ago is on the next run. */
export const onPayroll = (): Employee[] => EMPLOYEES.filter((e) => e.status !== "ลาออก");

export const employeeOf = (id: number): Employee => {
  const e = EMPLOYEES.find((x) => x.id === id);
  if (!e) throw new Error(`ไม่พบพนักงาน ${id}`);
  return e;
};

export type AnnualTax = { net: number; tax: number; expense: number; sso: number; pvd: number; allowance: number };

/**
 * ภาษีทั้งปีจากเงินได้ทั้งปี: หักค่าใช้จ่าย ค่าลดหย่อนส่วนตัว เงินสมทบประกันสังคม
 * และเงินสะสมกองทุนสำรองเลี้ยงชีพ แล้วคิดตามขั้นบันได
 */
export function annualTax(
  taxableYear: number,
  paid: { sso: number; pvd: number } = { sso: SSO_CAP * 12, pvd: 0 }
): AnnualTax {
  const expense = Math.min(taxableYear * 0.5, EXPENSE_CAP);
  const pvd = Math.min(paid.pvd, taxableYear * PVD_DEDUCTION_RATE, PVD_DEDUCTION_CAP);
  const net = Math.max(0, taxableYear - expense - PERSONAL_ALLOWANCE - paid.sso - pvd);
  let tax = 0;
  let prev = 0;
  for (const b of TAX_BANDS) {
    if (net <= prev) break;
    tax += (Math.min(net, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return { net, tax, expense, sso: paid.sso, pvd, allowance: PERSONAL_ALLOWANCE };
}

/* ------------------------------------------------- variable pay items */

export type AdjustmentKind = { name: string; sign: 1 | -1; taxable: boolean; note: string };

/**
 * รายการเงินได้และเงินหักที่คีย์เป็นครั้ง ๆ ในงวด
 *
 * เงินได้ครั้งคราวเสียภาษีเฉพาะส่วนที่เพิ่มขึ้นทั้งปี ไม่เอาไปคูณสิบสองเหมือนเงินเดือน
 * ไม่อย่างนั้นโบนัสเดือนเดียวจะถูกหักภาษีราวกับได้ทุกเดือน
 */
export const ADJUSTMENT_KINDS: AdjustmentKind[] = [
  { name: "โบนัส", sign: 1, taxable: true, note: "เงินได้ครั้งคราว ภาษีคิดเฉพาะส่วนที่ทำให้ภาษีทั้งปีเพิ่มขึ้น" },
  { name: "ค่าคอมมิชชั่น", sign: 1, taxable: true, note: "ส่วนที่คิดจากยอดขายของงวด นอกเหนือจากที่จ่ายประจำ" },
  { name: "เงินได้อื่น", sign: 1, taxable: true, note: "เช่น เงินรางวัล เบี้ยเลี้ยงเดินทาง" },
  { name: "หักเบิกเงินล่วงหน้า", sign: -1, taxable: false, note: "คืนเงินที่เบิกล่วงหน้าระหว่างเดือน" },
  { name: "หักชำระ กยศ.", sign: -1, taxable: false, note: "ตามหนังสือแจ้งจากกองทุนเงินให้กู้ยืมเพื่อการศึกษา" },
  { name: "หักอื่น ๆ", sign: -1, taxable: false, note: "เช่น ค่าเสียหายที่พนักงานยินยอมเป็นหนังสือ" },
];

export const adjustmentKindOf = (name: string): AdjustmentKind => {
  const k = ADJUSTMENT_KINDS.find((x) => x.name === name);
  if (!k) throw new Error(`ไม่รู้จักรายการ ${name}`);
  return k;
};

export type Adjustment = {
  id: number;
  periodId: number;
  employeeId: number;
  kind: string;
  amount: number;
  note: string;
  addedAt: string;
};

export const ADJUSTMENTS: Adjustment[] = [
  { id: 1, periodId: 1, employeeId: 6, kind: "เงินได้อื่น", amount: 2000, note: "รางวัลพนักงานขายยอดเยี่ยมเดือนสิงหาคม", addedAt: "2026-09-15" },
  { id: 2, periodId: 1, employeeId: 3, kind: "หักเบิกเงินล่วงหน้า", amount: 2000, note: "เบิกล่วงหน้าเมื่อ 10 ก.ย. 2569", addedAt: "2026-09-10" },
];

/* ------------------------------------------------------ benefit claims */

/** สวัสดิการที่เบิกตามจริงพร้อมใบเสร็จ มีเพดานต่อปี */
export const CLAIM_TYPES = [
  { name: "ค่ารักษาพยาบาล", limit: 20000, taxable: false, note: "ตามใบเสร็จสถานพยาบาล ปีละไม่เกิน 20,000 บาท" },
  { name: "ค่าทันตกรรม", limit: 5000, taxable: false, note: "ปีละไม่เกิน 5,000 บาท" },
  { name: "ค่าตัดแว่นสายตา", limit: 3000, taxable: false, note: "ปีละไม่เกิน 3,000 บาท" },
  { name: "ค่าเล่าเรียนบุตร", limit: 10000, taxable: true, note: "ปีละไม่เกิน 10,000 บาท ถือเป็นเงินได้ที่ต้องเสียภาษี" },
];

export const claimTypeOf = (name: string) => {
  const t = CLAIM_TYPES.find((x) => x.name === name);
  if (!t) throw new Error(`ไม่รู้จักสวัสดิการ ${name}`);
  return t;
};

export type ClaimStatus = "รออนุมัติ" | "อนุมัติแล้ว" | "ไม่อนุมัติ";

/** ใบเบิกสวัสดิการ — อนุมัติแล้วจ่ายรวมในสลิปของงวดที่ผูกไว้ */
export type Claim = {
  id: number;
  no: string;
  employeeId: number;
  type: string;
  amount: number;
  receiptDate: string;
  detail: string;
  status: ClaimStatus;
  periodId: number;
  filedAt: string;
  decidedBy?: string;
  note?: string;
};

export const CLAIMS: Claim[] = [
  { id: 1, no: "BC-2569-0021", employeeId: 1, type: "ค่ารักษาพยาบาล", amount: 4200, receiptDate: "2026-08-12", detail: "ตรวจรักษาอาการปวดหลัง โรงพยาบาลพญาไท 2", status: "อนุมัติแล้ว", periodId: 2, filedAt: "2026-08-13", decidedBy: "หัวหน้าฝ่ายบุคคล" },
  { id: 2, no: "BC-2569-0022", employeeId: 6, type: "ค่าตัดแว่นสายตา", amount: 2800, receiptDate: "2026-09-05", detail: "ตัดแว่นสายตาใหม่ ร้านแว่นเซ็นทรัลพระราม 9", status: "อนุมัติแล้ว", periodId: 1, filedAt: "2026-09-06", decidedBy: "หัวหน้าฝ่ายบุคคล" },
  { id: 3, no: "BC-2569-0023", employeeId: 3, type: "ค่ารักษาพยาบาล", amount: 1650, receiptDate: "2026-09-21", detail: "ไข้หวัด คลินิกเวชกรรมบางพลี", status: "รออนุมัติ", periodId: 1, filedAt: "2026-09-22" },
  { id: 4, no: "BC-2569-0024", employeeId: 5, type: "ค่าทันตกรรม", amount: 3500, receiptDate: "2026-09-14", detail: "ถอนฟันคุด คลินิกทันตกรรมพัทยา", status: "รออนุมัติ", periodId: 1, filedAt: "2026-09-16" },
];

/** ยอดที่ใช้ไปของสวัสดิการหนึ่งในปี นับจากวันที่ในใบเสร็จ */
export function claimUsage(employeeId: number, type: string, year: string = TODAY.slice(0, 4)) {
  const t = claimTypeOf(type);
  const mine = CLAIMS.filter((c) => c.employeeId === employeeId && c.type === type && c.receiptDate.startsWith(year));
  const sum = (status: ClaimStatus) => mine.filter((c) => c.status === status).reduce((n, c) => n + c.amount, 0);
  const used = sum("อนุมัติแล้ว");
  const pending = sum("รออนุมัติ");
  return { limit: t.limit, used, pending, left: t.limit - used - pending };
}

/* -------------------------------------------------------------- payslip */

const dayCount = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000) + 1;

const lastDayOf = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};

/**
 * วันที่เป็นพนักงานในเดือนของงวด — คนที่เริ่มงานหรือลาออกกลางเดือนได้เงินเดือน
 * ตามสัดส่วนวันตามปฏิทิน คนที่อยู่ทั้งเดือนได้เต็ม
 */
function employedDays(employee: Employee, month: string) {
  const first = `${month}-01`;
  const last = lastDayOf(month);
  const from = employee.contract.startedAt > first ? employee.contract.startedAt : first;
  const leftAt = employee.separation?.lastDay;
  const to = leftAt && leftAt < last ? leftAt : last;
  return { employed: Math.max(0, dayCount(from, to)), inMonth: dayCount(first, last) };
}

export type Payslip = ReturnType<typeof payslip>;

/** สลิปหนึ่งใบ — ทุกตัวเลขคำนวณสดจากฐานเงินเดือนในทะเบียนพนักงาน */
export function payslip(employeeId: number, periodId: number, override?: Partial<Variable>) {
  const employee = employeeOf(employeeId);
  const period = periodById(periodId);
  if (!isMember(periodId, employeeId)) throw new Error(`${employee.name} ไม่อยู่ใน${period.label}`);
  // Somebody picked up since the last run has no figures keyed yet: nothing
  // absent, nothing late, no overtime.
  const v: Variable = { ...(VARIABLES[periodId]?.[employeeId] ?? NOTHING_KEYED), ...override };

  const fullBase = employee.contract.baseSalary;
  const { employed, inMonth } = employedDays(employee, period.month);
  const base = employed >= inMonth ? fullBase : Math.round((fullBase * employed) / inMonth);
  const pvdRate = employee.admin.pvdRate / 100;
  const perDay = fullBase / period.workDays;
  const perHour = perDay / 8;

  const benefitLines = Object.entries(BENEFITS[employeeId] ?? {}).map(([code, amount]) => {
    const plan = planOf(code);
    // เบี้ยขยันตัดทั้งก้อนเมื่อขาดงาน ตามเงื่อนไขของสวัสดิการนั้นเอง
    const paid = plan.code === "DILI" && v.absentDays > 0 ? 0 : amount;
    return { ...plan, amount: paid, full: amount, forfeited: paid !== amount };
  });
  const benefitTotal = benefitLines.reduce((n, b) => n + b.amount, 0);
  const holidayOtHours = v.holidayOtHours ?? 0;
  const otNormalPay = Math.round(v.otHours * perHour * 1.5);
  const otHolidayPay = Math.round(holidayOtHours * perHour * 3);
  const otPay = otNormalPay + otHolidayPay;

  const absenceCut = Math.round((v.absentDays + v.unpaidDays) * perDay);
  const lateCut = Math.round((v.lateMinutes / 60) * perHour);

  const adjustments = ADJUSTMENTS.filter((a) => a.periodId === periodId && a.employeeId === employeeId).map((a) => ({
    ...a,
    ...adjustmentKindOf(a.kind),
  }));
  const extraEarnings = adjustments.filter((a) => a.sign > 0).reduce((n, a) => n + a.amount, 0);
  const extraDeductions = adjustments.filter((a) => a.sign < 0).reduce((n, a) => n + a.amount, 0);

  const claimLines = CLAIMS.filter(
    (c) => c.periodId === periodId && c.employeeId === employeeId && c.status === "อนุมัติแล้ว"
  ).map((c) => ({ ...c, taxable: claimTypeOf(c.type).taxable }));
  const claimTotal = claimLines.reduce((n, c) => n + c.amount, 0);

  const gross = base + benefitTotal + otPay + extraEarnings + claimTotal;
  // What is actually earned this month, cuts taken off — the regular income
  // the tax is projected from.
  const wage = Math.max(0, base - absenceCut - lateCut);
  const taxableMonth = wage + otPay + benefitLines.filter((b) => b.taxable).reduce((n, b) => n + b.amount, 0);
  const taxableOneOff =
    adjustments.filter((a) => a.sign > 0 && a.taxable).reduce((n, a) => n + a.amount, 0) +
    claimLines.filter((c) => c.taxable).reduce((n, c) => n + c.amount, 0);

  const ssoBase = Math.min(Math.max(wage, SSO_BASE_MIN), SSO_BASE_MAX);
  const sso = Math.min(Math.round(ssoBase * SSO_RATE), SSO_CAP);
  const pvd = Math.round(base * pvdRate);
  const paid = { sso: sso * 12, pvd: pvd * 12 };
  const regular = annualTax(taxableMonth * 12, paid);
  const withOneOff = annualTax(taxableMonth * 12 + taxableOneOff, paid);
  const taxRegular = Math.round(regular.tax / 12);
  const taxOneOff = Math.round(withOneOff.tax - regular.tax);
  const tax = taxRegular + taxOneOff;

  const deductions = absenceCut + lateCut + sso + pvd + tax + extraDeductions;
  return {
    employeeId,
    periodId,
    employee,
    base,
    fullBase,
    employedDays: employed,
    daysInMonth: inMonth,
    perDay,
    perHour,
    pvdRate,
    benefitLines,
    benefitTotal,
    otHours: v.otHours,
    holidayOtHours,
    otNormalPay,
    otHolidayPay,
    otPay,
    absentDays: v.absentDays,
    unpaidDays: v.unpaidDays,
    lateMinutes: v.lateMinutes,
    note: v.note,
    absenceCut,
    lateCut,
    adjustments,
    extraEarnings,
    extraDeductions,
    claimLines,
    claimTotal,
    ssoBase,
    sso,
    pvd,
    tax,
    taxRegular,
    taxOneOff,
    taxableMonth,
    taxableOneOff,
    taxableNet: regular.net,
    yearTax: regular,
    gross,
    deductions,
    netPay: gross - deductions,
  };
}

/**
 * Payslips frozen when their period was approved.
 *
 * A paid slip is a record of what was paid, not a sum to redo: somebody's
 * raise or new allowance must not reach back into it. Seeded here for the
 * periods that start the demo approved or paid.
 */
export const LOCKED_SLIPS: Record<number, Payslip[]> = {};

const NOTHING_KEYED: Variable = { otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 0 };

/**
 * Who a period pays.
 *
 * A closed period pays whoever it had when it was approved. An open one also
 * takes anybody working by the end of its month, read from the personnel
 * register on every look — so a person hired this morning is on this month's
 * payroll, on a pro-rated salary, without anyone re-keying them. Somebody who
 * has left stays in the period they were already in, for their final pay.
 */
function membersOf(periodId: number): Employee[] {
  const p = periodById(periodId);
  const rows = VARIABLES[periodId] ?? {};
  const last = lastDayOf(p.month);
  return EMPLOYEES.filter(
    (e) => rows[e.id] !== undefined || (!isLocked(p) && e.status !== "ลาออก" && e.contract.startedAt <= last)
  );
}

export const isMember = (periodId: number, employeeId: number) => membersOf(periodId).some((e) => e.id === employeeId);

export const slipsFor = (periodId: number, overrides: Record<number, Partial<Variable>> = {}) =>
  LOCKED_SLIPS[periodId] ?? membersOf(periodId).map((e) => payslip(e.id, periodId, overrides[e.id]));

/** ต้นทุนแรงงานของบริษัทในงวด — เงินที่จ่ายพนักงานบวกส่วนที่นายจ้างสมทบ */
export function periodCost(periodId: number) {
  const slips = slipsFor(periodId);
  const gross = slips.reduce((n, s) => n + s.gross, 0);
  const employerSso = slips.reduce((n, s) => n + s.sso, 0);
  const employerPvd = slips.reduce((n, s) => n + s.pvd, 0);
  return {
    slips,
    gross,
    net: slips.reduce((n, s) => n + s.netPay, 0),
    deductions: slips.reduce((n, s) => n + s.deductions, 0),
    tax: slips.reduce((n, s) => n + s.tax, 0),
    sso: slips.reduce((n, s) => n + s.sso, 0),
    pvd: slips.reduce((n, s) => n + s.pvd, 0),
    employerSso,
    employerPvd,
    total: gross + employerSso + employerPvd,
  };
}

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";
export const empName = (id: number) => EMPLOYEES.find((e) => e.id === id)?.name ?? "—";

/* ============================================================= actions */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const beYear = (iso: string) => Number(iso.slice(0, 4)) + 543;

const nextId = (list: { id: number }[]) => Math.max(0, ...list.map((x) => x.id)) + 1;

const firstError = (errors: Record<string, string>) => {
  const message = Object.values(errors)[0];
  if (message) throw new Error(message);
};

/** Every write to a period's figures starts here: an approved period is closed. */
const openPeriod = (periodId: number) => {
  const p = periodById(periodId);
  if (isLocked(p)) throw new Error(`${p.label} ${p.status} งวดนี้ล็อกแล้ว แก้ไขไม่ได้`);
  return p;
};

/* -------------------------------------------------------------- periods */

/** วันทำงานของงวด: จันทร์ถึงศุกร์ในเดือนนั้น */
export function workDaysOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  let n = 0;
  while (d.getMonth() === m - 1) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** จ่ายทุกวันที่ 25 ถ้าตรงเสาร์อาทิตย์เลื่อนมาวันศุกร์ก่อนหน้า */
export function defaultPayDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 25);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return `${month}-${String(d.getDate()).padStart(2, "0")}`;
}

export const latestPeriod = () => [...PERIODS].sort((a, b) => b.month.localeCompare(a.month))[0];

export function nextMonthOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export const periodLabel = (month: string) =>
  `งวดเดือน${TH_MONTHS[Number(month.slice(5, 7)) - 1]} ${beYear(month + "-01")}`;

export type PeriodDraft = { month: string; payDate: string };

export function periodErrors(d: PeriodDraft): Record<string, string> {
  const e: Record<string, string> = {};
  const latest = latestPeriod();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.month)) e.month = "เลือกเดือนของงวด";
  else if (PERIODS.some((p) => p.month === d.month)) e.month = "เดือนนี้มีงวดอยู่แล้ว";
  else if (d.month !== nextMonthOf(latest.month)) e.month = `งวดใหม่ต้องต่อจาก${latest.label} คือเดือน ${nextMonthOf(latest.month)}`;
  else if (!isLocked(latest)) e.month = `ต้องอนุมัติ${latest.label}ให้เรียบร้อยก่อนเปิดงวดใหม่`;
  if (!ISO_DATE.test(d.payDate)) e.payDate = "เลือกวันจ่าย";
  else if (!e.month && !d.payDate.startsWith(d.month)) e.payDate = "วันจ่ายต้องอยู่ในเดือนของงวด";
  return e;
}

/** เปิดงวดใหม่ — ทุกคนที่ยังทำงานอยู่ได้แถวของงวด ตัวเลขผันแปรเริ่มที่ศูนย์ */
export function createPeriod(d: PeriodDraft): Period {
  firstError(periodErrors(d));
  return commit(() => {
    const period: Period = {
      id: nextId(PERIODS),
      label: periodLabel(d.month),
      month: d.month,
      status: "กำลังคำนวณ",
      payDate: d.payDate,
      workDays: workDaysOf(d.month),
    };
    VARIABLES[period.id] = {};
    PERIODS.unshift(period);
    for (const e of membersOf(period.id)) VARIABLES[period.id][e.id] = { ...NOTHING_KEYED };
    return period;
  });
}

/** คนที่เข้ามาในงวดหลังคำนวณครั้งก่อน — ส่วนใหญ่คือพนักงานที่เพิ่งรับเข้า ยังไม่มีตัวเลขขาดลามาสายของงวด */
export const missingFrom = (periodId: number) => membersOf(periodId).filter((e) => !VARIABLES[periodId]?.[e.id]);

/**
 * คำนวณเงินเดือน: ดึงคนที่ยังไม่อยู่ในงวดเข้ามา แล้วส่งงวดไปรอตรวจสอบ
 * รันซ้ำได้จนกว่าจะอนุมัติ ตัวเลขทุกตัวคำนวณจากข้อมูลล่าสุดเสมอ
 */
export function runPayroll(periodId: number): { slips: Payslip[]; added: Employee[] } {
  const period = openPeriod(periodId);
  const added = missingFrom(periodId);
  commit(() => {
    VARIABLES[periodId] ??= {};
    for (const e of added) VARIABLES[periodId][e.id] = { ...NOTHING_KEYED };
    if (period.status === "กำลังคำนวณ") period.status = "รอตรวจสอบ";
  });
  return { slips: slipsFor(periodId), added };
}

/** สิ่งที่ยังค้างก่อนอนุมัติงวดได้ — ว่างเปล่าคือพร้อมอนุมัติ */
export function approvalBlockers(periodId: number): string[] {
  const p = periodById(periodId);
  if (p.status !== "รอตรวจสอบ") return [`งวดนี้อยู่ในสถานะ${p.status} อนุมัติได้เฉพาะงวดที่รอตรวจสอบ`];
  const out: string[] = [];
  const pending = CLAIMS.filter((c) => c.periodId === periodId && c.status === "รออนุมัติ");
  if (pending.length) out.push(`ยังมีใบเบิกสวัสดิการรออนุมัติ ${pending.length} ใบในงวดนี้`);
  const negative = slipsFor(periodId).filter((s) => s.netPay < 0);
  if (negative.length) out.push(`สลิปของ ${negative.map((s) => s.employee.name).join(", ")} ยอดสุทธิติดลบ`);
  return out;
}

/** อนุมัติและล็อกงวด — สลิปทุกใบถูกเก็บตามตัวเลข ณ ตอนนี้ */
export function approvePeriod(periodId: number, by = "คุณ"): Period {
  const period = periodById(periodId);
  const blockers = approvalBlockers(periodId);
  if (blockers.length) throw new Error(blockers[0]);
  const slips = slipsFor(periodId);
  return commit(() => {
    LOCKED_SLIPS[periodId] = slips;
    period.status = "อนุมัติแล้ว";
    period.approvedBy = by;
    return period;
  });
}

/** ปลดล็อกงวดที่อนุมัติแล้วแต่ยังไม่จ่าย กลับไปรอตรวจสอบ — ต้องบอกเหตุผล */
export function reopenPeriod(periodId: number, reason: string): Period {
  const period = periodById(periodId);
  if (period.status !== "อนุมัติแล้ว") throw new Error("ปลดล็อกได้เฉพาะงวดที่อนุมัติแล้วแต่ยังไม่จ่าย");
  if (reason.trim().length < 5) throw new Error("ระบุเหตุผลที่ปลดล็อกอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    delete LOCKED_SLIPS[periodId];
    period.status = "รอตรวจสอบ";
    period.approvedBy = undefined;
    period.note = reason.trim();
    return period;
  });
}

/** บันทึกว่าจ่ายเงินทั้งงวดแล้ว — ย้อนกลับไม่ได้ */
export function markPaid(periodId: number, paidAt = TODAY): Period {
  const period = periodById(periodId);
  if (period.status !== "อนุมัติแล้ว") throw new Error("ต้องอนุมัติงวดก่อนบันทึกการจ่าย");
  return commit(() => {
    period.status = "จ่ายแล้ว";
    period.paidAt = paidAt;
    return period;
  });
}

/* ----------------------------------------------------- attendance items */

export type VariableDraft = {
  absentDays: string;
  unpaidDays: string;
  lateMinutes: string;
  otHours: string;
  holidayOtHours: string;
  note: string;
};

export function variableErrors(periodId: number, d: VariableDraft): Record<string, string> {
  const e: Record<string, string> = {};
  const p = periodById(periodId);
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const check = (key: keyof VariableDraft, max: number, unit: string) => {
    const n = num(d[key]);
    if (!Number.isFinite(n) || n < 0) e[key] = "กรอกตัวเลขไม่ติดลบ";
    else if (n > max) e[key] = `ไม่เกิน ${max} ${unit}`;
  };
  check("absentDays", p.workDays, "วัน");
  check("unpaidDays", p.workDays, "วัน");
  check("lateMinutes", p.workDays * 8 * 60, "นาที");
  check("otHours", 36 * 5, "ชั่วโมง");
  check("holidayOtHours", 36 * 5, "ชั่วโมง");
  if (!e.absentDays && !e.unpaidDays && num(d.absentDays) + num(d.unpaidDays) > p.workDays) {
    e.unpaidDays = `ขาดรวมลาไม่รับค่าจ้างเกินวันทำงาน ${p.workDays} วันของงวด`;
  }
  if (d.note.trim().length < 5) e.note = "บอกเหตุผลที่แก้อย่างน้อย 5 ตัวอักษร ผู้ตรวจงวดจะเห็นข้อความนี้";
  return e;
}

/** แก้ตัวเลขขาด ลา มาสาย และล่วงเวลาของงวดที่ยังไม่ล็อก */
export function setVariable(periodId: number, employeeId: number, d: VariableDraft): Variable {
  openPeriod(periodId);
  if (!isMember(periodId, employeeId)) throw new Error(`${empName(employeeId)} ไม่อยู่ในงวดนี้`);
  firstError(variableErrors(periodId, d));
  return commit(() => {
    VARIABLES[periodId] ??= {};
    const row = (VARIABLES[periodId][employeeId] ??= { ...NOTHING_KEYED });
    row.absentDays = Number(d.absentDays);
    row.unpaidDays = Number(d.unpaidDays);
    row.lateMinutes = Number(d.lateMinutes);
    row.otHours = Number(d.otHours);
    row.holidayOtHours = Number(d.holidayOtHours);
    row.note = d.note.trim();
    return row;
  });
}

/* ------------------------------------------------------ adjustments */

export type AdjustmentDraft = { periodId: number; employeeId: number; kind: string; amount: string; note: string };

/**
 * หักค่าจ้างได้เฉพาะที่กฎหมายยอม และรวมกันไม่เกินหนึ่งในห้าของค่าจ้างงวดนั้น
 * (มาตรา 76 พ.ร.บ.คุ้มครองแรงงาน) — ภาษี ประกันสังคม และกองทุนไม่นับรวม
 */
export function adjustmentErrors(d: AdjustmentDraft, editingId?: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isMember(d.periodId, d.employeeId)) e.employeeId = "เลือกพนักงานที่อยู่ในงวดนี้";
  const kind = ADJUSTMENT_KINDS.find((k) => k.name === d.kind);
  if (!kind) e.kind = "เลือกประเภทรายการ";
  const amount = Number(d.amount);
  if (d.amount.trim() === "" || !Number.isFinite(amount) || amount <= 0) e.amount = "กรอกจำนวนเงินมากกว่า 0";
  else if (Math.round(amount * 100) !== amount * 100) e.amount = "ทศนิยมได้ไม่เกินสองตำแหน่ง";
  if (d.note.trim().length < 5) e.note = "บอกที่มาของรายการอย่างน้อย 5 ตัวอักษร";
  if (e.employeeId || e.kind || e.amount || !kind || kind.sign > 0) return e;

  const base = employeeOf(d.employeeId).contract.baseSalary;
  const already = ADJUSTMENTS.filter(
    (a) => a.id !== editingId && a.periodId === d.periodId && a.employeeId === d.employeeId && adjustmentKindOf(a.kind).sign < 0
  ).reduce((n, a) => n + a.amount, 0);
  if (already + amount > base / 5) {
    e.amount = `รายการหักรวมจะเป็น ${baht(already + amount)} เกินหนึ่งในห้าของค่าจ้าง (${baht(base / 5)}) ตามมาตรา 76`;
  }
  return e;
}

export function addAdjustment(d: AdjustmentDraft): Adjustment {
  openPeriod(d.periodId);
  firstError(adjustmentErrors(d));
  return commit(() => {
    const a: Adjustment = {
      id: nextId(ADJUSTMENTS),
      periodId: d.periodId,
      employeeId: d.employeeId,
      kind: d.kind,
      amount: Number(d.amount),
      note: d.note.trim(),
      addedAt: TODAY,
    };
    ADJUSTMENTS.push(a);
    return a;
  });
}

const adjustmentById = (id: number) => {
  const a = ADJUSTMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`ไม่พบรายการ ${id}`);
  return a;
};

export function updateAdjustment(id: number, d: AdjustmentDraft): Adjustment {
  const a = adjustmentById(id);
  openPeriod(a.periodId);
  if (d.periodId !== a.periodId) throw new Error("ย้ายรายการข้ามงวดไม่ได้");
  firstError(adjustmentErrors(d, id));
  return commit(() => {
    a.employeeId = d.employeeId;
    a.kind = d.kind;
    a.amount = Number(d.amount);
    a.note = d.note.trim();
    return a;
  });
}

export function removeAdjustment(id: number): void {
  const a = adjustmentById(id);
  openPeriod(a.periodId);
  commit(() => ADJUSTMENTS.splice(ADJUSTMENTS.indexOf(a), 1));
}

/* ----------------------------------------------------------- benefits */

/** ปรับสวัสดิการประจำของคนหนึ่ง — มีผลกับงวดที่ยังไม่ล็อก สลิปที่อนุมัติแล้วไม่เปลี่ยน */
export function setBenefits(employeeId: number, amounts: Record<string, string>): Record<string, number> {
  employeeOf(employeeId);
  const next: Record<string, number> = {};
  for (const [code, raw] of Object.entries(amounts)) {
    planOf(code);
    if (raw.trim() === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${planOf(code).name} ต้องเป็นตัวเลขไม่ติดลบ`);
    if (n > 0) next[code] = n;
  }
  return commit(() => {
    BENEFITS[employeeId] = next;
    return next;
  });
}

/* ------------------------------------------------------------- claims */

export type ClaimDraft = {
  periodId: number;
  employeeId: number;
  type: string;
  amount: string;
  receiptDate: string;
  detail: string;
};

export function claimErrors(d: ClaimDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isMember(d.periodId, d.employeeId)) e.employeeId = "เลือกพนักงานที่อยู่ในงวดนี้";
  if (!CLAIM_TYPES.some((t) => t.name === d.type)) e.type = "เลือกประเภทสวัสดิการ";
  const amount = Number(d.amount);
  if (d.amount.trim() === "" || !Number.isFinite(amount) || amount <= 0) e.amount = "กรอกยอดตามใบเสร็จมากกว่า 0";
  if (!ISO_DATE.test(d.receiptDate)) e.receiptDate = "เลือกวันที่ในใบเสร็จ";
  else if (d.receiptDate > TODAY) e.receiptDate = "วันที่ในใบเสร็จต้องไม่อยู่ในอนาคต";
  if (d.detail.trim().length < 5) e.detail = "บอกรายละเอียดและสถานที่อย่างน้อย 5 ตัวอักษร";
  if (e.type || e.amount || e.receiptDate || e.employeeId) return e;

  const u = claimUsage(d.employeeId, d.type, d.receiptDate.slice(0, 4));
  if (amount > u.left) {
    e.amount = `เกินวงเงินคงเหลือ · ${d.type} เบิกได้อีก ${baht(Math.max(0, u.left))} จากเพดานปีละ ${baht(u.limit)}`;
  }
  return e;
}

const claimNo = () => {
  const last = Math.max(0, ...CLAIMS.map((c) => Number(c.no.slice(-4))));
  return `BC-${beYear(TODAY)}-${String(last + 1).padStart(4, "0")}`;
};

/** ยื่นเบิกสวัสดิการ — จ่ายรวมในสลิปของงวดที่ระบุเมื่ออนุมัติ */
export function fileClaim(d: ClaimDraft): Claim {
  openPeriod(d.periodId);
  firstError(claimErrors(d));
  return commit(() => {
    const c: Claim = {
      id: nextId(CLAIMS),
      no: claimNo(),
      employeeId: d.employeeId,
      type: d.type,
      amount: Number(d.amount),
      receiptDate: d.receiptDate,
      detail: d.detail.trim(),
      status: "รออนุมัติ",
      periodId: d.periodId,
      filedAt: TODAY,
    };
    CLAIMS.push(c);
    return c;
  });
}

const claimById = (id: number) => {
  const c = CLAIMS.find((x) => x.id === id);
  if (!c) throw new Error(`ไม่พบใบเบิก ${id}`);
  return c;
};

export function approveClaim(id: number, by = "คุณ"): Claim {
  const c = claimById(id);
  if (c.status !== "รออนุมัติ") throw new Error(`ใบเบิกนี้${c.status}แล้ว`);
  openPeriod(c.periodId);
  return commit(() => {
    c.status = "อนุมัติแล้ว";
    c.decidedBy = by;
    return c;
  });
}

export function rejectClaim(id: number, reason: string, by = "คุณ"): Claim {
  const c = claimById(id);
  if (c.status !== "รออนุมัติ") throw new Error(`ใบเบิกนี้${c.status}แล้ว`);
  if (reason.trim().length < 5) throw new Error("ระบุเหตุผลที่ไม่อนุมัติอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    c.status = "ไม่อนุมัติ";
    c.decidedBy = by;
    c.note = reason.trim();
    return c;
  });
}

/* ---------------------------------------------------------- reports */

/**
 * ไฟล์โอนเงินเดือนให้ธนาคาร — เฉพาะคนที่รับเงินทางบัญชี ยอดแต่ละแถวคือเงินสุทธิในสลิป
 * สร้างได้หลังอนุมัติงวดแล้วเท่านั้น ไฟล์จากตัวเลขที่ยังแก้ได้คือไฟล์ที่โอนผิด
 */
export function bankFile(periodId: number) {
  const period = periodById(periodId);
  if (!isLocked(period)) throw new Error("ต้องอนุมัติงวดก่อนสร้างไฟล์โอนเงิน");
  const rows = slipsFor(periodId)
    .filter((s) => bankOf(s.employeeId).method === "โอนเข้าบัญชี")
    .map((s, i) => {
      const b = bankOf(s.employeeId);
      return { seq: i + 1, code: s.employee.code, name: s.employee.name, bank: b.bank, account: b.account, amount: s.netPay };
    });
  return { period, rows, count: rows.length, total: rows.reduce((n, r) => n + r.amount, 0) };
}

/** ใบแนบ ภ.ง.ด.1 — เงินได้ตามมาตรา 40(1) ที่จ่ายในเดือนและภาษีที่หักไว้ */
export function pnd1(periodId: number) {
  const rows = slipsFor(periodId).map((s, i) => ({
    seq: i + 1,
    taxId: s.employee.admin.taxId,
    name: s.employee.name,
    income: s.taxableMonth + s.taxableOneOff,
    tax: s.tax,
  }));
  return {
    period: periodById(periodId),
    rows,
    income: rows.reduce((n, r) => n + r.income, 0),
    tax: rows.reduce((n, r) => n + r.tax, 0),
  };
}

/** แบบ สปส.1-10 — ค่าจ้างที่ใช้คิดเงินสมทบ ส่วนลูกจ้าง และส่วนนายจ้างที่สมทบเท่ากัน */
export function sso110(periodId: number) {
  const rows = slipsFor(periodId).map((s, i) => ({
    seq: i + 1,
    idCard: s.employee.personal.nationalId.replace(/-/g, ""),
    name: s.employee.name,
    wage: s.ssoBase,
    contribution: s.sso,
  }));
  const employee = rows.reduce((n, r) => n + r.contribution, 0);
  return {
    period: periodById(periodId),
    rows,
    wages: rows.reduce((n, r) => n + r.wage, 0),
    employee,
    employer: employee,
    total: employee * 2,
  };
}

/**
 * หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) ของทั้งปี — รวมเฉพาะงวดที่จ่ายเงินแล้ว
 * เพราะเป็นหนังสือรับรองสิ่งที่จ่ายไปแล้ว ไม่ใช่สิ่งที่กำลังจะจ่าย
 */
export function cert50(employeeId: number, year: string = TODAY.slice(0, 4)) {
  const periods = PERIODS.filter((p) => p.status === "จ่ายแล้ว" && p.month.startsWith(year)).sort((a, b) =>
    a.month.localeCompare(b.month)
  );
  const slips = periods
    .map((p) => slipsFor(p.id).find((s) => s.employeeId === employeeId))
    .filter((s): s is Payslip => s !== undefined);
  return {
    employee: employeeOf(employeeId),
    year,
    periods: periods.filter((p) => slips.some((s) => s.periodId === p.id)),
    income: slips.reduce((n, s) => n + s.taxableMonth + s.taxableOneOff, 0),
    tax: slips.reduce((n, s) => n + s.tax, 0),
    sso: slips.reduce((n, s) => n + s.sso, 0),
    pvd: slips.reduce((n, s) => n + s.pvd, 0),
  };
}

// The periods that open the demo already approved or paid are frozen the same
// way approving one does it.
for (const p of PERIODS) if (isLocked(p)) LOCKED_SLIPS[p.id] = membersOf(p.id).map((e) => payslip(e.id, p.id));
