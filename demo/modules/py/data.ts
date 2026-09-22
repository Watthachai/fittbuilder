import { EMPLOYEES } from "../pa/data";

export const PERIODS = [
  { id: 1, label: "งวดเดือนกันยายน 2569", status: "รอตรวจสอบ", payDate: "2026-09-25" },
  { id: 2, label: "งวดเดือนสิงหาคม 2569", status: "จ่ายแล้ว", payDate: "2026-08-25" },
  { id: 3, label: "งวดเดือนกรกฎาคม 2569", status: "จ่ายแล้ว", payDate: "2026-07-24" },
];

/** สวัสดิการที่จ่ายเป็นเงินเข้ารวมในสลิป */
export const BENEFIT_PLANS = [
  { code: "POS", name: "ค่าตำแหน่ง", taxable: true },
  { code: "TRV", name: "ค่าเดินทาง", taxable: false },
  { code: "TEL", name: "ค่าโทรศัพท์", taxable: false },
  { code: "MEAL", name: "ค่าอาหาร", taxable: false },
  { code: "PVD", name: "กองทุนสำรองเลี้ยงชีพ", taxable: false },
];

/** ข้อมูลตั้งต้นต่อคนของงวดที่กำลังคำนวณ */
type PayrollInput = {
  base: number;
  benefits: Record<string, number>;
  otHours: number;
  absentDays: number;
  unpaidDays: number;
  lateMinutes: number;
  pvdRate: number;
};

export const PAYROLL_INPUT: Record<number, PayrollInput> = {
  1: { base: 52000, benefits: { POS: 8000, TRV: 3000, TEL: 800 }, otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 0, pvdRate: 0.05 },
  2: { base: 38000, benefits: { POS: 3000, MEAL: 1500 }, otHours: 4, absentDays: 0, unpaidDays: 0, lateMinutes: 31, pvdRate: 0.03 },
  3: { base: 21000, benefits: { MEAL: 1500 }, otHours: 18, absentDays: 0, unpaidDays: 0, lateMinutes: 0, pvdRate: 0.03 },
  4: { base: 34000, benefits: { POS: 2500, TEL: 500 }, otHours: 6, absentDays: 0, unpaidDays: 0, lateMinutes: 0, pvdRate: 0.03 },
  5: { base: 23500, benefits: { MEAL: 1500, TRV: 1200 }, otHours: 26, absentDays: 0, unpaidDays: 0, lateMinutes: 0, pvdRate: 0 },
  6: { base: 29000, benefits: { POS: 2000 }, otHours: 0, absentDays: 0, unpaidDays: 0, lateMinutes: 41, pvdRate: 0.03 },
  7: { base: 26000, benefits: { MEAL: 1500 }, otHours: 0, absentDays: 1, unpaidDays: 1, lateMinutes: 0, pvdRate: 0.03 },
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

const WORK_DAYS = 22;

export function annualTax(taxableYear: number) {
  const expense = Math.min(taxableYear * 0.5, EXPENSE_CAP);
  const net = Math.max(0, taxableYear - expense - PERSONAL_ALLOWANCE - SSO_CAP * 12);
  let tax = 0, prev = 0;
  for (const b of TAX_BANDS) {
    if (net <= prev) break;
    tax += (Math.min(net, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return { net, tax };
}

/** สลิปหนึ่งใบ — ทุกตัวเลขคำนวณสด ไม่ได้ hard-code */
export function payslip(employeeId: number) {
  const inp = PAYROLL_INPUT[employeeId];
  const perDay = inp.base / WORK_DAYS;
  const perHour = perDay / 8;

  const benefitLines = Object.entries(inp.benefits).map(([code, amount]) => {
    const plan = BENEFIT_PLANS.find((p) => p.code === code);
    if (!plan) throw new Error(`ไม่รู้จักสวัสดิการ ${code}`);
    return { ...plan, amount };
  });
  const benefitTotal = benefitLines.reduce((n, b) => n + b.amount, 0);
  const otPay = Math.round(inp.otHours * perHour * 1.5);

  const absenceCut = Math.round((inp.absentDays + inp.unpaidDays) * perDay);
  const lateCut = Math.round((inp.lateMinutes / 60) * perHour);

  const gross = inp.base + benefitTotal + otPay;
  const taxableMonth = inp.base + otPay + benefitLines.filter((b) => b.taxable).reduce((n, b) => n + b.amount, 0);

  const sso = Math.min(Math.round(inp.base * SSO_RATE), SSO_CAP);
  const pvd = Math.round(inp.base * inp.pvdRate);
  const tax = Math.round(annualTax(taxableMonth * 12).tax / 12);

  const deductions = absenceCut + lateCut + sso + pvd + tax;
  return {
    employeeId, base: inp.base, benefitLines, benefitTotal, otHours: inp.otHours, otPay,
    absentDays: inp.absentDays, unpaidDays: inp.unpaidDays, lateMinutes: inp.lateMinutes,
    absenceCut, lateCut, sso, pvd, tax, gross, deductions, netPay: gross - deductions,
  };
}

export const SLIPS = Object.keys(PAYROLL_INPUT).map((id) => payslip(Number(id)));
export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";
export const empName = (id: number) => EMPLOYEES.find((e) => e.id === id)?.name ?? "—";
