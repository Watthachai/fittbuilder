import type { Module } from "../types";

/**
 * Time and leave — the module a manager opens on a Monday.
 *
 * It owns `timeEntry` and `leaveRequest` and reads `employee`. It deliberately does
 * NOT require payroll: plenty of companies track leave long before they move payroll
 * off a spreadsheet, and inventing that dependency would force a bundle the buyer
 * never asked for.
 */
const SCREEN = `import { useState } from "react";
import { EMPLOYEES } from "../pa/data";
import { LEAVE_REQUESTS, LEAVE_BALANCE, TIME_TODAY } from "./data";

export default function TmScreen() {
  const [tab, setTab] = useState("leave");
  const [reviewing, setReviewing] = useState(null);
  const [decided, setDecided] = useState({});

  const nameOf = (id) => EMPLOYEES.find((e) => e.id === id)?.name ?? "—";
  const pending = LEAVE_REQUESTS.filter((r) => (decided[r.id] ?? r.status) === "รออนุมัติ");

  const decide = (id, status) => {
    setDecided((d) => ({ ...d, [id]: status }));
    setReviewing(null);
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">เวลาทำงานและการลา</h1>
        <p className="text-sm text-slate-500">
          รออนุมัติ {pending.length} รายการ · เข้างานวันนี้ {TIME_TODAY.filter((t) => t.in).length}/{EMPLOYEES.length} คน
        </p>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        <button
          onClick={() => setTab("leave")}
          className={tab === "leave" ? "flex-1 rounded-md bg-white py-2 font-medium shadow-sm" : "flex-1 py-2 text-slate-600"}
        >
          ใบลา
        </button>
        <button
          onClick={() => setTab("time")}
          className={tab === "time" ? "flex-1 rounded-md bg-white py-2 font-medium shadow-sm" : "flex-1 py-2 text-slate-600"}
        >
          เวลาเข้า-ออกวันนี้
        </button>
      </div>

      {tab === "leave" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">พนักงาน</th>
                <th className="px-4 py-3">ประเภท</th>
                <th className="px-4 py-3">ช่วงวันที่</th>
                <th className="px-4 py-3">จำนวนวัน</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {LEAVE_REQUESTS.map((r) => {
                const status = decided[r.id] ?? r.status;
                return (
                  <tr key={r.id} className="hover:bg-sky-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{nameOf(r.employeeId)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.type}</td>
                    <td className="px-4 py-3 text-slate-600">{r.from} — {r.to}</td>
                    <td className="px-4 py-3 text-slate-600">{r.days}</td>
                    <td className="px-4 py-3">
                      <Badge status={status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "รออนุมัติ" && (
                        <button
                          onClick={() => setReviewing(r)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700"
                        >
                          พิจารณา
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">พนักงาน</th>
                <th className="px-4 py-3">เข้า</th>
                <th className="px-4 py-3">ออก</th>
                <th className="px-4 py-3">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TIME_TODAY.map((t) => (
                <tr key={t.employeeId} className="hover:bg-sky-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{nameOf(t.employeeId)}</td>
                  <td className="px-4 py-3 text-slate-700">{t.in ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{t.out ?? "—"}</td>
                  <td className="px-4 py-3">
                    {t.note && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">{t.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <ReviewLeave
          request={reviewing}
          name={nameOf(reviewing.employeeId)}
          balance={LEAVE_BALANCE[reviewing.employeeId]}
          onDecide={decide}
          onClose={() => setReviewing(null)}
        />
      )}

      <div hidden data-fitt-index>
        <button data-fitt-screen="เวลาทำงานและการลา" />
        <button data-fitt-screen="พิจารณาใบลา" data-fitt-modal onClick={() => setReviewing(LEAVE_REQUESTS[0])} />
      </div>
    </div>
  );
}

function Badge({ status }) {
  const tone =
    status === "อนุมัติแล้ว"
      ? "bg-emerald-50 text-emerald-700"
      : status === "ไม่อนุมัติ"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700";
  return <span className={"rounded-full px-2 py-1 text-xs " + tone}>{status}</span>;
}

function ReviewLeave({ request, name, balance, onDecide, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">พิจารณาใบลา</h2>
        <p className="mt-0.5 text-sm text-slate-500">{name} · {request.type}</p>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">ช่วงวันที่</dt>
            <dd className="text-slate-900">{request.from} — {request.to}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">จำนวนวันที่ขอ</dt>
            <dd className="text-slate-900">{request.days} วัน</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">วันลาคงเหลือ</dt>
            <dd className={balance - request.days < 0 ? "font-semibold text-rose-600" : "text-slate-900"}>
              {balance} วัน {balance - request.days < 0 && "· เกินสิทธิ์"}
            </dd>
          </div>
          {request.reason && (
            <div className="rounded-lg bg-slate-50 p-3 text-slate-700">{request.reason}</div>
          )}
        </dl>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => onDecide(request.id, "ไม่อนุมัติ")}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ไม่อนุมัติ
          </button>
          <button
            onClick={() => onDecide(request.id, "อนุมัติแล้ว")}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            อนุมัติ
          </button>
        </div>
      </div>
    </div>
  );
}
`;

const DATA = `export const LEAVE_REQUESTS = [
  { id: 1, employeeId: 3, type: "ลาป่วย", from: "2026-09-22", to: "2026-09-23", days: 2, status: "รออนุมัติ", reason: "ไข้หวัด มีใบรับรองแพทย์" },
  { id: 2, employeeId: 6, type: "ลาพักร้อน", from: "2026-10-06", to: "2026-10-10", days: 5, status: "รออนุมัติ", reason: "เดินทางต่างจังหวัดกับครอบครัว" },
  { id: 3, employeeId: 2, type: "ลากิจ", from: "2026-09-18", to: "2026-09-18", days: 1, status: "อนุมัติแล้ว", reason: "ธุระที่อำเภอ" },
  { id: 4, employeeId: 5, type: "ลาพักร้อน", from: "2026-09-29", to: "2026-10-03", days: 5, status: "รออนุมัติ", reason: "" },
  { id: 5, employeeId: 1, type: "ลาป่วย", from: "2026-09-08", to: "2026-09-08", days: 1, status: "อนุมัติแล้ว", reason: "" },
  { id: 6, employeeId: 4, type: "ลากิจ", from: "2026-09-11", to: "2026-09-12", days: 2, status: "ไม่อนุมัติ", reason: "ตรงกับวันปิดงบเดือน" },
];

/** วันลาคงเหลือรายคน ตามรหัสพนักงานในทะเบียนพนักงาน */
export const LEAVE_BALANCE = { 1: 6, 2: 9, 3: 4, 4: 8, 5: 3, 6: 11, 7: 7 };

export const TIME_TODAY = [
  { employeeId: 1, in: "08:42", out: null, note: "" },
  { employeeId: 2, in: "08:55", out: null, note: "" },
  { employeeId: 3, in: null, out: null, note: "ลาป่วย" },
  { employeeId: 4, in: "09:14", out: null, note: "เข้าสาย" },
  { employeeId: 5, in: "08:31", out: null, note: "" },
  { employeeId: 6, in: "08:47", out: null, note: "" },
  { employeeId: 7, in: "07:58", out: null, note: "" },
];
`;

export const TM: Module = {
  id: "tm",
  name: "เวลาทำงานและการลา",
  sapCode: "PT",
  family: "hr",
  tier: "base",
  pitch:
    "ใบลาไม่ต้องเดินกระดาษ หัวหน้าเห็นวันลาคงเหลือตอนกดอนุมัติ — และรู้ทันทีว่าใครยังไม่เข้างานวันนี้",
  provides: ["timeEntry", "leaveRequest"],
  needs: ["employee"],
  effortDays: 6,
  maPerMonth: 3000,
  build:
    "หน้าเวลาและการลา สองแท็บ: ใบลาพร้อมสถานะและปุ่มพิจารณา กับเวลาเข้า-ออกวันนี้ · ชื่อพนักงานอ่านจากทะเบียนพนักงาน · หน้าต่างพิจารณาใบลาแสดงวันลาคงเหลือและเตือนเมื่อขอเกินสิทธิ์ กด อนุมัติ/ไม่อนุมัติ แล้วสถานะในตารางเปลี่ยนทันที",
  files: {
    "src/modules/tm/screen.tsx": SCREEN,
    "src/modules/tm/data.ts": DATA,
  },
};
