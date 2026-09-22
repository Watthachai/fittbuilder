import { useState } from "react";
import type { ReactNode } from "react";
import { EMPLOYEES, EVENT_TYPES } from "./data";
import type { Employee } from "./data";
import { TH } from "../ui";

type PersonnelEvent = Employee["events"][number];

const baht = (n: number) => n.toLocaleString("th-TH");
const TABS = [
  "ข้อมูลส่วนตัว",
  "ข้อมูลสัญญาจ้าง",
  "ข้อมูลทางปกครอง",
  "เหตุการณ์ทางบุคคล",
  "ค่าตอบแทนและสวัสดิการ",
];

/**
 * Each capability is its own view of the same register, so picking one from the
 * navigation changes what the table shows — not just which tab is underlined.
 * Opening a row then lands on that part of the person's record.
 */
const COLUMNS: Record<string, { k: string; cell: (e: Employee) => ReactNode }[]> = {
  "ข้อมูลส่วนตัว": [
    { k: "วันเกิด", cell: (e) => e.personal.birthDate },
    { k: "เลขบัตรประชาชน", cell: (e) => <span className="font-mono text-xs">{e.personal.nationalId}</span> },
    { k: "โทรศัพท์", cell: (e) => e.personal.phone },
    { k: "อีเมล", cell: (e) => e.personal.email },
  ],
  "ข้อมูลสัญญาจ้าง": [
    { k: "ประเภทจ้าง", cell: (e) => e.contract.type },
    { k: "วันเริ่มงาน", cell: (e) => e.contract.startedAt },
    { k: "สิ้นสุดสัญญา", cell: (e) => e.contract.endsAt ?? "ไม่กำหนด" },
    { k: "พ้นทดลองงาน", cell: (e) => e.contract.probationUntil },
    { k: "สถานะ", cell: (e) => <StatusBadge status={e.status} /> },
  ],
  "ข้อมูลทางปกครอง": [
    { k: "เลขประกันสังคม", cell: (e) => <span className="font-mono text-xs">{e.admin.ssoNumber}</span> },
    { k: "เลขผู้เสียภาษี", cell: (e) => <span className="font-mono text-xs">{e.admin.taxId}</span> },
    { k: "ธนาคาร", cell: (e) => e.admin.bankName },
    { k: "เลขบัญชี", cell: (e) => <span className="font-mono text-xs">{e.admin.bankAccount}</span> },
    { k: "กองทุนสำรองฯ", cell: (e) => e.admin.pvdRate + "%" },
  ],
  "เหตุการณ์ทางบุคคล": [
    { k: "เหตุการณ์ล่าสุด", cell: (e) => e.events[e.events.length - 1]?.type ?? "—" },
    { k: "เมื่อ", cell: (e) => e.events[e.events.length - 1]?.date ?? "—" },
    { k: "จำนวนเหตุการณ์", cell: (e) => e.events.length + " ครั้ง" },
  ],
  "ค่าตอบแทนและสวัสดิการ": [
    { k: "เงินเดือนฐาน", cell: (e) => baht(e.contract.baseSalary) + " ฿" },
    { k: "สวัสดิการ", cell: (e) => e.benefits.length + " รายการ" },
    { k: "รายการแรก", cell: (e) => e.benefits[0] ?? "—" },
  ],
};

export default function PaScreen({ section }: { section?: string }) {
  // Which capability to show is the navigation's decision, not this screen's.
  const tab = section && TABS.includes(section) ? section : TABS[0];
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("ทุกแผนก");
  const [picked, setPicked] = useState<Employee | null>(null);
  // Events added in this session, keyed by employee — the seed list stays untouched.
  const [events, setEvents] = useState<Record<number, PersonnelEvent[]>>({});

  const departments = ["ทุกแผนก", ...new Set(EMPLOYEES.map((e) => e.department))];
  const rows = EMPLOYEES.filter(
    (e) =>
      (dept === "ทุกแผนก" || e.department === dept) &&
      (e.name.includes(q) || e.code.toLowerCase().includes(q.toLowerCase()) || e.nickname.includes(q))
  );

  const eventsOf = (e: Employee) => [...e.events, ...(events[e.id] ?? [])];
  const addEvent = (id: number, ev: PersonnelEvent) =>
    setEvents((m) => ({ ...m, [id]: [...(m[id] ?? []), ev] }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">ทะเบียนพนักงาน</h1>
          <p className="text-sm text-slate-500">
            {tab} · {rows.length} คน จากทั้งหมด{" "}
            {EMPLOYEES.filter((e) => e.status !== "ลาออก").length} คนที่ยังทำงานอยู่
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500"
          >
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัส"
            className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">รหัส</th>
              <th className="px-4 py-3">ชื่อ-นามสกุล</th>
              <th className="px-4 py-3">แผนก</th>
              {COLUMNS[tab].map((c) => <th key={c.k} className="px-4 py-3">{c.k}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((e) => (
              <tr key={e.id} onClick={() => setPicked(e)} className="cursor-pointer hover:bg-sky-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.code}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">{e.name}</span>
                  <span className="ml-1.5 text-xs text-slate-400">({e.nickname})</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{e.department}</td>
                {COLUMNS[tab].map((c) => (
                  <td key={c.k} className="px-4 py-3 text-slate-600">{c.cell(e)}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">ไม่พบพนักงานที่ตรงกับที่ค้นหา</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {picked && (
        <EmployeeRecord
          openAt={tab}
          employee={picked}
          events={eventsOf(picked)}
          onAddEvent={(ev) => addEvent(picked.id, ev)}
          onClose={() => setPicked(null)}
        />
      )}

      <div hidden data-fitt-index>
        <button data-fitt-screen="ทะเบียนพนักงาน" />
        <button data-fitt-screen="แฟ้มประวัติพนักงาน" data-fitt-modal onClick={() => setPicked(EMPLOYEES[0])} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ทำงานอยู่" ? "bg-emerald-50 text-emerald-700"
    : status === "ทดลองงาน" ? "bg-amber-50 text-amber-700"
    : "bg-slate-100 text-slate-600";
  return <span className={"rounded-full px-2 py-1 text-xs " + tone}>{status}</span>;
}

/** The record itself. One tab per capability, so nothing is claimed that is not here. */
function EmployeeRecord({
  employee: e,
  events,
  openAt,
  onAddEvent,
  onClose,
}: {
  employee: Employee;
  events: PersonnelEvent[];
  openAt: string;
  onAddEvent: (ev: PersonnelEvent) => void;
  onClose: () => void;
}) {
  // Opens on the part of the record the list was showing, then flips freely.
  const [tab, setTab] = useState(openAt);
  const [adding, setAdding] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{e.name}</h2>
            <p className="text-sm text-slate-500">{e.code} · {e.position} · {e.department}</p>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4">
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

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === "ข้อมูลส่วนตัว" && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="วันเกิด" value={e.personal.birthDate} />
              <Field label="เลขบัตรประชาชน" value={e.personal.nationalId} />
              <Field label="โทรศัพท์" value={e.personal.phone} />
              <Field label="อีเมล" value={e.personal.email} />
              <Field label="ที่อยู่ตามทะเบียนบ้าน" value={e.personal.address} wide />
            </dl>
          )}

          {tab === "ข้อมูลสัญญาจ้าง" && (
            <>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Field label="ประเภทการจ้าง" value={e.contract.type} />
                <Field label="วันเริ่มงาน" value={e.contract.startedAt} />
                <Field label="วันสิ้นสุดสัญญา" value={e.contract.endsAt ?? "ไม่กำหนด"} />
                <Field label="ครบทดลองงาน" value={e.contract.probationUntil} />
                <Field label="เงินเดือนฐาน" value={baht(e.contract.baseSalary) + " บาท"} />
                <Field label="วันทำงาน" value={e.contract.workDays} />
              </dl>
              {e.contract.endsAt && e.status !== "ลาออก" && (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-800">
                  สัญญาสิ้นสุด {e.contract.endsAt} — ควรเริ่มพิจารณาต่อสัญญาล่วงหน้าอย่างน้อย 30 วัน
                </p>
              )}
            </>
          )}

          {tab === "ข้อมูลทางปกครอง" && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="เลขประกันสังคม" value={e.admin.ssoNumber} />
              <Field label="เลขประจำตัวผู้เสียภาษี" value={e.admin.taxId} />
              <Field label="ธนาคาร" value={e.admin.bankName} />
              <Field label="เลขบัญชีรับเงินเดือน" value={e.admin.bankAccount} />
              <Field label="สะสมกองทุนสำรองเลี้ยงชีพ" value={e.admin.pvdRate + "%"} />
            </dl>
          )}

          {tab === "เหตุการณ์ทางบุคคล" && (
            <>
              <ol className="relative border-l border-slate-200 pl-5">
                {events.map((ev, i) => (
                  <li key={i} className="mb-4 last:mb-0">
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-sky-500" />
                    <div className="text-[13px] text-slate-400">{ev.date}</div>
                    <div className="text-sm font-medium text-slate-900">{ev.type}</div>
                    <div className="text-[13px] text-slate-600">{ev.detail}</div>
                  </li>
                ))}
              </ol>
              {adding ? (
                <AddEvent
                  onCancel={() => setAdding(false)}
                  onSave={(ev) => { onAddEvent(ev); setAdding(false); }}
                />
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="mt-5 w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-sm text-slate-600 hover:border-sky-500 hover:text-sky-700"
                >
                  + บันทึกเหตุการณ์ใหม่
                </button>
              )}
            </>
          )}

          {tab === "ค่าตอบแทนและสวัสดิการ" && (
            <>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">เงินเดือนฐานปัจจุบัน</div>
                <div className="mt-0.5 text-2xl font-semibold text-slate-900">{baht(e.contract.baseSalary)} บาท</div>
              </div>
              <h3 className="mt-5 text-sm font-medium text-slate-800">สวัสดิการที่ได้รับ</h3>
              <ul className="mt-2 space-y-1.5">
                {e.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-emerald-600">✓</span>{b}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddEvent({ onSave, onCancel }: { onSave: (ev: PersonnelEvent) => void; onCancel: () => void }) {
  const [type, setType] = useState(EVENT_TYPES[1]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [detail, setDetail] = useState("");

  return (
    <div className="mt-5 rounded-xl border border-slate-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">ประเภทเหตุการณ์</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          >
            {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">วันที่มีผล</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
        </label>
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs text-slate-500">รายละเอียด</span>
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="เช่น ย้ายจากฝ่ายขายไปฝ่ายการตลาด"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
      </label>
      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50">
          ยกเลิก
        </button>
        <button
          onClick={() => onSave({ date, type, detail: detail || "—" })}
          className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white"
        >
          บันทึก
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
    </div>
  );
}
