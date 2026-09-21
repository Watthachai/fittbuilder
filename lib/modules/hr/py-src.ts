export const PY_DATA = `import { EMPLOYEES } from "../pa/data";

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
export const PAYROLL_INPUT = {
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

export const BANKS = {
  1: { bank: "กสิกรไทย", account: "xxx-x-x4821-x", method: "โอนเข้าบัญชี" },
  2: { bank: "ไทยพาณิชย์", account: "xxx-x-x0173-x", method: "โอนเข้าบัญชี" },
  3: { bank: "กรุงไทย", account: "xxx-x-x9264-x", method: "โอนเข้าบัญชี" },
  4: { bank: "กสิกรไทย", account: "xxx-x-x5530-x", method: "โอนเข้าบัญชี" },
  5: { bank: "กรุงเทพ", account: "xxx-x-x1108-x", method: "โอนเข้าบัญชี" },
  6: { bank: "ไทยพาณิชย์", account: "xxx-x-x7745-x", method: "โอนเข้าบัญชี" },
  7: { bank: "—", account: "—", method: "เงินสด" },
};

const WORK_DAYS = 22;

export function annualTax(taxableYear) {
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
export function payslip(employeeId) {
  const inp = PAYROLL_INPUT[employeeId];
  const perDay = inp.base / WORK_DAYS;
  const perHour = perDay / 8;

  const benefitLines = Object.entries(inp.benefits).map(([code, amount]) => ({
    ...BENEFIT_PLANS.find((p) => p.code === code),
    amount,
  }));
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
export const baht = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";
export const empName = (id) => EMPLOYEES.find((e) => e.id === id)?.name ?? "—";
`;

export const PY_SCREEN = `import { useState } from "react";
import { EMPLOYEES } from "../pa/data";
import {
  PERIODS, BENEFIT_PLANS, PAYROLL_INPUT, TAX_BANDS, BANKS,
  SSO_RATE, SSO_CAP, SLIPS, baht, empName,
} from "./data";

const TABS = ["คำนวณเงินเดือน", "สวัสดิการ", "ขาดลามาสาย", "ภาษีและประกันสังคม", "การจ่ายเงิน"];

export default function PyScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [open, setOpen] = useState(null);

  const total = SLIPS.reduce((n, s) => n + s.netPay, 0);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">เงินเดือน</h1>
          <p className="text-sm text-slate-500">{SLIPS.length} คน · ยอดจ่ายสุทธิ {baht(total)}</p>
        </div>
        <select
          value={period.id}
          onChange={(e) => setPeriod(PERIODS.find((p) => p.id === Number(e.target.value)))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              t === tab
                ? "whitespace-nowrap border-b-2 border-sky-600 px-3 py-2.5 text-[13px] font-medium text-sky-700"
                : "whitespace-nowrap px-3 py-2.5 text-[13px] text-slate-500 hover:text-slate-800"
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "คำนวณเงินเดือน" && <Calculation period={period} onOpen={setOpen} />}
      {tab === "สวัสดิการ" && <Benefits />}
      {tab === "ขาดลามาสาย" && <Absences />}
      {tab === "ภาษีและประกันสังคม" && <Statutory />}
      {tab === "การจ่ายเงิน" && <Payments period={period} />}

      {open && <SlipDialog slip={open} period={period} onClose={() => setOpen(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="คำนวณเงินเดือน" />
        <button data-fitt-screen="สลิปเงินเดือน" data-fitt-modal onClick={() => setOpen(SLIPS[0])} />
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{children}</div>;
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={"mt-1 text-lg font-semibold " + (tone === "cut" ? "text-rose-600" : "text-slate-900")}>{value}</div>
    </div>
  );
}

function Calculation({ period, onOpen }) {
  const gross = SLIPS.reduce((n, s) => n + s.gross, 0);
  const cut = SLIPS.reduce((n, s) => n + s.deductions, 0);
  return (
    <div>
      <div className="mb-3 grid grid-cols-4 gap-3">
        <Stat label="รายได้รวม" value={baht(gross)} />
        <Stat label="รายการหักรวม" value={baht(cut)} tone="cut" />
        <Stat label="จ่ายสุทธิ" value={baht(gross - cut)} />
        <Stat label="สถานะงวด" value={period.status} />
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th><th className="px-4 py-3 text-right">เงินเดือน</th>
              <th className="px-4 py-3 text-right">สวัสดิการ</th><th className="px-4 py-3 text-right">ล่วงเวลา</th>
              <th className="px-4 py-3 text-right">หัก</th><th className="px-4 py-3 text-right">สุทธิ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SLIPS.map((s) => (
              <tr key={s.employeeId} className="hover:bg-sky-50">
                <td className="px-4 py-3 font-medium text-slate-900">{empName(s.employeeId)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{baht(s.base)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{baht(s.benefitTotal)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{s.otPay ? baht(s.otPay) : "—"}</td>
                <td className="px-4 py-3 text-right text-rose-600">−{baht(s.deductions)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{baht(s.netPay)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onOpen(s)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700">
                    ดูสลิป
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Benefits() {
  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">รายการสวัสดิการที่ประกาศใช้</div>
        <ul className="divide-y divide-slate-100">
          {BENEFIT_PLANS.map((p) => (
            <li key={p.code} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-800">{p.name}</span>
              <span className={"rounded-full px-2 py-1 text-xs " + (p.taxable ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                {p.taxable ? "นำไปคำนวณภาษี" : "ยกเว้นภาษี"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">สวัสดิการรายคนในงวดนี้</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th>
              {BENEFIT_PLANS.filter((p) => p.code !== "PVD").map((p) => <th key={p.code} className="px-4 py-3 text-right">{p.name}</th>)}
              <th className="px-4 py-3 text-right">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SLIPS.map((s) => (
              <tr key={s.employeeId} className="hover:bg-sky-50">
                <td className="px-4 py-3 font-medium text-slate-900">{empName(s.employeeId)}</td>
                {BENEFIT_PLANS.filter((p) => p.code !== "PVD").map((p) => {
                  const line = s.benefitLines.find((b) => b.code === p.code);
                  return <td key={p.code} className="px-4 py-3 text-right text-slate-700">{line ? baht(line.amount) : "—"}</td>;
                })}
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{baht(s.benefitTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Absences() {
  const affected = SLIPS.filter((s) => s.absenceCut > 0 || s.lateCut > 0);
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="พนักงานที่ถูกหัก" value={affected.length + " คน"} />
        <Stat label="หักจากวันขาด/ลาไม่รับค่าจ้าง" value={baht(SLIPS.reduce((n, s) => n + s.absenceCut, 0))} tone="cut" />
        <Stat label="หักจากมาสาย" value={baht(SLIPS.reduce((n, s) => n + s.lateCut, 0))} tone="cut" />
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th><th className="px-4 py-3 text-right">วันขาดงาน</th>
              <th className="px-4 py-3 text-right">ลาไม่รับค่าจ้าง</th><th className="px-4 py-3 text-right">มาสาย</th>
              <th className="px-4 py-3 text-right">ยอดหัก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SLIPS.map((s) => {
              const cut = s.absenceCut + s.lateCut;
              return (
                <tr key={s.employeeId} className="hover:bg-sky-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{empName(s.employeeId)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{s.absentDays || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{s.unpaidDays || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{s.lateMinutes ? s.lateMinutes + " นาที" : "—"}</td>
                  <td className={"px-4 py-3 text-right " + (cut ? "font-semibold text-rose-600" : "text-slate-400")}>
                    {cut ? "−" + baht(cut) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Statutory() {
  const sso = SLIPS.reduce((n, s) => n + s.sso, 0);
  const tax = SLIPS.reduce((n, s) => n + s.tax, 0);
  const pvd = SLIPS.reduce((n, s) => n + s.pvd, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="ประกันสังคม (ฝั่งลูกจ้าง)" value={baht(sso)} />
        <Stat label="สมทบนายจ้าง" value={baht(sso)} />
        <Stat label="ภาษีหัก ณ ที่จ่าย" value={baht(tax)} />
      </div>
      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">
          รายการนำส่ง — ประกันสังคม {SSO_RATE * 100}% ของเงินเดือน สูงสุด {SSO_CAP} ฿ · กองทุนสำรองเลี้ยงชีพรวม {baht(pvd)}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th><th className="px-4 py-3 text-right">ฐานคำนวณ</th>
              <th className="px-4 py-3 text-right">ประกันสังคม</th><th className="px-4 py-3 text-right">กองทุนสำรองฯ</th>
              <th className="px-4 py-3 text-right">ภาษีหัก ณ ที่จ่าย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SLIPS.map((s) => (
              <tr key={s.employeeId} className="hover:bg-sky-50">
                <td className="px-4 py-3 font-medium text-slate-900">{empName(s.employeeId)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{baht(s.base)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{baht(s.sso)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{s.pvd ? baht(s.pvd) : "—"}</td>
                <td className="px-4 py-3 text-right text-slate-700">{s.tax ? baht(s.tax) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">ขั้นภาษีเงินได้บุคคลธรรมดาที่ใช้คำนวณ</div>
        <ul className="divide-y divide-slate-100 text-sm">
          {TAX_BANDS.map((b, i) => (
            <li key={i} className="flex justify-between px-4 py-2">
              <span className="text-slate-700">
                เงินได้สุทธิถึง {b.upTo === Infinity ? "ไม่จำกัด" : b.upTo.toLocaleString("th-TH") + " ฿"}
              </span>
              <span className="text-slate-900">{b.rate * 100}%</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Payments({ period }) {
  const byMethod = SLIPS.reduce((m, s) => {
    const k = BANKS[s.employeeId].method;
    m[k] = (m[k] ?? 0) + s.netPay;
    return m;
  }, {});
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="วันที่จ่าย" value={period.payDate} />
        {Object.entries(byMethod).map(([k, v]) => <Stat key={k} label={k} value={baht(v)} />)}
      </div>
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-800">รายการโอนเข้าบัญชี</span>
          <span className={"rounded-full px-2.5 py-1 text-xs " + (period.status === "จ่ายแล้ว" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            {period.status}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th><th className="px-4 py-3">ธนาคาร</th>
              <th className="px-4 py-3">เลขบัญชี</th><th className="px-4 py-3">วิธีจ่าย</th>
              <th className="px-4 py-3 text-right">ยอดโอน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SLIPS.map((s) => {
              const b = BANKS[s.employeeId];
              return (
                <tr key={s.employeeId} className="hover:bg-sky-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{empName(s.employeeId)}</td>
                  <td className="px-4 py-3 text-slate-600">{b.bank}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.account}</td>
                  <td className="px-4 py-3 text-slate-600">{b.method}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{baht(s.netPay)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right text-sm text-slate-600">ยอดโอนรวมทั้งงวด</td>
              <td className="px-4 py-3 text-right text-base font-semibold text-slate-900">
                {baht(SLIPS.reduce((n, s) => n + s.netPay, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

function SlipDialog({ slip, period, onClose }) {
  const emp = EMPLOYEES.find((e) => e.id === slip.employeeId);
  const bank = BANKS[slip.employeeId];
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">สลิปเงินเดือน</h2>
            <p className="text-sm text-slate-500">{emp?.name} · {period.label}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <Section title="รายได้">
          <Line k="เงินเดือน" v={baht(slip.base)} />
          {slip.benefitLines.map((b) => <Line key={b.code} k={b.name} v={baht(b.amount)} />)}
          {slip.otPay > 0 && <Line k={"ล่วงเวลา " + slip.otHours + " ชม. (อัตรา 1.5)"} v={baht(slip.otPay)} />}
          <Line k="รวมรายได้" v={baht(slip.gross)} bold />
        </Section>

        <Section title="รายการหัก">
          {slip.absenceCut > 0 && <Line k={"ขาดงาน/ลาไม่รับค่าจ้าง " + (slip.absentDays + slip.unpaidDays) + " วัน"} v={"−" + baht(slip.absenceCut)} cut />}
          {slip.lateCut > 0 && <Line k={"มาสาย " + slip.lateMinutes + " นาที"} v={"−" + baht(slip.lateCut)} cut />}
          <Line k="ประกันสังคม" v={"−" + baht(slip.sso)} cut />
          {slip.pvd > 0 && <Line k="กองทุนสำรองเลี้ยงชีพ" v={"−" + baht(slip.pvd)} cut />}
          {slip.tax > 0 && <Line k="ภาษีหัก ณ ที่จ่าย" v={"−" + baht(slip.tax)} cut />}
          <Line k="รวมรายการหัก" v={"−" + baht(slip.deductions)} bold cut />
        </Section>

        <div className="mt-5 flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3.5">
          <span className="text-sm font-medium text-sky-900">จ่ายสุทธิ</span>
          <span className="text-xl font-semibold text-sky-900">{baht(slip.netPay)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {bank.method === "เงินสด" ? "รับเป็นเงินสด" : "โอนเข้า " + bank.bank + " " + bank.account} · วันที่จ่าย {period.payDate}
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-5">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</div>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </div>
  );
}

function Line({ k, v, bold, cut }) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <dt className={bold ? "font-medium text-slate-900" : "text-slate-600"}>{k}</dt>
      <dd className={(bold ? "font-semibold " : "") + (cut ? "text-rose-600" : "text-slate-900")}>{v}</dd>
    </div>
  );
}
`;
