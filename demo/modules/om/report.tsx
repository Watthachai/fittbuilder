import { Printer } from "lucide-react";
import { COMPANY } from "../pa/data";
import { ORG_UNITS, REQUISITIONS, ROOT_UNIT, TODAY, childUnits, positionOf, seats } from "./data";
import type { OrgUnit } from "./data";
import { Button } from "../ui";
import { FormModal, Paper, notify, printDocument, useData } from "../kit";

/**
 * The organisation on paper: every unit in chart order, its seats, who holds
 * them, and how far each unit is from its plan — the page a manager signs at
 * the annual manpower review.
 */

/** Units in chart order, each with how deep it sits. */
function chartOrder(u: OrgUnit = ROOT_UNIT, depth = 0): { unit: OrgUnit; depth: number }[] {
  return [{ unit: u, depth }, ...childUnits(u.id).flatMap((c) => chartOrder(c, depth + 1))];
}

const OPEN = ["รออนุมัติ", "อนุมัติแล้ว", "กำลังสรรหา"];

export function OrgReportPaper() {
  const all = seats();
  const filled = all.filter((s) => s.holder).length;
  const planned = ORG_UNITS.reduce((n, u) => n + u.plannedHeadcount, 0);
  const open = REQUISITIONS.filter((r) => OPEN.includes(r.status));
  const cell = "border border-slate-300 px-2 py-1.5";

  return (
    <Paper>
      <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
        <div>
          <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
          <p className="mt-1 text-slate-600">รายงานโครงสร้างองค์กรและอัตรากำลัง</p>
        </div>
        <div className="text-right text-slate-700">
          <p>ข้อมูล ณ วันที่ {TODAY}</p>
          <p className="mt-1">{ORG_UNITS.length} หน่วยงาน · {all.length} ตำแหน่ง</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          ["อัตราตามแผน", planned],
          ["มีผู้ดำรงตำแหน่ง", filled],
          ["ตำแหน่งว่าง", all.length - filled],
          ["คำขอที่เปิดอยู่", open.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-slate-300 py-2">
            <dt className="text-[11px] text-slate-500">{k}</dt>
            <dd className="text-[16px] font-bold tabular-nums text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-[11.5px] text-slate-600">
            <th className={cell + " text-left font-medium"}>หน่วยงาน / ตำแหน่ง</th>
            <th className={cell + " text-left font-medium"}>ระดับ</th>
            <th className={cell + " text-left font-medium"}>รายงานต่อ</th>
            <th className={cell + " text-left font-medium"}>ผู้ดำรงตำแหน่ง</th>
          </tr>
        </thead>
        <tbody>
          {chartOrder().map(({ unit, depth }) => {
            const own = all.filter((s) => s.unit.id === unit.id);
            const have = own.filter((s) => s.holder).length;
            return [
              <tr key={"u" + unit.id} className="bg-slate-50">
                <td className={cell + " font-semibold text-slate-900"} colSpan={3} style={{ paddingLeft: 8 + depth * 16 }}>
                  {unit.name} <span className="font-normal text-slate-500">· {unit.code} · {unit.costCentre}</span>
                </td>
                <td className={cell + " tabular-nums text-slate-700"}>
                  {have}/{unit.plannedHeadcount} อัตรา{have < unit.plannedHeadcount ? ` · ขาด ${unit.plannedHeadcount - have}` : ""}
                </td>
              </tr>,
              ...own.map((s) => (
                <tr key={"p" + s.position.id}>
                  <td className={cell} style={{ paddingLeft: 20 + depth * 16 }}>
                    {s.position.title} <span className="text-slate-400">{s.position.code}</span>
                  </td>
                  <td className={cell}>{s.position.level}</td>
                  <td className={cell}>{s.position.reportsTo === null ? "—" : positionOf(s.position.reportsTo).title}</td>
                  <td className={cell}>
                    {s.holder
                      ? `${s.holder.name} (${s.holder.code})`
                      : s.acting
                        ? `ว่าง · รักษาการ ${s.acting.employee.name}`
                        : "ว่าง"}
                  </td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>

      {open.length > 0 && (
        <>
          <p className="mt-5 font-semibold text-slate-900">คำขออัตรากำลังที่เปิดอยู่</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
            {open.map((r) => (
              <li key={r.id}>
                {r.id} · {positionOf(r.positionId).title} · {r.kind} · {r.status} · ต้องการภายใน {r.wantedBy}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-12 grid grid-cols-2 gap-8">
        {["ผู้จัดทำ (ฝ่ายทรัพยากรบุคคล)", "ผู้อนุมัติ (กรรมการผู้จัดการ)"].map((l) => (
          <div key={l} className="text-center">
            <div className="mx-auto h-10 w-44 border-b border-dotted border-slate-500" />
            <p className="mt-1.5 text-slate-600">{l}</p>
            <p className="text-[11px] text-slate-400">วันที่ ____/____/______</p>
          </div>
        ))}
      </div>
    </Paper>
  );
}

export function OrgReportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useData();
  return (
    <FormModal open={open} size="lg" title="รายงานโครงสร้างองค์กร" subtitle="พิมพ์ได้ทั้งฉบับ อ่านจากผังและทะเบียนพนักงาน ณ ตอนนี้" onClose={onClose}>
      {open && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-950">
            <OrgReportPaper />
          </div>
          <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
            <Button variant="secondary" onClick={onClose}>ปิด</Button>
            <Button
              variant="primary"
              icon={<Printer size={14} />}
              onClick={() => {
                printDocument();
                notify("ส่งรายงานโครงสร้างองค์กรไปที่เครื่องพิมพ์แล้ว");
              }}
            >
              พิมพ์
            </Button>
          </div>
        </div>
      )}
    </FormModal>
  );
}
