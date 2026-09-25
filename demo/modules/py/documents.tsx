import type { ReactNode } from "react";
import {
  COMPANY, bankFile, bankOf, beYear, cert50, isLocked, pnd1, sso110,
} from "./data";
import type { Payslip, Period } from "./data";
import { Paper, bahtText, money } from "../kit";

/**
 * The papers payroll hands out and files: the payslip, the monthly withholding
 * and social-security returns, the year-end certificate, and the transfer list
 * the bank signs for. None of them is priced, so each is its own layout on Paper.
 */

const thaiDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
const thaiMonth = (month: string) =>
  new Date(month + "-01T00:00:00").toLocaleDateString("th-TH", { month: "long", year: "numeric" });

const cell = "border border-slate-300 px-2 py-1.5";
const head = cell + " bg-slate-100 text-[11.5px] font-medium text-slate-600";

function Letterhead({ title, lines }: { title: ReactNode; lines: ReactNode[] }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
        <p className="mt-1 max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
        <p className="text-slate-600">
          เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} · {COMPANY.branch}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[17px] font-bold text-slate-900">{title}</p>
        {lines.map((l, i) => (
          <p key={i} className="mt-0.5 tabular-nums text-slate-600">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

function Signature({ role, name }: { role: string; name?: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto h-10 w-44 border-b border-dotted border-slate-500" />
      <p className="mt-1.5 text-slate-700">({name ?? "......................................"})</p>
      <p className="text-slate-600">{role}</p>
      <p className="text-[11px] text-slate-400">วันที่ ____/____/______</p>
    </div>
  );
}

/* ---------------------------------------------------------------- payslip */

/** One payslip's content — the single print and the batch print draw the same thing. */
export function PayslipBody({ slip, period }: { slip: Payslip; period: Period }) {
  const bank = bankOf(slip.employeeId);
  const earnings: [string, number][] = [
    [
      slip.base === slip.fullBase ? "เงินเดือน" : `เงินเดือน (${slip.employedDays}/${slip.daysInMonth} วัน)`,
      slip.base,
    ],
    ...slip.benefitLines.filter((b) => b.amount > 0).map((b): [string, number] => [b.name, b.amount]),
    ...(slip.otNormalPay ? [[`ค่าล่วงเวลา 1.5 เท่า (${slip.otHours} ชม.)`, slip.otNormalPay] as [string, number]] : []),
    ...(slip.otHolidayPay ? [[`ค่าล่วงเวลาวันหยุด 3 เท่า (${slip.holidayOtHours} ชม.)`, slip.otHolidayPay] as [string, number]] : []),
    ...slip.adjustments.filter((a) => a.sign > 0).map((a): [string, number] => [a.kind, a.amount]),
    ...slip.claimLines.map((c): [string, number] => [`เบิก${c.type}`, c.amount]),
  ];
  const deductions: [string, number][] = [
    ...(slip.absenceCut ? [[`ขาดงาน/ลาไม่รับค่าจ้าง (${slip.absentDays + slip.unpaidDays} วัน)`, slip.absenceCut] as [string, number]] : []),
    ...(slip.lateCut ? [[`มาสาย (${slip.lateMinutes} นาที)`, slip.lateCut] as [string, number]] : []),
    ["ประกันสังคม", slip.sso],
    ...(slip.pvd ? [[`กองทุนสำรองเลี้ยงชีพ ${Math.round(slip.pvdRate * 100)}%`, slip.pvd] as [string, number]] : []),
    ["ภาษีหัก ณ ที่จ่าย", slip.tax],
    ...slip.adjustments.filter((a) => a.sign < 0).map((a): [string, number] => [a.kind, a.amount]),
  ];
  const rows = Math.max(earnings.length, deductions.length);

  return (
    <>
      <Letterhead
        title="สลิปเงินเดือน"
        lines={[
          period.label,
          `วันที่จ่าย ${thaiDate(period.payDate)}`,
          ...(isLocked(period) ? [] : [<span key="draft" className="font-semibold text-rose-600">ฉบับร่าง · งวดยังไม่อนุมัติ</span>]),
        ]}
      />
      <div className="mt-4 grid gap-x-8 gap-y-0.5 sm:grid-cols-2">
        <p><span className="text-slate-500">ชื่อ</span> {slip.employee.name}</p>
        <p><span className="text-slate-500">รหัสพนักงาน</span> {slip.employee.code}</p>
        <p><span className="text-slate-500">ตำแหน่ง</span> {slip.employee.position} · {slip.employee.department}</p>
        <p><span className="text-slate-500">เลขประจำตัวผู้เสียภาษี</span> {slip.employee.admin.taxId}</p>
        <p className="sm:col-span-2">
          <span className="text-slate-500">การจ่าย</span>{" "}
          {bank.method === "เงินสด" ? "เงินสด รับที่ฝ่ายบัญชี" : `${bank.method} ${bank.bank} ${bank.account}`}
        </p>
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={head + " text-left"}>รายได้</th>
            <th className={head + " w-28 text-right"}>จำนวนเงิน</th>
            <th className={head + " text-left"}>รายการหัก</th>
            <th className={head + " w-28 text-right"}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td className={cell}>{earnings[i]?.[0] ?? ""}</td>
              <td className={cell + " text-right tabular-nums"}>{earnings[i] ? money(earnings[i][1]) : ""}</td>
              <td className={cell}>{deductions[i]?.[0] ?? ""}</td>
              <td className={cell + " text-right tabular-nums"}>{deductions[i] ? money(deductions[i][1]) : ""}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={cell}>รวมรายได้</td>
            <td className={cell + " text-right tabular-nums"}>{money(slip.gross)}</td>
            <td className={cell}>รวมรายการหัก</td>
            <td className={cell + " text-right tabular-nums"}>{money(slip.deductions)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-100 px-3 py-2">
        <span className="font-medium text-slate-800">({bahtText(slip.netPay)})</span>
        <span className="text-[15px] font-bold tabular-nums text-slate-900">เงินได้สุทธิ {money(slip.netPay)} บาท</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        เอกสารนี้เป็นความลับเฉพาะตัวพนักงาน · ภาษีหัก ณ ที่จ่ายคำนวณจากเงินได้ทั้งปีหักค่าใช้จ่าย ค่าลดหย่อนส่วนตัว
        ประกันสังคม และกองทุนสำรองเลี้ยงชีพ
      </p>
    </>
  );
}

export function PayslipPaper({ slip, period }: { slip: Payslip; period: Period }) {
  return (
    <Paper>
      <PayslipBody slip={slip} period={period} />
    </Paper>
  );
}

/** Every payslip of the period, one per page — printDocument() puts each sheet on its own page. */
export function PayslipBatch({ slips, period }: { slips: Payslip[]; period: Period }) {
  return (
    <div className="space-y-3">
      {slips.map((s) => (
        <PayslipPaper key={s.employeeId} slip={s} period={period} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ tax returns */

/** ใบแนบ ภ.ง.ด.1 — ยื่นภายในวันที่ 7 ของเดือนถัดไป */
export function Pnd1Paper({ periodId }: { periodId: number }) {
  const r = pnd1(periodId);
  return (
    <Paper>
      <Letterhead title="ใบแนบ ภ.ง.ด.1" lines={[`เดือนที่จ่ายเงินได้ ${thaiMonth(r.period.month)}`, `วันที่จ่าย ${thaiDate(r.period.payDate)}`]} />
      <p className="mt-3 text-slate-700">เงินได้ตามมาตรา 40 (1) เงินเดือน ค่าจ้าง ฯลฯ กรณีทั่วไป · เงื่อนไขการหักภาษี 1 = หัก ณ ที่จ่าย</p>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th className={head}>ลำดับ</th>
            <th className={head + " text-left"}>เลขประจำตัวผู้เสียภาษี</th>
            <th className={head + " text-left"}>ชื่อผู้มีเงินได้</th>
            <th className={head + " text-right"}>จำนวนเงินที่จ่าย</th>
            <th className={head + " text-right"}>ภาษีที่หักและนำส่ง</th>
            <th className={head}>เงื่อนไข</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((x) => (
            <tr key={x.seq}>
              <td className={cell + " text-center tabular-nums"}>{x.seq}</td>
              <td className={cell + " tabular-nums"}>{x.taxId}</td>
              <td className={cell}>{x.name}</td>
              <td className={cell + " text-right tabular-nums"}>{money(x.income)}</td>
              <td className={cell + " text-right tabular-nums"}>{money(x.tax)}</td>
              <td className={cell + " text-center"}>1</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={cell} colSpan={3}>
              รวม {r.rows.length} ราย
            </td>
            <td className={cell + " text-right tabular-nums"}>{money(r.income)}</td>
            <td className={cell + " text-right tabular-nums"}>{money(r.tax)}</td>
            <td className={cell} />
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-slate-600">ภาษีที่นำส่งทั้งสิ้น ({bahtText(r.tax)})</p>
      <p className="mt-1 text-[11px] text-slate-500">ยื่นแบบและชำระภาษีภายในวันที่ 7 ของเดือนถัดไป หรือวันที่ 15 เมื่อยื่นทางอินเทอร์เน็ต</p>
      <div className="mt-10 flex justify-end">
        <Signature role="ผู้จ่ายเงิน" />
      </div>
    </Paper>
  );
}

/** แบบ สปส.1-10 ส่วนที่ 1 และ 2 — นำส่งภายในวันที่ 15 ของเดือนถัดไป */
export function Sso110Paper({ periodId }: { periodId: number }) {
  const r = sso110(periodId);
  return (
    <Paper>
      <Letterhead
        title="แบบรายการแสดงการส่งเงินสมทบ (สปส.1-10)"
        lines={[`ค่าจ้างเดือน ${thaiMonth(r.period.month)}`, `เลขที่บัญชีนายจ้าง ${COMPANY.ssoAccount}`, "ลำดับที่สาขา 000000"]}
      />
      <p className="mt-4 font-semibold text-slate-900">ส่วนที่ 1 · สรุปการนำส่งเงินสมทบ</p>
      <dl className="mt-1 grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-0.5">
        <dt className="text-slate-600">จำนวนผู้ประกันตน</dt>
        <dd className="text-right tabular-nums">{r.rows.length} คน</dd>
        <dt className="text-slate-600">ค่าจ้างที่ใช้คำนวณเงินสมทบ</dt>
        <dd className="text-right tabular-nums">{money(r.wages)}</dd>
        <dt className="text-slate-600">เงินสมทบผู้ประกันตน 5%</dt>
        <dd className="text-right tabular-nums">{money(r.employee)}</dd>
        <dt className="text-slate-600">เงินสมทบนายจ้าง 5%</dt>
        <dd className="text-right tabular-nums">{money(r.employer)}</dd>
        <dt className="border-t border-slate-800 pt-1 font-bold text-slate-900">รวมเงินสมทบที่นำส่ง</dt>
        <dd className="border-t border-slate-800 pt-1 text-right font-bold tabular-nums">{money(r.total)}</dd>
      </dl>
      <p className="mt-4 font-semibold text-slate-900">ส่วนที่ 2 · รายละเอียดการนำส่งเงินสมทบ</p>
      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr>
            <th className={head}>ลำดับ</th>
            <th className={head + " text-left"}>เลขประจำตัวประชาชน</th>
            <th className={head + " text-left"}>ชื่อ-นามสกุล</th>
            <th className={head + " text-right"}>ค่าจ้าง</th>
            <th className={head + " text-right"}>เงินสมทบ</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((x) => (
            <tr key={x.seq}>
              <td className={cell + " text-center tabular-nums"}>{x.seq}</td>
              <td className={cell + " tabular-nums"}>{x.idCard}</td>
              <td className={cell}>{x.name}</td>
              <td className={cell + " text-right tabular-nums"}>{money(x.wage)}</td>
              <td className={cell + " text-right tabular-nums"}>{money(x.contribution)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-500">ค่าจ้างคิดเงินสมทบต่ำสุด 1,650 สูงสุด 15,000 บาท · นำส่งภายในวันที่ 15 ของเดือนถัดไป</p>
      <div className="mt-10 flex justify-end">
        <Signature role="นายจ้าง / ผู้รับมอบอำนาจ" />
      </div>
    </Paper>
  );
}

/** หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ — ของทั้งปีภาษี */
export function Cert50Paper({ employeeId, year }: { employeeId: number; year: string }) {
  const c = cert50(employeeId, year);
  return (
    <Paper>
      <div className="border-b-2 border-slate-800 pb-3 text-center">
        <p className="text-[16px] font-bold text-slate-900">หนังสือรับรองการหักภาษี ณ ที่จ่าย</p>
        <p className="text-slate-600">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร · ปีภาษี {beYear(year + "-01-01")}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-300 p-3">
          <p className="text-[11px] text-slate-500">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</p>
          <p className="font-semibold text-slate-900">{COMPANY.name}</p>
          <p className="leading-relaxed text-slate-600">{COMPANY.address}</p>
          <p className="text-slate-600">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}</p>
        </div>
        <div className="rounded-md border border-slate-300 p-3">
          <p className="text-[11px] text-slate-500">ผู้ถูกหักภาษี ณ ที่จ่าย</p>
          <p className="font-semibold text-slate-900">{c.employee.name}</p>
          <p className="leading-relaxed text-slate-600">{c.employee.personal.address}</p>
          <p className="text-slate-600">เลขประจำตัวผู้เสียภาษี {c.employee.admin.taxId}</p>
        </div>
      </div>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={head + " text-left"}>ประเภทเงินได้พึงประเมินที่จ่าย</th>
            <th className={head + " text-left"}>งวดที่จ่าย</th>
            <th className={head + " text-right"}>จำนวนเงินที่จ่าย</th>
            <th className={head + " text-right"}>ภาษีที่หักและนำส่งไว้</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={cell}>1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</td>
            <td className={cell}>{c.periods.length ? c.periods.map((p) => p.label.replace("งวดเดือน", "")).join(", ") : "—"}</td>
            <td className={cell + " text-right tabular-nums"}>{money(c.income)}</td>
            <td className={cell + " text-right tabular-nums"}>{money(c.tax)}</td>
          </tr>
          <tr className="font-semibold">
            <td className={cell} colSpan={2}>
              รวมเงินที่จ่ายและภาษีที่หักนำส่ง
            </td>
            <td className={cell + " text-right tabular-nums"}>{money(c.income)}</td>
            <td className={cell + " text-right tabular-nums"}>{money(c.tax)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-800">รวมภาษีที่หักนำส่ง ({bahtText(c.tax)})</p>
      <p className="mt-2 text-slate-700">
        เงินที่จ่ายเข้า กองทุนประกันสังคม {money(c.sso)} บาท · กองทุนสำรองเลี้ยงชีพ {money(c.pvd)} บาท
      </p>
      <p className="mt-1 text-slate-700">ผู้จ่ายเงิน ☑ หัก ณ ที่จ่าย ☐ ออกให้ตลอดไป ☐ ออกให้ครั้งเดียว</p>
      <p className="mt-1 text-[11px] text-slate-500">นับเฉพาะงวดที่จ่ายเงินแล้วในปีภาษีนี้ · ใช้ประกอบการยื่นแบบ ภ.ง.ด.90/91</p>
      <div className="mt-10 flex justify-end">
        <Signature role="ผู้มีหน้าที่หักภาษี ณ ที่จ่าย" />
      </div>
    </Paper>
  );
}

/** ใบนำส่งรายการโอนเงินเดือน — แนบไปกับไฟล์โอนให้ธนาคาร */
export function BankPaper({ periodId }: { periodId: number }) {
  const f = bankFile(periodId);
  return (
    <Paper>
      <Letterhead
        title="ใบนำส่งรายการโอนเงินเดือน"
        lines={[f.period.label, `วันที่โอน ${thaiDate(f.period.payDate)}`, `บัญชีบริษัท ${COMPANY.payrollBank} ${COMPANY.payrollAccount}`]}
      />
      <p className="mt-3 text-slate-700">เรียน ผู้จัดการธนาคาร{COMPANY.payrollBank} · ขอให้โอนเงินเดือนเข้าบัญชีพนักงานตามรายการต่อไปนี้</p>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th className={head}>ลำดับ</th>
            <th className={head + " text-left"}>รหัส</th>
            <th className={head + " text-left"}>ชื่อบัญชี</th>
            <th className={head + " text-left"}>ธนาคาร</th>
            <th className={head + " text-left"}>เลขบัญชี</th>
            <th className={head + " text-right"}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {f.rows.map((r) => (
            <tr key={r.seq}>
              <td className={cell + " text-center tabular-nums"}>{r.seq}</td>
              <td className={cell + " tabular-nums"}>{r.code}</td>
              <td className={cell}>{r.name}</td>
              <td className={cell}>{r.bank}</td>
              <td className={cell + " tabular-nums"}>{r.account}</td>
              <td className={cell + " text-right tabular-nums"}>{money(r.amount)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={cell} colSpan={5}>
              รวม {f.count} รายการ
            </td>
            <td className={cell + " text-right tabular-nums"}>{money(f.total)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-800">({bahtText(f.total)})</p>
      <div className="mt-10 grid grid-cols-2 gap-8">
        <Signature role="ผู้มีอำนาจลงนาม" />
        <Signature role="ผู้มีอำนาจลงนาม" />
      </div>
    </Paper>
  );
}
