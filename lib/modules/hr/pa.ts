import type { Module } from "../types";

/**
 * Personnel records — the module every other HR module reads from.
 *
 * It owns `employee`. Payroll, time and the org chart all read it and none of them
 * may keep their own copy, which is the whole reason the composer tracks ownership:
 * two employee tables in one system is not a bug anyone reports, it is a system
 * that quietly disagrees with itself.
 */
const SCREEN = `import { useState } from "react";
import { EMPLOYEES } from "./data";

export default function PaScreen() {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const rows = EMPLOYEES.filter(
    (e) => e.name.includes(q) || e.code.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">ทะเบียนพนักงาน</h1>
          <p className="text-sm text-slate-500">{EMPLOYEES.length} คน · อัปเดตล่าสุดวันนี้</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อหรือรหัสพนักงาน"
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">รหัส</th>
              <th className="px-4 py-3">ชื่อ-นามสกุล</th>
              <th className="px-4 py-3">ตำแหน่ง</th>
              <th className="px-4 py-3">แผนก</th>
              <th className="px-4 py-3">วันเริ่มงาน</th>
              <th className="px-4 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((e) => (
              <tr
                key={e.id}
                onClick={() => setPicked(e)}
                className="cursor-pointer hover:bg-sky-50"
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{e.name}</td>
                <td className="px-4 py-3 text-slate-600">{e.position}</td>
                <td className="px-4 py-3 text-slate-600">{e.department}</td>
                <td className="px-4 py-3 text-slate-600">{e.startedAt}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      e.status === "ทำงานอยู่"
                        ? "rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                        : "rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                    }
                  >
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  ไม่พบพนักงานที่ตรงกับ "{q}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {picked && <EmployeeDetail employee={picked} onClose={() => setPicked(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="ทะเบียนพนักงาน" />
        <button data-fitt-screen="ประวัติพนักงาน" data-fitt-modal onClick={() => setPicked(EMPLOYEES[0])} />
      </div>
    </div>
  );
}

function EmployeeDetail({ employee, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{employee.name}</h2>
            <p className="text-sm text-slate-500">
              {employee.code} · {employee.position}
            </p>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="แผนก" value={employee.department} />
          <Field label="วันเริ่มงาน" value={employee.startedAt} />
          <Field label="ประเภทการจ้าง" value={employee.contract} />
          <Field label="อีเมล" value={employee.email} />
        </dl>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white"
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
    </div>
  );
}
`;

const DATA = `export const EMPLOYEES = [
  { id: 1, code: "EMP-0001", name: "สมชาย รักดี", position: "หัวหน้าฝ่ายขาย", department: "ฝ่ายขาย", startedAt: "2019-03-04", status: "ทำงานอยู่", contract: "พนักงานประจำ", email: "somchai@example.co.th" },
  { id: 2, code: "EMP-0002", name: "วิภาดา ศรีสุข", position: "นักบัญชีอาวุโส", department: "ฝ่ายบัญชี", startedAt: "2020-07-15", status: "ทำงานอยู่", contract: "พนักงานประจำ", email: "wipada@example.co.th" },
  { id: 3, code: "EMP-0003", name: "ณัฐพล ทองดี", position: "พนักงานคลังสินค้า", department: "ฝ่ายคลัง", startedAt: "2021-01-11", status: "ทำงานอยู่", contract: "พนักงานประจำ", email: "nattapon@example.co.th" },
  { id: 4, code: "EMP-0004", name: "ปรียา แก้วใส", position: "เจ้าหน้าที่บุคคล", department: "ฝ่ายบุคคล", startedAt: "2022-05-02", status: "ทำงานอยู่", contract: "พนักงานประจำ", email: "preeya@example.co.th" },
  { id: 5, code: "EMP-0005", name: "อนุชา มั่นคง", position: "ช่างเทคนิค", department: "ฝ่ายผลิต", startedAt: "2023-09-18", status: "ทดลองงาน", contract: "สัญญาจ้าง 1 ปี", email: "anucha@example.co.th" },
  { id: 6, code: "EMP-0006", name: "กมลวรรณ ใจงาม", position: "พนักงานขาย", department: "ฝ่ายขาย", startedAt: "2024-02-01", status: "ทำงานอยู่", contract: "พนักงานประจำ", email: "kamonwan@example.co.th" },
  { id: 7, code: "EMP-0007", name: "ธีรศักดิ์ พูลทรัพย์", position: "ผู้จัดการคลัง", department: "ฝ่ายคลัง", startedAt: "2018-11-26", status: "ทำงานอยู่", contract: "พนักงานประจำ", email: "teerasak@example.co.th" },
  { id: 8, code: "EMP-0008", name: "สุนิสา เพชรงาม", position: "เจ้าหน้าที่จัดซื้อ", department: "ฝ่ายจัดซื้อ", startedAt: "2023-04-10", status: "ลาออก", contract: "พนักงานประจำ", email: "sunisa@example.co.th" },
];
`;

export const PA: Module = {
  id: "pa",
  name: "ทะเบียนพนักงาน",
  sapCode: "PA",
  family: "hr",
  tier: "base",
  pitch:
    "ประวัติพนักงานอยู่ที่เดียว ค้นเจอใน 3 วินาที — ไม่ต้องไล่เปิดไฟล์ Excel หลายใบที่ไม่ตรงกัน",
  provides: ["employee"],
  needs: [],
  effortDays: 4,
  maPerMonth: 2000,
  build:
    "หน้าทะเบียนพนักงาน: ตารางค้นหาได้ตามชื่อและรหัส แสดงตำแหน่ง แผนก วันเริ่มงาน สถานะ · คลิกแถวเปิดหน้าต่างประวัติพนักงานพร้อมข้อมูลการจ้าง",
  files: {
    "src/modules/pa/screen.tsx": SCREEN,
    "src/modules/pa/data.ts": DATA,
  },
};
