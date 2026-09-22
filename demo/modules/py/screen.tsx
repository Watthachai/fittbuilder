import { useState } from "react";
import type { ReactNode } from "react";
import { EMPLOYEES } from "../pa/data";
import {
  PERIODS, BENEFIT_PLANS, PAYROLL_INPUT, TAX_BANDS, BANKS,
  SSO_RATE, SSO_CAP, SLIPS, baht, empName,
} from "./data";

type Period = (typeof PERIODS)[number];
type Payslip = (typeof SLIPS)[number];

const periodById = (id: number) => {
  const p = PERIODS.find((x) => x.id === id);
  if (!p) throw new Error(`ไม่มีงวด ${id}`);
  return p;
};
import { Card, Stat, Row, TH } from "../ui";

const TABS = ["คำนวณเงินเดือน", "สวัสดิการ", "ขาดลามาสาย", "ภาษีและประกันสังคม", "การจ่ายเงิน"];

export default function PyScreen({ section }: { section?: string }) {
  // Which capability to show is the navigation's decision, not this screen's.
  const tab = section && TABS.includes(section) ? section : TABS[0];
  const [period, setPeriod] = useState<Period>(PERIODS[0]);
  const [open, setOpen] = useState<Payslip | null>(null);

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
          onChange={(e) => setPeriod(periodById(Number(e.target.value)))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
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

function Calculation({ period, onOpen }: { period: Period; onOpen: (s: Payslip) => void }) {
  const gross = SLIPS.reduce((n, s) => n + s.gross, 0);
  const cut = SLIPS.reduce((n, s) => n + s.deductions, 0);
  return (
    <div>
      <div className="mb-3 grid grid-cols-4 gap-3">
        <Stat label="รายได้รวม" value={baht(gross)} />
        <Stat label="รายการหักรวม" value={baht(cut)} tone="bad" />
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
        <Stat label="หักจากวันขาด/ลาไม่รับค่าจ้าง" value={baht(SLIPS.reduce((n, s) => n + s.absenceCut, 0))} tone="bad" />
        <Stat label="หักจากมาสาย" value={baht(SLIPS.reduce((n, s) => n + s.lateCut, 0))} tone="bad" />
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

function Payments({ period }: { period: Period }) {
  const byMethod = SLIPS.reduce<Record<string, number>>((m, s) => {
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

function SlipDialog({ slip, period, onClose }: { slip: Payslip; period: Period; onClose: () => void }) {
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
          <Row k="เงินเดือน" v={baht(slip.base)} />
          {slip.benefitLines.map((b) => <Row key={b.code} k={b.name} v={baht(b.amount)} />)}
          {slip.otPay > 0 && <Row k={"ล่วงเวลา " + slip.otHours + " ชม. (อัตรา 1.5)"} v={baht(slip.otPay)} />}
          <Row k="รวมรายได้" v={baht(slip.gross)} bold />
        </Section>

        <Section title="รายการหัก">
          {slip.absenceCut > 0 && <Row k={"ขาดงาน/ลาไม่รับค่าจ้าง " + (slip.absentDays + slip.unpaidDays) + " วัน"} v={"−" + baht(slip.absenceCut)} cut />}
          {slip.lateCut > 0 && <Row k={"มาสาย " + slip.lateMinutes + " นาที"} v={"−" + baht(slip.lateCut)} cut />}
          <Row k="ประกันสังคม" v={"−" + baht(slip.sso)} cut />
          {slip.pvd > 0 && <Row k="กองทุนสำรองเลี้ยงชีพ" v={"−" + baht(slip.pvd)} cut />}
          {slip.tax > 0 && <Row k="ภาษีหัก ณ ที่จ่าย" v={"−" + baht(slip.tax)} cut />}
          <Row k="รวมรายการหัก" v={"−" + baht(slip.deductions)} bold cut />
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</div>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </div>
  );
}

