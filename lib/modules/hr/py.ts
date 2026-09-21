import type { Module } from "../types";

/**
 * Payroll — the module that proves the ownership contract is real.
 *
 * It reads `employee` and never keeps its own copy. That is the whole point of
 * shipping HR first: if the composer's `provides`/`needs` rule were decorative,
 * this is where it would show, because a payroll screen with its own private list
 * of staff looks completely fine until someone is hired.
 */
const SCREEN = `import { useState } from "react";
import { EMPLOYEES } from "../pa/data";
import { PAY_RUNS, baseSalaryOf } from "./data";

const baht = (n) => n.toLocaleString("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

export default function PyScreen() {
  const [runId, setRunId] = useState(PAY_RUNS[0].id);
  const [slip, setSlip] = useState(null);
  const run = PAY_RUNS.find((r) => r.id === runId);

  // The staff list comes from the personnel module. Payroll does not keep one.
  const active = EMPLOYEES.filter((e) => e.status !== "ลาออก");
  const lines = active.map((e) => {
    const base = baseSalaryOf(e.id);
    const social = Math.min(Math.round(base * 0.05), 750);
    return { employee: e, base, social, net: base - social };
  });
  const total = lines.reduce((n, l) => n + l.net, 0);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">เงินเดือน</h1>
          <p className="text-sm text-slate-500">
            พนักงานที่เข้าเกณฑ์ {active.length} คน · ข้อมูลมาจากทะเบียนพนักงาน
          </p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-slate-500">รอบจ่าย</span>
          <select
            value={runId}
            onChange={(e) => setRunId(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          >
            {PAY_RUNS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="ยอดจ่ายสุทธิ" value={baht(total)} />
        <Stat label="ประกันสังคมนำส่ง" value={baht(lines.reduce((n, l) => n + l.social, 0))} />
        <Stat label="สถานะรอบ" value={run.status} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th>
              <th className="px-4 py-3">แผนก</th>
              <th className="px-4 py-3 text-right">เงินเดือน</th>
              <th className="px-4 py-3 text-right">ประกันสังคม</th>
              <th className="px-4 py-3 text-right">สุทธิ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.employee.id} className="hover:bg-sky-50">
                <td className="px-4 py-3 font-medium text-slate-900">{l.employee.name}</td>
                <td className="px-4 py-3 text-slate-600">{l.employee.department}</td>
                <td className="px-4 py-3 text-right text-slate-700">{baht(l.base)}</td>
                <td className="px-4 py-3 text-right text-rose-600">-{baht(l.social)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{baht(l.net)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSlip(l)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700"
                  >
                    ดูสลิป
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slip && <Payslip line={slip} run={run} onClose={() => setSlip(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="เงินเดือน" />
        <button data-fitt-screen="สลิปเงินเดือน" data-fitt-modal onClick={() => setSlip(lines[0])} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Payslip({ line, run, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">สลิปเงินเดือน</h2>
        <p className="mt-0.5 text-sm text-slate-500">{line.employee.name} · {run.label}</p>
        <dl className="mt-5 space-y-2 text-sm">
          <Row label="เงินเดือน" value={baht(line.base)} />
          <Row label="ประกันสังคม" value={"-" + baht(line.social)} tone="text-rose-600" />
          <div className="border-t border-slate-200 pt-2">
            <Row label="รับสุทธิ" value={baht(line.net)} bold />
          </div>
        </dl>
        <button onClick={onClose} className="mt-6 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white">
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, tone, bold }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className={(bold ? "font-semibold text-slate-900" : tone || "text-slate-900")}>{value}</dd>
    </div>
  );
}
`;

const DATA = `export const PAY_RUNS = [
  { id: 1, label: "งวดเดือนกันยายน 2569", status: "รอตรวจสอบ" },
  { id: 2, label: "งวดเดือนสิงหาคม 2569", status: "จ่ายแล้ว" },
  { id: 3, label: "งวดเดือนกรกฎาคม 2569", status: "จ่ายแล้ว" },
];

/** Base salary per employee id — keyed to the personnel module's records. */
const BASE = { 1: 45000, 2: 38000, 3: 18000, 4: 25000, 5: 21000, 6: 22000, 7: 42000 };

export function baseSalaryOf(employeeId) {
  return BASE[employeeId] ?? 15000;
}
`;

export const PY: Module = {
  id: "py",
  name: "เงินเดือน",
  sapCode: "PY",
  family: "hr",
  tier: "base",
  pitch:
    "คำนวณเงินเดือนจากทะเบียนพนักงานที่มีอยู่แล้ว ไม่ต้องคีย์ชื่อซ้ำ — คนเข้าใหม่โผล่ในรอบจ่ายเอง",
  provides: ["payslip"],
  needs: ["employee"],
  effortDays: 8,
  maPerMonth: 4000,
  build:
    "หน้าเงินเดือน: เลือกรอบจ่าย แสดงยอดสุทธิรวมและประกันสังคมนำส่ง ตารางรายคนอ่านจากทะเบียนพนักงาน (ไม่เก็บรายชื่อของตัวเอง) · เปิดสลิปรายคนเป็นหน้าต่างซ้อน",
  files: {
    "src/modules/py/screen.tsx": SCREEN,
    "src/modules/py/data.ts": DATA,
  },
};
