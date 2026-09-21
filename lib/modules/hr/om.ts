import type { Module } from "../types";

/**
 * Organisational structure — who reports to whom, and which seats exist.
 *
 * It owns `position` and `orgUnit` but reads `employee`, because a seat and the
 * person sitting in it are different facts with different lifetimes: the seat
 * outlives whoever holds it, and a vacancy is a seat with nobody in it rather than
 * a missing row.
 */
const SCREEN = `import { useState } from "react";
import { EMPLOYEES } from "../pa/data";
import { ORG_UNITS, POSITIONS } from "./data";

export default function OmScreen() {
  const [openUnits, setOpenUnits] = useState(ORG_UNITS.map((u) => u.id));
  const [vacancy, setVacancy] = useState(null);

  const toggle = (id) =>
    setOpenUnits((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const holderOf = (positionId) => EMPLOYEES.find((e) => e.position === positionId);
  const vacant = POSITIONS.filter((p) => !holderOf(p.title));

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">โครงสร้างองค์กร</h1>
          <p className="text-sm text-slate-500">
            {ORG_UNITS.length} หน่วยงาน · {POSITIONS.length} ตำแหน่ง · ว่าง {vacant.length} ตำแหน่ง
          </p>
        </div>
        {vacant.length > 0 && (
          <button
            onClick={() => setVacancy(vacant)}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100"
          >
            ดูตำแหน่งที่ยังว่าง {vacant.length} ตำแหน่ง
          </button>
        )}
      </div>

      <div className="space-y-3">
        {ORG_UNITS.map((unit) => {
          const seats = POSITIONS.filter((p) => p.unitId === unit.id);
          const open = openUnits.includes(unit.id);
          return (
            <div key={unit.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                onClick={() => toggle(unit.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
              >
                <span>
                  <span className="font-medium text-slate-900">{unit.name}</span>
                  <span className="ml-2 text-sm text-slate-500">{seats.length} ตำแหน่ง</span>
                </span>
                <span className="text-slate-400">{open ? "▾" : "▸"}</span>
              </button>
              {open && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {seats.map((p) => {
                    const holder = holderOf(p.title);
                    return (
                      <li key={p.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{p.title}</div>
                          <div className="text-xs text-slate-500">ระดับ {p.level}</div>
                        </div>
                        {holder ? (
                          <span className="text-sm text-slate-700">{holder.name}</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
                            ยังไม่มีผู้ดำรงตำแหน่ง
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {vacancy && <VacancyList positions={vacancy} onClose={() => setVacancy(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="โครงสร้างองค์กร" />
        <button data-fitt-screen="ตำแหน่งที่ยังว่าง" data-fitt-modal onClick={() => setVacancy(vacant)} />
      </div>
    </div>
  );
}

function VacancyList({ positions, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">ตำแหน่งที่ยังว่าง</h2>
        <p className="mt-0.5 text-sm text-slate-500">{positions.length} ตำแหน่ง รอการสรรหา</p>
        <ul className="mt-4 divide-y divide-slate-100">
          {positions.map((p) => (
            <li key={p.id} className="py-3">
              <div className="text-sm font-medium text-slate-800">{p.title}</div>
              <div className="text-xs text-slate-500">ระดับ {p.level}</div>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="mt-6 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white">
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
}
`;

const DATA = `export const ORG_UNITS = [
  { id: 1, name: "ฝ่ายขาย" },
  { id: 2, name: "ฝ่ายบัญชี" },
  { id: 3, name: "ฝ่ายคลัง" },
  { id: 4, name: "ฝ่ายบุคคล" },
  { id: 5, name: "ฝ่ายผลิต" },
  { id: 6, name: "ฝ่ายจัดซื้อ" },
];

export const POSITIONS = [
  { id: 1, unitId: 1, title: "หัวหน้าฝ่ายขาย", level: "หัวหน้างาน" },
  { id: 2, unitId: 1, title: "พนักงานขาย", level: "ปฏิบัติการ" },
  { id: 3, unitId: 2, title: "นักบัญชีอาวุโส", level: "อาวุโส" },
  { id: 4, unitId: 3, title: "ผู้จัดการคลัง", level: "ผู้จัดการ" },
  { id: 5, unitId: 3, title: "พนักงานคลังสินค้า", level: "ปฏิบัติการ" },
  { id: 6, unitId: 4, title: "เจ้าหน้าที่บุคคล", level: "ปฏิบัติการ" },
  { id: 7, unitId: 5, title: "ช่างเทคนิค", level: "ปฏิบัติการ" },
  { id: 8, unitId: 5, title: "หัวหน้าสายการผลิต", level: "หัวหน้างาน" },
  { id: 9, unitId: 6, title: "เจ้าหน้าที่จัดซื้อ", level: "ปฏิบัติการ" },
];
`;

export const OM: Module = {
  id: "om",
  name: "โครงสร้างองค์กร",
  sapCode: "OM",
  family: "hr",
  tier: "base",
  pitch:
    "เห็นทั้งองค์กรในหน้าเดียวว่าใครอยู่ตรงไหน และตำแหน่งไหนยังว่าง — ไม่ต้องรอ HR วาดผังใหม่ทุกครั้งที่มีคนเข้าออก",
  provides: ["orgUnit", "position"],
  needs: ["employee"],
  effortDays: 5,
  maPerMonth: 2500,
  build:
    "หน้าโครงสร้างองค์กร: รายการหน่วยงานกางเก็บได้ แต่ละหน่วยงานแสดงตำแหน่งพร้อมผู้ดำรงตำแหน่งที่อ่านจากทะเบียนพนักงาน · ตำแหน่งที่ไม่มีคนถือขึ้นป้ายว่าง และมีหน้าต่างรวมตำแหน่งว่างทั้งหมด",
  files: {
    "src/modules/om/screen.tsx": SCREEN,
    "src/modules/om/data.ts": DATA,
  },
};
