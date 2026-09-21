export const TM_DATA = `import { EMPLOYEES } from "../pa/data";

/** กะที่บริษัทประกาศใช้ — ผูกกับพนักงานผ่าน ROSTER */
export const SHIFTS = [
  { code: "A", name: "กะเช้า", start: "08:00", end: "17:00", breakMin: 60, color: "sky" },
  { code: "B", name: "กะบ่าย", start: "13:00", end: "22:00", breakMin: 60, color: "violet" },
  { code: "N", name: "กะดึก", start: "22:00", end: "07:00", breakMin: 60, color: "slate" },
  { code: "O", name: "วันหยุด", start: "—", end: "—", breakMin: 0, color: "emerald" },
];

export const WEEK_DAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

/** ตารางกะรายสัปดาห์: employeeId -> กะของแต่ละวัน */
export const ROSTER = {
  1: ["A", "A", "A", "A", "A", "O", "O"],
  2: ["A", "A", "A", "A", "A", "O", "O"],
  3: ["B", "B", "B", "B", "B", "O", "O"],
  4: ["A", "A", "A", "A", "A", "O", "O"],
  5: ["N", "N", "N", "O", "O", "N", "N"],
  6: ["A", "A", "B", "B", "A", "O", "O"],
  7: ["A", "A", "A", "A", "A", "S", "O"],
};

export const HOLIDAYS = [
  { date: "2026-10-13", name: "วันนวมินทรมหาราช" },
  { date: "2026-10-23", name: "วันปิยมหาราช" },
  { date: "2026-12-05", name: "วันพ่อแห่งชาติ" },
  { date: "2026-12-10", name: "วันรัฐธรรมนูญ" },
];

/** ตอกบัตรจริงของสัปดาห์นี้ — null = ยังไม่ตอก */
export const PUNCHES = [
  { id: 1, employeeId: 1, date: "2026-09-21", shift: "A", in: "07:52", out: "17:14" },
  { id: 2, employeeId: 2, date: "2026-09-21", shift: "A", in: "08:19", out: "17:02" },
  { id: 3, employeeId: 3, date: "2026-09-21", shift: "B", in: "12:55", out: "22:40" },
  { id: 4, employeeId: 4, date: "2026-09-21", shift: "A", in: "07:45", out: "18:30" },
  { id: 5, employeeId: 5, date: "2026-09-21", shift: "N", in: "21:58", out: "07:05" },
  { id: 6, employeeId: 6, date: "2026-09-21", shift: "A", in: "08:41", out: "17:00" },
  { id: 7, employeeId: 7, date: "2026-09-21", shift: "A", in: null, out: null },
  { id: 8, employeeId: 1, date: "2026-09-18", shift: "A", in: "07:58", out: "17:05" },
  { id: 9, employeeId: 2, date: "2026-09-18", shift: "A", in: "08:31", out: "17:10" },
  { id: 10, employeeId: 4, date: "2026-09-18", shift: "A", in: "07:50", out: "19:12" },
];

export const LEAVE_TYPES = [
  { name: "ลาป่วย", quota: 30, paid: true },
  { name: "ลาพักร้อน", quota: 6, paid: true },
  { name: "ลากิจ", quota: 3, paid: true },
  { name: "ลาคลอด", quota: 98, paid: true },
  { name: "ลาไม่รับค่าจ้าง", quota: 0, paid: false },
];

export const LEAVES = [
  { id: 1, employeeId: 3, type: "ลาป่วย", from: "2026-09-22", to: "2026-09-23", days: 2, status: "รออนุมัติ", reason: "ไข้หวัด มีใบรับรองแพทย์" },
  { id: 2, employeeId: 6, type: "ลาพักร้อน", from: "2026-10-06", to: "2026-10-10", days: 5, status: "รออนุมัติ", reason: "เดินทางต่างจังหวัดกับครอบครัว" },
  { id: 3, employeeId: 2, type: "ลากิจ", from: "2026-09-18", to: "2026-09-18", days: 1, status: "อนุมัติแล้ว", reason: "ธุระที่อำเภอ" },
  { id: 4, employeeId: 5, type: "ลาพักร้อน", from: "2026-09-29", to: "2026-10-03", days: 5, status: "รออนุมัติ", reason: "" },
  { id: 5, employeeId: 1, type: "ลาป่วย", from: "2026-09-08", to: "2026-09-08", days: 1, status: "อนุมัติแล้ว", reason: "" },
  { id: 6, employeeId: 4, type: "ลากิจ", from: "2026-09-11", to: "2026-09-12", days: 2, status: "ไม่อนุมัติ", reason: "ตรงกับวันปิดงบเดือน" },
  { id: 7, employeeId: 7, type: "ลาไม่รับค่าจ้าง", from: "2026-09-21", to: "2026-09-21", days: 1, status: "อนุมัติแล้ว", reason: "ธุระส่วนตัว" },
];

export const empName = (id) => EMPLOYEES.find((e) => e.id === id)?.name ?? "—";
export const shiftOf = (code) => SHIFTS.find((s) => s.code === code);

const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** สายเกิน 15 นาที นับเป็นมาสาย · อยู่เกินกะเกิน 30 นาที นับเป็นล่วงเวลา */
export function judge(p) {
  if (!p.in) return { state: "ขาดงาน", lateMin: 0, otMin: 0, workedMin: 0 };
  const s = shiftOf(p.shift);
  const lateMin = Math.max(0, toMin(p.in) - toMin(s.start));
  let worked = toMin(p.out) - toMin(p.in);
  if (worked < 0) worked += 24 * 60;
  let planned = toMin(s.end) - toMin(s.start);
  if (planned < 0) planned += 24 * 60;
  const otMin = Math.max(0, worked - planned);
  return {
    state: lateMin > 15 ? "มาสาย" : "ปกติ",
    lateMin,
    otMin: otMin > 30 ? otMin : 0,
    workedMin: worked - s.breakMin,
  };
}

export const hhmm = (min) => Math.floor(min / 60) + " ชม. " + (min % 60) + " น.";
`;

export const TM_SCREEN = `import { useState } from "react";
import { EMPLOYEES } from "../pa/data";
import {
  SHIFTS, WEEK_DAYS, ROSTER, HOLIDAYS, PUNCHES, LEAVE_TYPES, LEAVES,
  empName, shiftOf, judge, hhmm,
} from "./data";

const TABS = ["แผนกะการทำงาน", "บันทึกเวลาทำงาน", "การลาและการขาดงาน", "ติดตามการเข้างาน"];

export default function TmScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [leaves, setLeaves] = useState(LEAVES);
  const [reviewing, setReviewing] = useState(null);

  const decide = (id, status) => {
    setLeaves((all) => all.map((l) => (l.id === id ? { ...l, status } : l)));
    setReviewing(null);
  };
  const waiting = leaves.filter((l) => l.status === "รออนุมัติ").length;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">เวลาทำงานและการลา</h1>
        <p className="text-sm text-slate-500">
          {SHIFTS.length} กะ · ตอกบัตรวันนี้ {PUNCHES.filter((p) => p.date === "2026-09-21" && p.in).length} คน · รออนุมัติลา {waiting} รายการ
        </p>
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
            {t === "การลาและการขาดงาน" && waiting > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">{waiting}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "แผนกะการทำงาน" && <Roster />}
      {tab === "บันทึกเวลาทำงาน" && <TimeSheet />}
      {tab === "การลาและการขาดงาน" && <Leaves leaves={leaves} onReview={setReviewing} />}
      {tab === "ติดตามการเข้างาน" && <Attendance leaves={leaves} />}

      {reviewing && <ReviewDialog leave={reviewing} onClose={() => setReviewing(null)} onDecide={decide} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="แผนกะและเวลาทำงาน" />
        <button data-fitt-screen="อนุมัติการลา" data-fitt-modal onClick={() => setReviewing(leaves[0])} />
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{children}</div>;
}

const CHIP = {
  sky: "bg-sky-100 text-sky-700", violet: "bg-violet-100 text-violet-700",
  slate: "bg-slate-200 text-slate-600", emerald: "bg-emerald-50 text-emerald-700",
};

function Roster() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {SHIFTS.map((s) => (
          <div key={s.code} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={"inline-flex rounded-full px-2 py-0.5 text-xs " + CHIP[s.color]}>{s.name}</div>
            <div className="mt-2 text-sm text-slate-800">{s.start} – {s.end}</div>
            <div className="text-xs text-slate-500">พัก {s.breakMin} นาที</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">ตารางกะสัปดาห์นี้</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">พนักงาน</th>
              {WEEK_DAYS.map((d) => <th key={d} className="px-2 py-3 text-center font-medium">{d}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EMPLOYEES.filter((e) => ROSTER[e.id]).map((e) => (
              <tr key={e.id} className="hover:bg-sky-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">{e.name}</td>
                {ROSTER[e.id].map((code, i) => {
                  const s = shiftOf(code);
                  return (
                    <td key={i} className="px-2 py-2.5 text-center">
                      <span className={"inline-flex min-w-[2.2rem] justify-center rounded-md px-1.5 py-1 text-xs " + (s ? CHIP[s.color] : "bg-amber-100 text-amber-700")}>
                        {s ? s.name.replace("กะ", "") : "เสริม"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">วันหยุดประจำปีที่กระทบตารางกะ</div>
        <ul className="divide-y divide-slate-100">
          {HOLIDAYS.map((h) => (
            <li key={h.date} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-800">{h.name}</span>
              <span className="text-slate-500">{h.date}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function TimeSheet() {
  const [day, setDay] = useState("2026-09-21");
  const days = [...new Set(PUNCHES.map((p) => p.date))];
  const rows = PUNCHES.filter((p) => p.date === day);
  return (
    <div>
      <div className="mb-3 flex gap-2">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={"rounded-lg px-3 py-1.5 text-sm " + (d === day ? "bg-sky-600 text-white" : "border border-slate-300 text-slate-600 hover:border-sky-400")}
          >
            {d}
          </button>
        ))}
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th><th className="px-4 py-3">กะ</th>
              <th className="px-4 py-3">เข้า</th><th className="px-4 py-3">ออก</th>
              <th className="px-4 py-3">ชั่วโมงทำงาน</th><th className="px-4 py-3">ล่วงเวลา</th>
              <th className="px-4 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => {
              const j = judge(p);
              return (
                <tr key={p.id} className="hover:bg-sky-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{empName(p.employeeId)}</td>
                  <td className="px-4 py-3 text-slate-600">{shiftOf(p.shift).name}</td>
                  <td className={"px-4 py-3 " + (j.lateMin > 15 ? "font-semibold text-amber-700" : "text-slate-700")}>{p.in ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.out ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{j.workedMin > 0 ? hhmm(j.workedMin) : "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{j.otMin ? hhmm(j.otMin) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2 py-1 text-xs " + (
                      j.state === "ปกติ" ? "bg-emerald-50 text-emerald-700"
                      : j.state === "มาสาย" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                    )}>
                      {j.state}{j.state === "มาสาย" ? " " + j.lateMin + " น." : ""}
                    </span>
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

function Leaves({ leaves, onReview }) {
  const used = (empId, type) =>
    leaves.filter((l) => l.employeeId === empId && l.type === type && l.status === "อนุมัติแล้ว")
      .reduce((n, l) => n + l.days, 0);
  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">ใบลา</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th><th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">ช่วงวัน</th><th className="px-4 py-3">จำนวน</th>
              <th className="px-4 py-3">สถานะ</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaves.map((l) => (
              <tr key={l.id} className="hover:bg-sky-50">
                <td className="px-4 py-3 font-medium text-slate-900">{empName(l.employeeId)}</td>
                <td className="px-4 py-3 text-slate-600">{l.type}</td>
                <td className="px-4 py-3 text-slate-600">{l.from} → {l.to}</td>
                <td className="px-4 py-3 text-slate-700">{l.days} วัน</td>
                <td className="px-4 py-3">
                  <span className={"rounded-full px-2 py-1 text-xs " + (
                    l.status === "อนุมัติแล้ว" ? "bg-emerald-50 text-emerald-700"
                    : l.status === "รออนุมัติ" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                  )}>{l.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {l.status === "รออนุมัติ" && (
                    <button onClick={() => onReview(l)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-700">
                      พิจารณา
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">สิทธิ์ลาคงเหลือ</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th>
              {LEAVE_TYPES.filter((t) => t.paid).map((t) => <th key={t.name} className="px-4 py-3 text-right">{t.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EMPLOYEES.filter((e) => e.status !== "ลาออก").map((e) => (
              <tr key={e.id} className="hover:bg-sky-50">
                <td className="px-4 py-3 font-medium text-slate-900">{e.name}</td>
                {LEAVE_TYPES.filter((t) => t.paid).map((t) => {
                  const left = t.quota - used(e.id, t.name);
                  return (
                    <td key={t.name} className={"px-4 py-3 text-right " + (left <= 0 ? "font-semibold text-rose-600" : "text-slate-700")}>
                      {left} / {t.quota}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Attendance({ leaves }) {
  const rows = EMPLOYEES.filter((e) => ROSTER[e.id]).map((e) => {
    const mine = PUNCHES.filter((p) => p.employeeId === e.id);
    const judged = mine.map(judge);
    return {
      e,
      days: mine.length,
      late: judged.filter((j) => j.state === "มาสาย").length,
      absent: judged.filter((j) => j.state === "ขาดงาน").length,
      ot: judged.reduce((n, j) => n + j.otMin, 0),
      leaveDays: leaves.filter((l) => l.employeeId === e.id && l.status === "อนุมัติแล้ว").reduce((n, l) => n + l.days, 0),
    };
  });
  const totalLate = rows.reduce((n, r) => n + r.late, 0);
  const totalAbsent = rows.reduce((n, r) => n + r.absent, 0);
  const totalOt = rows.reduce((n, r) => n + r.ot, 0);
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="มาสายรวม" value={totalLate + " ครั้ง"} />
        <Stat label="ขาดงานรวม" value={totalAbsent + " ครั้ง"} />
        <Stat label="ล่วงเวลารวม" value={hhmm(totalOt)} />
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">พนักงาน</th><th className="px-4 py-3 text-right">วันที่บันทึก</th>
              <th className="px-4 py-3 text-right">มาสาย</th><th className="px-4 py-3 text-right">ขาดงาน</th>
              <th className="px-4 py-3 text-right">ลา</th><th className="px-4 py-3 text-right">ล่วงเวลา</th>
              <th className="px-4 py-3">อัตราเข้างาน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const rate = r.days ? Math.round(((r.days - r.absent) / r.days) * 100) : 0;
              return (
                <tr key={r.e.id} className="hover:bg-sky-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.e.name}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.days}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.late}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.absent}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.leaveDays}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.ot ? hhmm(r.ot) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                        <span className={"block h-full rounded-full " + (rate === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: rate + "%" }} />
                      </span>
                      <span className="text-xs text-slate-600">{rate}%</span>
                    </span>
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

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ReviewDialog({ leave, onClose, onDecide }) {
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">พิจารณาใบลา</h2>
        <dl className="mt-4 space-y-2.5 text-sm">
          <Row k="พนักงาน" v={empName(leave.employeeId)} />
          <Row k="ประเภท" v={leave.type} />
          <Row k="ช่วงวัน" v={leave.from + " → " + leave.to} />
          <Row k="จำนวน" v={leave.days + " วัน"} />
          <Row k="เหตุผล" v={leave.reason || "ไม่ได้ระบุ"} />
        </dl>
        <div className="mt-6 flex gap-2">
          <button onClick={() => onDecide(leave.id, "อนุมัติแล้ว")} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
            อนุมัติ
          </button>
          <button onClick={() => onDecide(leave.id, "ไม่อนุมัติ")} className="flex-1 rounded-lg border border-rose-300 py-2.5 text-sm text-rose-700 hover:bg-rose-50">
            ไม่อนุมัติ
          </button>
        </div>
        <button onClick={onClose} className="mt-2 w-full rounded-lg py-2 text-sm text-slate-500 hover:text-slate-800">ปิดหน้าต่าง</button>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{k}</dt>
      <dd className="text-right text-slate-900">{v}</dd>
    </div>
  );
}
`;
