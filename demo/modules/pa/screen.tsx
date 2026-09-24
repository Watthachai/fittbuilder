import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight, Banknote, Briefcase, Building, Cake, CalendarClock, CalendarDays, CircleCheck, CircleDashed,
  CircleX, Clock3, Contact, CreditCard, Ellipsis, FileText, Gift, Heart, Hourglass, IdCard, Landmark, Mail,
  MapPin, MessageSquare, Phone, PiggyBank, Plus, ScanFace, Search as SearchIcon, Send, ShieldCheck, Sparkles,
  TrendingUp, UserMinus, UserPlus, UserRound, Users, Wallet,
} from "lucide-react";
import {
  ACTIVITY, EMPLOYEES, EVENT_TYPES, GENDER, TODAY, ageOf, baht, daysBetween,
  documentsOf, headcountTrend, hiredIn, leftIn, tenureYears, upcoming,
} from "./data";
import type { ActivityEntry, Employee, PersonnelEvent } from "./data";
import {
  Avatar, Badge, Button, Card, Chip, ColumnChart, Donut, Dot, FIELD, Gauge, IconButton, IconRow, Note,
  PageHead, Progress, Reveal, Search, SectionTitle, Segmented, Select, StatStrip, Stepper, SURFACE, Tabs,
  Tag, Timeline, TintCard, ViewToggle, WeekStrip, enter, swatchFor,
} from "../ui";
import { ConfirmDialog, DataTable, DetailModal, Field, FormModal, Wizard } from "../kit";
import type { Column, Step } from "../kit";

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

const RESIGN_REASONS = [
  "เลือกเหตุผล",
  "ลาออกตามความสมัครใจ",
  "ได้งานใหม่",
  "ย้ายภูมิลำเนา",
  "ปัญหาสุขภาพ",
  "หมดสัญญาจ้าง",
  "อื่น ๆ",
];

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

/* ------------------------------------------------------------------ draft */

type Draft = {
  name: string; nickname: string; position: string; department: string;
  birthDate: string; nationalId: string; phone: string; email: string;
  type: string; startedAt: string; baseSalary: string;
  ssoNumber: string; bankName: string; bankAccount: string;
};

const EMPTY: Draft = {
  name: "", nickname: "", position: "", department: "ฝ่ายขาย",
  birthDate: "", nationalId: "", phone: "", email: "",
  type: "พนักงานประจำ", startedAt: TODAY, baseSalary: "",
  ssoNumber: "", bankName: "กสิกรไทย", bankAccount: "",
};

const DEPARTMENTS = [...new Set(EMPLOYEES.map((e) => e.department))];

/**
 * Colour keys. Departments take their swatch from catalogue order so ฝ่ายขาย is
 * the same hue on the donut, the chip and the list; event kinds are ordered by
 * hand so the alarming ones land on the alarming colours.
 */
const deptSwatch = (name: string) => swatchFor(name, DEPARTMENTS);
const EVENT_ORDER = ["ปรับเงินเดือน", "ย้ายแผนก", "รับเข้าทำงาน", "ต่อสัญญา", "ลาออก", "เลื่อนตำแหน่ง"];
const eventSwatch = (type: string) => swatchFor(type, EVENT_ORDER);
const KIND_ORDER = ["ครบรอบการทำงาน", "", "", "ครบกำหนดทดลองงาน", "สัญญาหมดอายุ"];
const kindSwatch = (kind: string) => swatchFor(kind, KIND_ORDER);
const CONTRACT_TYPES = ["พนักงานประจำ", "สัญญาจ้าง 1 ปี", "พนักงานรายวัน", "พนักงานชั่วคราว"];
const BANKS = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงไทย", "กรุงเทพ", "กรุงศรีอยุธยา"];

/* ----------------------------------------------------------------- screen */

export default function PaScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  /** The host's way of moving to a capability, so "ดูทั้งหมด" can point somewhere. */
  onOpenSection?: (index: number) => void;
}) {
  // The section chosen in the navigation decides which columns the register
  // shows and which part of a record opens first. Without one, the overview.
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ทั้งหมด");
  const [dept, setDept] = useState("ทุกแผนก");
  const [view, setView] = useState<"list" | "grid">("list");
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [added, setAdded] = useState<Employee[]>([]);
  const [events, setEvents] = useState<Record<number, PersonnelEvent[]>>({});
  const [resigned, setResigned] = useState<number[]>([]);
  const [favourites, setFavourites] = useState<number[]>([1]);
  const [notes, setNotes] = useState<Record<number, ActivityEntry[]>>({});
  const [resigning, setResigning] = useState<Employee | null>(null);

  const people = useMemo(() => [...EMPLOYEES, ...added], [added]);
  const statusOf = (e: Employee) => (resigned.includes(e.id) ? "ลาออก" : e.status);
  const eventsOf = (e: Employee) => [...e.events, ...(events[e.id] ?? [])];
  const activityOf = (e: Employee) => [...(ACTIVITY[e.id] ?? []), ...(notes[e.id] ?? [])];

  const rows = people.filter(
    (e) =>
      (status === "ทั้งหมด" || statusOf(e) === status) &&
      (dept === "ทุกแผนก" || e.department === dept) &&
      (q.trim() === "" ||
        [e.name, e.nickname, e.code, e.position].some((t) => t.toLowerCase().includes(q.trim().toLowerCase())))
  );
  const picked = openAt === null ? null : (rows[openAt] ?? null);

  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, s === "ทั้งหมด" ? people.length : people.filter((e) => statusOf(e) === s).length])
  );

  const addEvent = (id: number, ev: PersonnelEvent) =>
    setEvents((m) => ({ ...m, [id]: [...(m[id] ?? []), ev] }));
  const addNote = (id: number, entry: ActivityEntry) =>
    setNotes((m) => ({ ...m, [id]: [...(m[id] ?? []), entry] }));
  const toggleFavourite = (id: number) =>
    setFavourites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const commitResignation = (e: Employee, reason: string, message: string) => {
    setResigned((prev) => [...new Set([...prev, e.id])]);
    addEvent(e.id, { date: TODAY, type: "ลาออก", detail: reason + (message ? " · แจ้งพนักงานแล้ว" : "") });
    addNote(e.id, { date: TODAY, time: "ตอนนี้", actor: "คุณ", text: "บันทึกการลาออก", target: reason });
    setResigning(null);
  };

  /* ------------------------------------------------------------ figures */
  const active = people.filter((e) => statusOf(e) !== "ลาออก");
  const probation = active.filter((e) => statusOf(e) === "ทดลองงาน");
  const expiring = active.filter(
    (e) => e.contract.endsAt && daysBetween(TODAY, e.contract.endsAt) <= 90 && daysBetween(TODAY, e.contract.endsAt) >= 0
  );
  const left = people.filter((e) => statusOf(e) === "ลาออก");
  const year = TODAY.slice(0, 4);
  const hires = hiredIn(year);
  const leavers = leftIn(year).length + resigned.length;
  const avgTenure = active.length ? active.reduce((n, e) => n + tenureYears(e), 0) / active.length : 0;
  const soonest = expiring.map((e) => daysBetween(TODAY, e.contract.endsAt!)).sort((a, b) => a - b)[0];

  if (!tab) {
    return (
      <Dashboard
        people={people}
        statusOf={statusOf}
        eventsOf={eventsOf}
        onOpenSection={onOpenSection}
        onOpen={(e) => {
          // The register list is the pager's universe; open the person there.
          setStatus("ทั้งหมด");
          setDept("ทุกแผนก");
          setQ("");
          setOpenAt(people.indexOf(e));
        }}
        openAt={openAt}
        picked={picked}
        onClose={() => setOpenAt(null)}
        activityOf={activityOf}
        favourites={favourites}
        toggleFavourite={toggleFavourite}
        addEvent={addEvent}
        addNote={addNote}
        setResigning={setResigning}
        resigning={resigning}
        commitResignation={commitResignation}
      />
    );
  }

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

      <Reveal delay={0.08} className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อ ชื่อเล่น รหัส ตำแหน่ง" icon={<SearchIcon size={14} />} className="w-56" />
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" />
          <ViewToggle value={view} onChange={setView} />
          <Segmented options={STATUSES} value={status} onChange={(v) => setStatus(v as (typeof STATUSES)[number])} counts={counts} />
          <Select value={dept} onChange={setDept} options={["ทุกแผนก", ...DEPARTMENTS]} className="w-40" />
          <span className="ml-auto" />
          <Button
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => {
              setDraft(EMPTY);
              setAdding(true);
            }}
          >
            เพิ่มพนักงาน
          </Button>
        </div>

        {view === "list" ? (
            <motion.div key="list" initial={enter({ opacity: 0 })} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
              <DataTable
                rows={rows}
                getId={(e) => e.id}
                onOpen={(e) => setOpenAt(rows.indexOf(e))}
                selectable
                columns={columnsFor(tab, statusOf, eventsOf)}
                trailing={(e) => (
                  <span className="inline-flex items-center gap-1">
                    <FavouriteButton on={favourites.includes(e.id)} onToggle={() => toggleFavourite(e.id)} />
                    <IconButton label="เปิดแฟ้ม" onClick={() => setOpenAt(rows.indexOf(e))} className="border-transparent bg-transparent dark:bg-transparent">
                      <Ellipsis size={15} />
                    </IconButton>
                  </span>
                )}
                bulkActions={(selected) => (
                  <button
                    onClick={() => {
                      const first = selected.find((e) => statusOf(e) !== "ลาออก");
                      if (first) setResigning(first);
                    }}
                    disabled={selected.every((e) => statusOf(e) === "ลาออก")}
                    className="rounded-lg border border-rose-300 px-2.5 py-1 text-[12px] text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  >
                    บันทึกการลาออก
                  </button>
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
                  status={statusOf(e)}
                  index={i}
                  favourite={favourites.includes(e.id)}
                  onFavourite={() => toggleFavourite(e.id)}
                  onOpen={() => setOpenAt(i)}
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
        onClose={() => setOpenAt(null)}
        index={openAt ?? 0}
        total={rows.length}
        onStep={(d) => setOpenAt((i) => (i === null ? i : Math.max(0, Math.min(rows.length - 1, i + d))))}
      >
        {picked && (
          <Record
            key={picked.id}
            employee={picked}
            status={statusOf(picked)}
            events={eventsOf(picked)}
            activity={activityOf(picked)}
            favourite={favourites.includes(picked.id)}
            openAt={tab ?? TABS[0]}
            onFavourite={() => toggleFavourite(picked.id)}
            onAddEvent={(ev) => addEvent(picked.id, ev)}
            onAddNote={(entry) => addNote(picked.id, entry)}
            onResign={() => setResigning(picked)}
          />
        )}
      </DetailModal>

      <FormModal
        open={adding}
        title="เพิ่มพนักงานใหม่"
        subtitle="กรอกสามขั้นตอน ระบบตรวจความถูกต้องให้ก่อนไปขั้นถัดไป"
        onClose={() => setAdding(false)}
      >
        <NewEmployee
          draft={draft}
          setDraft={setDraft}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdded((prev) => [...prev, employeeFrom(draft, people.length + 1)]);
            setAdding(false);
          }}
        />
      </FormModal>

      <ResignDialog employee={resigning} onCancel={() => setResigning(null)} onConfirm={commitResignation} />

      <div hidden data-fitt-index>
        <button data-fitt-screen="ทะเบียนพนักงาน" />
        <button data-fitt-screen="แฟ้มประวัติพนักงาน" data-fitt-modal onClick={() => setOpenAt(0)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- dashboard */

function Dashboard({
  people,
  statusOf,
  eventsOf,
  onOpenSection,
  onOpen,
  openAt,
  picked,
  onClose,
  activityOf,
  favourites,
  toggleFavourite,
  addEvent,
  addNote,
  setResigning,
  resigning,
  commitResignation,
}: {
  people: Employee[];
  statusOf: (e: Employee) => string;
  eventsOf: (e: Employee) => PersonnelEvent[];
  onOpenSection?: (index: number) => void;
  onOpen: (e: Employee) => void;
  openAt: number | null;
  picked: Employee | null;
  onClose: () => void;
  activityOf: (e: Employee) => ActivityEntry[];
  favourites: number[];
  toggleFavourite: (id: number) => void;
  addEvent: (id: number, ev: PersonnelEvent) => void;
  addNote: (id: number, entry: ActivityEntry) => void;
  setResigning: (e: Employee | null) => void;
  resigning: Employee | null;
  commitResignation: (e: Employee, reason: string, message: string) => void;
}) {
  const active = people.filter((e) => statusOf(e) !== "ลาออก");

  // Documents: one gauge for the whole register, then who is short.
  const docs = active.map((e) => ({ e, list: documentsOf(e) }));
  const docTotal = docs.reduce((n, x) => n + x.list.length, 0);
  const docDone = docs.reduce((n, x) => n + x.list.filter((d) => d.done).length, 0);
  const short = docs.filter((x) => x.list.some((d) => !d.done));
  const complete = docs.filter((x) => x.list.every((d) => d.done));

  // Headcount by department, coloured by catalogue order.
  const byDept = DEPARTMENTS.map((d) => ({
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

  const probation = active.filter((e) => statusOf(e) === "ทดลองงาน");
  const fixedTerm = active.filter((e) => e.contract.endsAt);
  const gone = people.filter((e) => statusOf(e) === "ลาออก");

  const recent = people
    .flatMap((e) => eventsOf(e).map((ev) => ({ ...ev, e })))
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
          onOpenSection ? (
            <Button variant="primary" icon={<Users size={15} />} onClick={() => onOpenSection(0)}>
              เปิดรายชื่อพนักงาน
            </Button>
          ) : undefined
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
                        <span className="text-[11.5px] opacity-75">{t.kind === "สัญญาหมดอายุ" ? "เริ่มกระบวนการต่อสัญญา" : t.kind === "ครบกำหนดทดลองงาน" ? "ประเมินผลก่อนบรรจุ" : "ทบทวนค่าตอบแทนประจำปี"}</span>
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
                  <TrackerRow key={e.id} e={e} onOpen={onOpen} sub={eventsOf(e).find((ev) => ev.type === "ลาออก")?.date ?? ""}>
                    <Badge tone="idle" icon={<UserMinus size={11} />}>ลาออก</Badge>
                  </TrackerRow>
                ))}
              </TrackerGroup>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <Card title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />เหตุการณ์ทางบุคคลล่าสุด</span>} action={seeAll(3)}>
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
      </Reveal>

      <DetailModal open={picked !== null} title="แฟ้มพนักงาน" onClose={onClose} index={openAt ?? 0} total={people.length}>
        {picked && (
          <Record
            key={picked.id}
            employee={picked}
            status={statusOf(picked)}
            events={eventsOf(picked)}
            activity={activityOf(picked)}
            favourite={favourites.includes(picked.id)}
            openAt={TABS[0]}
            onFavourite={() => toggleFavourite(picked.id)}
            onAddEvent={(ev) => addEvent(picked.id, ev)}
            onAddNote={(entry) => addNote(picked.id, entry)}
            onResign={() => setResigning(picked)}
          />
        )}
      </DetailModal>
      <ResignDialog employee={resigning} onCancel={() => setResigning(null)} onConfirm={commitResignation} />
    </div>
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

function GenderMark({ id }: { id: number }) {
  const g = GENDER[id];
  if (!g) return null;
  return (
    <span className={"text-[12px] " + (g === "ชาย" ? "text-sky-500" : "text-pink-500")} title={g}>
      {g === "ชาย" ? "♂" : "♀"}
    </span>
  );
}

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

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge dot tone={status === "ทำงานอยู่" ? "ok" : status === "ทดลองงาน" ? "warn" : "idle"}>
      {status}
    </Badge>
  );
}

/** Each capability is a different set of columns over the same register. */
function columnsFor(
  tab: string | undefined,
  statusOf: (e: Employee) => string,
  eventsOf: (e: Employee) => PersonnelEvent[]
): Column<Employee>[] {
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
    { key: "status", header: "สถานะ", cell: (e) => <StatusBadge status={statusOf(e)} /> },
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
      { key: "status", header: "สถานะ", cell: (e) => <StatusBadge status={statusOf(e)} /> },
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
      { key: "last", header: "เหตุการณ์ล่าสุด", cell: (e) => { const t = eventsOf(e).at(-1)?.type; return t ? <Tag swatch={eventSwatch(t)}>{t}</Tag> : "—"; } },
      { key: "when", header: "เมื่อ", sort: (a, b) => (eventsOf(a).at(-1)?.date ?? "").localeCompare(eventsOf(b).at(-1)?.date ?? ""), cell: (e) => eventsOf(e).at(-1)?.date ?? "—" },
      { key: "detail", header: "รายละเอียด", cell: (e) => <span className="text-slate-500">{eventsOf(e).at(-1)?.detail ?? "—"}</span> },
      { key: "count", header: "ทั้งหมด", align: "right", sort: (a, b) => eventsOf(a).length - eventsOf(b).length, cell: (e) => eventsOf(e).length + " ครั้ง" },
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

function PersonCard({
  employee: e,
  status,
  index,
  favourite,
  onFavourite,
  onOpen,
}: {
  employee: Employee;
  status: string;
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
        <CardRow icon={<Clock3 size={13} />} label="สถานะ"><StatusBadge status={status} /></CardRow>
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
  status,
  events,
  activity,
  favourite,
  openAt,
  onFavourite,
  onAddEvent,
  onAddNote,
  onResign,
}: {
  employee: Employee;
  status: string;
  events: PersonnelEvent[];
  activity: ActivityEntry[];
  favourite: boolean;
  openAt: string;
  onFavourite: () => void;
  onAddEvent: (ev: PersonnelEvent) => void;
  onAddNote: (entry: ActivityEntry) => void;
  onResign: () => void;
}) {
  const [tab, setTab] = useState(openAt);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("บันทึก");
  const docs = documentsOf(e);
  const done = docs.filter((d) => d.done).length;

  const sendNote = () => {
    if (!note.trim()) return;
    onAddNote({ date: TODAY, time: "ตอนนี้", actor: "คุณ", text: noteType, target: note.trim() });
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

          {status !== "ลาออก" && (
            <button
              onClick={onResign}
              className="w-full rounded-xl border border-rose-200 py-2 text-[12.5px] text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              บันทึกการลาออก
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
              {tab === "ข้อมูลส่วนตัว" && <PersonalTab e={e} />}
              {tab === "ข้อมูลสัญญาจ้าง" && <ContractTab e={e} status={status} events={events} />}
              {tab === "ข้อมูลทางปกครอง" && <AdminTab e={e} docs={docs} done={done} />}
              {tab === "เหตุการณ์ทางบุคคล" && <EventsTab events={events} onAdd={onAddEvent} />}
              {tab === "ค่าตอบแทนและสวัสดิการ" && <PayTab e={e} />}
              {tab === "กิจกรรม" && <ActivityTab activity={activity} />}
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

function PersonalTab({ e }: { e: Employee }) {
  return (
    <div className="space-y-4">
      <Card title="ข้อมูลส่วนตัว">
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

function ContractTab({ e, status, events }: { e: Employee; status: string; events: PersonnelEvent[] }) {
  const probationOver = daysBetween(TODAY, e.contract.probationUntil) < 0;
  const renewed = events.some((ev) => ev.type === "ต่อสัญญา");
  const expiring = e.contract.endsAt ? daysBetween(TODAY, e.contract.endsAt) : null;
  const leftCo = status === "ลาออก";

  const steps = [
    { label: "รับเข้าทำงาน", state: "done" as const },
    { label: "ทดลองงาน", state: leftCo ? ("done" as const) : probationOver ? ("done" as const) : ("current" as const) },
    { label: "บรรจุ", state: leftCo ? ("done" as const) : probationOver ? ("done" as const) : ("todo" as const) },
    ...(e.contract.endsAt
      ? [{ label: "ต่อสัญญา", state: leftCo ? ("failed" as const) : renewed ? ("done" as const) : expiring !== null && expiring <= 90 ? ("current" as const) : ("todo" as const) }]
      : []),
    ...(leftCo ? [{ label: "ลาออก", state: "failed" as const }] : []),
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
        </div>
      </div>

      {expiring !== null && expiring >= 0 && expiring <= 90 && !leftCo && (
        <Note tone="warn">
          สัญญาหมดอายุ {e.contract.endsAt} เหลืออีก {expiring} วัน ควรเริ่มกระบวนการต่อสัญญาหรือแจ้งล่วงหน้าตามกฎหมายแรงงาน
        </Note>
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

function AdminTab({ e, docs, done }: { e: Employee; docs: { name: string; done: boolean }[]; done: number }) {
  return (
    <div className="space-y-4">
      <Card title="เอกสารประกอบการจ้าง">
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
            </li>
          ))}
        </ul>
      </Card>

      <Card title="ภาษีและประกันสังคม">
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

function EventsTab({ events, onAdd }: { events: PersonnelEvent[]; onAdd: (ev: PersonnelEvent) => void }) {
  const [logging, setLogging] = useState(false);
  const years = [...new Set(events.map((ev) => ev.date.slice(0, 4)))].sort().reverse();
  const groups = years.map((y) => ({
    heading: "ปี " + (Number(y) + 543),
    items: [...events].filter((ev) => ev.date.startsWith(y)).reverse().map((ev) => ({
      time: ev.date.slice(5),
      body: (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={ev.type === "ลาออก" ? "bad" : ev.type === "รับเข้าทำงาน" ? "ok" : "accent"}>{ev.type}</Badge>
          <span className="text-slate-700 dark:text-slate-200">{ev.detail}</span>
        </span>
      ),
    })),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-slate-500">{events.length} เหตุการณ์ในประวัติ</p>
        {!logging && (
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setLogging(true)}>
            บันทึกเหตุการณ์
          </Button>
        )}
      </div>
      {logging && (
        <AddEvent
          onCancel={() => setLogging(false)}
          onSave={(ev) => {
            onAdd(ev);
            setLogging(false);
          }}
        />
      )}
      <Card>
        <div className="p-4">
          <Timeline groups={groups} />
        </div>
      </Card>
    </div>
  );
}

function PayTab({ e }: { e: Employee }) {
  return (
    <div className="space-y-4">
      <div className={"flex items-center gap-4 p-4 " + SURFACE}>
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
        </div>
      </div>

      <Card title={`สวัสดิการ ${e.benefits.length} รายการ`}>
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

function AddEvent({ onSave, onCancel }: { onSave: (ev: PersonnelEvent) => void; onCancel: () => void }) {
  const [type, setType] = useState(EVENT_TYPES[1]);
  const [date, setDate] = useState(TODAY);
  const [detail, setDetail] = useState("");
  const [tried, setTried] = useState(false);
  const bad = tried && detail.trim().length < 5;

  return (
    <div className={"p-4 " + SURFACE}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ประเภทเหตุการณ์">
          <Select value={type} onChange={setType} options={EVENT_TYPES} className="w-full" />
        </Field>
        <Field label="วันที่มีผล">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD + " w-full"} />
        </Field>
      </div>
      <div className="mt-3">
        <Field
          label="รายละเอียด"
          error={bad ? "ใส่รายละเอียดอย่างน้อย 5 ตัวอักษร เพื่อให้คนอ่านประวัติย้อนหลังเข้าใจ" : undefined}
          hint="เช่น ย้ายจากฝ่ายขายไปฝ่ายการตลาด"
        >
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className={FIELD + " w-full " + (bad ? "border-rose-400 dark:border-rose-500" : "")}
          />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => {
            setTried(true);
            if (detail.trim().length >= 5) onSave({ date, type, detail: detail.trim() });
          }}
        >
          บันทึกเหตุการณ์
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- resign */

function ResignDialog({
  employee: e,
  onCancel,
  onConfirm,
}: {
  employee: Employee | null;
  onCancel: () => void;
  onConfirm: (e: Employee, reason: string, message: string) => void;
}) {
  const [reason, setReason] = useState(RESIGN_REASONS[0]);
  const [message, setMessage] = useState("");
  const ready = reason !== RESIGN_REASONS[0];

  // A courteous note drafted from the reason — a template filled in, not a
  // model call, and labelled as such so nobody mistakes it for one.
  const draft = () =>
    setMessage(
      `เรียน คุณ${e?.nickname ?? ""}\n\nบริษัทรับทราบการลาออกของท่าน (${reason}) และขอขอบคุณสำหรับการทำงานที่ผ่านมา ฝ่ายบุคคลจะติดต่อเรื่องการส่งมอบงาน ทรัพย์สินของบริษัท และเอกสารสิทธิประโยชน์ภายใน 3 วันทำการ\n\nขอให้ท่านประสบความสำเร็จในเส้นทางต่อไป`
    );

  const reset = () => {
    setReason(RESIGN_REASONS[0]);
    setMessage("");
  };

  return (
    <ConfirmDialog
      open={e !== null}
      title="บันทึกการลาออก"
      body="ระบุเหตุผลและข้อความถึงพนักงาน เพื่อให้กระบวนการเป็นระบบและสุภาพ"
      confirmLabel="บันทึกการลาออก"
      disabled={!ready}
      onCancel={() => {
        reset();
        onCancel();
      }}
      onConfirm={() => {
        if (e && ready) {
          onConfirm(e, reason, message);
          reset();
        }
      }}
      subject={
        e && (
          <div className={"flex items-center gap-3 p-3 " + SURFACE}>
            <Avatar name={e.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-50">
                {e.name} <GenderMark id={e.id} />
              </p>
              <p className="flex items-center gap-1 text-[11.5px] text-slate-500">
                <CalendarDays size={11} /> เริ่มงาน {e.contract.startedAt}
              </p>
            </div>
            <div className="text-right text-[11.5px] text-slate-500">
              <p className="flex items-center justify-end gap-1"><Briefcase size={11} />{e.position}</p>
              <p className="flex items-center justify-end gap-1"><Building size={11} />{e.department}</p>
            </div>
          </div>
        )
      }
      fields={
        <>
          <Field label="เหตุผล">
            <Select value={reason} onChange={setReason} options={RESIGN_REASONS} className="w-full" />
          </Field>
          <Field label="ข้อความถึงพนักงาน">
            <div className={"relative overflow-hidden " + SURFACE}>
              <textarea
                value={message}
                onChange={(ev) => setMessage(ev.target.value)}
                rows={5}
                placeholder="พิมพ์ข้อความ…"
                className="w-full resize-none bg-transparent px-3.5 py-3 pb-12 text-[13px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={draft}
                disabled={!ready}
                className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-orange-400 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm disabled:opacity-40"
              >
                <Sparkles size={13} />
                ร่างข้อความอัตโนมัติ
              </motion.button>
            </div>
          </Field>
        </>
      }
    />
  );
}

/* ---------------------------------------------------------------- wizard */

function employeeFrom(d: Draft, n: number): Employee {
  return {
    id: 1000 + n,
    code: "EMP-" + String(1000 + n).slice(1).padStart(4, "0"),
    name: d.name,
    nickname: d.nickname || d.name.split(" ")[0],
    position: d.position,
    department: d.department,
    status: "ทดลองงาน",
    personal: { birthDate: d.birthDate, nationalId: d.nationalId, phone: d.phone, email: d.email, address: "—" },
    contract: {
      type: d.type,
      startedAt: d.startedAt,
      endsAt: null,
      probationUntil: d.startedAt,
      baseSalary: Number(d.baseSalary) || 0,
      workDays: "จันทร์–ศุกร์",
    },
    admin: {
      ssoNumber: d.ssoNumber,
      taxId: d.nationalId.replace(/-/g, ""),
      bankName: d.bankName,
      bankAccount: d.bankAccount,
      pvdRate: 3,
    },
    benefits: ["ประกันสุขภาพกลุ่ม"],
    events: [{ date: d.startedAt, type: "รับเข้าทำงาน", detail: `ตำแหน่ง ${d.position} · เงินเดือน ${d.baseSalary}` }],
  } as Employee;
}

/**
 * Declared out here, not inside the wizard: a component defined during render
 * is a new type every render, so React remounts the input and takes the caret.
 */
function DraftText({
  value,
  onChange,
  label,
  error,
  hint,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD + " w-full " + (error ? "border-rose-400 dark:border-rose-500" : "")}
      />
    </Field>
  );
}

function NewEmployee({
  draft,
  setDraft,
  onDone,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const set = (k: keyof Draft) => (v: string) => setDraft({ ...draft, [k]: v });
  const text = (k: keyof Draft, label: string, errors: Record<string, string>, extra?: { hint?: string; placeholder?: string }) => (
    <DraftText value={draft[k]} onChange={set(k)} label={label} error={errors[k]} hint={extra?.hint} placeholder={extra?.placeholder} />
  );

  const steps: Step[] = [
    {
      title: "ข้อมูลส่วนตัว",
      validate: () => {
        const e: Record<string, string> = {};
        if (draft.name.trim().split(" ").length < 2) e.name = "ใส่ทั้งชื่อและนามสกุล";
        if (!/^\d-\d{4}-\d{5}-\d{2}-\d$/.test(draft.nationalId)) e.nationalId = "รูปแบบต้องเป็น 1-2345-67890-12-3";
        if (!/^0\d{2}-\d{3}-\d{4}$/.test(draft.phone)) e.phone = "รูปแบบต้องเป็น 08X-XXX-XXXX";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) e.email = "อีเมลไม่ถูกต้อง";
        return e;
      },
      render: (errors) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            {text("name", "ชื่อ-นามสกุล", errors, { placeholder: "สมชาย รักดี" })}
            {text("nickname", "ชื่อเล่น", errors, { placeholder: "ชาย" })}
          </div>
          {text("nationalId", "เลขบัตรประชาชน", errors, { hint: "ใส่ขีดตามบัตร", placeholder: "1-2345-67890-12-3" })}
          <div className="grid grid-cols-2 gap-3">
            {text("phone", "โทรศัพท์", errors, { hint: "รูปแบบ 08X-XXX-XXXX", placeholder: "081-234-5678" })}
            <Field label="วันเกิด">
              <input type="date" value={draft.birthDate} onChange={(e) => set("birthDate")(e.target.value)} className={FIELD + " w-full"} />
            </Field>
          </div>
          {text("email", "อีเมล", errors, { placeholder: "somchai@example.co.th" })}
        </>
      ),
    },
    {
      title: "ข้อมูลการจ้าง",
      validate: () => {
        const e: Record<string, string> = {};
        if (draft.position.trim().length < 2) e.position = "ระบุตำแหน่ง";
        if (!draft.baseSalary || Number(draft.baseSalary) < 10000) e.baseSalary = "เงินเดือนต้องไม่ต่ำกว่า 10,000 บาท";
        return e;
      },
      render: (errors) => (
        <>
          {text("position", "ตำแหน่ง", errors, { placeholder: "พนักงานขาย" })}
          <div className="grid grid-cols-2 gap-3">
            <Field label="แผนก"><Select value={draft.department} onChange={set("department")} options={DEPARTMENTS} className="w-full" /></Field>
            <Field label="ประเภทการจ้าง"><Select value={draft.type} onChange={set("type")} options={CONTRACT_TYPES} className="w-full" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="วันเริ่มงาน">
              <input type="date" value={draft.startedAt} onChange={(e) => set("startedAt")(e.target.value)} className={FIELD + " w-full"} />
            </Field>
            {text("baseSalary", "เงินเดือนฐาน (บาท)", errors, { placeholder: "22000" })}
          </div>
        </>
      ),
    },
    {
      title: "ข้อมูลทางปกครอง",
      validate: () => {
        const e: Record<string, string> = {};
        if (!/^\d{10}$/.test(draft.ssoNumber)) e.ssoNumber = "เลขประกันสังคมต้องมี 10 หลัก";
        if (draft.bankAccount.trim().length < 6) e.bankAccount = "ใส่เลขบัญชีให้ครบ";
        return e;
      },
      render: (errors) => (
        <>
          {text("ssoNumber", "เลขประกันสังคม", errors, { hint: "10 หลัก ไม่ต้องใส่ขีด", placeholder: "1234567890" })}
          <div className="grid grid-cols-2 gap-3">
            <Field label="ธนาคาร"><Select value={draft.bankName} onChange={set("bankName")} options={BANKS} className="w-full" /></Field>
            {text("bankAccount", "เลขบัญชี", errors, { placeholder: "xxx-x-x1234-5" })}
          </div>
          <Note tone="accent">
            เลขผู้เสียภาษีจะใช้เลขบัตรประชาชนที่กรอกไว้ และตั้งกองทุนสำรองเลี้ยงชีพเริ่มต้นที่ 3% แก้ได้ภายหลังในแฟ้มประวัติ
          </Note>
        </>
      ),
    },
  ];

  return <Wizard steps={steps} onDone={onDone} onCancel={onCancel} doneLabel="เพิ่มพนักงาน" />;
}
