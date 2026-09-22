import { EMPLOYEES, TODAY } from "../pa/data";
import type { Employee } from "../pa/data";

/**
 * Payroll for one period, calculated rather than stored.
 *
 * The base salary and provident-fund rate are read from the personnel register,
 * because a second copy of somebody's salary is the one number in a company that
 * must never disagree with itself. What this module owns is what only payroll
 * knows: the allowances it pays, and the attendance figures keyed in for the
 * period — a company without a time system still has to enter them somewhere.
 */

export { TODAY };

export type PeriodStatus = "กำลังคำนวณ" | "รอตรวจสอบ" | "อนุมัติแล้ว" | "จ่ายแล้ว";

export const PERIOD_FLOW: PeriodStatus[] = ["กำลังคำนวณ", "รอตรวจสอบ", "อนุมัติแล้ว", "จ่ายแล้ว"];

export type Period = {
  id: number;
  label: string;
  month: string;
  status: PeriodStatus;
  payDate: string;
  workDays: number;
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

export type Variable = { otHours: number; absentDays: number; unpaidDays: number; lateMinutes: number };

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
export const PERSONAL_ALLOWANCE = 60000;
/** หักค่าใช้จ่าย 50% ของเงินได้ แต่ไม่เกิน 100,000 */
export const EXPENSE_CAP = 100000;

export const BANKS: Record<number, { bank: string; account: string; method: string }> = {
  1: { bank: "กสิกรไทย", account: "xxx-x-x4821-x", method: "โอนเข้าบัญชี" },
  2: { bank: "ไทยพาณิชย์", account: "xxx-x-x0173-x", method: "โอนเข้าบัญชี" },
  3: { bank: "กรุงไทย", account: "xxx-x-x9264-x", method: "โอนเข้าบัญชี" },
  4: { bank: "กสิกรไทย", account: "xxx-x-x5530-x", method: "โอนเข้าบัญชี" },
  5: { bank: "กรุงเทพ", account: "xxx-x-x1108-x", method: "โอนเข้าบัญชี" },
  6: { bank: "ไทยพาณิชย์", account: "xxx-x-x7745-x", method: "โอนเข้าบัญชี" },
  7: { bank: "—", account: "—", method: "เงินสด" },
};

/** พนักงานที่อยู่ในรอบจ่ายเงินเดือน — อ่านจากทะเบียนพนักงาน */
export const ON_PAYROLL: Employee[] = EMPLOYEES.filter((e) => e.status !== "ลาออก");

export const employeeOf = (id: number): Employee => {
  const e = EMPLOYEES.find((x) => x.id === id);
  if (!e) throw new Error(`ไม่พบพนักงาน ${id}`);
  return e;
};

export function annualTax(taxableYear: number) {
  const expense = Math.min(taxableYear * 0.5, EXPENSE_CAP);
  const net = Math.max(0, taxableYear - expense - PERSONAL_ALLOWANCE - SSO_CAP * 12);
  let tax = 0;
  let prev = 0;
  for (const b of TAX_BANDS) {
    if (net <= prev) break;
    tax += (Math.min(net, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return { net, tax, expense };
}

export type Payslip = ReturnType<typeof payslip>;

/** สลิปหนึ่งใบ — ทุกตัวเลขคำนวณสดจากฐานเงินเดือนในทะเบียนพนักงาน */
export function payslip(employeeId: number, periodId: number, override?: Partial<Variable>) {
  const employee = employeeOf(employeeId);
  const period = periodById(periodId);
  const v = { ...VARIABLES[periodId][employeeId], ...override };

  const base = employee.contract.baseSalary;
  const pvdRate = employee.admin.pvdRate / 100;
  const perDay = base / period.workDays;
  const perHour = perDay / 8;

  const benefitLines = Object.entries(BENEFITS[employeeId] ?? {}).map(([code, amount]) => {
    const plan = planOf(code);
    // เบี้ยขยันตัดทั้งก้อนเมื่อขาดงาน ตามเงื่อนไขของสวัสดิการนั้นเอง
    const paid = plan.code === "DILI" && v.absentDays > 0 ? 0 : amount;
    return { ...plan, amount: paid, full: amount, forfeited: paid !== amount };
  });
  const benefitTotal = benefitLines.reduce((n, b) => n + b.amount, 0);
  const otPay = Math.round(v.otHours * perHour * 1.5);

  const absenceCut = Math.round((v.absentDays + v.unpaidDays) * perDay);
  const lateCut = Math.round((v.lateMinutes / 60) * perHour);

  const gross = base + benefitTotal + otPay;
  const taxableMonth = base + otPay + benefitLines.filter((b) => b.taxable).reduce((n, b) => n + b.amount, 0);

  const sso = Math.min(Math.round(base * SSO_RATE), SSO_CAP);
  const pvd = Math.round(base * pvdRate);
  const { tax: yearTax, net: taxableNet } = annualTax(taxableMonth * 12);
  const tax = Math.round(yearTax / 12);

  const deductions = absenceCut + lateCut + sso + pvd + tax;
  return {
    employeeId,
    periodId,
    employee,
    base,
    perDay,
    perHour,
    pvdRate,
    benefitLines,
    benefitTotal,
    otHours: v.otHours,
    otPay,
    absentDays: v.absentDays,
    unpaidDays: v.unpaidDays,
    lateMinutes: v.lateMinutes,
    absenceCut,
    lateCut,
    sso,
    pvd,
    tax,
    taxableMonth,
    taxableNet,
    gross,
    deductions,
    netPay: gross - deductions,
  };
}

export const slipsFor = (periodId: number, overrides: Record<number, Partial<Variable>> = {}) =>
  ON_PAYROLL.filter((e) => VARIABLES[periodId][e.id]).map((e) => payslip(e.id, periodId, overrides[e.id]));

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
