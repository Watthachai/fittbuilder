import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, CalendarCheck, CalendarDays, CalendarX, CircleCheck, CircleX, Clock3, Coffee,
  FileText, Hourglass, LogIn, LogOut, MoonStar, Pencil, Plus, Search as SearchIcon, Sun,
  SunMedium, Timer, TrendingUp, TriangleAlert, UserRound, Users,
} from "lucide-react";
import { EMPLOYEES } from "../pa/data";
import type { Employee } from "../pa/data";
import {
  HOLIDAYS, LEAVES, LEAVE_TYPES, PERIOD_DAYS, PERIOD_END, PERIOD_START, PUNCHES, ROSTER,
  ROSTERED, SHIFTS, TODAY, WEEK_DAYS, addDays, attendanceOf, daysBetween, dowIndex, empName, hhmm,
  isHoliday, judge, punchesOn, shiftOf, usedLeave,
} from "./data";
import type { Leave, LeaveStatus, Punch } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, FIELD, Gauge, Heatmap, IconRow,
  Note, PageHead, Progress, Reveal, Search, Segmented, Select, StatStrip, Tabs, Tag, TintCard,
  WeekStrip, swatchFor,
} from "../ui";
import { ConfirmDialog, DataTable, DetailModal, Field, FormModal, Wizard } from "../kit";
import type { Column, Step } from "../kit";

const TABS = ["แผนกะการทำงาน", "บันทึกเวลาทำงาน", "การลาและการขาดงาน", "ติดตามการเข้างาน"];

const LEAVE_TAB_ICONS: Record<string, ReactNode> = {
  ใบลา: <FileText size={13} />,
  สิทธิ์คงเหลือ: <CalendarCheck size={13} />,
  ประวัติการลา: <Clock3 size={13} />,
};
const LEAVE_TABS = ["ใบลา", "สิทธิ์คงเหลือ", "ประวัติการลา"];

const SHIFT_ORDER = SHIFTS.map((s) => s.code);
const shiftSwatch = (code: string) => swatchFor(code, SHIFT_ORDER);

const TYPE_ORDER = LEAVE_TYPES.map((t) => t.name);
const typeSwatch = (name: string) => swatchFor(name, TYPE_ORDER);

const SHIFT_ICON: Record<string, ReactNode> = {
  A: <Sun size={14} />,
  B: <SunMedium size={14} />,
  N: <MoonStar size={14} />,
  O: <Coffee size={14} />,
  S: <Timer size={14} />,
};

const STATUS_TONE: Record<LeaveStatus, "ok" | "warn" | "bad"> = {
  อนุมัติแล้ว: "ok",
  รออนุมัติ: "warn",
  ไม่อนุมัติ: "bad",
};

const STATE_TONE: Record<string, "ok" | "warn" | "bad"> = {
  ปกติ: "ok",
  มาสาย: "warn",
  ขาดงาน: "bad",
};

/** A punch with its verdict and the person it belongs to, worked out once. */
type Day = { punch: Punch; employee: Employee; verdict: ReturnType<typeof judge> };

/* ----------------------------------------------------------------- screen */

export default function TmScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;

  const [leaves, setLeaves] = useState<Leave[]>(LEAVES);
  const [roster, setRoster] = useState<Record<number, string[]>>(ROSTER);
  const [corrections, setCorrections] = useState<Record<number, { in: string; out: string }>>({});

  const [day, setDay] = useState(TODAY);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ทั้งหมด");
  const [openLeaveAt, setOpenLeaveAt] = useState<number | null>(null);
  const [openDayAt, setOpenDayAt] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<Leave | null>(null);
  const [filing, setFiling] = useState(false);
  const [editingShift, setEditingShift] = useState<{ employeeId: number; dow: number } | null>(null);
  const [editingPunch, setEditingPunch] = useState<Punch | null>(null);

  const punchOf = (p: Punch): Punch => {
    const fix = corrections[p.id];
    return fix ? { ...p, in: fix.in, out: fix.out } : p;
  };

  const waiting = leaves.filter((l) => l.status === "รออนุมัติ");

  const decide = (id: number, next: LeaveStatus, note?: string) => {
    setLeaves((all) =>
      all.map((l) => (l.id === id ? { ...l, status: next, decidedBy: "คุณ", note: note ?? l.note } : l))
    );
    setRejecting(null);
  };

  const needle = q.trim().toLowerCase();
  const leaveRows = leaves.filter(
    (l) =>
      (status === "ทั้งหมด" || l.status === status) &&
      (needle === "" || [empName(l.employeeId), l.type, l.reason].some((t) => t.toLowerCase().includes(needle)))
  );
  const pickedLeave = openLeaveAt === null ? null : (leaveRows[openLeaveAt] ?? null);

  const dayRows: Day[] = useMemo(
    () =>
      punchesOn(day)
        .map(punchOf)
        .map((p) => ({ punch: p, employee: EMPLOYEES.find((e) => e.id === p.employeeId)!, verdict: judge(p) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, corrections]
  );
  const pickedDay = openDayAt === null ? null : (dayRows[openDayAt] ?? null);

  const panels = (
    <>
      <DetailModal
        open={pickedLeave !== null}
        title="ใบลา"
        onClose={() => setOpenLeaveAt(null)}
        index={openLeaveAt ?? 0}
        total={leaveRows.length}
        onStep={(d) => setOpenLeaveAt((i) => Math.min(leaveRows.length - 1, Math.max(0, (i ?? 0) + d)))}
      >
        {pickedLeave && (
          <LeaveRecord
            key={pickedLeave.id}
            leave={pickedLeave}
            leaves={leaves}
            onApprove={() => decide(pickedLeave.id, "อนุมัติแล้ว")}
            onReject={() => setRejecting(pickedLeave)}
          />
        )}
      </DetailModal>

      <DetailModal
        open={pickedDay !== null}
        title="บันทึกเวลาทำงาน"
        onClose={() => setOpenDayAt(null)}
        index={openDayAt ?? 0}
        total={dayRows.length}
        onStep={(d) => setOpenDayAt((i) => Math.min(dayRows.length - 1, Math.max(0, (i ?? 0) + d)))}
      >
        {pickedDay && (
          <DayRecord
            key={pickedDay.punch.id}
            row={pickedDay}
            corrected={corrections[pickedDay.punch.id] !== undefined}
            onEdit={() => setEditingPunch(pickedDay.punch)}
          />
        )}
      </DetailModal>

      <ConfirmDialog
        open={rejecting !== null}
        title="ไม่อนุมัติใบลา"
        body="ผู้ยื่นจะเห็นผลทันที และวันดังกล่าวจะกลับไปนับเป็นวันทำงานตามตารางกะ"
        subject={
          rejecting && (
            <span className="flex items-center gap-2.5">
              <Avatar name={empName(rejecting.employeeId)} size="sm" />
              <span>
                <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
                  {empName(rejecting.employeeId)}
                </span>
                <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
                  {rejecting.type} · {rejecting.from} ถึง {rejecting.to}
                </span>
              </span>
            </span>
          )
        }
        confirmLabel="ไม่อนุมัติ"
        onCancel={() => setRejecting(null)}
        onConfirm={() => rejecting && decide(rejecting.id, "ไม่อนุมัติ", "ไม่อนุมัติโดยหัวหน้างาน")}
      />

      <LeaveForm
        open={filing}
        leaves={leaves}
        onCancel={() => setFiling(false)}
        onSave={(l) => {
          setLeaves((all) => [l, ...all]);
          setFiling(false);
        }}
      />

      <ShiftPicker
        target={editingShift}
        roster={roster}
        onCancel={() => setEditingShift(null)}
        onPick={(employeeId, dow, code) => {
          setRoster((r) => ({ ...r, [employeeId]: r[employeeId].map((c, i) => (i === dow ? code : c)) }));
          setEditingShift(null);
        }}
      />

      <PunchForm
        punch={editingPunch}
        onCancel={() => setEditingPunch(null)}
        onSave={(id, times) => {
          setCorrections((c) => ({ ...c, [id]: times }));
          setEditingPunch(null);
        }}
      />
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          leaves={leaves}
          waiting={waiting}
          onOpenSection={onOpenSection}
          onOpenLeave={(l) => {
            setStatus("ทั้งหมด");
            setQ("");
            setOpenLeaveAt(leaves.indexOf(l));
          }}
          onApprove={(l) => decide(l.id, "อนุมัติแล้ว")}
        />
        {panels}
      </>
    );
  }

  return (
    <div>
      <PageHead
        title="เวลาทำงานและการลา"
        meta={`${tab} · งวด ${PERIOD_START} ถึง ${PERIOD_END} · รออนุมัติ ${waiting.length} ใบ`}
        right={
          tab === "การลาและการขาดงาน" ? (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setFiling(true)}>
              ยื่นใบลา
            </Button>
          ) : undefined
        }
      />

      {tab === "แผนกะการทำงาน" && <Roster roster={roster} onPick={setEditingShift} />}

      {tab === "บันทึกเวลาทำงาน" && (
        <TimeSheet rows={dayRows} day={day} setDay={setDay} onOpen={(r) => setOpenDayAt(dayRows.indexOf(r))} />
      )}

      {tab === "การลาและการขาดงาน" && (
        <Leaves
          rows={leaveRows}
          leaves={leaves}
          q={q}
          setQ={setQ}
          status={status}
          setStatus={setStatus}
          onOpen={(l) => setOpenLeaveAt(leaveRows.indexOf(l))}
          onApprove={(l) => decide(l.id, "อนุมัติแล้ว")}
          onReject={setRejecting}
        />
      )}

      {tab === "ติดตามการเข้างาน" && <AttendanceReport leaves={leaves} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="แผนกะและเวลาทำงาน" />
        <button data-fitt-screen="อนุมัติการลา" data-fitt-modal onClick={() => setOpenLeaveAt(0)} />
        <button data-fitt-screen="ยื่นใบลา" data-fitt-modal onClick={() => setFiling(true)} />
        <button data-fitt-screen="แก้เวลาตอกบัตร" data-fitt-modal onClick={() => setEditingPunch(PUNCHES[0])} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  leaves,
  waiting,
  onOpenSection,
  onOpenLeave,
  onApprove,
}: {
  leaves: Leave[];
  waiting: Leave[];
  onOpenSection?: (index: number) => void;
  onOpenLeave: (l: Leave) => void;
  onApprove: (l: Leave) => void;
}) {
  const stats = ROSTERED.map((e) => ({ e, a: attendanceOf(e.id, leaves) }));
  const scheduled = stats.reduce((n, s) => n + s.a.scheduled, 0);
  const absent = stats.reduce((n, s) => n + s.a.absent, 0);
  const late = stats.reduce((n, s) => n + s.a.late, 0);
  const otMin = stats.reduce((n, s) => n + s.a.otMin, 0);

  const byShift = SHIFTS.filter((s) => s.code !== "O")
    .map((s) => ({
      label: s.name,
      value: PUNCHES.filter((p) => p.shift === s.code).length,
      swatch: shiftSwatch(s.code),
    }))
    .filter((s) => s.value > 0);

  // The week ahead: leaves starting, and holidays.
  const [pick, setPick] = useState(TODAY);
  const week = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(TODAY, i);
    return {
      date: iso,
      dow: WEEK_DAYS[dowIndex(iso)],
      day: iso.slice(8),
      marked: leaves.some((l) => l.from <= iso && iso <= l.to) || isHoliday(iso),
    };
  });
  const agenda = [
    ...leaves
      .filter((l) => l.to >= pick)
      .map((l) => ({ date: l.from, kind: l.type, who: empName(l.employeeId), detail: `${l.from} ถึง ${l.to} · ${l.days} วัน`, status: l.status, leave: l })),
    ...HOLIDAYS.filter((h) => h.date >= pick).map((h) => ({ date: h.date, kind: "วันหยุดบริษัท", who: h.name, detail: h.date, status: undefined, leave: undefined })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  // Lateness by person across the last fortnight reads better as a grid than a list.
  const heatDays = PERIOD_DAYS.slice(-14);
  const lateOn = (name: string, date: string) => {
    const e = ROSTERED.find((x) => x.nickname === name);
    if (!e) return 0;
    const p = PUNCHES.find((x) => x.employeeId === e.id && x.date === date);
    if (!p) return 0;
    const j = judge(p);
    return j.state === "ขาดงาน" ? 60 : j.lateMin;
  };

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
        title="ภาพรวมเวลาทำงานและการลา"
        meta={`งวด ${PERIOD_START} ถึง ${PERIOD_END} · ${ROSTERED.length} คนในตารางกะ · ข้อมูล ณ ${TODAY}`}
        right={
          onOpenSection ? (
            <Button variant="primary" icon={<CalendarDays size={15} />} onClick={() => onOpenSection(1)}>
              เปิดบันทึกเวลาทำงาน
            </Button>
          ) : undefined
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            title={<span className="flex items-center gap-2"><CalendarCheck size={15} className="text-slate-400" />อัตราการเข้างานทั้งงวด</span>}
            action={seeAll(3)}
          >
            <div className="px-4 pt-3">
              <Gauge value={scheduled - absent} max={scheduled} label={`ตามกะ ${scheduled} วัน`} hex="#7c3aed" size={210} />
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats
                .filter((s) => s.a.absent > 0 || s.a.late > 0)
                .sort((a, b) => b.a.absent - a.a.absent || b.a.late - a.a.late)
                .slice(0, 3)
                .map(({ e, a }) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                    <Avatar name={e.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800 dark:text-slate-100">{e.name}</span>
                    <Badge tone={a.absent > 0 ? "bad" : "warn"}>
                      {a.absent > 0 ? `ขาด ${a.absent} วัน` : `สาย ${a.late} ครั้ง`}
                    </Badge>
                  </li>
                ))}
            </ul>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Clock3 size={15} className="text-slate-400" />สัดส่วนกะที่ใช้จริง</span>}
            action={seeAll(0)}
          >
            <div className="p-4">
              <Donut
                segments={byShift}
                center={
                  <span>
                    <span className="block text-[26px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {PUNCHES.length}
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">กะ</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><CalendarDays size={15} className="text-slate-400" />ปฏิทินการลาและวันหยุด</span>}
            action={seeAll(2)}
          >
            <div className="space-y-3 p-4">
              <WeekStrip days={week} active={pick} onPick={setPick} />
              {agenda.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-slate-400">ไม่มีรายการตั้งแต่วันที่เลือกเป็นต้นไป</p>
              ) : (
                agenda.map((a, i) => {
                  const sw = typeSwatch(a.kind);
                  return (
                    <TintCard key={i} swatch={sw}>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => a.leave && onOpenLeave(a.leave)}
                          className="min-w-0 text-left"
                          disabled={!a.leave}
                        >
                          <span className="block truncate text-[13.5px] font-semibold">{a.who}</span>
                          <span className="block text-[12px] opacity-75">{a.detail}</span>
                        </button>
                        {a.leave ? <Avatar name={a.who} size="sm" /> : <CalendarX size={16} className="opacity-60" />}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[11.5px] opacity-75">{a.status ?? "หยุดทั้งบริษัท"}</span>
                        <Tag swatch={sw}>{a.kind}</Tag>
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
            title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />การมาสายรายคนใน 14 วันล่าสุด</span>}
            subtitle="ช่องยิ่งเข้มยิ่งสายมาก ช่องเข้มที่สุดคือวันที่ไม่มีการตอกบัตร"
          >
            <Heatmap
              rows={ROSTERED.map((e) => e.nickname)}
              cols={heatDays.map((d) => d.slice(8))}
              value={(row, col) => lateOn(row, heatDays.find((d) => d.slice(8) === col)!)}
              format={(n) => (n >= 60 ? "ขาดงาน" : n === 0 ? "ตรงเวลา" : "สาย " + n + " นาที")}
            />
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Hourglass size={15} className="text-slate-400" />ใบลาที่รออนุมัติ</span>}
            action={seeAll(2)}
          >
            {waiting.length === 0 ? (
              <p className="py-14 text-center text-[12.5px] text-slate-400">ไม่มีใบลาค้างพิจารณา</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {waiting.map((l) => (
                  <li key={l.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Avatar name={empName(l.employeeId)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => onOpenLeave(l)}
                          className="block truncate text-left text-[13px] text-slate-900 hover:text-violet-700 dark:text-slate-50"
                        >
                          {empName(l.employeeId)}
                        </button>
                        <span className="block truncate text-[11.5px] text-slate-400">
                          {l.from} ถึง {l.to} · {l.days} วัน
                        </span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Tag swatch={typeSwatch(l.type)}>{l.type}</Tag>
                          <button
                            onClick={() => onApprove(l)}
                            className="rounded-lg border border-emerald-300 px-2 py-0.5 text-[11px] text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300"
                          >
                            อนุมัติ
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-2">
          <Card
            title={<span className="flex items-center gap-2"><Timer size={15} className="text-slate-400" />ล่วงเวลาสะสมรายคน</span>}
            subtitle={`รวมทั้งงวด ${hhmm(otMin)} ยอดนี้ส่งต่อให้โมดูลเงินเดือนใช้คำนวณ`}
          >
            <ColumnChart
              data={stats.map((s) => ({
                label: s.e.nickname,
                value: Math.round(s.a.otMin / 60),
                tone: s.a.otMin > 600 ? ("warn" as const) : undefined,
              }))}
              format={(n) => n + " ชม."}
              height={170}
            />
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />สรุปงวดนี้</span>}
          >
            <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800">
              {[
                { icon: <Users size={15} />, label: "วันทำงานตามกะ", value: scheduled + " วัน", tone: "text-slate-900 dark:text-slate-50" },
                { icon: <CircleX size={15} />, label: "ขาดงาน", value: absent + " วัน", tone: "text-rose-600 dark:text-rose-400" },
                { icon: <Clock3 size={15} />, label: "มาสาย", value: late + " ครั้ง", tone: "text-amber-600 dark:text-amber-400" },
                { icon: <Timer size={15} />, label: "ล่วงเวลา", value: hhmm(otMin), tone: "text-violet-600 dark:text-violet-300" },
              ].map((c) => (
                <div key={c.label} className="bg-white p-4 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-[12.5px] text-slate-500 dark:text-slate-400">
                    <span className="text-slate-400">{c.icon}</span>
                    {c.label}
                  </div>
                  <div className={"mt-1.5 text-[22px] font-semibold tabular-nums " + c.tone}>{c.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}

/* --------------------------------------------------------------- roster */

function Roster({
  roster,
  onPick,
}: {
  roster: Record<number, string[]>;
  onPick: (t: { employeeId: number; dow: number }) => void;
}) {
  const used = (code: string) => Object.values(roster).flat().filter((c) => c === code).length;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {SHIFTS.map((s) => {
          const sw = shiftSwatch(s.code);
          return (
            <TintCard key={s.code} swatch={sw}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                  {SHIFT_ICON[s.code]}
                  {s.name}
                </span>
                <Tag swatch={sw}>{s.code}</Tag>
              </div>
              <p className="mt-2 text-[15px] font-semibold tabular-nums">
                {s.start} – {s.end}
              </p>
              <p className="mt-1 text-[11.5px] opacity-75">
                {s.breakMin > 0 ? `พัก ${s.breakMin} นาที` : "ไม่ต้องเข้างาน"} · ใช้ {used(s.code)} ช่องในสัปดาห์
              </p>
            </TintCard>
          );
        })}
      </div>

      <Card
        title={<span className="flex items-center gap-2"><CalendarDays size={15} className="text-slate-400" />ตารางกะประจำสัปดาห์</span>}
        subtitle="กดที่ช่องใดก็ได้เพื่อเปลี่ยนกะของคนนั้นในวันนั้น"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-[13px]">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium">พนักงาน</th>
                {WEEK_DAYS.map((d) => (
                  <th key={d} className="px-2 py-3 text-center font-medium">
                    {d}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium">ชั่วโมงตามแผน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ROSTERED.map((e) => {
                const week = roster[e.id];
                const plannedMin = week.reduce((n, code) => {
                  if (code === "O") return n;
                  const s = shiftOf(code);
                  const [sh, sm] = s.start.split(":").map(Number);
                  const [eh, em] = s.end.split(":").map(Number);
                  let mins = eh * 60 + em - (sh * 60 + sm);
                  if (mins < 0) mins += 1440;
                  return n + mins - s.breakMin;
                }, 0);
                return (
                  <tr key={e.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={e.name} size="sm" />
                        <span>
                          <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">{e.name}</span>
                          <span className="block text-[11px] text-slate-400">{e.position}</span>
                        </span>
                      </span>
                    </td>
                    {week.map((code, i) => {
                      const s = shiftOf(code);
                      const sw = shiftSwatch(code);
                      return (
                        <td key={i} className="px-1.5 py-2 text-center">
                          <button
                            onClick={() => onPick({ employeeId: e.id, dow: i })}
                            title={`${s.name} ${s.start}–${s.end}`}
                            className={
                              "inline-flex w-full min-w-[3rem] items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11.5px] font-medium ring-1 transition hover:brightness-95 " +
                              sw.tint +
                              " " +
                              sw.ring
                            }
                          >
                            {SHIFT_ICON[code]}
                            {s.name.replace("กะ", "")}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {hhmm(plannedMin)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><CalendarX size={15} className="text-slate-400" />วันหยุดประจำปีที่กระทบตารางกะ</span>}
        subtitle="วันในรายการนี้จะไม่ถูกนับเป็นวันทำงาน และไม่ต้องตอกบัตร"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {HOLIDAYS.map((h) => (
            <li key={h.date} className="flex items-center gap-3 px-4 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CalendarX size={14} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800 dark:text-slate-100">{h.name}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">{h.date}</span>
              <Chip>{WEEK_DAYS[dowIndex(h.date)]}</Chip>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ timesheet */

function TimeSheet({
  rows,
  day,
  setDay,
  onOpen,
}: {
  rows: Day[];
  day: string;
  setDay: (d: string) => void;
  onOpen: (r: Day) => void;
}) {
  // A fortnight of days is enough to move around in without a date picker.
  const strip = PERIOD_DAYS.slice(-14).map((iso) => ({
    date: iso,
    dow: WEEK_DAYS[dowIndex(iso)],
    day: iso.slice(8),
    marked: punchesOn(iso).some((p) => judge(p).state !== "ปกติ"),
  }));

  const columns: Column<Day>[] = [
    {
      key: "name",
      header: "พนักงาน",
      width: "24%",
      sort: (a, b) => a.employee.name.localeCompare(b.employee.name, "th"),
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.employee.name} size="sm" />
          <span>
            <span className="block font-medium text-slate-900 dark:text-slate-50">{r.employee.name}</span>
            <span className="block text-[11px] text-slate-400">{r.employee.position}</span>
          </span>
        </span>
      ),
    },
    {
      key: "shift",
      header: "กะ",
      width: "13%",
      cell: (r) => <Tag swatch={shiftSwatch(r.punch.shift)}>{shiftOf(r.punch.shift).name}</Tag>,
    },
    {
      key: "in",
      header: "เข้า",
      width: "10%",
      sort: (a, b) => (a.punch.in ?? "").localeCompare(b.punch.in ?? ""),
      cell: (r) => (
        <span className={"tabular-nums " + (r.verdict.lateMin > 15 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-slate-700 dark:text-slate-200")}>
          {r.punch.in ?? "—"}
        </span>
      ),
    },
    {
      key: "out",
      header: "ออก",
      width: "10%",
      cell: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{r.punch.out ?? "—"}</span>,
    },
    {
      key: "worked",
      header: "ชั่วโมงทำงาน",
      align: "right",
      width: "15%",
      sort: (a, b) => a.verdict.workedMin - b.verdict.workedMin,
      cell: (r) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-200">
          {r.verdict.workedMin > 0 ? hhmm(r.verdict.workedMin) : "—"}
        </span>
      ),
    },
    {
      key: "ot",
      header: "ล่วงเวลา",
      align: "right",
      width: "13%",
      sort: (a, b) => a.verdict.otMin - b.verdict.otMin,
      cell: (r) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-200">{r.verdict.otMin ? hhmm(r.verdict.otMin) : "—"}</span>
      ),
    },
    {
      key: "state",
      header: "สถานะ",
      width: "15%",
      cell: (r) => (
        <Badge tone={STATE_TONE[r.verdict.state]} dot>
          {r.verdict.state}
          {r.verdict.state === "มาสาย" ? ` ${r.verdict.lateMin} น.` : ""}
        </Badge>
      ),
    },
  ];

  const late = rows.filter((r) => r.verdict.state === "มาสาย").length;
  const absent = rows.filter((r) => r.verdict.state === "ขาดงาน").length;

  return (
    <div className="space-y-3">
      <Card
        title={<span className="flex items-center gap-2"><CalendarDays size={15} className="text-slate-400" />เลือกวันที่</span>}
        subtitle="จุดใต้วันคือวันที่มีคนมาสายหรือขาดงาน"
      >
        <div className="p-4">
          <WeekStrip days={strip} active={day} onPick={setDay} />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Note tone="idle">ไม่มีการตอกบัตรในวันที่ {day} วันนี้อาจเป็นวันหยุดหรือทุกคนอยู่นอกตารางกะ</Note>
      ) : (
        <>
          {(late > 0 || absent > 0) && (
            <Note tone={absent > 0 ? "bad" : "warn"}>
              วันที่ {day} มีมาสาย {late} คน และขาดงาน {absent} คน กดที่แถวเพื่อดูรายละเอียดและแก้เวลาตอกบัตรที่บันทึกผิด
            </Note>
          )}
          <DataTable
            rows={rows}
            columns={columns}
            getId={(r) => r.punch.id}
            onOpen={onOpen}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">บันทึกวันที่ {day}</span>
                <Chip>{rows.length} คน</Chip>
                <span className="ml-auto text-[12px] text-slate-400">
                  รวมชั่วโมงทำงาน {hhmm(rows.reduce((n, r) => n + Math.max(0, r.verdict.workedMin), 0))}
                </span>
              </div>
            }
          />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- leave */

function Leaves({
  rows,
  leaves,
  q,
  setQ,
  status,
  setStatus,
  onOpen,
  onApprove,
  onReject,
}: {
  rows: Leave[];
  leaves: Leave[];
  q: string;
  setQ: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  onOpen: (l: Leave) => void;
  onApprove: (l: Leave) => void;
  onReject: (l: Leave) => void;
}) {
  const [view, setView] = useState(LEAVE_TABS[0]);

  const columns: Column<Leave>[] = [
    {
      key: "name",
      header: "พนักงาน",
      width: "22%",
      sort: (a, b) => empName(a.employeeId).localeCompare(empName(b.employeeId), "th"),
      cell: (l) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={empName(l.employeeId)} size="sm" />
          <span className="font-medium text-slate-900 dark:text-slate-50">{empName(l.employeeId)}</span>
        </span>
      ),
    },
    {
      key: "type",
      header: "ประเภท",
      width: "16%",
      sort: (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
      cell: (l) => <Tag swatch={typeSwatch(l.type)}>{l.type}</Tag>,
    },
    {
      key: "range",
      header: "ช่วงวัน",
      width: "22%",
      sort: (a, b) => a.from.localeCompare(b.from),
      cell: (l) => (
        <span className="tabular-nums text-slate-600 dark:text-slate-300">
          {l.from} → {l.to}
        </span>
      ),
    },
    {
      key: "days",
      header: "จำนวน",
      align: "right",
      width: "10%",
      sort: (a, b) => a.days - b.days,
      cell: (l) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{l.days} วัน</span>,
    },
    {
      key: "status",
      header: "สถานะ",
      width: "15%",
      cell: (l) => <Badge tone={STATUS_TONE[l.status]} dot>{l.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-3">
      <Tabs tabs={LEAVE_TABS} active={view} onPick={setView} icons={LEAVE_TAB_ICONS} id="leave" />

      {view === "ใบลา" && (
        <DataTable
          rows={rows}
          columns={columns}
          getId={(l) => l.id}
          onOpen={onOpen}
          selectable
          bulkActions={(selected, clear) => (
            <button
              onClick={() => {
                selected.filter((l) => l.status === "รออนุมัติ").forEach(onApprove);
                clear();
              }}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[12px] font-medium text-white transition hover:bg-emerald-700"
            >
              อนุมัติที่เลือกไว้
            </button>
          )}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อ ประเภทลา หรือเหตุผล" icon={<SearchIcon size={14} />} />
              <Select value={status} onChange={setStatus} options={["ทั้งหมด", "รออนุมัติ", "อนุมัติแล้ว", "ไม่อนุมัติ"]} />
              <span className="ml-auto text-[12px] text-slate-400">แสดง {rows.length} ใบ</span>
            </div>
          }
          trailing={(l) =>
            l.status === "รออนุมัติ" ? (
              <span className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onApprove(l)}
                  title="อนุมัติใบลานี้"
                  aria-label="อนุมัติใบลานี้"
                  className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
                >
                  <CircleCheck size={16} />
                </button>
                <button
                  onClick={() => onReject(l)}
                  title="ไม่อนุมัติใบลานี้"
                  aria-label="ไม่อนุมัติใบลานี้"
                  className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                >
                  <CircleX size={16} />
                </button>
              </span>
            ) : (
              <span className="block truncate text-right text-[11px] text-slate-400">{l.decidedBy ?? "—"}</span>
            )
          }
        />
      )}

      {view === "สิทธิ์คงเหลือ" && <Balances leaves={leaves} />}

      {view === "ประวัติการลา" && <LeaveHistory leaves={leaves} onOpen={onOpen} />}
    </div>
  );
}

function Balances({ leaves }: { leaves: Leave[] }) {
  const paid = LEAVE_TYPES.filter((t) => t.paid);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {EMPLOYEES.filter((e) => e.status !== "ลาออก").map((e) => {
        const total = paid.reduce((n, t) => n + t.quota, 0);
        const spent = paid.reduce((n, t) => n + usedLeave(e.id, t.name, leaves), 0);
        return (
          <Card
            key={e.id}
            title={
              <span className="flex items-center gap-2.5">
                <Avatar name={e.name} size="sm" />
                {e.name}
              </span>
            }
            subtitle={`${e.position} · ${e.department}`}
            action={<Badge tone={spent > total * 0.7 ? "warn" : "ok"}>ใช้ไป {spent} วัน</Badge>}
          >
            <div className="space-y-3 p-4">
              {paid.map((t) => {
                const used = usedLeave(e.id, t.name, leaves);
                const left = t.quota - used;
                return (
                  <div key={t.name}>
                    <div className="mb-1 flex items-center gap-2 text-[12.5px]">
                      <Dot className={typeSwatch(t.name).dot} />
                      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{t.name}</span>
                      <span className={"tabular-nums " + (left <= 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400")}>
                        เหลือ {left} จาก {t.quota} วัน
                      </span>
                    </div>
                    <Bar pct={(used / t.quota) * 100} tone={left <= 0 ? "bad" : left <= 1 ? "warn" : "ok"} width="w-full" />
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function LeaveHistory({ leaves, onOpen }: { leaves: Leave[]; onOpen: (l: Leave) => void }) {
  const byMonth = [...leaves]
    .sort((a, b) => b.from.localeCompare(a.from))
    .reduce<Record<string, Leave[]>>((m, l) => {
      const key = l.from.slice(0, 7);
      return { ...m, [key]: [...(m[key] ?? []), l] };
    }, {});

  return (
    <div className="space-y-3">
      {Object.entries(byMonth).map(([month, list]) => (
        <Card
          key={month}
          title={<span className="flex items-center gap-2"><CalendarDays size={15} className="text-slate-400" />{month}</span>}
          action={<Chip>{list.reduce((n, l) => n + l.days, 0)} วัน</Chip>}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar name={empName(l.employeeId)} size="sm" />
                <button onClick={() => onOpen(l)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{empName(l.employeeId)}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">{l.reason || "ไม่ได้ระบุเหตุผล"}</span>
                </button>
                <Tag swatch={typeSwatch(l.type)}>{l.type}</Tag>
                <span className="shrink-0 text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                  {l.from} → {l.to}
                </span>
                <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- attendance */

function AttendanceReport({ leaves }: { leaves: Leave[] }) {
  const rows = ROSTERED.map((e) => ({ e, a: attendanceOf(e.id, leaves) }));
  const scheduled = rows.reduce((n, r) => n + r.a.scheduled, 0);
  const absent = rows.reduce((n, r) => n + r.a.absent, 0);
  const late = rows.reduce((n, r) => n + r.a.late, 0);
  const ot = rows.reduce((n, r) => n + r.a.otMin, 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title={`สรุปงวด ${PERIOD_START} ถึง ${PERIOD_END}`}
        icon={<TrendingUp size={15} />}
        cells={[
          { icon: <CalendarCheck size={13} />, label: "อัตราเข้างาน", value: Math.round(((scheduled - absent) / scheduled) * 100) + "%", sub: `จากวันทำงานตามกะ ${scheduled} วัน`, tone: "ok" },
          { icon: <Clock3 size={13} />, label: "มาสาย", value: late + " ครั้ง", sub: "นับเมื่อเข้างานช้ากว่ากะเกิน 15 นาที", tone: "warn" },
          { icon: <CircleX size={13} />, label: "ขาดงาน", value: absent + " วัน", sub: "วันที่อยู่ในตารางกะแต่ไม่มีการตอกบัตร", tone: "bad" },
          { icon: <Timer size={13} />, label: "ล่วงเวลา", value: hhmm(ot), sub: "อยู่เกินกะเกิน 30 นาทีจึงเริ่มนับ", tone: "accent" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Users size={15} className="text-slate-400" />การเข้างานรายคน</span>}
        subtitle="วันลาที่อนุมัติแล้วไม่ถูกนับเป็นขาดงาน เพราะวันนั้นไม่ได้อยู่ในหน้าที่ต้องมาทำงาน"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-[13px]">
            <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">พนักงาน</th>
                <th className="px-4 py-3 text-right font-medium">วันตามกะ</th>
                <th className="px-4 py-3 text-right font-medium">มาทำงาน</th>
                <th className="px-4 py-3 text-right font-medium">มาสาย</th>
                <th className="px-4 py-3 text-right font-medium">ขาดงาน</th>
                <th className="px-4 py-3 text-right font-medium">ลา</th>
                <th className="px-4 py-3 text-right font-medium">ล่วงเวลา</th>
                <th className="px-4 py-3 font-medium">อัตราเข้างาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(({ e, a }) => (
                <tr key={e.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={e.name} size="sm" />
                      <span>
                        <span className="block font-medium text-slate-900 dark:text-slate-50">{e.name}</span>
                        <span className="block text-[11px] text-slate-400">{e.department}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{a.scheduled}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{a.worked}</td>
                  <td className={"px-4 py-2.5 text-right tabular-nums " + (a.late > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-300 dark:text-slate-600")}>
                    {a.late || "—"}
                  </td>
                  <td className={"px-4 py-2.5 text-right tabular-nums " + (a.absent > 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-300 dark:text-slate-600")}>
                    {a.absent || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{a.leaveDays || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{a.otMin ? hhmm(a.otMin) : "—"}</td>
                  <td className="px-4 py-2.5">
                    <Bar pct={a.rate} tone={a.rate === 100 ? "ok" : a.rate >= 90 ? "warn" : "bad"} width="w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><Clock3 size={15} className="text-slate-400" />ชั่วโมงทำงานสะสมรายคน</span>}
          subtitle="หักเวลาพักตามกะแล้ว"
        >
          <ColumnChart
            data={rows.map((r) => ({ label: r.e.nickname, value: Math.round(r.a.workedMin / 60) }))}
            format={(n) => n + " ชม."}
            height={170}
          />
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><FileText size={15} className="text-slate-400" />วันลาที่ใช้ไปตามประเภท</span>}
          subtitle="นับเฉพาะใบลาที่อนุมัติแล้ว"
        >
          <div className="p-4">
            <Donut
              segments={LEAVE_TYPES.map((t) => ({
                label: t.name,
                value: leaves.filter((l) => l.type === t.name && l.status === "อนุมัติแล้ว").reduce((n, l) => n + l.days, 0),
                swatch: typeSwatch(t.name),
              })).filter((s) => s.value > 0)}
              center={
                <span>
                  <span className="block text-[26px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                    {leaves.filter((l) => l.status === "อนุมัติแล้ว").reduce((n, l) => n + l.days, 0)}
                  </span>
                  <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">วัน</span>
                </span>
              }
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function LeaveRecord({
  leave,
  leaves,
  onApprove,
  onReject,
}: {
  leave: Leave;
  leaves: Leave[];
  onApprove: () => void;
  onReject: () => void;
}) {
  const type = LEAVE_TYPES.find((t) => t.name === leave.type)!;
  const used = usedLeave(leave.employeeId, leave.type, leaves);
  const sw = typeSwatch(leave.type);
  const days = daysBetween(leave.from, leave.to);

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 dark:border-slate-800">
        <Avatar name={empName(leave.employeeId)} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{empName(leave.employeeId)}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {leave.from} ถึง {leave.to} · {leave.days} วัน · ยื่นเมื่อ {leave.filedAt}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag swatch={sw}>{leave.type}</Tag>
            <Badge tone={STATUS_TONE[leave.status]} dot>{leave.status}</Badge>
            {type.paid ? <Chip>ได้รับค่าจ้าง</Chip> : <Chip>ไม่ได้รับค่าจ้าง</Chip>}
          </div>
        </div>
        {leave.status === "รออนุมัติ" && (
          <div className="flex shrink-0 gap-2">
            <Button variant="primary" icon={<CircleCheck size={15} />} onClick={onApprove}>
              อนุมัติ
            </Button>
            <Button variant="secondary" icon={<CircleX size={15} />} onClick={onReject}>
              ไม่อนุมัติ
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="space-y-1">
          <IconRow icon={<FileText size={14} />} label="เหตุผล">{leave.reason || "ไม่ได้ระบุ"}</IconRow>
          <IconRow icon={<CalendarDays size={14} />} label="วันที่ลา">
            {days.map((d) => `${d.slice(8)}/${d.slice(5, 7)}`).join(" · ")}
          </IconRow>
          <IconRow icon={<UserRound size={14} />} label="ผู้พิจารณา">{leave.decidedBy ?? "ยังไม่มีการพิจารณา"}</IconRow>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">สิทธิ์ {leave.type}</p>
          <Progress done={used} total={type.quota} label={`ใช้ไปแล้ว ${used} จาก ${type.quota} วัน`} />
        </div>

        {leave.note && <Note tone={leave.status === "ไม่อนุมัติ" ? "bad" : "idle"}>{leave.note}</Note>}

        {leave.status === "รออนุมัติ" && used + leave.days > type.quota && (
          <Note tone="warn">
            อนุมัติใบนี้แล้วจะใช้สิทธิ์ {leave.type} เกินโควตาไป {used + leave.days - type.quota} วัน
            ส่วนที่เกินจะกลายเป็นลาไม่รับค่าจ้าง
          </Note>
        )}

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ตารางกะในวันที่ลา</p>
          <ul className="space-y-1.5">
            {days.map((d) => {
              const code = ROSTER[leave.employeeId]?.[dowIndex(d)] ?? "O";
              const s = shiftOf(code);
              return (
                <li key={d} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-24 shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{d}</span>
                  <Tag swatch={shiftSwatch(code)}>{s.name}</Tag>
                  <span className="text-slate-400">{code === "O" ? "เป็นวันหยุดอยู่แล้ว" : `${s.start}–${s.end}`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DayRecord({ row, corrected, onEdit }: { row: Day; corrected: boolean; onEdit: () => void }) {
  const s = shiftOf(row.punch.shift);
  const a = attendanceOf(row.employee.id);

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 dark:border-slate-800">
        <Avatar name={row.employee.name} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{row.employee.name}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {row.punch.date} · {s.name} {s.start}–{s.end}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATE_TONE[row.verdict.state]} dot>{row.verdict.state}</Badge>
            <Tag swatch={shiftSwatch(row.punch.shift)}>{s.name}</Tag>
            {corrected && <Chip>แก้ไขแล้ว</Chip>}
          </div>
        </div>
        <Button variant="secondary" icon={<Pencil size={15} />} onClick={onEdit}>
          แก้เวลาตอกบัตร
        </Button>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <LogIn size={15} />, label: "เวลาเข้า", value: row.punch.in ?? "ไม่ได้ตอก" },
            { icon: <LogOut size={15} />, label: "เวลาออก", value: row.punch.out ?? "ไม่ได้ตอก" },
            { icon: <Clock3 size={15} />, label: "ชั่วโมงทำงาน", value: row.verdict.workedMin > 0 ? hhmm(row.verdict.workedMin) : "—" },
            { icon: <Timer size={15} />, label: "ล่วงเวลา", value: row.verdict.otMin ? hhmm(row.verdict.otMin) : "—" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                <span className="text-slate-400">{c.icon}</span>
                {c.label}
              </div>
              <div className="mt-1 text-[16px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
            </div>
          ))}
        </div>

        {row.verdict.state === "มาสาย" && (
          <Note tone="warn">
            เข้างานช้ากว่าเวลาเริ่มกะ {row.verdict.lateMin} นาที เกินเกณฑ์ 15 นาทีจึงนับเป็นมาสาย
          </Note>
        )}
        {row.verdict.state === "ขาดงาน" && (
          <Note tone="bad">
            วันนี้อยู่ในตารางกะแต่ไม่มีการตอกบัตรทั้งเข้าและออก ถ้าลืมตอกให้แก้เวลาแทนการปล่อยเป็นขาดงาน
          </Note>
        )}

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">สถิติทั้งงวดของคนนี้</p>
          <div className="space-y-1">
            <IconRow icon={<CalendarCheck size={14} />} label="วันตามกะ">{a.scheduled} วัน</IconRow>
            <IconRow icon={<Clock3 size={14} />} label="มาสาย">{a.late} ครั้ง</IconRow>
            <IconRow icon={<CircleX size={14} />} label="ขาดงาน">{a.absent} วัน</IconRow>
            <IconRow icon={<Timer size={14} />} label="ล่วงเวลาสะสม">{hhmm(a.otMin)}</IconRow>
          </div>
          <div className="mt-2">
            <Bar pct={a.rate} tone={a.rate === 100 ? "ok" : a.rate >= 90 ? "warn" : "bad"} width="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- forms */

function ShiftPicker({
  target,
  roster,
  onCancel,
  onPick,
}: {
  target: { employeeId: number; dow: number } | null;
  roster: Record<number, string[]>;
  onCancel: () => void;
  onPick: (employeeId: number, dow: number, code: string) => void;
}) {
  const current = target ? roster[target.employeeId][target.dow] : "";
  return (
    <FormModal
      open={target !== null}
      title="เปลี่ยนกะ"
      subtitle={target ? `${empName(target.employeeId)} · วัน${WEEK_DAYS[target.dow]}` : undefined}
      onClose={onCancel}
      size="sm"
    >
      <ul className="space-y-1.5">
        {SHIFTS.map((s) => {
          const sw = shiftSwatch(s.code);
          const on = s.code === current;
          return (
            <li key={s.code}>
              <button
                onClick={() => target && onPick(target.employeeId, target.dow, s.code)}
                className={
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition " +
                  (on ? sw.tint + " " + sw.ring : "ring-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60")
                }
              >
                <span className={"grid size-8 shrink-0 place-items-center rounded-full " + sw.tint}>
                  {SHIFT_ICON[s.code]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">{s.name}</span>
                  <span className="block text-[11.5px] text-slate-400">
                    {s.start} – {s.end}
                    {s.breakMin > 0 ? ` · พัก ${s.breakMin} นาที` : ""}
                  </span>
                </span>
                {on && <CircleCheck size={16} className="shrink-0 text-violet-600 dark:text-violet-300" />}
              </button>
            </li>
          );
        })}
      </ul>
    </FormModal>
  );
}

function PunchForm({
  punch,
  onCancel,
  onSave,
}: {
  punch: Punch | null;
  onCancel: () => void;
  onSave: (id: number, times: { in: string; out: string }) => void;
}) {
  const [inAt, setInAt] = useState("");
  const [outAt, setOutAt] = useState("");
  const [error, setError] = useState<string>();

  const open = punch !== null;
  const start = punch ? shiftOf(punch.shift) : null;

  return (
    <FormModal
      open={open}
      title="แก้เวลาตอกบัตร"
      subtitle={punch ? `${empName(punch.employeeId)} · ${punch.date}` : undefined}
      onClose={onCancel}
      size="sm"
    >
      <div className="space-y-3">
        <Note tone="idle">
          การแก้เวลาไม่ลบของเดิม ระบบจะทำเครื่องหมายว่าแถวนี้ถูกแก้ไขไว้ให้ตรวจสอบย้อนหลังได้
          {start ? ` กะนี้เริ่ม ${start.start} เลิก ${start.end}` : ""}
        </Note>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เวลาเข้า" error={error} hint="รูปแบบ ชช:นน">
            <input
              value={inAt}
              onChange={(e) => setInAt(e.target.value)}
              placeholder={punch?.in ?? start?.start ?? "08:00"}
              className={FIELD + " w-full tabular-nums"}
            />
          </Field>
          <Field label="เวลาออก" hint="รูปแบบ ชช:นน">
            <input
              value={outAt}
              onChange={(e) => setOutAt(e.target.value)}
              placeholder={punch?.out ?? start?.end ?? "17:00"}
              className={FIELD + " w-full tabular-nums"}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const ok = (t: string) => /^\d{2}:\d{2}$/.test(t);
              if (!ok(inAt) || !ok(outAt)) {
                setError("กรอกเวลาทั้งสองช่องในรูปแบบ ชช:นน");
                return;
              }
              setError(undefined);
              if (punch) onSave(punch.id, { in: inAt, out: outAt });
              setInAt("");
              setOutAt("");
            }}
          >
            บันทึกเวลาใหม่
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

type LeaveDraft = { employee: string; type: string; from: string; to: string; reason: string };
const EMPTY_LEAVE: LeaveDraft = { employee: "", type: "", from: "", to: "", reason: "" };

function LeaveForm({
  open,
  leaves,
  onCancel,
  onSave,
}: {
  open: boolean;
  leaves: Leave[];
  onCancel: () => void;
  onSave: (l: Leave) => void;
}) {
  const [draft, setDraft] = useState<LeaveDraft>(EMPTY_LEAVE);

  const staff = EMPLOYEES.filter((e) => e.status !== "ลาออก");
  const names = staff.map((e) => e.name);
  const chosen = staff.find((e) => e.name === (draft.employee || names[0]))!;
  const type = draft.type || LEAVE_TYPES[0].name;
  const quota = LEAVE_TYPES.find((t) => t.name === type)!;
  const used = usedLeave(chosen.id, type, leaves);
  const span = /^\d{4}-\d{2}-\d{2}$/.test(draft.from) && /^\d{4}-\d{2}-\d{2}$/.test(draft.to) && draft.to >= draft.from
    ? daysBetween(draft.from, draft.to).length
    : 0;

  const steps: Step[] = [
    {
      title: "ผู้ลาและประเภท",
      render: () => (
        <div className="space-y-3">
          <Field label="พนักงาน">
            <Select value={draft.employee || names[0]} onChange={(v) => setDraft((d) => ({ ...d, employee: v }))} options={names} className="w-full" />
          </Field>
          <Field label="ประเภทการลา" hint={`เหลือ ${quota.quota - used} จาก ${quota.quota} วัน`}>
            <Select value={type} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} options={LEAVE_TYPES.map((t) => t.name)} className="w-full" />
          </Field>
          <Progress done={used} total={quota.quota} label={`ใช้ไปแล้ว ${used} วัน`} />
        </div>
      ),
    },
    {
      title: "ช่วงวัน",
      validate: (): Record<string, string> => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.from)) return { from: "กรอกวันที่เริ่มในรูปแบบ ปปปป-ดด-วว" };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.to)) return { to: "กรอกวันที่สิ้นสุดในรูปแบบ ปปปป-ดด-วว" };
        if (draft.to < draft.from) return { to: "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่ม" };
        return {};
      },
      render: (errors) => (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ตั้งแต่วันที่" error={errors.from}>
              <input value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} placeholder="2026-10-01" className={FIELD + " w-full"} />
            </Field>
            <Field label="ถึงวันที่" error={errors.to}>
              <input value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} placeholder="2026-10-03" className={FIELD + " w-full"} />
            </Field>
          </div>
          {span > 0 && (
            <Note tone={used + span > quota.quota ? "warn" : "idle"}>
              ลาทั้งหมด {span} วัน
              {used + span > quota.quota
                ? ` เกินสิทธิ์ ${type} ไป ${used + span - quota.quota} วัน ส่วนที่เกินจะเป็นลาไม่รับค่าจ้าง`
                : ` เหลือสิทธิ์อีก ${quota.quota - used - span} วันหลังจากใบนี้`}
            </Note>
          )}
        </div>
      ),
    },
    {
      title: "เหตุผล",
      validate: (): Record<string, string> =>
        draft.reason.trim().length >= 5 ? {} : { reason: "เขียนเหตุผลอย่างน้อย 5 ตัวอักษร" },
      render: (errors) => (
        <Field label="เหตุผลการลา" error={errors.reason} hint="หัวหน้างานจะเห็นข้อความนี้ตอนพิจารณา">
          <textarea
            value={draft.reason}
            onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
            rows={4}
            placeholder="เช่น ไข้หวัด มีใบรับรองแพทย์"
            className={FIELD + " w-full resize-none"}
          />
        </Field>
      ),
    },
  ];

  return (
    <FormModal open={open} title="ยื่นใบลา" subtitle="กรอกสามขั้นตอน ระบบตรวจสิทธิ์คงเหลือให้ระหว่างกรอก" onClose={onCancel}>
      <Wizard
        steps={steps}
        onCancel={() => {
          setDraft(EMPTY_LEAVE);
          onCancel();
        }}
        onDone={() => {
          onSave({
            id: Math.max(0, ...leaves.map((l) => l.id)) + 1,
            employeeId: chosen.id,
            type,
            from: draft.from,
            to: draft.to,
            days: span,
            status: "รออนุมัติ",
            reason: draft.reason.trim(),
            filedAt: TODAY,
          });
          setDraft(EMPTY_LEAVE);
        }}
        doneLabel="ยื่นใบลา"
      />
    </FormModal>
  );
}
