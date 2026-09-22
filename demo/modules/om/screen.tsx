import { useState } from "react";
import { EMPLOYEES } from "../pa/data";
import { ORG_UNITS, POSITIONS, EMPLOYEE_SKILLS, holderOf } from "./data";
import type { Employee } from "../pa/data";

type Position = (typeof POSITIONS)[number];
type SeatHolder = (p: Position) => Employee | undefined;
type StaffOf = (unitId: number) => Employee[];

const unitName = (id: number) => {
  const u = ORG_UNITS.find((x) => x.id === id);
  if (!u) throw new Error(`ไม่พบหน่วยงาน ${id}`);
  return u.name;
};
import { Card, Stat } from "../ui";

const TABS = [
  "โครงสร้างองค์กร",
  "ตำแหน่งและหน้าที่งาน",
  "การมอบหมายผู้ดำรงตำแหน่ง",
  "การวางแผนอัตรากำลัง",
  "คุณสมบัติประจำตำแหน่ง",
  "รายงานและการวิเคราะห์",
];

export default function OmScreen({ section }: { section?: string }) {
  // Which capability to show is the navigation's decision, not this screen's.
  const tab = section && TABS.includes(section) ? section : TABS[0];
  const [assigning, setAssigning] = useState<Position | null>(null);
  // Seats reassigned in this session; the seed holder still answers for the rest.
  const [assigned, setAssigned] = useState<Record<number, number>>({});

  const seatHolder: SeatHolder = (p) => {
    const manual = assigned[p.id];
    if (manual) return EMPLOYEES.find((e) => e.id === manual);
    return holderOf(p.title);
  };
  const vacant = POSITIONS.filter((p) => !seatHolder(p));
  const staffOf: StaffOf = (unitId) =>
    POSITIONS.filter((p) => p.unitId === unitId)
      .map(seatHolder)
      .filter((e): e is Employee => e !== undefined);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">โครงสร้างองค์กร</h1>
        <p className="text-sm text-slate-500">
          {ORG_UNITS.length} หน่วยงาน · {POSITIONS.length} ตำแหน่ง · ว่าง {vacant.length} ตำแหน่ง
        </p>
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
          onPick={(empId: number) => {
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

function Structure({ staffOf }: { staffOf: StaffOf }) {
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
              <td className="px-4 py-3 text-slate-600">{unitName(p.unitId)}</td>
              <td className="px-4 py-3 text-slate-600">{p.level}</td>
              <td className="px-4 py-3 text-slate-500">{p.reportsTo ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Assignments({ seatHolder, onAssign }: { seatHolder: SeatHolder; onAssign: (p: Position) => void }) {
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

function Planning({ staffOf }: { staffOf: StaffOf }) {
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

function Qualifications({ seatHolder }: { seatHolder: SeatHolder }) {
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

function Reports({ staffOf, vacantCount }: { staffOf: StaffOf; vacantCount: number }) {
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

function AssignDialog({ position, onClose, onPick }: { position: Position; onClose: () => void; onPick: (id: number) => void }) {
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
