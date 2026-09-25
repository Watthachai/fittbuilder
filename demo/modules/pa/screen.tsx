import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight, Banknote, Bell, Briefcase, Building, Cake, CalendarClock, CalendarDays, CircleCheck, CircleDashed,
  CircleX, Clock3, Contact, CreditCard, Download, Ellipsis, FileText, Gift, Heart, Hourglass, IdCard, Landmark, Mail,
  MapPin, MessageSquare, Pencil, Phone, PiggyBank, Plus, Printer, ScanFace, Search as SearchIcon, Send, ShieldCheck,
  Stamp, TrendingUp, UserMinus, UserPlus, UserRound, Users, Wallet,
} from "lucide-react";
import {
  ACTIVITY, EMPLOYEES, GENDER, PERSONNEL_ACTIONS, PROBATION_DAYS, TODAY, actionsOf, addNote, ageOf, baht, daysBetween,
  departments, documentsOf, headcountTrend, hiredIn, isFixedTerm, leftIn, pendingActions, remindDocuments,
  setDocumentReceived, ssoContribution, tenureYears, thaiDate, upcoming,
} from "./data";
import type { ActivityEntry, Employee, PersonnelAction } from "./data";
import {
  Avatar, Badge, Button, Card, Chip, ColumnChart, Donut, Dot, Gauge, IconButton, IconRow, Note,
  PageHead, Progress, Reveal, Search, SectionTitle, Segmented, Select, StatStrip, Stepper, SURFACE, Tabs,
  Tag, Timeline, TintCard, ViewToggle, WeekStrip, enter, swatchFor,
} from "../ui";
import { DataTable, DetailModal, downloadCsv, money, notify, useData } from "../kit";
import type { Column } from "../kit";
import { PaSheets } from "./actions";
import type { Sheet } from "./actions";
import { ACTION_TONE, GenderMark, RowButton, StatusBadge, actionSummary, deptSwatch } from "./parts";

const TABS = [
  "ข้อมูลส่วนตัว",
  "ข้อมูลสัญญาจ้าง",
  "ข้อมูลทางปกครอง",
  "เหตุการณ์ทางบุคคล",
  "ค่าตอบแทนและสวัสดิการ",
];

/** The record's own tabs: the five capabilities plus the log of who did what to it. */
const RECORD_TABS = [...TABS, "กิจกรรม"];

const STATUSES = ["ทั้งหมด", "ทำงานอยู่", "ทดลองงาน", "ลาออก"] as const;

const STEP_ICONS = {
  done: <CircleCheck size={15} />,
  current: <CircleDashed size={15} className="animate-[spin_3s_linear_infinite]" />,
  todo: <CircleDashed size={15} />,
  failed: <CircleX size={15} />,
};

const TAB_ICONS: Record<string, ReactNode> = {
  "ข้อมูลส่วนตัว": <UserRound size={14} />,
  "ข้อมูลสัญญาจ้าง": <FileText size={14} />,
  "ข้อมูลทางปกครอง": <ShieldCheck size={14} />,
  "เหตุการณ์ทางบุคคล": <CalendarClock size={14} />,
  "ค่าตอบแทนและสวัสดิการ": <Wallet size={14} />,
  "กิจกรรม": <Clock3 size={14} />,
};

/**
 * Colour keys. Departments take theirs from catalogue order (parts.tsx); event
 * kinds are ordered by hand so the alarming ones land on the alarming colours.
 */
const EVENT_ORDER = ["ปรับเงินเดือน", "ย้ายแผนก", "รับเข้าทำงาน", "ต่อสัญญา", "ลาออก", "เลื่อนตำแหน่ง", "ผ่านทดลองงาน", "ตักเตือน"];
const eventSwatch = (type: string) => swatchFor(type, EVENT_ORDER);
const KIND_ORDER = ["ครบรอบการทำงาน", "", "", "ครบกำหนดทดลองงาน", "สัญญาหมดอายุ"];
const kindSwatch = (kind: string) => swatchFor(kind, KIND_ORDER);

/* ----------------------------------------------------------------- screen */

export default function PaScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  /** The host's way of moving to a capability, so "ดูทั้งหมด" can point somewhere. */
  onOpenSection?: (index: number) => void;
}) {
  // Every screen that reads the register redraws when any record changes.
  useData();

  // The section chosen in the navigation decides which columns the register
  // shows and which part of a record opens first. Without one, the overview.
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ทั้งหมด");
  const [dept, setDept] = useState("ทุกแผนก");
  const [view, setView] = useState<"list" | "grid">("list");
  // The open record is held by id, so a change that moves it out of the current
  // filter (someone leaves while "ทำงานอยู่" is showing) does not swap the person.
  const [openId, setOpenId] = useState<number | null>(null);
  const [favourites, setFavourites] = useState<number[]>([1]);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const people = EMPLOYEES;
  const rows = people.filter(
    (e) =>
      (status === "ทั้งหมด" || e.status === status) &&
      (dept === "ทุกแผนก" || e.department === dept) &&
      (q.trim() === "" ||
        [e.name, e.nickname, e.code, e.position].some((t) => t.toLowerCase().includes(q.trim().toLowerCase())))
  );
  const picked = openId === null ? null : (people.find((e) => e.id === openId) ?? null);
  const at = picked ? rows.indexOf(picked) : -1;

  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, s === "ทั้งหมด" ? people.length : people.filter((e) => e.status === s).length])
  );

  const toggleFavourite = (id: number) =>
    setFavourites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const sheets = <PaSheets sheet={sheet} onSheet={setSheet} onHired={(e) => setOpenId(e.id)} />;

  /* ------------------------------------------------------------ figures */
  const active = people.filter((e) => e.status !== "ลาออก");
  const probation = active.filter((e) => e.status === "ทดลองงาน");
  const expiring = active.filter(
    (e) => e.contract.endsAt && daysBetween(TODAY, e.contract.endsAt) <= 90 && daysBetween(TODAY, e.contract.endsAt) >= 0
  );
  const left = people.filter((e) => e.status === "ลาออก");
  const year = TODAY.slice(0, 4);
  const hires = hiredIn(year);
  const leavers = leftIn(year).length;
  const avgTenure = active.length ? active.reduce((n, e) => n + tenureYears(e), 0) / active.length : 0;
  const soonest = expiring.map((e) => daysBetween(TODAY, e.contract.endsAt!)).sort((a, b) => a - b)[0];

  const index = (
    <div hidden data-fitt-index>
      <button data-fitt-screen="ทะเบียนพนักงาน" />
      <button data-fitt-screen="แฟ้มประวัติพนักงาน" data-fitt-modal onClick={() => setOpenId(people[0].id)} />
      <button data-fitt-screen="เพิ่มพนักงานใหม่" data-fitt-modal onClick={() => setSheet({ kind: "hire" })} />
      <button data-fitt-screen="แก้ไขข้อมูลส่วนตัว" data-fitt-modal onClick={() => setSheet({ kind: "personal", id: people[0].id })} />
      <button data-fitt-screen="แก้ไขเงื่อนไขการจ้าง" data-fitt-modal onClick={() => setSheet({ kind: "contract", id: active[0].id })} />
      <button
        data-fitt-screen="ต่อสัญญาจ้าง"
        data-fitt-modal
        onClick={() => {
          const e = active.find((x) => x.contract.endsAt && isFixedTerm(x.contract.type));
          if (e) setSheet({ kind: "renew", id: e.id });
        }}
      />
      <button
        data-fitt-screen="ผ่านการทดลองงาน"
        data-fitt-modal
        onClick={() => {
          if (probation[0]) setSheet({ kind: "probation", id: probation[0].id });
        }}
      />
      <button data-fitt-screen="แก้ไขข้อมูลทางปกครอง" data-fitt-modal onClick={() => setSheet({ kind: "admin", id: active[0].id })} />
      <button data-fitt-screen="ลงทะเบียนสวัสดิการ" data-fitt-modal onClick={() => setSheet({ kind: "benefits", id: active[0].id })} />
      <button data-fitt-screen="ขอเปลี่ยนแปลงทางบุคคล" data-fitt-modal onClick={() => setSheet({ kind: "action", id: null, preset: "ย้ายแผนก" })} />
      <button data-fitt-screen="ปรับเงินเดือนประจำปี" data-fitt-modal onClick={() => setSheet({ kind: "raise", ids: active.map((e) => e.id) })} />
      <button
        data-fitt-screen="อนุมัติคำขอเปลี่ยนแปลงทางบุคคล"
        data-fitt-modal
        onClick={() => {
          const a = pendingActions()[0];
          if (a) setSheet({ kind: "decide", actionId: a.id, approve: true });
        }}
      />
      <button
        data-fitt-screen="ไม่อนุมัติคำขอเปลี่ยนแปลงทางบุคคล"
        data-fitt-modal
        onClick={() => {
          const a = pendingActions()[0];
          if (a) setSheet({ kind: "decide", actionId: a.id, approve: false });
        }}
      />
      <button data-fitt-screen="บันทึกการพ้นสภาพ" data-fitt-modal onClick={() => setSheet({ kind: "separate", id: active[0].id })} />
      <button data-fitt-screen="หนังสือรับรองการทำงาน" data-fitt-modal onClick={() => setSheet({ kind: "certificate", id: people[0].id, letter: "หนังสือรับรองการทำงาน" })} />
      <button data-fitt-screen="หนังสือรับรองเงินเดือน" data-fitt-modal onClick={() => setSheet({ kind: "certificate", id: active[0].id, letter: "หนังสือรับรองเงินเดือน" })} />
      <button data-fitt-screen="สัญญาจ้างแรงงาน" data-fitt-modal onClick={() => setSheet({ kind: "contractDoc", id: people[0].id })} />
      <button
        data-fitt-screen="คำสั่งบริษัท"
        data-fitt-modal
        onClick={() => {
          const a = PERSONNEL_ACTIONS.find((x) => x.status === "อนุมัติแล้ว");
          if (a) setSheet({ kind: "order", actionId: a.id });
        }}
      />
    </div>
  );

  if (!tab) {
    return (
      <>
        <Dashboard
          onOpenSection={onOpenSection}
          onOpen={(e) => setOpenId(e.id)}
          picked={picked}
          onClose={() => setOpenId(null)}
          favourites={favourites}
          toggleFavourite={toggleFavourite}
          onSheet={setSheet}
        />
        {sheets}
        {index}
      </>
    );
  }

  const csv = csvFor(tab);

  return (
    <div>
      <PageHead
        title="ทะเบียนพนักงาน"
        meta={`${tab} · ${rows.length} คนที่แสดง จาก ${people.length} คนในทะเบียน`}
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-[1.9fr_1fr]">
          <StatStrip
            title="สถานะกำลังคน"
            icon={<Users size={16} />}
            cells={[
              {
                icon: <UserRound size={14} />, label: "ทำงานอยู่", value: active.length,
                sub: <>อายุงานเฉลี่ย <b className="text-slate-700 dark:text-slate-200">{avgTenure.toFixed(1)} ปี</b></>, tone: "accent",
              },
              {
                icon: <Hourglass size={14} />, label: "ทดลองงาน", value: probation.length,
                sub: probation.length ? <>{probation.map((e) => e.nickname).join(" · ")}</> : "ไม่มีในงวดนี้", tone: "warn",
              },
              {
                icon: <CalendarClock size={14} />, label: "สัญญาใกล้หมด", value: expiring.length,
                sub: soonest !== undefined ? <>ใกล้สุดใน <b className="text-slate-700 dark:text-slate-200">{soonest} วัน</b></> : "ไม่มีใน 90 วัน", tone: "bad",
              },
              {
                icon: <UserMinus size={14} />, label: "ลาออกแล้ว", value: left.length,
                sub: <>ยังอยู่ในทะเบียนเพื่ออ้างอิง</>, tone: "idle",
              },
            ]}
          />
          <StatStrip
            title={`ปี ${year}`}
            icon={<TrendingUp size={16} />}
            cells={[
              {
                icon: <UserPlus size={14} />, label: "รับเข้า", value: hires.length,
                sub: <>คิดเป็น <b className="text-slate-700 dark:text-slate-200">{active.length ? Math.round((hires.length / active.length) * 100) : 0}%</b> ของกำลังคน</>, tone: "ok",
              },
              {
                icon: <UserMinus size={14} />, label: "ลาออก", value: leavers,
                sub: <>อัตราลาออก <b className="text-slate-700 dark:text-slate-200">{people.length ? Math.round((leavers / people.length) * 100) : 0}%</b></>, tone: "bad",
              },
            ]}
          />
        </div>
      </Reveal>

      {tab === "ข้อมูลสัญญาจ้าง" && (
        <Reveal delay={0.04} className="mt-4">
          <ContractDue people={active} onOpen={(e) => setOpenId(e.id)} onSheet={setSheet} />
        </Reveal>
      )}

      {tab === "เหตุการณ์ทางบุคคล" && (
        <Reveal delay={0.04} className="mt-4">
          <ActionQueue onOpen={(e) => setOpenId(e.id)} onSheet={setSheet} />
        </Reveal>
      )}

      <Reveal delay={0.08} className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อ ชื่อเล่น รหัส ตำแหน่ง" icon={<SearchIcon size={14} />} className="w-56" />
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" />
          <ViewToggle value={view} onChange={setView} />
          <Segmented options={STATUSES} value={status} onChange={(v) => setStatus(v as (typeof STATUSES)[number])} counts={counts} />
          <Select value={dept} onChange={setDept} options={["ทุกแผนก", ...departments()]} className="w-40" />
          <span className="ml-auto" />
          <Button
            variant="secondary"
            icon={<Download size={15} />}
            onClick={() => {
              downloadCsv(`ทะเบียนพนักงาน-${tab}-${TODAY}`, csv.header, rows.map(csv.row));
              notify(`ส่งออก${tab} ${rows.length} คนเป็นไฟล์ Excel แล้ว`);
            }}
          >
            ส่งออก Excel
          </Button>
          {tab === "เหตุการณ์ทางบุคคล" && (
            <Button variant="secondary" icon={<Stamp size={15} />} onClick={() => setSheet({ kind: "action", id: null, preset: "ย้ายแผนก" })}>
              ขอเปลี่ยนแปลงทางบุคคล
            </Button>
          )}
          {tab === "ค่าตอบแทนและสวัสดิการ" && (
            <Button variant="secondary" icon={<Banknote size={15} />} onClick={() => setSheet({ kind: "action", id: null, preset: "ปรับเงินเดือน" })}>
              ขอปรับเงินเดือน
            </Button>
          )}
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setSheet({ kind: "hire" })}>
            เพิ่มพนักงาน
          </Button>
        </div>

        {view === "list" ? (
            <motion.div key="list" initial={enter({ opacity: 0 })} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
              <DataTable
                rows={rows}
                getId={(e) => e.id}
                onOpen={(e) => setOpenId(e.id)}
                selectable
                columns={columnsFor(tab)}
                trailing={(e) => (
                  <span className="inline-flex items-center gap-1">
                    <FavouriteButton on={favourites.includes(e.id)} onToggle={() => toggleFavourite(e.id)} />
                    <IconButton label="เปิดแฟ้ม" onClick={() => setOpenId(e.id)} className="border-transparent bg-transparent dark:bg-transparent">
                      <Ellipsis size={15} />
                    </IconButton>
                  </span>
                )}
                bulkActions={(selected, clear) => (
                  <>
                    {tab === "ข้อมูลทางปกครอง" && (
                      <RowButton
                        icon={<Bell size={12} />}
                        onClick={() => {
                          const n = remindDocuments(selected.map((e) => e.id));
                          notify(n ? `ส่งเตือนขอเอกสาร ${n} คนแล้ว` : "ทุกคนที่เลือกยื่นเอกสารครบแล้ว", n ? "ok" : "idle");
                          clear();
                        }}
                      >
                        ส่งเตือนขอเอกสาร
                      </RowButton>
                    )}
                    {tab === "ค่าตอบแทนและสวัสดิการ" && (
                      <RowButton icon={<TrendingUp size={12} />} onClick={() => setSheet({ kind: "raise", ids: selected.map((e) => e.id) })}>
                        ปรับเงินเดือนประจำปี
                      </RowButton>
                    )}
                    <RowButton
                      icon={<Download size={12} />}
                      onClick={() => {
                        downloadCsv(`ทะเบียนพนักงาน-${tab}-ที่เลือก-${TODAY}`, csv.header, selected.map(csv.row));
                        notify(`ส่งออก ${selected.length} คนที่เลือกเป็นไฟล์ Excel แล้ว`);
                      }}
                    >
                      ส่งออกที่เลือก
                    </RowButton>
                    <button
                      onClick={() => {
                        const first = selected.find((e) => e.status !== "ลาออก");
                        if (first) setSheet({ kind: "separate", id: first.id });
                      }}
                      disabled={selected.every((e) => e.status === "ลาออก")}
                      className="rounded-lg border border-rose-300 px-2.5 py-1 text-[12px] text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      บันทึกการลาออก
                    </button>
                  </>
                )}
              />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={enter({ opacity: 0 })}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {rows.map((e, i) => (
                <PersonCard
                  key={e.id}
                  employee={e}
                  index={i}
                  favourite={favourites.includes(e.id)}
                  onFavourite={() => toggleFavourite(e.id)}
                  onOpen={() => setOpenId(e.id)}
                />
              ))}
              {rows.length === 0 && (
                <p className="col-span-full py-14 text-center text-[13px] text-slate-400">ไม่มีข้อมูลที่ตรงกับเงื่อนไข</p>
              )}
            </motion.div>
          )}
      </Reveal>

      <DetailModal
        open={picked !== null}
        title="แฟ้มพนักงาน"
        onClose={() => setOpenId(null)}
        index={Math.max(0, at)}
        total={rows.length}
        // The pager listens for arrow keys on the whole window; while a form is
        // open over the record, those keys belong to the text being typed.
        onStep={
          sheet
            ? undefined
            : (d) => {
                const next = rows[Math.max(0, Math.min(rows.length - 1, at + d))];
                if (next) setOpenId(next.id);
              }
        }
      >
        {picked && (
          <Record
            key={picked.id}
            employee={picked}
            favourite={favourites.includes(picked.id)}
            openAt={tab ?? TABS[0]}
            onFavourite={() => toggleFavourite(picked.id)}
            onSheet={setSheet}
          />
        )}
      </DetailModal>

      {sheets}
      {index}
    </div>
  );
}

/* ------------------------------------------------------ section helpers */

/** What the contract section is for: the probations to decide and the contracts to renew. */
function ContractDue({
  people,
  onOpen,
  onSheet,
}: {
  people: Employee[];
  onOpen: (e: Employee) => void;
  onSheet: (s: Sheet) => void;
}) {
  const due = [
    ...people
      .filter((e) => e.status === "ทดลองงาน")
      .map((e) => ({ e, kind: "ครบกำหนดทดลองงาน", date: e.contract.probationUntil })),
    ...people
      .filter((e) => e.contract.endsAt && daysBetween(TODAY, e.contract.endsAt) <= 120)
      .map((e) => ({ e, kind: "สัญญาหมดอายุ", date: e.contract.endsAt! })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card
      title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />ต้องดำเนินการเรื่องสัญญา</span>}
      subtitle={`ทดลองงานไม่เกิน ${PROBATION_DAYS} วัน และสัญญาที่หมดใน 120 วัน`}
    >
      {due.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-slate-400">ไม่มีทดลองงานหรือสัญญาที่ต้องตัดสินใจในช่วงนี้</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {due.map(({ e, kind, date }) => {
            const inDays = daysBetween(TODAY, date);
            return (
              <li key={e.id + kind} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar name={e.name} size="sm" />
                <button onClick={() => onOpen(e)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium text-slate-900 hover:text-violet-700 dark:text-slate-50">{e.name}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">{e.position} · {e.contract.type}</span>
                </button>
                <Tag swatch={kindSwatch(kind)}>{kind}</Tag>
                <Badge tone={inDays < 0 ? "bad" : inDays <= 30 ? "warn" : "info"}>
                  {inDays < 0 ? `เลยกำหนด ${-inDays} วัน` : `${date} · อีก ${inDays} วัน`}
                </Badge>
                {kind === "ครบกำหนดทดลองงาน" ? (
                  <RowButton tone="go" onClick={() => onSheet({ kind: "probation", id: e.id })}>ประเมินผ่านทดลองงาน</RowButton>
                ) : (
                  <RowButton tone="go" onClick={() => onSheet({ kind: "renew", id: e.id })}>ต่อสัญญา</RowButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Requests waiting for a decision first, then the latest ones decided. */
function ActionQueue({ onOpen, onSheet, limit = 6 }: { onOpen: (e: Employee) => void; onSheet: (s: Sheet) => void; limit?: number }) {
  const pending = pendingActions().sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const decided = PERSONNEL_ACTIONS.filter((a) => a.status !== "รออนุมัติ")
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
    .slice(0, Math.max(0, limit - pending.length));

  return (
    <Card
      title={<span className="flex items-center gap-2"><Stamp size={15} className="text-slate-400" />คำขอเปลี่ยนแปลงทางบุคคล</span>}
      subtitle="โยกย้าย เลื่อนตำแหน่ง ปรับเงินเดือน ตักเตือน — แฟ้มเปลี่ยนเมื่ออนุมัติ"
      action={<Badge tone={pending.length ? "warn" : "ok"}>{pending.length ? `รออนุมัติ ${pending.length}` : "ไม่มีค้าง"}</Badge>}
    >
      <ActionList actions={[...pending, ...decided]} onOpen={onOpen} onSheet={onSheet} empty="ยังไม่มีคำขอ" />
    </Card>
  );
}

function ActionList({
  actions,
  onOpen,
  onSheet,
  empty,
}: {
  actions: PersonnelAction[];
  onOpen?: (e: Employee) => void;
  onSheet: (s: Sheet) => void;
  empty: string;
}) {
  if (actions.length === 0) return <p className="py-6 text-center text-[12.5px] text-slate-400">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {actions.map((a) => {
        const e = EMPLOYEES.find((x) => x.id === a.employeeId)!;
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
            <span className="w-28 shrink-0 font-mono text-[11.5px] text-slate-400">{a.id}</span>
            <span className="min-w-0 flex-1">
              {onOpen ? (
                <button onClick={() => onOpen(e)} className="block truncate text-left text-[13px] font-medium text-slate-900 hover:text-violet-700 dark:text-slate-50">
                  {e.name}
                </button>
              ) : null}
              <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{actionSummary(a)}</span>
            </span>
            <Tag swatch={eventSwatch(a.kind)}>{a.kind}</Tag>
            <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">มีผล {a.effectiveDate}</span>
            <Badge tone={ACTION_TONE[a.status]}>{a.status}</Badge>
            {a.status === "รออนุมัติ" && (
              <span className="flex gap-1.5">
                <RowButton tone="go" onClick={() => onSheet({ kind: "decide", actionId: a.id, approve: true })}>อนุมัติ</RowButton>
                <RowButton tone="stop" onClick={() => onSheet({ kind: "decide", actionId: a.id, approve: false })}>ไม่อนุมัติ</RowButton>
              </span>
            )}
            {a.status === "อนุมัติแล้ว" && (
              <RowButton icon={<Printer size={12} />} onClick={() => onSheet({ kind: "order", actionId: a.id })}>
                {a.kind === "ตักเตือน" ? "พิมพ์หนังสือเตือน" : "พิมพ์คำสั่ง"}
              </RowButton>
            )}
            {a.status === "ไม่อนุมัติ" && a.decisionNote && (
              <span className="w-full pl-[7.75rem] text-[11.5px] text-slate-400">เหตุผล: {a.decisionNote}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------- dashboard */

function Dashboard({
  onOpenSection,
  onOpen,
  picked,
  onClose,
  favourites,
  toggleFavourite,
  onSheet,
}: {
  onOpenSection?: (index: number) => void;
  onOpen: (e: Employee) => void;
  picked: Employee | null;
  onClose: () => void;
  favourites: number[];
  toggleFavourite: (id: number) => void;
  onSheet: (s: Sheet) => void;
}) {
  useData();
  const people = EMPLOYEES;
  const active = people.filter((e) => e.status !== "ลาออก");

  // Documents: one gauge for the whole register, then who is short.
  const docs = active.map((e) => ({ e, list: documentsOf(e) }));
  const docTotal = docs.reduce((n, x) => n + x.list.length, 0);
  const docDone = docs.reduce((n, x) => n + x.list.filter((d) => d.done).length, 0);
  const short = docs.filter((x) => x.list.some((d) => !d.done));
  const complete = docs.filter((x) => x.list.every((d) => d.done));

  // Headcount by department, coloured by catalogue order.
  const byDept = departments().map((d) => ({
    label: d,
    value: active.filter((e) => e.department === d).length,
    swatch: deptSwatch(d),
  })).filter((s) => s.value > 0);

  const trend = headcountTrend();
  const todo = upcoming(120);

  // The strip shows the next week; the list shows what falls on or after the
  // chosen day, so a quiet week still tells you what is coming.
  const [day, setDay] = useState(TODAY);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return {
      date: iso,
      dow: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][d.getDay()],
      day: String(d.getDate()).padStart(2, "0"),
      marked: todo.some((t) => t.date === iso),
    };
  });
  const agenda = todo.filter((t) => t.date >= day).slice(0, 4);

  const probation = active.filter((e) => e.status === "ทดลองงาน");
  const fixedTerm = active.filter((e) => e.contract.endsAt);
  const gone = people.filter((e) => e.status === "ลาออก");

  const recent = people
    .flatMap((e) => e.events.map((ev) => ({ ...ev, e })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const seeAll = (index: number) =>
    onOpenSection ? (
      <button
        onClick={() => onOpenSection(index)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300"
      >
        ดูทั้งหมด <ArrowRight size={12} />
      </button>
    ) : undefined;

  const byId = (id: number) => people.find((e) => e.id === id)!;

  return (
    <div>
      <PageHead
        title="ภาพรวมทะเบียนพนักงาน"
        meta={`${active.length} คนที่ทำงานอยู่ · ข้อมูล ณ ${TODAY} · ทุกตัวเลขคำนวณจากทะเบียน ไม่ได้พิมพ์ทิ้งไว้`}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => onSheet({ kind: "hire" })}>
              เพิ่มพนักงาน
            </Button>
            {onOpenSection && (
              <Button variant="primary" icon={<Users size={15} />} onClick={() => onOpenSection(0)}>
                เปิดรายชื่อพนักงาน
              </Button>
            )}
          </div>
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card title={<span className="flex items-center gap-2"><FileText size={15} className="text-slate-400" />เอกสารการจ้าง</span>} action={seeAll(2)}>
            <div className="px-4 pt-3">
              <Gauge value={docDone} max={docTotal} label={`จาก ${docTotal} รายการ`} hex="#7c3aed" size={210} />
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...short, ...complete.slice(0, Math.max(1, 3 - short.length))].slice(0, 3).map(({ e, list }) => {
                const missing = list.filter((d) => !d.done).length;
                return (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Dot className={missing ? "bg-amber-500" : "bg-emerald-500"} />
                    <button onClick={() => onOpen(e)} className="min-w-0 flex-1 truncate text-left text-[13px] text-slate-800 hover:text-violet-700 dark:text-slate-100">
                      {e.name} <span className="text-slate-400">({e.department})</span>
                    </button>
                    <Badge tone={missing ? "warn" : "ok"}>{missing ? `รอ ${missing} รายการ` : "ครบ"}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Building size={15} className="text-slate-400" />กำลังคนตามแผนก</span>} action={seeAll(0)}>
            <div className="p-4">
              <Donut
                segments={byDept}
                center={
                  <span>
                    <span className="block text-[26px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">{active.length}</span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">คน</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-2"><CalendarDays size={15} className="text-slate-400" />กำหนดการ</span>} action={seeAll(1)}>
            <div className="space-y-3 p-4">
              <WeekStrip days={week} active={day} onPick={setDay} />
              {agenda.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-slate-400">ไม่มีรายการตั้งแต่วันที่เลือกไปอีก 120 วัน</p>
              ) : (
                agenda.map((t, i) => {
                  const sw = kindSwatch(t.kind);
                  return (
                    <TintCard key={i} swatch={sw}>
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => onOpen(byId(t.employeeId))} className="min-w-0 text-left">
                          <span className="block truncate text-[13.5px] font-semibold">{t.name}</span>
                          <span className="block text-[12px] opacity-75">
                            {t.date} · อีก {t.inDays} วัน
                          </span>
                        </button>
                        <Avatar name={t.name} size="sm" />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() =>
                            onSheet(
                              t.kind === "สัญญาหมดอายุ"
                                ? { kind: "renew", id: t.employeeId }
                                : t.kind === "ครบกำหนดทดลองงาน"
                                  ? { kind: "probation", id: t.employeeId }
                                  : { kind: "action", id: t.employeeId, preset: "ปรับเงินเดือน" }
                            )
                          }
                          className="rounded-lg bg-white/70 px-2.5 py-1 text-[11.5px] font-medium transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                        >
                          {t.kind === "สัญญาหมดอายุ" ? "ต่อสัญญา" : t.kind === "ครบกำหนดทดลองงาน" ? "ประเมินผ่านทดลองงาน" : "ทบทวนค่าตอบแทน"}
                        </button>
                        <Tag swatch={sw}>{t.kind}</Tag>
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
            title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />จำนวนพนักงานย้อนหลัง 12 เดือน</span>}
            action={<span className="text-[11.5px] text-slate-400">นับจากวันเริ่มงานหักคนที่ลาออกแล้ว</span>}
          >
            <ColumnChart
              data={trend.map((t, i) => ({ label: t.label, value: t.value, tone: i === trend.length - 1 ? "accent" : undefined }))}
              format={(n) => n + " คน"}
              height={180}
            />
          </Card>

          <Card title={<span className="flex items-center gap-2"><Clock3 size={15} className="text-slate-400" />สถานะกำลังคน</span>} action={seeAll(1)}>
            <div className="space-y-4 p-4">
              <TrackerGroup label="ทดลองงาน" empty="ไม่มีในงวดนี้">
                {probation.map((e) => (
                  <TrackerRow key={e.id} e={e} onOpen={onOpen} sub={e.position}>
                    <Badge tone="warn" icon={<Hourglass size={11} />}>อีก {Math.max(0, daysBetween(TODAY, e.contract.probationUntil))} วัน</Badge>
                  </TrackerRow>
                ))}
              </TrackerGroup>
              <TrackerGroup label="สัญญาจ้างมีกำหนด" empty="ทุกคนเป็นสัญญาไม่มีกำหนด">
                {fixedTerm.map((e) => {
                  const left = daysBetween(TODAY, e.contract.endsAt!);
                  return (
                    <TrackerRow key={e.id} e={e} onOpen={onOpen} sub={e.contract.type}>
                      <Badge tone={left < 0 ? "idle" : left <= 90 ? "bad" : "info"} icon={<CalendarClock size={11} />}>
                        {left < 0 ? "หมดอายุแล้ว" : `เหลือ ${left} วัน`}
                      </Badge>
                    </TrackerRow>
                  );
                })}
              </TrackerGroup>
              <TrackerGroup label="ลาออกแล้ว" empty="ยังไม่มีในปีนี้">
                {gone.map((e) => (
                  <TrackerRow key={e.id} e={e} onOpen={onOpen} sub={e.separation ? `${e.separation.kind} · ${e.separation.lastDay}` : ""}>
                    <Badge tone="idle" icon={<UserMinus size={11} />}>ลาออก</Badge>
                  </TrackerRow>
                ))}
              </TrackerGroup>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />เหตุการณ์ทางบุคคลล่าสุด</span>} action={seeAll(3)}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((ev, i) => {
              const sw = eventSwatch(ev.type);
              return (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className={"mt-0.5 grid size-7 shrink-0 place-items-center rounded-full " + sw.tint}>
                    <CircleCheck size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onOpen(ev.e)} className="text-left text-[13px] text-slate-900 hover:text-violet-700 dark:text-slate-50">
                      <span className="font-medium">{ev.e.name}</span>
                      <span className="text-slate-500 dark:text-slate-400"> — {ev.detail}</span>
                    </button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Tag swatch={sw}>{ev.type}</Tag>
                      <Chip>{ev.e.department}</Chip>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[11.5px] tabular-nums text-slate-400">
                    <CalendarDays size={12} /> {ev.date}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card
          title={<span className="flex items-center gap-2"><Stamp size={15} className="text-slate-400" />รออนุมัติ</span>}
          subtitle="คำขอเปลี่ยนแปลงทางบุคคลที่รอผู้มีอำนาจ"
          action={seeAll(3)}
        >
          <PendingList onOpen={onOpen} onSheet={onSheet} />
        </Card>
        </div>
      </Reveal>

      <DetailModal open={picked !== null} title="แฟ้มพนักงาน" onClose={onClose} index={picked ? people.indexOf(picked) : 0} total={people.length}>
        {picked && (
          <Record
            key={picked.id}
            employee={picked}
            favourite={favourites.includes(picked.id)}
            openAt={TABS[0]}
            onFavourite={() => toggleFavourite(picked.id)}
            onSheet={onSheet}
          />
        )}
      </DetailModal>
    </div>
  );
}

/** The overview's short form of the approval queue: who, what, and the two buttons. */
function PendingList({ onOpen, onSheet }: { onOpen: (e: Employee) => void; onSheet: (s: Sheet) => void }) {
  const pending = pendingActions();
  if (pending.length === 0) {
    return <p className="py-10 text-center text-[12.5px] text-slate-400">ไม่มีคำขอค้างอนุมัติ</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {pending.map((a) => {
        const e = EMPLOYEES.find((x) => x.id === a.employeeId)!;
        return (
          <li key={a.id} className="space-y-2 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Avatar name={e.name} size="sm" />
              <button onClick={() => onOpen(e)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium text-slate-900 hover:text-violet-700 dark:text-slate-50">{e.name}</span>
                <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{actionSummary(a)}</span>
              </button>
              <Tag swatch={eventSwatch(a.kind)}>{a.kind}</Tag>
            </div>
            <div className="flex items-center justify-between gap-2 pl-8">
              <span className="text-[11px] tabular-nums text-slate-400">{a.id} · มีผล {a.effectiveDate}</span>
              <span className="flex gap-1.5">
                <RowButton tone="go" onClick={() => onSheet({ kind: "decide", actionId: a.id, approve: true })}>อนุมัติ</RowButton>
                <RowButton tone="stop" onClick={() => onSheet({ kind: "decide", actionId: a.id, approve: false })}>ไม่อนุมัติ</RowButton>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TrackerGroup({ label, empty, children }: { label: string; empty: string; children: ReactNode[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {children.length === 0 ? (
        <p className="text-[12px] text-slate-400 dark:text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5">{children}</ul>
      )}
    </div>
  );
}

function TrackerRow({ e, sub, onOpen, children }: { e: Employee; sub: string; onOpen: (e: Employee) => void; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <Avatar name={e.name} />
      <button onClick={() => onOpen(e)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-medium text-slate-900 hover:text-violet-700 dark:text-slate-50">{e.name}</span>
        <span className="block truncate text-[11.5px] text-slate-400">{sub}</span>
      </button>
      {children}
    </li>
  );
}

/* ---------------------------------------------------------------- pieces */

function FavouriteButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={onToggle}
      aria-label={on ? "เอาออกจากรายการโปรด" : "เพิ่มเป็นรายการโปรด"}
      className={"grid size-8 place-items-center rounded-lg transition " + (on ? "text-rose-500" : "text-slate-300 hover:text-rose-400 dark:text-slate-600")}
    >
      <Heart size={16} fill={on ? "currentColor" : "none"} />
    </motion.button>
  );
}

/** Each capability is a different set of columns over the same register. */
function columnsFor(tab: string | undefined): Column<Employee>[] {
  const mono = (v: string) => <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{v}</span>;
  const head: Column<Employee>[] = [
    { key: "code", header: "รหัส", width: "7.5rem", sort: (a, b) => a.code.localeCompare(b.code), cell: (e) => mono("#" + e.code.slice(4)) },
    {
      key: "name",
      header: "ชื่อ-นามสกุล",
      sort: (a, b) => a.name.localeCompare(b.name, "th"),
      cell: (e) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={e.name} />
          <span className="font-medium text-slate-900 dark:text-slate-100">{e.name}</span>
          <GenderMark id={e.id} />
        </span>
      ),
    },
  ];

  const base: Column<Employee>[] = [
    {
      key: "position", header: "ตำแหน่ง", sort: (a, b) => a.position.localeCompare(b.position, "th"),
      cell: (e) => <span className="flex items-center gap-1.5"><Briefcase size={13} className="text-slate-400" />{e.position}</span>,
    },
    {
      key: "department", header: "แผนก", sort: (a, b) => a.department.localeCompare(b.department, "th"),
      cell: (e) => <span className="flex items-center gap-1.5"><Dot className={deptSwatch(e.department).dot} />{e.department}</span>,
    },
    { key: "type", header: "ประเภทจ้าง", cell: (e) => e.contract.type },
    {
      key: "tenure", header: "อายุงาน", sort: (a, b) => tenureYears(a) - tenureYears(b),
      cell: (e) => { const y = tenureYears(e); return y < 1 ? "ไม่ถึงปี" : y.toFixed(1) + " ปี"; },
    },
    { key: "status", header: "สถานะ", cell: (e) => <StatusBadge status={e.status} /> },
  ];

  const bySection: Record<string, Column<Employee>[]> = {
    "ข้อมูลส่วนตัว": [
      { key: "birth", header: "วันเกิด", sort: (a, b) => a.personal.birthDate.localeCompare(b.personal.birthDate), cell: (e) => <>{e.personal.birthDate} <span className="text-slate-400">({ageOf(e)} ปี)</span></> },
      { key: "nid", header: "เลขบัตรประชาชน", cell: (e) => mono(e.personal.nationalId) },
      { key: "phone", header: "โทรศัพท์", cell: (e) => <span className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" />{e.personal.phone}</span> },
      { key: "email", header: "อีเมล", cell: (e) => <span className="text-violet-600 dark:text-violet-300">{e.personal.email}</span> },
      { key: "department", header: "แผนก", cell: (e) => e.department },
    ],
    "ข้อมูลสัญญาจ้าง": [
      { key: "type", header: "ประเภทจ้าง", sort: (a, b) => a.contract.type.localeCompare(b.contract.type, "th"), cell: (e) => <span className="flex items-center gap-1.5"><Briefcase size={13} className="text-slate-400" />{e.contract.type}</span> },
      { key: "start", header: "วันเริ่มงาน", sort: (a, b) => a.contract.startedAt.localeCompare(b.contract.startedAt), cell: (e) => e.contract.startedAt },
      {
        key: "end", header: "สิ้นสุดสัญญา",
        sort: (a, b) => (a.contract.endsAt ?? "9999").localeCompare(b.contract.endsAt ?? "9999"),
        cell: (e) => {
          if (!e.contract.endsAt) return <span className="text-slate-400 dark:text-slate-500">ไม่กำหนด</span>;
          const left = daysBetween(TODAY, e.contract.endsAt);
          if (left < 0) return <Badge tone="idle">{e.contract.endsAt} · หมดอายุแล้ว</Badge>;
          if (left <= 90) return <Badge tone="bad">{e.contract.endsAt} · เหลือ {left} วัน</Badge>;
          return e.contract.endsAt;
        },
      },
      { key: "status", header: "สถานะ", cell: (e) => <StatusBadge status={e.status} /> },
    ],
    "ข้อมูลทางปกครอง": [
      { key: "sso", header: "เลขประกันสังคม", cell: (e) => mono(e.admin.ssoNumber) },
      { key: "tax", header: "เลขผู้เสียภาษี", cell: (e) => mono(e.admin.taxId) },
      { key: "bank", header: "ธนาคาร", sort: (a, b) => a.admin.bankName.localeCompare(b.admin.bankName, "th"), cell: (e) => <span className="flex items-center gap-1.5"><CreditCard size={13} className="text-slate-400" />{e.admin.bankName} {mono(e.admin.bankAccount)}</span> },
      {
        key: "docs", header: "เอกสาร",
        sort: (a, b) => documentsOf(a).filter((d) => d.done).length - documentsOf(b).filter((d) => d.done).length,
        cell: (e) => { const d = documentsOf(e); const n = d.filter((x) => x.done).length; return <Badge tone={n === d.length ? "ok" : "warn"}>{n}/{d.length}</Badge>; },
      },
      { key: "pvd", header: "กองทุนสำรองฯ", align: "right", sort: (a, b) => a.admin.pvdRate - b.admin.pvdRate, cell: (e) => e.admin.pvdRate + "%" },
    ],
    "เหตุการณ์ทางบุคคล": [
      { key: "last", header: "เหตุการณ์ล่าสุด", cell: (e) => { const t = e.events.at(-1)?.type; return t ? <Tag swatch={eventSwatch(t)}>{t}</Tag> : "—"; } },
      { key: "when", header: "เมื่อ", sort: (a, b) => (a.events.at(-1)?.date ?? "").localeCompare(b.events.at(-1)?.date ?? ""), cell: (e) => e.events.at(-1)?.date ?? "—" },
      { key: "detail", header: "รายละเอียด", cell: (e) => <span className="text-slate-500">{e.events.at(-1)?.detail ?? "—"}</span> },
      { key: "pending", header: "รออนุมัติ", cell: (e) => { const n = actionsOf(e.id).filter((a) => a.status === "รออนุมัติ").length; return n ? <Badge tone="warn">{n} คำขอ</Badge> : <span className="text-slate-300 dark:text-slate-600">—</span>; } },
      { key: "count", header: "ทั้งหมด", align: "right", sort: (a, b) => a.events.length - b.events.length, cell: (e) => e.events.length + " ครั้ง" },
    ],
    "ค่าตอบแทนและสวัสดิการ": [
      { key: "salary", header: "เงินเดือนฐาน", align: "right", sort: (a, b) => a.contract.baseSalary - b.contract.baseSalary, cell: (e) => <span className="font-medium text-slate-900 dark:text-slate-100">{baht(e.contract.baseSalary)} ฿</span> },
      { key: "ben", header: "สวัสดิการ", align: "right", sort: (a, b) => a.benefits.length - b.benefits.length, cell: (e) => <Badge tone="accent" icon={<Gift size={11} />}>{e.benefits.length} รายการ</Badge> },
      { key: "first", header: "รายการหลัก", cell: (e) => <span className="flex flex-wrap gap-1">{e.benefits.slice(0, 2).map((b) => <Chip key={b}>{b}</Chip>)}</span> },
      { key: "pvd", header: "กองทุนสำรองฯ", align: "right", cell: (e) => e.admin.pvdRate + "%" },
    ],
  };

  return [...head, ...(tab ? bySection[tab] : base)];
}

/** "ส่งออก Excel": the same columns the section shows, as plain values. */
function csvFor(tab: string): { header: string[]; row: (e: Employee) => (string | number)[] } {
  const head = ["รหัส", "ชื่อ-นามสกุล"];
  const bySection: Record<string, { header: string[]; row: (e: Employee) => (string | number)[] }> = {
    "ข้อมูลส่วนตัว": {
      header: ["วันเกิด", "อายุ", "เลขบัตรประชาชน", "โทรศัพท์", "อีเมล", "แผนก"],
      row: (e) => [e.personal.birthDate, ageOf(e), e.personal.nationalId, e.personal.phone, e.personal.email, e.department],
    },
    "ข้อมูลสัญญาจ้าง": {
      header: ["ประเภทจ้าง", "วันเริ่มงาน", "สิ้นสุดสัญญา", "สถานะ"],
      row: (e) => [e.contract.type, e.contract.startedAt, e.contract.endsAt ?? "ไม่กำหนด", e.status],
    },
    "ข้อมูลทางปกครอง": {
      header: ["เลขประกันสังคม", "เลขผู้เสียภาษี", "ธนาคาร", "เลขบัญชี", "เอกสาร", "กองทุนสำรองฯ (%)"],
      row: (e) => {
        const d = documentsOf(e);
        return [e.admin.ssoNumber, e.admin.taxId, e.admin.bankName, e.admin.bankAccount, `${d.filter((x) => x.done).length}/${d.length}`, e.admin.pvdRate];
      },
    },
    "เหตุการณ์ทางบุคคล": {
      header: ["เหตุการณ์ล่าสุด", "เมื่อ", "รายละเอียด", "รออนุมัติ", "ทั้งหมด"],
      row: (e) => [
        e.events.at(-1)?.type ?? "", e.events.at(-1)?.date ?? "", e.events.at(-1)?.detail ?? "",
        actionsOf(e.id).filter((a) => a.status === "รออนุมัติ").length, e.events.length,
      ],
    },
    "ค่าตอบแทนและสวัสดิการ": {
      header: ["เงินเดือนฐาน", "ประกันสังคม (พนักงาน)", "สวัสดิการ", "รายการสวัสดิการ", "กองทุนสำรองฯ (%)"],
      row: (e) => [e.contract.baseSalary, ssoContribution(e.contract.baseSalary), e.benefits.length, e.benefits.join(" · "), e.admin.pvdRate],
    },
  };
  const spec = bySection[tab];
  return { header: [...head, ...spec.header], row: (e) => [e.code, e.name, ...spec.row(e)] };
}

function PersonCard({
  employee: e,
  index,
  favourite,
  onFavourite,
  onOpen,
}: {
  employee: Employee;
  index: number;
  favourite: boolean;
  onFavourite: () => void;
  onOpen: () => void;
}) {
  return (
    <motion.article
      initial={enter({ opacity: 0, y: 8 })}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.03 }}
      whileHover={{ y: -2 }}
      className={"p-4 transition hover:shadow-md hover:shadow-slate-900/5 " + SURFACE}
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={e.name} />
        <button onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[14px] font-semibold text-slate-900 hover:text-violet-700 dark:text-slate-50">
          {e.name} <GenderMark id={e.id} />
        </button>
        <FavouriteButton on={favourite} onToggle={onFavourite} />
        <IconButton label="เปิดแฟ้ม" onClick={onOpen} className="border-transparent bg-transparent dark:bg-transparent">
          <Ellipsis size={15} />
        </IconButton>
      </div>
      <dl className="mt-3 space-y-1.5 text-[12.5px]">
        <CardRow icon={<IdCard size={13} />} label="รหัส">#{e.code.slice(4)}</CardRow>
        <CardRow icon={<Briefcase size={13} />} label="ตำแหน่ง">{e.position}</CardRow>
        <CardRow icon={<Building size={13} />} label="แผนก">{e.department}</CardRow>
        <CardRow icon={<CalendarDays size={13} />} label="เริ่มงาน">{e.contract.startedAt}</CardRow>
        <CardRow icon={<Clock3 size={13} />} label="สถานะ"><StatusBadge status={e.status} /></CardRow>
      </dl>
    </motion.article>
  );
}

function CardRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <dt className="w-16 shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- record */

function Record({
  employee: e,
  favourite,
  openAt,
  onFavourite,
  onSheet,
}: {
  employee: Employee;
  favourite: boolean;
  openAt: string;
  onFavourite: () => void;
  onSheet: (s: Sheet) => void;
}) {
  useData();
  const [tab, setTab] = useState(openAt);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("บันทึก");
  const docs = documentsOf(e);
  const done = docs.filter((d) => d.done).length;
  const status = e.status;
  const leftCo = status === "ลาออก";

  const sendNote = () => {
    if (!note.trim()) return;
    addNote(e.id, noteType, note);
    notify(`บันทึก${noteType}ในแฟ้มของ ${e.name} แล้ว`);
    setNote("");
    setTab("กิจกรรม");
  };

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[380px_1fr]">
      <aside className="min-h-0 overflow-y-auto border-r border-slate-100 dark:border-slate-800">
        <div
          className="px-5 pb-4 pt-5"
          style={{
            backgroundImage: "radial-gradient(circle, rgb(148 163 184 / 0.22) 1px, transparent 1px)",
            backgroundSize: "10px 10px",
          }}
        >
          <div className="flex items-center gap-3">
            <Avatar name={e.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                {e.name} <GenderMark id={e.id} />
              </p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                รหัสพนักงาน: <span className="font-semibold text-slate-800 dark:text-slate-100">#{e.code.slice(4)}</span>
              </p>
            </div>
            <FavouriteButton on={favourite} onToggle={onFavourite} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" icon={<Mail size={14} />} href={`mailto:${e.personal.email}`} className="flex-1">
              ส่งอีเมล
            </Button>
            <Button variant="secondary" icon={<MessageSquare size={14} />} onClick={() => setTab("กิจกรรม")} className="flex-1">
              บันทึกข้อความ
            </Button>
          </div>
        </div>

        <div className="space-y-5 px-5 pb-5">
          <div>
            <SectionTitle icon={<UserRound size={15} />}>ข้อมูลส่วนตัว</SectionTitle>
            <div className="mt-1.5">
              <IconRow icon={<Cake size={14} />} label="วันเกิด">{e.personal.birthDate} ({ageOf(e)} ปี)</IconRow>
              <IconRow icon={<ScanFace size={14} />} label="บัตรประชาชน"><span className="font-mono text-[12px]">{e.personal.nationalId}</span></IconRow>
              <IconRow icon={<Briefcase size={14} />} label="อายุงาน">{tenureYears(e) < 1 ? "ไม่ถึงปี" : tenureYears(e).toFixed(1) + " ปี"}</IconRow>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <SectionTitle icon={<Contact size={15} />}>ที่อยู่และการติดต่อ</SectionTitle>
            <div className="mt-1.5">
              <IconRow icon={<MapPin size={14} />} label="ที่อยู่"><span className="line-clamp-2">{e.personal.address}</span></IconRow>
              <IconRow icon={<Mail size={14} />} label="อีเมล">
                <a href={`mailto:${e.personal.email}`} className="break-all rounded-md bg-violet-50 px-1.5 py-0.5 text-[12px] text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{e.personal.email}</a>
              </IconRow>
              <IconRow icon={<Phone size={14} />} label="โทรศัพท์">
                <a href={`tel:${e.personal.phone}`} className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[12px] text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{e.personal.phone}</a>
              </IconRow>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <SectionTitle icon={<Building size={15} />}>การจ้างงาน</SectionTitle>
            <div className="mt-1.5">
              <IconRow icon={<Briefcase size={14} />} label="ตำแหน่ง"><Chip>{e.position}</Chip></IconRow>
              <IconRow icon={<Building size={14} />} label="แผนก"><Chip>{e.department}</Chip></IconRow>
              <IconRow icon={<FileText size={14} />} label="ประเภทจ้าง"><Chip>{e.contract.type}</Chip></IconRow>
              <IconRow icon={<Clock3 size={14} />} label="สถานะ"><StatusBadge status={status} /></IconRow>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="mb-2 text-[13px] font-semibold text-slate-900 dark:text-slate-50">บันทึกกิจกรรม</p>
            <div className={"overflow-hidden " + SURFACE}>
              <textarea
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
                placeholder="เขียนบันทึกถึงแฟ้มนี้…"
                rows={3}
                className="w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-2 dark:border-slate-800">
                <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                  ประเภท:
                  <Select value={noteType} onChange={setNoteType} options={["บันทึก", "โทรคุย", "นัดหมาย"]} className="w-28 [&_select]:py-1.5 [&_select]:text-[12px]" />
                </span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={sendNote}
                  aria-label="บันทึก"
                  className="grid size-8 place-items-center rounded-lg bg-violet-600 text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
                >
                  <Send size={14} />
                </motion.button>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            icon={<Printer size={14} />}
            className="w-full"
            onClick={() => onSheet({ kind: "certificate", id: e.id, letter: "หนังสือรับรองการทำงาน" })}
          >
            ออกหนังสือรับรอง
          </Button>

          {!leftCo && (
            <button
              onClick={() => onSheet({ kind: "separate", id: e.id })}
              className="w-full rounded-xl border border-rose-200 py-2 text-[12.5px] text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              บันทึกการลาออก / เลิกจ้าง
            </button>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="px-5 pt-2">
          <Tabs id={"record-" + e.id} tabs={RECORD_TABS} active={tab} onPick={setTab} icons={TAB_ICONS} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "ข้อมูลส่วนตัว" && <PersonalTab e={e} onSheet={onSheet} />}
              {tab === "ข้อมูลสัญญาจ้าง" && <ContractTab e={e} onSheet={onSheet} />}
              {tab === "ข้อมูลทางปกครอง" && <AdminTab e={e} docs={docs} done={done} onSheet={onSheet} />}
              {tab === "เหตุการณ์ทางบุคคล" && <EventsTab e={e} onSheet={onSheet} />}
              {tab === "ค่าตอบแทนและสวัสดิการ" && <PayTab e={e} onSheet={onSheet} />}
              {tab === "กิจกรรม" && <ActivityTab activity={ACTIVITY[e.id] ?? []} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

function Fact({ icon, label, children, wide }: { icon: ReactNode; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={"rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800/60 " + (wide ? "sm:col-span-2" : "")}>
      <dt className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] text-slate-900 dark:text-slate-50">{children}</dd>
    </div>
  );
}

/** A card's "แก้ไข" button: small enough to sit in the card head. */
function EditButton({ onClick, label = "แก้ไข" }: { onClick: () => void; label?: string }) {
  return (
    <RowButton icon={<Pencil size={12} />} onClick={onClick}>
      {label}
    </RowButton>
  );
}

function PersonalTab({ e, onSheet }: { e: Employee; onSheet: (s: Sheet) => void }) {
  return (
    <div className="space-y-4">
      <Card title="ข้อมูลส่วนตัว" action={<EditButton onClick={() => onSheet({ kind: "personal", id: e.id })} />}>
        <dl className="grid gap-2.5 p-4 sm:grid-cols-2">
          <Fact icon={<UserRound size={12} />} label="ชื่อ-นามสกุล">{e.name} ({e.nickname})</Fact>
          <Fact icon={<Cake size={12} />} label="วันเกิด">{e.personal.birthDate} · อายุ {ageOf(e)} ปี</Fact>
          <Fact icon={<ScanFace size={12} />} label="เลขบัตรประชาชน"><span className="font-mono">{e.personal.nationalId}</span></Fact>
          <Fact icon={<Phone size={12} />} label="โทรศัพท์">{e.personal.phone}</Fact>
          <Fact icon={<Mail size={12} />} label="อีเมล">{e.personal.email}</Fact>
          <Fact icon={<UserRound size={12} />} label="เพศ">{GENDER[e.id] ?? "—"}</Fact>
          <Fact icon={<MapPin size={12} />} label="ที่อยู่ตามทะเบียนบ้าน" wide>{e.personal.address}</Fact>
        </dl>
      </Card>
    </div>
  );
}

function ContractTab({ e, onSheet }: { e: Employee; onSheet: (s: Sheet) => void }) {
  const status = e.status;
  const leftCo = status === "ลาออก";
  const probationOver = status !== "ทดลองงาน";
  const renewed = e.events.some((ev) => ev.type === "ต่อสัญญา");
  const expiring = e.contract.endsAt ? daysBetween(TODAY, e.contract.endsAt) : null;
  const fixed = isFixedTerm(e.contract.type) && e.contract.endsAt !== null;

  const steps = [
    { label: "รับเข้าทำงาน", state: "done" as const },
    { label: "ทดลองงาน", state: probationOver ? ("done" as const) : ("current" as const) },
    { label: "บรรจุ", state: probationOver ? ("done" as const) : ("todo" as const) },
    ...(fixed
      ? [{ label: "ต่อสัญญา", state: leftCo ? ("failed" as const) : renewed ? ("done" as const) : expiring !== null && expiring <= 90 ? ("current" as const) : ("todo" as const) }]
      : []),
    ...(leftCo ? [{ label: e.separation?.kind ?? "ลาออก", state: "failed" as const }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className={"overflow-hidden border-l-4 " + (leftCo ? "border-l-slate-300" : expiring !== null && expiring <= 90 ? "border-l-amber-400" : "border-l-violet-500") + " " + SURFACE}>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">{e.contract.type}</h3>
            <StatusBadge status={status} />
            <span className="ml-auto text-[12px] text-slate-500">เริ่มงาน <b className="text-slate-800 dark:text-slate-100">{e.contract.startedAt}</b></span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><IdCard size={13} />#{e.code.slice(4)}</span>
            <span className="flex items-center gap-1"><CalendarDays size={13} />{e.contract.workDays}</span>
            <span className="flex items-center gap-1"><Hourglass size={13} />พ้นทดลองงาน {e.contract.probationUntil}</span>
            <span className="flex items-center gap-1"><CalendarClock size={13} />สิ้นสุด {e.contract.endsAt ?? "ไม่กำหนด"}</span>
          </p>
          <div className="mt-4">
            <Stepper steps={steps} icons={STEP_ICONS} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {status === "ทดลองงาน" && (
              <Button variant="primary" icon={<CircleCheck size={14} />} onClick={() => onSheet({ kind: "probation", id: e.id })}>
                ประเมินผ่านทดลองงาน
              </Button>
            )}
            {!leftCo && fixed && (
              <Button variant={status === "ทดลองงาน" ? "secondary" : "primary"} icon={<CalendarClock size={14} />} onClick={() => onSheet({ kind: "renew", id: e.id })}>
                ต่อสัญญา
              </Button>
            )}
            {!leftCo && (
              <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => onSheet({ kind: "contract", id: e.id })}>
                แก้ไขสัญญาจ้าง
              </Button>
            )}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onSheet({ kind: "contractDoc", id: e.id })}>
              พิมพ์สัญญาจ้าง
            </Button>
          </div>
        </div>
      </div>

      {expiring !== null && expiring >= 0 && expiring <= 90 && !leftCo && (
        <Note tone="warn">
          สัญญาหมดอายุ {e.contract.endsAt} เหลืออีก {expiring} วัน ควรเริ่มกระบวนการต่อสัญญาหรือแจ้งล่วงหน้าตามกฎหมายแรงงาน
        </Note>
      )}

      {e.separation && (
        <Card title={`บันทึกการพ้นสภาพ · ${e.separation.kind}`}>
          <dl className="grid gap-2.5 p-4 sm:grid-cols-2">
            <Fact icon={<CalendarDays size={12} />} label="วันที่แจ้ง">{thaiDate(e.separation.noticeDate)}</Fact>
            <Fact icon={<CalendarClock size={12} />} label="วันทำงานวันสุดท้าย">{thaiDate(e.separation.lastDay)}</Fact>
            <Fact icon={<FileText size={12} />} label="เหตุผล" wide>{e.separation.reason}</Fact>
            <Fact icon={<Banknote size={12} />} label="ค่าชดเชย">
              {e.separation.severanceDays ? `${e.separation.severanceDays} วัน · ${money(e.separation.severance)} บาท` : "ไม่มี"}
            </Fact>
            <Fact icon={<Banknote size={12} />} label="ค่าจ้างแทนการบอกกล่าว">
              {e.separation.noticePay ? `${money(e.separation.noticePay)} บาท` : "ไม่มี"}
            </Fact>
          </dl>
        </Card>
      )}

      <Card title="เงื่อนไขการจ้าง">
        <dl className="grid gap-2.5 p-4 sm:grid-cols-2">
          <Fact icon={<Banknote size={12} />} label="เงินเดือนฐาน">{baht(e.contract.baseSalary)} บาท/เดือน</Fact>
          <Fact icon={<CalendarDays size={12} />} label="วันทำงาน">{e.contract.workDays}</Fact>
          <Fact icon={<PiggyBank size={12} />} label="กองทุนสำรองเลี้ยงชีพ">{e.admin.pvdRate}% ของเงินเดือน</Fact>
          <Fact icon={<Briefcase size={12} />} label="อายุงาน">{tenureYears(e) < 1 ? "ไม่ถึงปี" : tenureYears(e).toFixed(1) + " ปี"}</Fact>
        </dl>
      </Card>
    </div>
  );
}

function AdminTab({
  e,
  docs,
  done,
  onSheet,
}: {
  e: Employee;
  docs: { name: string; done: boolean }[];
  done: number;
  onSheet: (s: Sheet) => void;
}) {
  const missing = docs.length - done;
  return (
    <div className="space-y-4">
      <Card
        title="เอกสารประกอบการจ้าง"
        action={
          missing > 0 && e.status !== "ลาออก" ? (
            <RowButton
              icon={<Bell size={12} />}
              onClick={() => {
                remindDocuments([e.id]);
                notify(`ส่งเตือนขอเอกสาร ${missing} รายการถึง ${e.name} แล้ว`);
              }}
            >
              ส่งเตือนขอเอกสาร
            </RowButton>
          ) : undefined
        }
      >
        <div className="p-4">
          <Progress done={done} total={docs.length} label={`ครบ ${done} จาก ${docs.length} รายการ`} />
        </div>
        <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
          {docs.map((d) => (
            <li key={d.name} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <FileText size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-slate-800 dark:text-slate-100">{d.name}</span>
                <span className="block text-[11.5px] text-slate-500">{d.done ? "ยื่นแล้ว · อยู่ในแฟ้ม" : "ยังไม่ได้รับ"}</span>
              </span>
              <Badge tone={d.done ? "ok" : "warn"} icon={d.done ? <CircleCheck size={11} /> : <Clock3 size={11} />}>
                {d.done ? "ครบ" : "รอเอกสาร"}
              </Badge>
              <RowButton
                tone={d.done ? "plain" : "go"}
                onClick={() => {
                  setDocumentReceived(e.id, d.name, !d.done);
                  notify(d.done ? `ยกเลิกการรับ${d.name}ของ ${e.name}` : `รับ${d.name}ของ ${e.name} เข้าแฟ้มแล้ว`, d.done ? "idle" : "ok");
                }}
              >
                {d.done ? "ยกเลิก" : "รับเอกสารแล้ว"}
              </RowButton>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="ภาษีและประกันสังคม" action={<EditButton onClick={() => onSheet({ kind: "admin", id: e.id })} />}>
        <dl className="grid gap-2.5 p-4 sm:grid-cols-2">
          <Fact icon={<Landmark size={12} />} label="เลขประกันสังคม"><span className="font-mono">{e.admin.ssoNumber}</span></Fact>
          <Fact icon={<ShieldCheck size={12} />} label="เลขผู้เสียภาษี"><span className="font-mono">{e.admin.taxId}</span></Fact>
          <Fact icon={<CreditCard size={12} />} label="บัญชีรับเงินเดือน">{e.admin.bankName} <span className="font-mono">{e.admin.bankAccount}</span></Fact>
          <Fact icon={<PiggyBank size={12} />} label="กองทุนสำรองเลี้ยงชีพ">{e.admin.pvdRate}% ของเงินเดือน</Fact>
        </dl>
      </Card>
    </div>
  );
}

function EventsTab({ e, onSheet }: { e: Employee; onSheet: (s: Sheet) => void }) {
  const events = e.events;
  const actions = actionsOf(e.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const years = [...new Set(events.map((ev) => ev.date.slice(0, 4)))].sort().reverse();
  const groups = years.map((y) => ({
    heading: "ปี " + (Number(y) + 543),
    items: [...events].filter((ev) => ev.date.startsWith(y)).reverse().map((ev) => ({
      time: ev.date.slice(5),
      body: (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={["ลาออก", "เลิกจ้าง", "ตักเตือน"].includes(ev.type) ? "bad" : ev.type === "รับเข้าทำงาน" ? "ok" : "accent"}>{ev.type}</Badge>
          <span className="text-slate-700 dark:text-slate-200">{ev.detail}</span>
        </span>
      ),
    })),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-slate-500">{events.length} เหตุการณ์ในประวัติ</p>
        {e.status !== "ลาออก" && (
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onSheet({ kind: "action", id: e.id, preset: "ย้ายแผนก" })}>
            ขอเปลี่ยนแปลงทางบุคคล
          </Button>
        )}
      </div>
      {actions.length > 0 && (
        <Card title="คำขอของพนักงานคนนี้" subtitle="แฟ้มเปลี่ยนเมื่ออนุมัติ คำสั่งที่อนุมัติแล้วพิมพ์ได้">
          <ActionList actions={actions} onSheet={onSheet} empty="ยังไม่มีคำขอ" />
        </Card>
      )}
      <Card>
        <div className="p-4">
          <Timeline groups={groups} />
        </div>
      </Card>
    </div>
  );
}

function PayTab({ e, onSheet }: { e: Employee; onSheet: (s: Sheet) => void }) {
  const working = e.status !== "ลาออก";
  const history = e.events.filter((ev) => ev.type === "ปรับเงินเดือน" || ev.type === "รับเข้าทำงาน").reverse();
  const sso = ssoContribution(e.contract.baseSalary);
  return (
    <div className="space-y-4">
      <div className={"flex flex-wrap items-center gap-4 p-4 " + SURFACE}>
        <span className="grid size-12 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <Wallet size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">เงินเดือนฐาน</p>
          <p className="text-[24px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(e.contract.baseSalary)} ฿</p>
        </div>
        <div className="text-right text-[12px] text-slate-500">
          <p>กองทุนสำรองฯ {e.admin.pvdRate}%</p>
          <p>= {baht(Math.round((e.contract.baseSalary * e.admin.pvdRate) / 100))} ฿/เดือน</p>
          <p className="mt-1">ประกันสังคม 5% = {baht(sso)} ฿/เดือน</p>
        </div>
        {working && (
          <div className="flex w-full flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <Button variant="primary" icon={<TrendingUp size={14} />} onClick={() => onSheet({ kind: "action", id: e.id, preset: "ปรับเงินเดือน" })}>
              ขอปรับเงินเดือน
            </Button>
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onSheet({ kind: "certificate", id: e.id, letter: "หนังสือรับรองเงินเดือน" })}>
              หนังสือรับรองเงินเดือน
            </Button>
          </div>
        )}
      </div>

      <Card
        title={`สวัสดิการ ${e.benefits.length} รายการ`}
        action={working ? <EditButton label="จัดการสวัสดิการ" onClick={() => onSheet({ kind: "benefits", id: e.id })} /> : undefined}
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {e.benefits.map((b, i) => (
            <motion.div
              key={b}
              initial={enter({ opacity: 0, y: 6 })}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-xl border border-slate-100 p-3.5 dark:border-slate-800"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Gift size={16} />
              </span>
              <span className="text-[13px] text-slate-800 dark:text-slate-100">{b}</span>
            </motion.div>
          ))}
        </div>
      </Card>

      <Card title="ประวัติเงินเดือน">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {history.map((ev, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className="w-24 shrink-0 tabular-nums text-slate-400">{ev.date}</span>
              <Tag swatch={eventSwatch(ev.type)}>{ev.type}</Tag>
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{ev.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ActivityTab({ activity }: { activity: ActivityEntry[] }) {
  const dates = [...new Set(activity.map((a) => a.date))].sort().reverse();
  const groups = dates.map((d) => ({
    heading: d === TODAY ? "วันนี้" : d,
    items: activity.filter((a) => a.date === d).map((a) => ({
      time: a.time,
      avatar: <Avatar name={a.actor} size="sm" />,
      body: (
        <>
          <span className="font-medium underline decoration-slate-300 underline-offset-2">{a.actor}</span>{" "}
          <span className="text-slate-600 dark:text-slate-300">{a.text}</span>
          {a.target && <span className="ml-1.5 font-medium text-slate-900 dark:text-slate-50">{a.target}</span>}
        </>
      ),
    })),
  }));

  return (
    <Card>
      <div className="p-4">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-slate-400">ยังไม่มีกิจกรรมกับแฟ้มนี้ เขียนบันทึกแรกได้จากช่องทางด้านซ้าย</p>
        ) : (
          <Timeline groups={groups} />
        )}
      </div>
    </Card>
  );
}
