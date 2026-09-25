import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Award, Banknote, Briefcase, Building, CalendarClock, ChevronRight, CircleCheck,
  ClipboardList, Contact, Download, GitBranch, Layers, ListChecks, Network, Pencil, Plus, Printer, Scale,
  Search as SearchIcon, ShieldCheck, Target, TrendingUp, UserCog, UserPlus, UserRound, Users, UserX,
} from "lucide-react";
import {
  LEVELS, ORG_UNITS, POSITIONS, REQUISITIONS, ROOT_UNIT, TODAY, bandOf, bandStanding,
  baht, chainAbove, daysSince, directReports, endActing, grantSkill, openRequisitionFor, positionOf,
  seats as seatsNow, skillsOf, startRecruiting, unitOf,
} from "./data";
import type { Level, Requisition, Seat } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, Gauge, IconRow, Note,
  PageHead, Progress, Reveal, Search, Segmented, Select, StatStrip, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";
import { RowButton } from "../pa/parts";
import { OmSheets } from "./actions";
import type { OmSheet } from "./actions";

const TABS = [
  "โครงสร้างองค์กร",
  "ตำแหน่งและหน้าที่งาน",
  "การมอบหมายผู้ดำรงตำแหน่ง",
  "การวางแผนอัตรากำลัง",
  "คุณสมบัติประจำตำแหน่ง",
  "รายงานและการวิเคราะห์",
];

/** The seat's own tabs inside the record panel. */
const SEAT_TABS = ["หน้าที่งาน", "คุณสมบัติ", "กรอบค่าตอบแทน", "สายบังคับบัญชา"];

const SEAT_TAB_ICONS: Record<string, ReactNode> = {
  หน้าที่งาน: <ListChecks size={13} />,
  คุณสมบัติ: <Award size={13} />,
  กรอบค่าตอบแทน: <Banknote size={13} />,
  สายบังคับบัญชา: <GitBranch size={13} />,
};

/** Units are added and renamed here, so their colours and lists are read, not frozen at load. */
const unitSwatch = (name: string) => swatchFor(name, ORG_UNITS.map((u) => u.name));
const departments = () => ORG_UNITS.filter((u) => u.parentId !== null).map((u) => u.name);
const levelSwatch = (level: Level) => swatchFor(level, LEVELS);

const REQ_TONE: Record<Requisition["status"], "warn" | "info" | "accent" | "ok" | "idle"> = {
  รออนุมัติ: "warn",
  อนุมัติแล้ว: "info",
  กำลังสรรหา: "accent",
  ปิดแล้ว: "ok",
  ไม่อนุมัติ: "idle",
};

const OPEN_REQ = ["รออนุมัติ", "อนุมัติแล้ว", "กำลังสรรหา"];
const isOpen = (r: Requisition) => OPEN_REQ.includes(r.status);

/** A bar's fill; a unit planned at zero has nothing to fill. */
const fillPct = (have: number, planned: number) => (planned === 0 ? (have > 0 ? 100 : 0) : (have / planned) * 100);

const holderLabel = (s: Seat) => s.holder?.name ?? (s.acting ? `ว่าง · รักษาการ ${s.acting.employee.name}` : "ว่าง");

/** "ส่งออก Excel": rows as the screen shows them, as a file the accountant opens. */
function exportCsv(name: string, header: string[], rows: (string | number)[][]) {
  downloadCsv(`${name}-${TODAY}`, header, rows);
  notify(`ส่งออก${name} ${rows.length} รายการเป็นไฟล์ Excel แล้ว`);
}

const ExportButton = ({ onClick }: { onClick: () => void }) => (
  <Button variant="secondary" icon={<Download size={15} />} onClick={onClick}>ส่งออก Excel</Button>
);

/* ----------------------------------------------------------------- screen */

export default function OmScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  // Seats and holders are worked out from the records on every change — here
  // and in the personnel register a promotion or a leaver changes the chart.
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [unitFilter, setUnitFilter] = useState("ทุกหน่วยงาน");
  const [levelFilter, setLevelFilter] = useState("ทุกระดับ");
  const [openId, setOpenId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<OmSheet | null>(null);

  const seats = seatsNow();
  const reqs = [...REQUISITIONS].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || b.openedAt.localeCompare(a.openedAt));
  const seatOf = (id: number) => seats.find((s) => s.position.id === id)!;
  const filled = seats.filter((s) => s.holder);
  const vacant = seats.filter((s) => !s.holder);

  const needle = q.trim().toLowerCase();
  const rows = seats.filter(
    (s) =>
      (unitFilter === "ทุกหน่วยงาน" || s.unit.name === unitFilter) &&
      (levelFilter === "ทุกระดับ" || s.position.level === levelFilter) &&
      (needle === "" ||
        [s.position.title, s.position.code, s.unit.name, s.holder?.name ?? ""].some((t) =>
          t.toLowerCase().includes(needle)
        ))
  );
  // Held by id, so an assignment that reorders nothing still keeps the same seat open.
  const picked = openId === null ? null : (seats.find((s) => s.position.id === openId) ?? null);
  const at = picked ? rows.findIndex((s) => s.position.id === picked.position.id) : -1;

  const openSeat = (s: Seat) => setOpenId(s.position.id);
  const plannedTotal = ORG_UNITS.reduce((n, u) => n + u.plannedHeadcount, 0);

  const panels = (
    <>
      <DetailModal
        open={picked !== null}
        title="แฟ้มตำแหน่งงาน"
        onClose={() => setOpenId(null)}
        index={Math.max(0, at)}
        total={rows.length}
        onStep={
          sheet
            ? undefined
            : (d) => {
                const next = rows[Math.max(0, Math.min(rows.length - 1, at + d))];
                if (next) setOpenId(next.position.id);
              }
        }
      >
        {picked && <SeatRecord key={picked.position.id} seat={picked} seatOf={seatOf} onSheet={setSheet} />}
      </DetailModal>
      <OmSheets sheet={sheet} onSheet={setSheet} />
      <div hidden data-fitt-index>
        <button data-fitt-screen="โครงสร้างองค์กร" />
        <button data-fitt-screen="แฟ้มตำแหน่งงาน" data-fitt-modal onClick={() => setOpenId(POSITIONS[0].id)} />
        <button data-fitt-screen="มอบหมายผู้ดำรงตำแหน่ง" data-fitt-modal onClick={() => setSheet({ kind: "assign", positionId: POSITIONS[0].id })} />
        <button
          data-fitt-screen="มอบหมายรักษาการ"
          data-fitt-modal
          onClick={() => {
            if (vacant[0]) setSheet({ kind: "acting", positionId: vacant[0].position.id });
          }}
        />
        <button
          data-fitt-screen="ปลดผู้ดำรงตำแหน่ง"
          data-fitt-modal
          onClick={() => {
            if (filled[0]) setSheet({ kind: "release", positionId: filled[0].position.id });
          }}
        />
        <button data-fitt-screen="เปิดคำขออัตรากำลัง" data-fitt-modal onClick={() => setSheet({ kind: "requisition" })} />
        <button
          data-fitt-screen="อนุมัติคำขออัตรากำลัง"
          data-fitt-modal
          onClick={() => {
            const r = REQUISITIONS.find((x) => x.status === "รออนุมัติ");
            if (r) setSheet({ kind: "decideReq", id: r.id, approve: true });
          }}
        />
        <button
          data-fitt-screen="ไม่อนุมัติคำขออัตรากำลัง"
          data-fitt-modal
          onClick={() => {
            const r = REQUISITIONS.find((x) => x.status === "รออนุมัติ");
            if (r) setSheet({ kind: "decideReq", id: r.id, approve: false });
          }}
        />
        <button data-fitt-screen="เพิ่มหน่วยงาน" data-fitt-modal onClick={() => setSheet({ kind: "unit", id: null })} />
        <button data-fitt-screen="แก้ไขหรือย้ายหน่วยงาน" data-fitt-modal onClick={() => setSheet({ kind: "unit", id: departmentsUnits()[0].id })} />
        <button data-fitt-screen="สร้างตำแหน่ง" data-fitt-modal onClick={() => setSheet({ kind: "position", id: null })} />
        <button data-fitt-screen="แก้ไขตำแหน่ง" data-fitt-modal onClick={() => setSheet({ kind: "position", id: POSITIONS[0].id })} />
        <button data-fitt-screen="แก้อัตรากำลังตามแผน" data-fitt-modal onClick={() => setSheet({ kind: "planned", unitId: ORG_UNITS[0].id })} />
        <button data-fitt-screen="คุณสมบัติประจำตำแหน่ง" data-fitt-modal onClick={() => setSheet({ kind: "quals", positionId: POSITIONS[0].id })} />
        <button data-fitt-screen="รายงานโครงสร้างองค์กร" data-fitt-modal onClick={() => setSheet({ kind: "report" })} />
      </div>
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          seats={seats}
          filled={filled}
          vacant={vacant}
          reqs={reqs}
          plannedTotal={plannedTotal}
          onOpenSection={onOpenSection}
          onOpenSeat={openSeat}
          onSheet={setSheet}
        />
        {panels}
      </>
    );
  }

  const right: Record<string, ReactNode> = {
    โครงสร้างองค์กร: (
      <div className="flex flex-wrap gap-2">
        <ExportButton
          onClick={() =>
            exportCsv(
              "หน่วยงาน",
              ["รหัส", "หน่วยงาน", "ขึ้นตรงต่อ", "ศูนย์ต้นทุน", "ตั้งเมื่อ", "มีอยู่", "ตามแผน"],
              ORG_UNITS.map((u) => [
                u.code, u.name, u.parentId === null ? "—" : unitOf(u.parentId).name, u.costCentre, u.openedAt,
                filled.filter((s) => s.unit.id === u.id).length, u.plannedHeadcount,
              ])
            )
          }
        />
        <Button variant="secondary" icon={<Printer size={15} />} onClick={() => setSheet({ kind: "report" })}>พิมพ์ผังองค์กร</Button>
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setSheet({ kind: "unit", id: null })}>เพิ่มหน่วยงาน</Button>
      </div>
    ),
    ตำแหน่งและหน้าที่งาน: (
      <div className="flex flex-wrap gap-2">
        <ExportButton
          onClick={() =>
            exportCsv(
              "ตำแหน่งงาน",
              ["รหัส", "ตำแหน่ง", "หน่วยงาน", "ระดับ", "หน้าที่หลัก", "รายงานต่อ", "เงินเดือนต่ำสุด", "เงินเดือนสูงสุด"],
              rows.map((s) => [
                s.position.code, s.position.title, s.unit.name, s.position.level, s.position.duties.join(" / "),
                s.position.reportsTo === null ? "—" : positionOf(s.position.reportsTo).title, bandOf(s.position).min, bandOf(s.position).max,
              ])
            )
          }
        />
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setSheet({ kind: "position", id: null })}>สร้างตำแหน่ง</Button>
      </div>
    ),
    การมอบหมายผู้ดำรงตำแหน่ง: (
      <ExportButton
        onClick={() =>
          exportCsv(
            "ผู้ดำรงตำแหน่ง",
            ["รหัสตำแหน่ง", "ตำแหน่ง", "หน่วยงาน", "ผู้ดำรงตำแหน่ง", "รหัสพนักงาน", "เริ่มงาน", "เทียบกรอบค่าตอบแทน"],
            rows.map((s) => [
              s.position.code, s.position.title, s.unit.name, holderLabel(s), s.holder?.code ?? "", s.holder?.contract.startedAt ?? "",
              s.holder ? bandStanding(s.position, s.holder.contract.baseSalary) : "",
            ])
          )
        }
      />
    ),
    การวางแผนอัตรากำลัง: (
      <div className="flex flex-wrap gap-2">
        <ExportButton
          onClick={() =>
            exportCsv(
              "คำขออัตรากำลัง",
              ["เลขที่", "ตำแหน่ง", "หน่วยงาน", "ประเภท", "เปิดเมื่อ", "ต้องการภายใน", "สถานะ", "เหตุผล"],
              reqs.map((r) => {
                const p = positionOf(r.positionId);
                return [r.id, p.title, unitOf(p.unitId).name, r.kind, r.openedAt, r.wantedBy, r.status, r.reason];
              })
            )
          }
        />
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setSheet({ kind: "requisition" })}>
          เปิดคำขออัตรากำลัง
        </Button>
      </div>
    ),
    คุณสมบัติประจำตำแหน่ง: (
      <ExportButton
        onClick={() =>
          exportCsv(
            "คุณสมบัติประจำตำแหน่ง",
            ["ตำแหน่ง", "ผู้ดำรงตำแหน่ง", "คุณสมบัติที่ต้องการ", "ที่ยังขาด"],
            seats.map((s) => [s.position.title, holderLabel(s), s.position.qualifications.join(" / "), s.holder ? s.gaps.join(" / ") : "—"])
          )
        }
      />
    ),
    รายงานและการวิเคราะห์: (
      <div className="flex flex-wrap gap-2">
        <ExportButton
          onClick={() =>
            exportCsv(
              "อัตรากำลังรายหน่วยงาน",
              ["หน่วยงาน", "ศูนย์ต้นทุน", "มีอยู่", "ตามแผน", "ต้องรับเพิ่ม", "ฐานเงินเดือนรวม"],
              ORG_UNITS.map((u) => {
                const own = filled.filter((s) => s.unit.id === u.id);
                return [u.name, u.costCentre, own.length, u.plannedHeadcount, Math.max(0, u.plannedHeadcount - own.length), own.reduce((n, s) => n + s.holder!.contract.baseSalary, 0)];
              })
            )
          }
        />
        <Button variant="primary" icon={<Printer size={15} />} onClick={() => setSheet({ kind: "report" })}>พิมพ์รายงานองค์กร</Button>
      </div>
    ),
  };

  return (
    <div>
      <PageHead
        title="โครงสร้างองค์กร"
        meta={`${tab} · ${ORG_UNITS.length - 1} หน่วยงาน · ${POSITIONS.length} ตำแหน่ง · ว่าง ${vacant.length} ตำแหน่ง`}
        right={right[tab]}
      />

      {tab === "โครงสร้างองค์กร" && <Structure seats={seats} onOpenSeat={openSeat} onSheet={setSheet} />}

      {tab === "ตำแหน่งและหน้าที่งาน" && (
        <SeatRegister
          rows={rows}
          q={q}
          setQ={setQ}
          unitFilter={unitFilter}
          setUnitFilter={setUnitFilter}
          levelFilter={levelFilter}
          setLevelFilter={setLevelFilter}
          onOpen={openSeat}
        />
      )}

      {tab === "การมอบหมายผู้ดำรงตำแหน่ง" && (
        <Assignments
          rows={rows}
          q={q}
          setQ={setQ}
          unitFilter={unitFilter}
          setUnitFilter={setUnitFilter}
          onOpen={openSeat}
          onSheet={setSheet}
        />
      )}

      {tab === "การวางแผนอัตรากำลัง" && (
        <Planning seats={seats} reqs={reqs} seatOf={seatOf} onOpenSeat={openSeat} onSheet={setSheet} />
      )}

      {tab === "คุณสมบัติประจำตำแหน่ง" && <Qualifications seats={seats} onOpenSeat={openSeat} onSheet={setSheet} />}

      {tab === "รายงานและการวิเคราะห์" && <Reports seats={seats} plannedTotal={plannedTotal} />}

      {panels}
    </div>
  );
}

const departmentsUnits = () => ORG_UNITS.filter((u) => u.parentId !== null);

/** The two buttons a request waiting for a decision carries. */
function Decide({ r, onSheet }: { r: Requisition; onSheet: (s: OmSheet) => void }) {
  return (
    <span className="flex gap-1.5">
      <RowButton tone="go" onClick={() => onSheet({ kind: "decideReq", id: r.id, approve: true })}>อนุมัติ</RowButton>
      <RowButton tone="stop" onClick={() => onSheet({ kind: "decideReq", id: r.id, approve: false })}>ไม่อนุมัติ</RowButton>
    </span>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  seats,
  filled,
  vacant,
  reqs,
  plannedTotal,
  onOpenSection,
  onOpenSeat,
  onSheet,
}: {
  seats: Seat[];
  filled: Seat[];
  vacant: Seat[];
  reqs: Requisition[];
  plannedTotal: number;
  onOpenSection?: (index: number) => void;
  onOpenSeat: (s: Seat) => void;
  onSheet: (s: OmSheet) => void;
}) {
  const units = ORG_UNITS;

  const byUnit = ORG_UNITS
    .map((u) => ({
      label: u.name,
      value: filled.filter((s) => s.unit.id === u.id).length,
      swatch: unitSwatch(u.name),
    }))
    .filter((s) => s.value > 0);

  const gapRows = seats.filter((s) => s.holder && s.gaps.length > 0);
  const qualifiedShare = filled.length ? Math.round(((filled.length - gapRows.length) / filled.length) * 100) : 0;

  const seeAll = (index: number) =>
    onOpenSection ? (
      <button
        onClick={() => onOpenSection(index)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300"
      >
        ดูทั้งหมด <ArrowRight size={12} />
      </button>
    ) : undefined;

  return (
    <div>
      <PageHead
        title="ภาพรวมโครงสร้างองค์กร"
        meta={`${units.length} หน่วยงาน · ${seats.length} ตำแหน่ง · ข้อมูล ณ ${TODAY}`}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Printer size={15} />} onClick={() => onSheet({ kind: "report" })}>
              พิมพ์ผังองค์กร
            </Button>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => onSheet({ kind: "requisition" })}>
              เปิดคำขออัตรากำลัง
            </Button>
            {onOpenSection && (
              <Button variant="primary" icon={<Network size={15} />} onClick={() => onOpenSection(0)}>
                เปิดผังองค์กร
              </Button>
            )}
          </div>
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            title={<span className="flex items-center gap-2"><Target size={15} className="text-slate-400" />อัตรากำลังเทียบแผน</span>}
            action={seeAll(3)}
          >
            <div className="px-4 pt-3">
              <Gauge value={filled.length} max={plannedTotal} label={`จากแผน ${plannedTotal} อัตรา`} hex="#7c3aed" size={210} />
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {units
                .map((u) => ({ u, have: filled.filter((s) => s.unit.id === u.id).length }))
                // Short units first: that is what the card is for.
                .sort((a, b) => (b.u.plannedHeadcount - b.have) - (a.u.plannedHeadcount - a.have))
                .map(({ u, have }) => {
                  const gap = u.plannedHeadcount - have;
                  return (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-2">
                      <Dot className={unitSwatch(u.name).dot} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800 dark:text-slate-100">{u.name}</span>
                      <Badge tone={gap > 0 ? "warn" : "ok"}>{gap > 0 ? `ขาด ${gap} อัตรา` : "ครบตามแผน"}</Badge>
                    </li>
                  );
                })}
            </ul>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Building size={15} className="text-slate-400" />คนตามหน่วยงาน</span>}
            action={seeAll(0)}
          >
            <div className="p-4">
              <Donut
                segments={byUnit}
                center={
                  <span>
                    <span className="block text-[26px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {filled.length}
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">คน</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><UserX size={15} className="text-slate-400" />ตำแหน่งว่าง</span>}
            action={seeAll(2)}
          >
            <div className="space-y-3 p-4">
              {vacant.length === 0 ? (
                <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกตำแหน่งมีผู้ดำรงอยู่ครบ</p>
              ) : (
                vacant.slice(0, 3).map((s) => {
                  const sw = levelSwatch(s.position.level);
                  const req = openRequisitionFor(s.position.id);
                  return (
                    <TintCard key={s.position.id} swatch={sw}>
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => onOpenSeat(s)} className="min-w-0 text-left">
                          <span className="block truncate text-[13.5px] font-semibold">{s.position.title}</span>
                          <span className="block text-[12px] opacity-75">{s.unit.name}</span>
                        </button>
                        <Tag swatch={sw}>{s.position.level}</Tag>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[11.5px] opacity-75">
                          {s.acting ? `รักษาการ ${s.acting.employee.name}` : req ? `${req.id} · ${req.status}` : "ยังไม่มีคำขออัตรากำลัง"}
                        </span>
                        <button
                          onClick={() => onSheet({ kind: "assign", positionId: s.position.id })}
                          className="rounded-lg bg-white/70 px-2.5 py-1 text-[11.5px] font-medium transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                        >
                          มอบหมาย
                        </button>
                      </div>
                    </TintCard>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Users size={15} className="text-slate-400" />อัตรากำลังรายหน่วยงาน</span>}
            subtitle="แถบเต็มคือครบตามแผน ส่วนที่ยังไม่เต็มคือจำนวนที่ต้องรับเพิ่ม"
            action={<span className="text-[11.5px] text-slate-400">มีอยู่ / ตามแผน</span>}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {units.map((u) => {
                const have = filled.filter((s) => s.unit.id === u.id).length;
                return (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="w-28 shrink-0 truncate text-[12.5px] text-slate-700 dark:text-slate-200">{u.name}</span>
                    <span className="flex-1"><Bar pct={fillPct(have, u.plannedHeadcount)} tone={have < u.plannedHeadcount ? "warn" : "ok"} width="w-full" /></span>
                    <span className="w-16 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                      {have}/{u.plannedHeadcount}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Award size={15} className="text-slate-400" />คุณสมบัติของผู้ดำรงตำแหน่ง</span>}
            action={seeAll(4)}
          >
            <div className="space-y-4 p-4">
              <Progress done={filled.length - gapRows.length} total={filled.length} label={`ครบคุณสมบัติ ${qualifiedShare}% ของผู้ดำรงตำแหน่ง`} />
              {gapRows.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-slate-400">ผู้ดำรงตำแหน่งทุกคนมีคุณสมบัติครบ</p>
              ) : (
                <ul className="space-y-2.5">
                  {gapRows.map((s) => (
                    <li key={s.position.id} className="flex items-start gap-3">
                      <Avatar name={s.holder!.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => onOpenSeat(s)}
                          className="block truncate text-left text-[13px] text-slate-900 hover:text-violet-700 dark:text-slate-50"
                        >
                          {s.holder!.name}
                        </button>
                        <span className="block truncate text-[11.5px] text-slate-400">{s.position.title}</span>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {s.gaps.map((g) => (
                            <span key={g} className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <Card
          title={<span className="flex items-center gap-2"><ClipboardList size={15} className="text-slate-400" />คำขออัตรากำลัง</span>}
          action={seeAll(3)}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {reqs.filter(isOpen).length === 0 && (
              <li className="py-8 text-center text-[12.5px] text-slate-400">ไม่มีคำขอที่เปิดอยู่</li>
            )}
            {reqs.filter(isOpen).map((r) => {
              const p = positionOf(r.positionId);
              const sw = levelSwatch(p.level);
              return (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={"mt-0.5 grid size-7 shrink-0 place-items-center rounded-full " + sw.tint}>
                    <UserPlus size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-slate-900 dark:text-slate-50">
                      <span className="font-medium">{p.title}</span>
                      <span className="text-slate-500 dark:text-slate-400"> · {unitOf(p.unitId).name}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">{r.reason}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={REQ_TONE[r.status]}>{r.status}</Badge>
                      <Chip>{r.id}</Chip>
                      <Chip>{r.kind}</Chip>
                      <Tag swatch={sw}>{p.level}</Tag>
                    </div>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="flex items-center gap-1 text-[11.5px] tabular-nums text-slate-400">
                      <CalendarClock size={12} /> ต้องการ {r.wantedBy}
                    </span>
                    {r.status === "รออนุมัติ" && <Decide r={r} onSheet={onSheet} />}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------- structure */

function Structure({
  seats,
  onOpenSeat,
  onSheet,
}: {
  seats: Seat[];
  onOpenSeat: (s: Seat) => void;
  onSheet: (s: OmSheet) => void;
}) {
  const [view, setView] = useState("สายบังคับบัญชา");
  const top = seats.filter((s) => s.position.reportsTo === null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={["สายบังคับบัญชา", "ตามหน่วยงาน"]} value={view} onChange={setView} />
        <span className="ml-auto flex items-center gap-3 text-[11.5px] text-slate-500 dark:text-slate-400">
          {LEVELS.map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <Dot className={levelSwatch(l).dot} />
              {l}
            </span>
          ))}
        </span>
      </div>

      {view === "สายบังคับบัญชา" ? (
        <Card title={<span className="flex items-center gap-2"><GitBranch size={15} className="text-slate-400" />{ROOT_UNIT.name}</span>}>
          <ul className="space-y-2 p-4">
            {top.map((s) => (
              <TreeNode key={s.position.id} seat={s} seats={seats} root onOpenSeat={onOpenSeat} onSheet={onSheet} />
            ))}
          </ul>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {ORG_UNITS.map((u) => {
            const own = seats.filter((s) => s.unit.id === u.id);
            const here = own.filter((s) => s.holder).length;
            const sw = unitSwatch(u.name);
            return (
              <Card
                key={u.id}
                title={
                  <span className="flex items-center gap-2">
                    <Dot className={sw.dot} />
                    {u.name}
                  </span>
                }
                subtitle={`${u.code} · ศูนย์ต้นทุน ${u.costCentre} · ${u.parentId === null ? "หน่วยงานสูงสุด" : "ขึ้นตรงต่อ" + unitOf(u.parentId).name}`}
                action={
                  <span className="flex items-center gap-1.5">
                    <Badge tone={here < u.plannedHeadcount ? "warn" : "ok"}>
                      {here}/{u.plannedHeadcount} อัตรา
                    </Badge>
                    {u.parentId !== null && (
                      <RowButton icon={<Pencil size={12} />} onClick={() => onSheet({ kind: "unit", id: u.id })}>แก้ไข/ย้าย</RowButton>
                    )}
                  </span>
                }
              >
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {own.map((s) => (
                    <li key={s.position.id} className="flex items-center gap-3 px-4 py-2.5">
                      {s.holder ? <Avatar name={s.holder.name} size="sm" /> : <VacantMark />}
                      <button onClick={() => onOpenSeat(s)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{s.position.title}</span>
                        <span className="block truncate text-[11.5px] text-slate-400">
                          {s.holder ? s.holder.name : "ยังไม่มีผู้ดำรงตำแหน่ง"}
                        </span>
                      </button>
                      <Tag swatch={levelSwatch(s.position.level)}>{s.position.level}</Tag>
                    </li>
                  ))}
                  <li className="px-4 py-2">
                    <button
                      onClick={() => onSheet({ kind: "position", id: null, unitId: u.id })}
                      className="flex items-center gap-1.5 text-[12px] text-violet-700 transition hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"
                    >
                      <Plus size={13} /> เพิ่มตำแหน่งใน{u.name}
                    </button>
                  </li>
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TreeNode({
  seat,
  seats,
  root,
  onOpenSeat,
  onSheet,
}: {
  seat: Seat;
  seats: Seat[];
  root?: boolean;
  onOpenSeat: (s: Seat) => void;
  onSheet: (s: OmSheet) => void;
}) {
  const kids = seats.filter((s) => s.position.reportsTo === seat.position.id);
  const sw = levelSwatch(seat.position.level);

  return (
    <li
      className={
        "relative " +
        (root
          ? ""
          : "before:absolute before:-left-5 before:top-7 before:h-px before:w-4 before:bg-slate-200 dark:before:bg-slate-800")
      }
    >
      <div
        className={
          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition " +
          (seat.holder
            ? "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            : "border border-dashed border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10")
        }
      >
        {seat.holder ? <Avatar name={seat.holder.name} /> : <VacantMark size="md" />}
        <button onClick={() => onOpenSeat(seat)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[13.5px] font-medium text-slate-900 dark:text-slate-50">
            {seat.position.title}
          </span>
          <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">
            {seat.holder ? seat.holder.name : seat.acting ? `ว่าง · รักษาการ ${seat.acting.employee.name}` : "ยังไม่มีผู้ดำรงตำแหน่ง"}
            {seat.direct > 0 && <span className="text-slate-400"> · ดูแล {seat.staff} คน</span>}
          </span>
        </button>
        <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <Dot className={unitSwatch(seat.unit.name).dot} />
          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{seat.unit.name}</span>
        </span>
        <Tag swatch={sw}>{seat.position.level}</Tag>
        {!seat.holder && (
          <button
            onClick={() => onSheet({ kind: "assign", positionId: seat.position.id })}
            className="shrink-0 rounded-lg border border-amber-300 px-2.5 py-1 text-[11.5px] text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/20"
          >
            มอบหมาย
          </button>
        )}
      </div>

      {kids.length > 0 && (
        <ul className="ml-6 mt-2 space-y-2 border-l border-slate-200 pl-5 dark:border-slate-800">
          {kids.map((k) => (
            <TreeNode key={k.position.id} seat={k} seats={seats} onOpenSeat={onOpenSeat} onSheet={onSheet} />
          ))}
        </ul>
      )}
    </li>
  );
}

function VacantMark({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={
        "grid shrink-0 place-items-center rounded-full border border-dashed border-amber-400 text-amber-500 dark:border-amber-500/50 dark:text-amber-400 " +
        (size === "md" ? "size-10" : "size-8")
      }
    >
      <UserRound size={size === "md" ? 17 : 14} />
    </span>
  );
}

/* --------------------------------------------------------------- tables */

const unitOptions = () => ["ทุกหน่วยงาน", ...departments()];
const levelOptions = ["ทุกระดับ", ...LEVELS];

function SeatRegister({
  rows,
  q,
  setQ,
  unitFilter,
  setUnitFilter,
  levelFilter,
  setLevelFilter,
  onOpen,
}: {
  rows: Seat[];
  q: string;
  setQ: (v: string) => void;
  unitFilter: string;
  setUnitFilter: (v: string) => void;
  levelFilter: string;
  setLevelFilter: (v: string) => void;
  onOpen: (s: Seat) => void;
}) {
  const columns: Column<Seat>[] = [
    {
      key: "title",
      header: "ตำแหน่ง",
      width: "18%",
      sort: (a, b) => a.position.title.localeCompare(b.position.title, "th"),
      cell: (s) => (
        <span>
          <span className="block font-medium text-slate-900 dark:text-slate-50">{s.position.title}</span>
          <span className="block font-mono text-[11px] text-slate-400">{s.position.code}</span>
        </span>
      ),
    },
    {
      key: "unit",
      header: "หน่วยงาน",
      width: "14%",
      sort: (a, b) => a.unit.name.localeCompare(b.unit.name, "th"),
      cell: (s) => (
        <span className="flex items-center gap-1.5">
          <Dot className={unitSwatch(s.unit.name).dot} />
          <span className="text-slate-600 dark:text-slate-300">{s.unit.name}</span>
        </span>
      ),
    },
    {
      key: "level",
      header: "ระดับ",
      sort: (a, b) => LEVELS.indexOf(a.position.level) - LEVELS.indexOf(b.position.level),
      cell: (s) => <Tag swatch={levelSwatch(s.position.level)}>{s.position.level}</Tag>,
    },
    {
      key: "duties",
      header: "หน้าที่หลัก",
      width: "28%",
      cell: (s) => (
        <span className="line-clamp-1 text-slate-600 dark:text-slate-300">{s.position.duties[0]}</span>
      ),
    },
    {
      key: "reportsTo",
      header: "รายงานต่อ",
      width: "16%",
      cell: (s) => (
        <span className="line-clamp-1 text-slate-500 dark:text-slate-400">
          {s.position.reportsTo === null ? "—" : positionOf(s.position.reportsTo).title}
        </span>
      ),
    },
    {
      key: "band",
      header: "กรอบเงินเดือน",
      align: "right",
      width: "15%",
      sort: (a, b) => bandOf(a.position).min - bandOf(b.position).min,
      cell: (s) => (
        <span className="tabular-nums text-slate-600 dark:text-slate-300">
          {bandOf(s.position).min.toLocaleString("th-TH")}–{bandOf(s.position).max.toLocaleString("th-TH")}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(s) => s.position.id}
      onOpen={onOpen}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Search value={q} onChange={setQ} placeholder="ค้นหาตำแหน่ง รหัส หรือหน่วยงาน" icon={<SearchIcon size={14} />} />
          <Select value={unitFilter} onChange={setUnitFilter} options={unitOptions()} />
          <Select value={levelFilter} onChange={setLevelFilter} options={levelOptions} />
          <span className="ml-auto text-[12px] text-slate-400">แสดง {rows.length} ตำแหน่ง</span>
        </div>
      }
    />
  );
}

function Assignments({
  rows,
  q,
  setQ,
  unitFilter,
  setUnitFilter,
  onOpen,
  onSheet,
}: {
  rows: Seat[];
  q: string;
  setQ: (v: string) => void;
  unitFilter: string;
  setUnitFilter: (v: string) => void;
  onOpen: (s: Seat) => void;
  onSheet: (s: OmSheet) => void;
}) {
  const columns: Column<Seat>[] = [
    {
      key: "title",
      header: "ตำแหน่ง",
      sort: (a, b) => a.position.title.localeCompare(b.position.title, "th"),
      cell: (s) => (
        <span>
          <span className="block font-medium text-slate-900 dark:text-slate-50">{s.position.title}</span>
          <span className="block text-[11.5px] text-slate-400">{s.unit.name}</span>
        </span>
      ),
    },
    {
      key: "holder",
      header: "ผู้ดำรงตำแหน่ง",
      sort: (a, b) => (a.holder?.name ?? "").localeCompare(b.holder?.name ?? "", "th"),
      cell: (s) =>
        s.holder ? (
          <span className="flex items-center gap-2.5">
            <Avatar name={s.holder.name} size="sm" />
            <span>
              <span className="block text-slate-900 dark:text-slate-50">{s.holder.name}</span>
              <span className="block font-mono text-[11px] text-slate-400">{s.holder.code}</span>
            </span>
          </span>
        ) : s.acting ? (
          <span className="flex flex-col items-start gap-1">
            <Badge tone="warn">ว่าง</Badge>
            <span className="text-[11.5px] text-slate-500 dark:text-slate-400">รักษาการ {s.acting.employee.name} ถึง {s.acting.until}</span>
          </span>
        ) : (
          <Badge tone="warn">ยังไม่มีผู้ดำรงตำแหน่ง</Badge>
        ),
    },
    {
      key: "since",
      header: "เริ่มงาน",
      cell: (s) => <span className="tabular-nums text-slate-500 dark:text-slate-400">{s.holder?.contract.startedAt ?? "—"}</span>,
    },
    {
      key: "standing",
      header: "เทียบกรอบค่าตอบแทน",
      cell: (s) => {
        if (!s.holder) return <span className="text-slate-400">—</span>;
        const st = bandStanding(s.position, s.holder.contract.baseSalary);
        return <Badge tone={st === "อยู่ในกรอบ" ? "ok" : "warn"}>{st}</Badge>;
      },
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(s) => s.position.id}
      onOpen={onOpen}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Search value={q} onChange={setQ} placeholder="ค้นหาตำแหน่งหรือชื่อผู้ดำรง" icon={<SearchIcon size={14} />} />
          <Select value={unitFilter} onChange={setUnitFilter} options={unitOptions()} />
          <span className="ml-auto text-[12px] text-slate-400">
            มีผู้ดำรง {rows.filter((s) => s.holder).length} จาก {rows.length} ตำแหน่ง
          </span>
        </div>
      }
      trailing={(s) => (
        <span className="flex items-center justify-end gap-1">
          {!s.holder && !s.acting && (
            <button
              onClick={() => onSheet({ kind: "acting", positionId: s.position.id })}
              title="มอบหมายรักษาการ"
              aria-label="มอบหมายรักษาการ"
              className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/15 dark:hover:text-amber-300"
            >
              <UserCog size={16} />
            </button>
          )}
          <button
            onClick={() => onSheet({ kind: "assign", positionId: s.position.id })}
            title={s.holder ? "เปลี่ยนผู้ดำรงตำแหน่ง" : "มอบหมายผู้ดำรงตำแหน่ง"}
            aria-label={s.holder ? "เปลี่ยนผู้ดำรงตำแหน่ง" : "มอบหมายผู้ดำรงตำแหน่ง"}
            className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
          >
            <UserPlus size={16} />
          </button>
          {s.holder && (
            <button
              onClick={() => onSheet({ kind: "release", positionId: s.position.id })}
              title="ปลดออกจากตำแหน่ง"
              aria-label="ปลดออกจากตำแหน่ง"
              className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
            >
              <UserX size={16} />
            </button>
          )}
        </span>
      )}
    />
  );
}

/* -------------------------------------------------------------- planning */

function Planning({
  seats,
  reqs,
  seatOf,
  onOpenSeat,
  onSheet,
}: {
  seats: Seat[];
  reqs: Requisition[];
  seatOf: (id: number) => Seat;
  onOpenSeat: (s: Seat) => void;
  onSheet: (s: OmSheet) => void;
}) {
  const units = ORG_UNITS;
  const filled = seats.filter((s) => s.holder);
  const shortfall = units.reduce(
    (n, u) => n + Math.max(0, u.plannedHeadcount - filled.filter((s) => s.unit.id === u.id).length),
    0
  );

  return (
    <div className="space-y-3">
      <StatStrip
        title="สรุปอัตรากำลัง"
        icon={<Target size={15} />}
        cells={[
          {
            icon: <Users size={13} />,
            label: "มีอยู่จริง",
            value: filled.length,
            sub: `จากตำแหน่งที่เปิดไว้ ${seats.length} ตำแหน่ง`,
          },
          {
            icon: <Layers size={13} />,
            label: "ตามแผน",
            value: units.reduce((n, u) => n + u.plannedHeadcount, 0),
            sub: "รวมทุกหน่วยงานและตำแหน่งบริหาร",
            tone: "info",
          },
          {
            icon: <UserPlus size={13} />,
            label: "ต้องรับเพิ่ม",
            value: shortfall,
            sub: shortfall > 0 ? "กระจายอยู่ในหลายหน่วยงาน" : "ครบตามแผนทุกหน่วยงาน",
            tone: shortfall > 0 ? "warn" : "ok",
          },
          {
            icon: <ClipboardList size={13} />,
            label: "คำขอที่เปิดอยู่",
            value: reqs.filter(isOpen).length,
            sub: `รออนุมัติ ${reqs.filter((r) => r.status === "รออนุมัติ").length} รายการ`,
            tone: "accent",
          },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Building size={15} className="text-slate-400" />อัตรากำลังรายหน่วยงาน</span>}
        subtitle="เทียบคนที่มีอยู่จริงกับอัตราที่วางแผนไว้ ส่วนที่ขาดคือจำนวนที่ต้องเปิดคำขอ"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">หน่วยงาน</th>
              <th className="px-4 py-3 font-medium">ศูนย์ต้นทุน</th>
              <th className="px-4 py-3 font-medium">ความคืบหน้า</th>
              <th className="px-4 py-3 text-right font-medium">มีอยู่</th>
              <th className="px-4 py-3 text-right font-medium">ตามแผน</th>
              <th className="px-4 py-3 text-right font-medium">ต้องรับเพิ่ม</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {units.map((u) => {
              const have = filled.filter((s) => s.unit.id === u.id).length;
              const gap = u.plannedHeadcount - have;
              return (
                <tr key={u.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <Dot className={unitSwatch(u.name).dot} />
                      <span className="font-medium text-slate-900 dark:text-slate-50">{u.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-slate-400">{u.costCentre}</td>
                  <td className="px-4 py-3"><Bar pct={fillPct(have, u.plannedHeadcount)} tone={gap > 0 ? "warn" : "ok"} width="w-32" /></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{have}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{u.plannedHeadcount}</td>
                  <td className={"px-4 py-3 text-right font-semibold tabular-nums " + (gap > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-300 dark:text-slate-600")}>
                    {gap > 0 ? "+" + gap : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowButton icon={<Pencil size={12} />} onClick={() => onSheet({ kind: "planned", unitId: u.id })}>แก้แผน</RowButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><ClipboardList size={15} className="text-slate-400" />คำขออัตรากำลัง</span>}
        subtitle="อนุมัติ → เริ่มสรรหา → มอบหมายผู้ดำรงตำแหน่ง แล้วคำขอปิดเอง"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {reqs.map((r) => {
            const seat = seatOf(r.positionId);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-32 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.id}</span>
                <button onClick={() => onOpenSeat(seat)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">{seat.position.title}</span>
                  <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{r.reason}</span>
                </button>
                <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                  {r.kind} · {isOpen(r) ? `เปิดมา ${daysSince(r.openedAt)} วัน · ` : ""}ต้องการ {r.wantedBy}
                </span>
                <Badge tone={REQ_TONE[r.status]}>{r.status}</Badge>
                {r.status === "รออนุมัติ" && <Decide r={r} onSheet={onSheet} />}
                {r.status === "อนุมัติแล้ว" && (
                  <RowButton
                    onClick={() => {
                      startRecruiting(r.id);
                      notify(`เริ่มสรรหา${seat.position.title}ตามคำขอ ${r.id} แล้ว`);
                    }}
                  >
                    เริ่มสรรหา
                  </RowButton>
                )}
                {(r.status === "อนุมัติแล้ว" || r.status === "กำลังสรรหา") && !seat.holder && (
                  <RowButton tone="go" onClick={() => onSheet({ kind: "assign", positionId: seat.position.id })}>มอบหมาย</RowButton>
                )}
                {r.status === "ปิดแล้ว" && (
                  <Badge tone="ok" icon={<CircleCheck size={11} />}>มอบหมายแล้ว{seat.holder ? ` · ${seat.holder.name}` : ""}</Badge>
                )}
                {r.status === "ไม่อนุมัติ" && r.decisionNote && (
                  <span className="w-full pl-[8.75rem] text-[11.5px] text-slate-400">เหตุผล: {r.decisionNote}</span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------- qualifications */

function Qualifications({
  seats,
  onOpenSeat,
  onSheet,
}: {
  seats: Seat[];
  onOpenSeat: (s: Seat) => void;
  onSheet: (s: OmSheet) => void;
}) {
  const [only, setOnly] = useState("ทั้งหมด");
  const shown = seats.filter((s) =>
    only === "ทั้งหมด" ? true : only === "ขาดคุณสมบัติ" ? s.gaps.length > 0 && s.holder : !s.holder
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={["ทั้งหมด", "ขาดคุณสมบัติ", "ตำแหน่งว่าง"]}
          value={only}
          onChange={setOnly}
          counts={{
            ทั้งหมด: seats.length,
            ขาดคุณสมบัติ: seats.filter((s) => s.holder && s.gaps.length > 0).length,
            ตำแหน่งว่าง: seats.filter((s) => !s.holder).length,
          }}
        />
        <span className="ml-auto text-[12px] text-slate-400">
          คุณสมบัติที่ขีดฆ่าคือข้อที่ผู้ดำรงตำแหน่งยังไม่มี คลิกเมื่ออบรมหรือได้ใบรับรองแล้ว
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((s) => {
          const has = s.holder ? skillsOf(s.holder.id) : [];
          const met = s.position.qualifications.length - s.gaps.length;
          return (
            <Card
              key={s.position.id}
              title={
                <button onClick={() => onOpenSeat(s)} className="text-left transition hover:text-violet-700">
                  {s.position.title}
                </button>
              }
              subtitle={s.holder ? `${s.holder.name} · ${s.unit.name}` : `ยังไม่มีผู้ดำรงตำแหน่ง · ${s.unit.name}`}
              action={
                <span className="flex items-center gap-1.5">
                  {s.holder ? (
                    <Badge tone={s.gaps.length === 0 ? "ok" : "warn"}>
                      {s.gaps.length === 0 ? "คุณสมบัติครบ" : `ขาด ${s.gaps.length} ข้อ`}
                    </Badge>
                  ) : (
                    <Badge tone="idle">รอมอบหมาย</Badge>
                  )}
                  <RowButton icon={<Pencil size={12} />} onClick={() => onSheet({ kind: "quals", positionId: s.position.id })}>แก้ไข</RowButton>
                </span>
              }
            >
              <div className="space-y-3 p-4">
                <Progress done={met} total={s.position.qualifications.length} label={`ตรงตามคุณสมบัติ ${met} จาก ${s.position.qualifications.length} ข้อ`} />
                <ul className="flex flex-wrap gap-1.5">
                  {s.position.qualifications.map((qual) => {
                    const ok = has.includes(qual);
                    const skin =
                      "rounded-full px-2.5 py-1 text-[11.5px] " +
                      (ok
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400");
                    return (
                      <li key={qual}>
                        {s.holder && !ok ? (
                          <button
                            title="บันทึกว่าผู้ดำรงตำแหน่งมีคุณสมบัตินี้แล้ว"
                            onClick={() => {
                              grantSkill(s.holder!.id, qual);
                              notify(`บันทึกว่า ${s.holder!.name} มี “${qual}” แล้ว`);
                            }}
                            className={skin + " transition hover:bg-emerald-50 hover:text-emerald-700 hover:no-underline dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"}
                          >
                            {qual}
                          </button>
                        ) : (
                          <span className={skin + " inline-block"}>{qual}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {s.holder && has.filter((x) => !s.position.qualifications.includes(x)).length > 0 && (
                  <p className="text-[11.5px] text-slate-400">
                    มีเพิ่มเติม: {has.filter((x) => !s.position.qualifications.includes(x)).join(" · ")}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- reports */

function Reports({ seats, plannedTotal }: { seats: Seat[]; plannedTotal: number }) {
  const filled = seats.filter((s) => s.holder);
  const managers = seats.filter((s) => s.direct > 0);
  const span = managers.length ? filled.length / managers.length : 0;
  const offBand = filled.filter((s) => bandStanding(s.position, s.holder!.contract.baseSalary) !== "อยู่ในกรอบ");
  const payroll = filled.reduce((n, s) => n + s.holder!.contract.baseSalary, 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="ตัวเลขรวมขององค์กร"
        icon={<TrendingUp size={15} />}
        cells={[
          { icon: <Users size={13} />, label: "พนักงานทั้งหมด", value: filled.length + " คน", sub: `จากแผน ${plannedTotal} อัตรา` },
          { icon: <Briefcase size={13} />, label: "ตำแหน่งที่เปิดไว้", value: seats.length, sub: `ว่าง ${seats.length - filled.length} ตำแหน่ง`, tone: "warn" },
          { icon: <Network size={13} />, label: "ช่วงการบังคับบัญชา", value: span.toFixed(1), sub: `คนต่อหนึ่งตำแหน่งหัวหน้า จากทั้งหมด ${managers.length} ตำแหน่ง`, tone: "info" },
          { icon: <Banknote size={13} />, label: "ฐานเงินเดือนรวม", value: baht(payroll), sub: "ต่อเดือน ก่อนค่าล่วงเวลาและสวัสดิการ", tone: "accent" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />ตำแหน่งตามระดับ</span>}
          subtitle="รูปทรงขององค์กร ระดับปฏิบัติการควรกว้างกว่าระดับบริหาร"
        >
          <ColumnChart
            data={LEVELS.map((l) => ({
              label: l,
              value: seats.filter((s) => s.position.level === l).length,
            }))}
            format={(n) => n + " ตำแหน่ง"}
            height={170}
          />
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Network size={15} className="text-slate-400" />ทีมที่แต่ละหัวหน้าดูแล</span>}
          subtitle="นับทั้งผู้ใต้บังคับบัญชาโดยตรงและที่อยู่ลึกลงไป"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {managers.map((s) => (
              <li key={s.position.id} className="flex items-center gap-3 px-4 py-2.5">
                {s.holder ? <Avatar name={s.holder.name} size="sm" /> : <VacantMark />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{s.position.title}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">{s.holder?.name ?? "ยังไม่มีผู้ดำรงตำแหน่ง"}</span>
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
                  ตรง {s.direct} · ทั้งหมด {s.team}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Scale size={15} className="text-slate-400" />เงินเดือนเทียบกรอบของระดับ</span>}
        subtitle="เงินเดือนอ่านจากทะเบียนพนักงาน กรอบมาจากการจัดระดับตำแหน่งในโมดูลนี้"
      >
        {offBand.length > 0 && (
          <div className="px-4 pt-4">
            <Note tone="warn">
              มี {offBand.length} ตำแหน่งที่เงินเดือนอยู่นอกกรอบของระดับ ควรทบทวนการจัดระดับหรือปรับค่าตอบแทนให้สอดคล้องกัน
            </Note>
          </div>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {filled.map((s) => {
            const b = bandOf(s.position);
            const salary = s.holder!.contract.baseSalary;
            const st = bandStanding(s.position, salary);
            const pct = ((salary - b.min) / (b.max - b.min)) * 100;
            return (
              <li key={s.position.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-40 shrink-0 truncate text-[13px] text-slate-800 dark:text-slate-100">{s.position.title}</span>
                <Tag swatch={levelSwatch(s.position.level)}>{s.position.level}</Tag>
                <span className="min-w-0 flex-1">
                  <Bar pct={Math.max(0, Math.min(100, pct))} tone={st === "อยู่ในกรอบ" ? "ok" : "warn"} width="w-full" />
                </span>
                <span className="w-44 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                  {salary.toLocaleString("th-TH")} ในกรอบ {b.min.toLocaleString("th-TH")}–{b.max.toLocaleString("th-TH")}
                </span>
                <Badge tone={st === "อยู่ในกรอบ" ? "ok" : "warn"}>{st}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- record */

function SeatRecord({
  seat,
  seatOf,
  onSheet,
}: {
  seat: Seat;
  seatOf: (id: number) => Seat;
  onSheet: (s: OmSheet) => void;
}) {
  const request = openRequisitionFor(seat.position.id);
  const [tab, setTab] = useState(SEAT_TABS[0]);
  const b = bandOf(seat.position);
  const sw = levelSwatch(seat.position.level);

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 dark:border-slate-800">
        {seat.holder ? <Avatar name={seat.holder.name} size="xl" /> : <VacantMark size="md" />}
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{seat.position.title}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {seat.position.code} · {seat.unit.name} · ศูนย์ต้นทุน {seat.unit.costCentre}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag swatch={sw}>{seat.position.level}</Tag>
            {seat.holder ? (
              <Badge tone="ok" icon={<Contact size={11} />}>{seat.holder.name}</Badge>
            ) : (
              <Badge tone="warn" icon={<UserX size={11} />}>ยังไม่มีผู้ดำรงตำแหน่ง</Badge>
            )}
            {seat.acting && <Chip>รักษาการ {seat.acting.employee.name} ถึง {seat.acting.until}</Chip>}
            {request && <Chip>{request.id} · {request.status}</Chip>}
            {seat.direct > 0 && <Chip>ดูแล {seat.staff} คน</Chip>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" icon={<UserPlus size={14} />} onClick={() => onSheet({ kind: "assign", positionId: seat.position.id })}>
              {seat.holder ? "เปลี่ยนผู้ดำรงตำแหน่ง" : "มอบหมายผู้ดำรงตำแหน่ง"}
            </Button>
            <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => onSheet({ kind: "position", id: seat.position.id })}>
              แก้ไขตำแหน่ง
            </Button>
            {!seat.holder && !seat.acting && (
              <Button variant="secondary" icon={<UserCog size={14} />} onClick={() => onSheet({ kind: "acting", positionId: seat.position.id })}>
                มอบหมายรักษาการ
              </Button>
            )}
            {seat.acting && (
              <Button
                variant="secondary"
                icon={<UserX size={14} />}
                onClick={() => {
                  endActing(seat.position.id);
                  notify(`สิ้นสุดการรักษาการ${seat.position.title}ของ ${seat.acting!.employee.name} แล้ว`);
                }}
              >
                สิ้นสุดรักษาการ
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<ClipboardList size={14} />}
              onClick={() =>
                onSheet({
                  kind: "requisition",
                  positionId: seat.position.id,
                  reqKind: seat.holder || request ? "อัตราเพิ่ม" : "ตำแหน่งว่าง",
                })
              }
            >
              {seat.holder || request ? "ขออัตราเพิ่ม" : "เปิดคำขออัตรากำลัง"}
            </Button>
            {seat.holder && (
              <Button variant="danger" icon={<UserX size={14} />} onClick={() => onSheet({ kind: "release", positionId: seat.position.id })}>
                ปลดออกจากตำแหน่ง
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-5">
        <Tabs tabs={SEAT_TABS} active={tab} onPick={setTab} icons={SEAT_TAB_ICONS} id="seat" />
      </div>

      <div className="px-5 py-4">
        {tab === "หน้าที่งาน" && (
          <ol className="space-y-2">
            {seat.position.duties.map((d, i) => (
              <li key={d} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/50">
                <span className="grid size-5 shrink-0 place-items-center rounded bg-white text-[11px] tabular-nums text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {i + 1}
                </span>
                <span className="text-[13px] text-slate-800 dark:text-slate-100">{d}</span>
              </li>
            ))}
          </ol>
        )}

        {tab === "คุณสมบัติ" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <RowButton icon={<Pencil size={12} />} onClick={() => onSheet({ kind: "quals", positionId: seat.position.id })}>แก้ไขคุณสมบัติ</RowButton>
            </div>
            <Progress
              done={seat.position.qualifications.length - seat.gaps.length}
              total={seat.position.qualifications.length}
              label="คุณสมบัติที่ผู้ดำรงตำแหน่งมีครบ"
            />
            <ul className="space-y-1.5">
              {seat.position.qualifications.map((qual) => {
                const ok = seat.holder ? skillsOf(seat.holder.id).includes(qual) : false;
                return (
                  <li key={qual} className="flex items-center gap-2.5 text-[13px]">
                    <span className={ok ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}>
                      {ok ? <CircleCheck size={15} /> : <ShieldCheck size={15} />}
                    </span>
                    <span className={ok ? "text-slate-800 dark:text-slate-100" : "text-slate-400 line-through"}>{qual}</span>
                    {seat.holder && !ok && (
                      <RowButton
                        onClick={() => {
                          grantSkill(seat.holder!.id, qual);
                          notify(`บันทึกว่า ${seat.holder!.name} มี “${qual}” แล้ว`);
                        }}
                      >
                        มีแล้ว
                      </RowButton>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {tab === "กรอบค่าตอบแทน" && (
          <div className="space-y-3">
            <IconRow icon={<Layers size={14} />} label="ระดับตำแหน่ง">{seat.position.level}</IconRow>
            <IconRow icon={<Banknote size={14} />} label="กรอบของระดับ">
              {b.min.toLocaleString("th-TH")} – {b.max.toLocaleString("th-TH")} บาท/เดือน
            </IconRow>
            {seat.holder ? (
              <>
                <IconRow icon={<Contact size={14} />} label="เงินเดือนปัจจุบัน">
                  {baht(seat.holder.contract.baseSalary)}
                </IconRow>
                <div className="pt-1">
                  <Bar
                    pct={Math.max(0, Math.min(100, ((seat.holder.contract.baseSalary - b.min) / (b.max - b.min)) * 100))}
                    tone={bandStanding(seat.position, seat.holder.contract.baseSalary) === "อยู่ในกรอบ" ? "ok" : "warn"}
                    width="w-full"
                  />
                </div>
                <Note tone={bandStanding(seat.position, seat.holder.contract.baseSalary) === "อยู่ในกรอบ" ? "ok" : "warn"}>
                  {bandStanding(seat.position, seat.holder.contract.baseSalary) === "อยู่ในกรอบ"
                    ? "เงินเดือนอยู่ในกรอบของระดับนี้"
                    : `เงินเดือน${bandStanding(seat.position, seat.holder.contract.baseSalary)}ของระดับ ควรทบทวนการจัดระดับหรือปรับค่าตอบแทน`}
                </Note>
              </>
            ) : (
              <Note tone="idle">ยังไม่มีผู้ดำรงตำแหน่ง จึงยังไม่มีเงินเดือนให้เทียบกับกรอบ</Note>
            )}
          </div>
        )}

        {tab === "สายบังคับบัญชา" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">รายงานขึ้นไปถึง</p>
              {chainAbove(seat.position.id).length === 0 ? (
                <p className="text-[13px] text-slate-400">ตำแหน่งนี้อยู่บนสุดของผัง</p>
              ) : (
                <ol className="space-y-1.5">
                  {chainAbove(seat.position.id).map((p) => {
                    const up = seatOf(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-2.5 text-[13px]">
                        <ChevronRight size={14} className="shrink-0 text-slate-300" />
                        <span className="text-slate-800 dark:text-slate-100">{p.title}</span>
                        <span className="text-slate-400">{up.holder?.name ?? "ว่าง"}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ผู้ใต้บังคับบัญชาโดยตรง</p>
              {directReports(seat.position.id).length === 0 ? (
                <p className="text-[13px] text-slate-400">ไม่มีผู้ใต้บังคับบัญชา</p>
              ) : (
                <ul className="space-y-1.5">
                  {directReports(seat.position.id).map((p) => {
                    const down = seatOf(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-2.5 text-[13px]">
                        {down.holder ? <Avatar name={down.holder.name} size="sm" /> : <VacantMark />}
                        <span className="text-slate-800 dark:text-slate-100">{p.title}</span>
                        <span className="text-slate-400">{down.holder?.name ?? "ว่าง"}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
