export const OM_DATA = `import { EMPLOYEES } from "../pa/data";

export const ORG_UNITS = [
  { id: 1, name: "ฝ่ายขาย", head: "หัวหน้าฝ่ายขาย", plannedHeadcount: 4 },
  { id: 2, name: "ฝ่ายบัญชี", head: "นักบัญชีอาวุโส", plannedHeadcount: 3 },
  { id: 3, name: "ฝ่ายคลัง", head: "ผู้จัดการคลัง", plannedHeadcount: 5 },
  { id: 4, name: "ฝ่ายบุคคล", head: "เจ้าหน้าที่บุคคล", plannedHeadcount: 2 },
  { id: 5, name: "ฝ่ายผลิต", head: "หัวหน้าสายการผลิต", plannedHeadcount: 6 },
  { id: 6, name: "ฝ่ายจัดซื้อ", head: "เจ้าหน้าที่จัดซื้อ", plannedHeadcount: 2 },
];

export const POSITIONS = [
  { id: 1, unitId: 1, title: "หัวหน้าฝ่ายขาย", level: "หัวหน้างาน", reportsTo: null, qualifications: ["ประสบการณ์ขาย 5 ปี", "บริหารทีม", "เจรจาต่อรอง"] },
  { id: 2, unitId: 1, title: "พนักงานขาย", level: "ปฏิบัติการ", reportsTo: "หัวหน้าฝ่ายขาย", qualifications: ["สื่อสารดี", "ใช้ CRM ได้"] },
  { id: 3, unitId: 2, title: "นักบัญชีอาวุโส", level: "อาวุโส", reportsTo: null, qualifications: ["บัญชีบัณฑิต", "ปิดงบได้", "ภาษีนิติบุคคล"] },
  { id: 4, unitId: 3, title: "ผู้จัดการคลัง", level: "ผู้จัดการ", reportsTo: null, qualifications: ["บริหารคลัง 5 ปี", "ระบบ WMS"] },
  { id: 5, unitId: 3, title: "พนักงานคลังสินค้า", level: "ปฏิบัติการ", reportsTo: "ผู้จัดการคลัง", qualifications: ["ขับโฟล์คลิฟท์", "นับสต็อก"] },
  { id: 6, unitId: 4, title: "เจ้าหน้าที่บุคคล", level: "ปฏิบัติการ", reportsTo: null, qualifications: ["กฎหมายแรงงาน", "สรรหา"] },
  { id: 7, unitId: 5, title: "ช่างเทคนิค", level: "ปฏิบัติการ", reportsTo: "หัวหน้าสายการผลิต", qualifications: ["ซ่อมบำรุงเครื่องจักร", "ความปลอดภัย"] },
  { id: 8, unitId: 5, title: "หัวหน้าสายการผลิต", level: "หัวหน้างาน", reportsTo: null, qualifications: ["วางแผนผลิต", "บริหารทีม", "ควบคุมคุณภาพ"] },
  { id: 9, unitId: 6, title: "เจ้าหน้าที่จัดซื้อ", level: "ปฏิบัติการ", reportsTo: null, qualifications: ["เจรจาต่อรอง", "ประเมินผู้ขาย"] },
];

/** Skills each person actually holds — compared against what the seat requires. */
export const EMPLOYEE_SKILLS = {
  1: ["ประสบการณ์ขาย 5 ปี", "บริหารทีม", "เจรจาต่อรอง"],
  2: ["บัญชีบัณฑิต", "ปิดงบได้"],
  3: ["นับสต็อก"],
  4: ["กฎหมายแรงงาน", "สรรหา"],
  5: ["ซ่อมบำรุงเครื่องจักร"],
  6: ["สื่อสารดี", "ใช้ CRM ได้"],
  7: ["บริหารคลัง 5 ปี", "ระบบ WMS"],
};

export const holderOf = (title) => EMPLOYEES.find((e) => e.position === title && e.status !== "ลาออก");
`;

export const OM_SCREEN = `import { useState } from "react";
import { EMPLOYEES } from "../pa/data";
import { ORG_UNITS, POSITIONS, EMPLOYEE_SKILLS, holderOf } from "./data";

const TABS = [
  "โครงสร้างองค์กร",
  "ตำแหน่งและหน้าที่งาน",
  "การมอบหมายผู้ดำรงตำแหน่ง",
  "การวางแผนอัตรากำลัง",
  "คุณสมบัติประจำตำแหน่ง",
  "รายงานและการวิเคราะห์",
];

export default function OmScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [assigning, setAssigning] = useState(null);
  const [assigned, setAssigned] = useState({});

  const seatHolder = (p) => {
    const manual = assigned[p.id];
    if (manual) return EMPLOYEES.find((e) => e.id === manual);
    return holderOf(p.title);
  };
  const vacant = POSITIONS.filter((p) => !seatHolder(p));
  const staffOf = (unitId) =>
    POSITIONS.filter((p) => p.unitId === unitId).map(seatHolder).filter(Boolean);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">โครงสร้างองค์กร</h1>
        <p className="text-sm text-slate-500">
          {ORG_UNITS.length} หน่วยงาน · {POSITIONS.length} ตำแหน่ง · ว่าง {vacant.length} ตำแหน่ง
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
          </button>
        ))}
      </div>

      {tab === "โครงสร้างองค์กร" && <Structure staffOf={staffOf} />}
      {tab === "ตำแหน่งและหน้าที่งาน" && <Positions />}
      {tab === "การมอบหมายผู้ดำรงตำแหน่ง" && (
        <Assignments seatHolder={seatHolder} onAssign={setAssigning} />
      )}
      {tab === "การวางแผนอัตรากำลัง" && <Planning staffOf={staffOf} />}
      {tab === "คุณสมบัติประจำตำแหน่ง" && <Qualifications seatHolder={seatHolder} />}
      {tab === "รายงานและการวิเคราะห์" && <Reports staffOf={staffOf} vacantCount={vacant.length} />}

      {assigning && (
        <AssignDialog
          position={assigning}
          onClose={() => setAssigning(null)}
          onPick={(empId) => {
            setAssigned((m) => ({ ...m, [assigning.id]: empId }));
            setAssigning(null);
          }}
        />
      )}

      <div hidden data-fitt-index>
        <button data-fitt-screen="โครงสร้างองค์กร" />
        <button data-fitt-screen="มอบหมายผู้ดำรงตำแหน่ง" data-fitt-modal onClick={() => setAssigning(POSITIONS[0])} />
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{children}</div>;
}

function Structure({ staffOf }) {
  return (
    <div className="space-y-3">
      {ORG_UNITS.map((u) => {
        const staff = staffOf(u.id);
        return (
          <Card key={u.id}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <div className="font-medium text-slate-900">{u.name}</div>
                <div className="text-xs text-slate-500">หัวหน้าหน่วยงาน: {u.head}</div>
              </div>
              <div className="text-sm text-slate-600">{staff.length} คน</div>
            </div>
            <ul className="divide-y divide-slate-100">
              {POSITIONS.filter((p) => p.unitId === u.id).map((p) => (
                <li key={p.id} className="px-4 py-2.5 text-sm">
                  <span className="text-slate-800">{p.title}</span>
                  {p.reportsTo && <span className="ml-2 text-xs text-slate-400">รายงานต่อ {p.reportsTo}</span>}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function Positions() {
  return (
    <Card>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">ตำแหน่ง</th><th className="px-4 py-3">หน่วยงาน</th>
            <th className="px-4 py-3">ระดับ</th><th className="px-4 py-3">รายงานต่อ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {POSITIONS.map((p) => (
            <tr key={p.id} className="hover:bg-sky-50">
              <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
              <td className="px-4 py-3 text-slate-600">{ORG_UNITS.find((u) => u.id === p.unitId).name}</td>
              <td className="px-4 py-3 text-slate-600">{p.level}</td>
              <td className="px-4 py-3 text-slate-500">{p.reportsTo ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Assignments({ seatHolder, onAssign }) {
  return (
    <Card>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-3">ตำแหน่ง</th><th className="px-4 py-3">ผู้ดำรงตำแหน่ง</th><th className="px-4 py-3" /></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {POSITIONS.map((p) => {
            const h = seatHolder(p);
            return (
              <tr key={p.id} className="hover:bg-sky-50">
                <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                <td className="px-4 py-3">
                  {h ? <span className="text-slate-700">{h.name}</span>
                     : <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">ยังไม่มีผู้ดำรงตำแหน่ง</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onAssign(p)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700"
                  >
                    {h ? "เปลี่ยนผู้ดำรง" : "มอบหมาย"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Planning({ staffOf }) {
  return (
    <Card>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">หน่วยงาน</th><th className="px-4 py-3 text-right">มีอยู่</th>
            <th className="px-4 py-3 text-right">แผน</th><th className="px-4 py-3 text-right">ต้องรับเพิ่ม</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ORG_UNITS.map((u) => {
            const have = staffOf(u.id).length;
            const gap = u.plannedHeadcount - have;
            return (
              <tr key={u.id} className="hover:bg-sky-50">
                <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                <td className="px-4 py-3 text-right text-slate-700">{have}</td>
                <td className="px-4 py-3 text-right text-slate-700">{u.plannedHeadcount}</td>
                <td className={"px-4 py-3 text-right font-semibold " + (gap > 0 ? "text-amber-700" : "text-slate-400")}>
                  {gap > 0 ? "+" + gap : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Qualifications({ seatHolder }) {
  return (
    <div className="space-y-3">
      {POSITIONS.map((p) => {
        const h = seatHolder(p);
        const has = h ? EMPLOYEE_SKILLS[h.id] ?? [] : [];
        const gaps = p.qualifications.filter((q) => !has.includes(q));
        return (
          <Card key={p.id}>
            <div className="flex items-start justify-between px-4 py-3">
              <div>
                <div className="font-medium text-slate-900">{p.title}</div>
                <div className="text-xs text-slate-500">{h ? h.name : "ยังไม่มีผู้ดำรงตำแหน่ง"}</div>
              </div>
              {h && (
                <span className={"rounded-full px-2 py-1 text-xs " + (gaps.length === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                  {gaps.length === 0 ? "คุณสมบัติครบ" : "ขาด " + gaps.length + " ข้อ"}
                </span>
              )}
            </div>
            <ul className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-3">
              {p.qualifications.map((q) => (
                <li key={q} className={"rounded-full px-2.5 py-1 text-xs " + (has.includes(q) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500 line-through")}>
                  {q}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function Reports({ staffOf, vacantCount }) {
  const total = ORG_UNITS.reduce((n, u) => n + staffOf(u.id).length, 0);
  const planned = ORG_UNITS.reduce((n, u) => n + u.plannedHeadcount, 0);
  const leads = POSITIONS.filter((p) => !p.reportsTo).length;
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        <Stat label="พนักงานทั้งหมด" value={total + " คน"} />
        <Stat label="อัตราตามแผน" value={planned + " คน"} />
        <Stat label="ตำแหน่งว่าง" value={vacantCount + " ตำแหน่ง"} />
        <Stat label="ช่วงการบังคับบัญชา" value={(total / leads).toFixed(1) + " คน/หัวหน้า"} />
      </div>
      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">สัดส่วนคนต่อหน่วยงาน</div>
        <ul className="divide-y divide-slate-100">
          {ORG_UNITS.map((u) => {
            const n = staffOf(u.id).length;
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-slate-700">{u.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-sky-500" style={{ width: (total ? (n / total) * 100 : 0) + "%" }} />
                </span>
                <span className="w-10 shrink-0 text-right text-slate-600">{n}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function AssignDialog({ position, onClose, onPick }) {
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">มอบหมายผู้ดำรงตำแหน่ง</h2>
        <p className="mt-0.5 text-sm text-slate-500">{position.title}</p>
        <ul className="mt-4 max-h-64 divide-y divide-slate-100 overflow-y-auto">
          {EMPLOYEES.filter((e) => e.status !== "ลาออก").map((e) => (
            <li key={e.id}>
              <button onClick={() => onPick(e.id)} className="flex w-full items-center justify-between px-1 py-2.5 text-left text-sm hover:bg-sky-50">
                <span className="text-slate-800">{e.name}</span>
                <span className="text-xs text-slate-400">{e.department}</span>
              </button>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="mt-5 w-full rounded-lg border border-slate-300 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
}
`;
