import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeftRight, ArrowRight, BellRing, CalendarCheck, CalendarDays, CalendarPlus, CalendarX, CircleCheck, CircleX,
  Clock3, FileSpreadsheet, FileText, Hourglass, Pencil, Plus, Printer, Search as SearchIcon, Timer, Trash2,
  TrendingUp, TriangleAlert, UserPlus, Users,
} from "lucide-react";
import { EMPLOYEES } from "../pa/data";
import {
  FOLLOW_UPS, HOLIDAYS, LEAVES, LEAVE_TYPES, OT_REQUESTS, PERIOD_DAYS, PERIOD_END, PERIOD_START, PUNCHES,
  PUNCH_FIXES, SHIFTS, SHIFT_SWAPS, TODAY, WEEK_DAYS, addDays, approveLeave, approveOt, approvePunchFix,
  approveSwap, approvedOtHours, attendanceOf, canCancelLeave, cancelLeave, dowIndex, empName, followUpsOf, hhmm,
  isHoliday, judge, leaveBalance, leaveNo, pendingFixOf, plannedMinutes, punchesOn, rejectLeave, rejectOt,
  rejectPunchFix, rejectSwap, removeHoliday, rosterOf, rostered, shiftOf, unrostered,
} from "./data";
import type { FollowUp, FollowUpKind, Holiday, Leave, LeaveDraft, OtRequest, Punch, PunchFix, ShiftSwap } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, Gauge, Heatmap, Note, PageHead, Reveal,
  Search, Select, StatStrip, Tabs, Tag, TintCard, WeekStrip,
} from "../ui";
import { ConfirmDialog, DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";
import {
  FollowUpForm, HolidayForm, LeaveForm, OtForm, PunchForm, RosterForm, ShiftPicker, SwapForm,
} from "./forms";
import { DayRecord, LeaveRecord, PersonRecord } from "./records";
import type { Day } from "./records";
import { LeavePaper, WarningPaper } from "./documents";
import {
  MiniButton, PrintModal, REQUEST_TONE, ReasonDialog, SHIFT_ICON, STATE_TONE, STATUS_TONE, TYPE_ORDER, Who,
  attempt, shiftSwatch, typeSwatch,
} from "./shared";

const TABS = ["แผนกะการทำงาน", "บันทึกเวลาทำงาน", "การลาและการขาดงาน", "ติดตามการเข้างาน"];

const LEAVE_TAB_ICONS: Record<string, ReactNode> = {
  ใบลา: <FileText size={13} />,
  สิทธิ์คงเหลือ: <CalendarCheck size={13} />,
  การขาดงาน: <CircleX size={13} />,
  ประวัติการลา: <Clock3 size={13} />,
};
const LEAVE_TABS = ["ใบลา", "สิทธิ์คงเหลือ", "การขาดงาน", "ประวัติการลา"];

const TIME_TABS = ["เวลาเข้าออกรายวัน", "คำขอแก้เวลา", "คำขอล่วงเวลา"];
const TIME_TAB_ICONS: Record<string, ReactNode> = {
  เวลาเข้าออกรายวัน: <Clock3 size={13} />,
  คำขอแก้เวลา: <Pencil size={13} />,
  คำขอล่วงเวลา: <Timer size={13} />,
};

/** The four kinds of request a supervisor can turn down, each with a reason on the record. */
type Rejection =
  | { kind: "leave"; item: Leave }
  | { kind: "fix"; item: PunchFix }
  | { kind: "ot"; item: OtRequest }
  | { kind: "swap"; item: ShiftSwap };

const byNewest = <T extends { filedAt: string; id: number }>(list: T[]) =>
  [...list].sort((a, b) => b.filedAt.localeCompare(a.filedAt) || b.id - a.id);

/* ------------------------------------------------------------ approvals */

const approveLeaveOf = (l: Leave) =>
  attempt(() => approveLeave(l.id), `อนุมัติใบลา ${leaveNo(l)} ของ${empName(l.employeeId)}แล้ว สิทธิ์คงเหลือขยับแล้ว`);
const approveFixOf = (f: PunchFix) =>
  attempt(() => approvePunchFix(f.id), `อนุมัติแก้เวลาของ${empName(f.employeeId)} วันที่ ${f.date} เป็น ${f.in}–${f.out} แล้ว`);
const approveOtOf = (o: OtRequest) =>
  attempt(() => approveOt(o.id), `อนุมัติล่วงเวลา ${o.hours} ชม. ของ${empName(o.employeeId)} วันที่ ${o.date} แล้ว`);
const approveSwapOf = (s: ShiftSwap) =>
  attempt(() => approveSwap(s.id), `อนุมัติสลับกะของ${empName(s.employeeId)}กับ${empName(s.withEmployeeId)} วันที่ ${s.date} แล้ว`);

function rejectionSubject(r: Rejection): ReactNode {
  switch (r.kind) {
    case "leave":
      return <Who id={r.item.employeeId} sub={`${leaveNo(r.item)} · ${r.item.type} · ${r.item.from} ถึง ${r.item.to}`} />;
    case "fix":
      return <Who id={r.item.employeeId} sub={`แก้เวลาวันที่ ${r.item.date} เป็น ${r.item.in}–${r.item.out}`} />;
    case "ot":
      return <Who id={r.item.employeeId} sub={`ล่วงเวลา ${r.item.hours} ชม. วันที่ ${r.item.date}`} />;
    case "swap":
      return <Who id={r.item.employeeId} sub={`สลับกะกับ${empName(r.item.withEmployeeId)} วันที่ ${r.item.date}`} />;
  }
}

const REJECTION_TITLE: Record<Rejection["kind"], string> = {
  leave: "ไม่อนุมัติใบลา",
  fix: "ไม่อนุมัติคำขอแก้เวลา",
  ot: "ไม่อนุมัติคำขอล่วงเวลา",
  swap: "ไม่อนุมัติคำขอสลับกะ",
};

function reject(r: Rejection, reason: string) {
  const who = empName(r.item.employeeId);
  switch (r.kind) {
    case "leave":
      return attempt(() => rejectLeave(r.item.id, reason), `ไม่อนุมัติใบลา ${leaveNo(r.item)} ของ${who}แล้ว`);
    case "fix":
      return attempt(() => rejectPunchFix(r.item.id, reason), `ไม่อนุมัติคำขอแก้เวลาของ${who}แล้ว เวลาในบันทึกคงเดิม`);
    case "ot":
      return attempt(() => rejectOt(r.item.id, reason), `ไม่อนุมัติคำขอล่วงเวลาของ${who}แล้ว`);
    case "swap":
      return attempt(() => rejectSwap(r.item.id, reason), `ไม่อนุมัติคำขอสลับกะของ${who}แล้ว`);
  }
}

/* --------------------------------------------------------------- export */

function exportRoster() {
  downloadCsv(
    `ตารางกะ-${TODAY}`,
    ["รหัส", "พนักงาน", "ตำแหน่ง", ...WEEK_DAYS, "ชั่วโมงตามแผน"],
    rostered().map((e) => [
      e.code,
      e.name,
      e.position,
      ...rosterOf(e.id)!.map((c) => shiftOf(c).name),
      rosterOf(e.id)!.reduce((n, c) => n + plannedMinutes(c), 0) / 60,
    ])
  );
  notify("ส่งออกตารางกะเป็นไฟล์ Excel แล้ว");
}

function exportDay(rows: Day[], day: string) {
  downloadCsv(
    `บันทึกเวลา-${day}`,
    ["รหัส", "พนักงาน", "กะ", "เข้า", "ออก", "ชั่วโมงทำงาน", "ล่วงเวลา (นาที)", "สถานะ"],
    rows.map((r) => [
      r.employee.code,
      r.employee.name,
      shiftOf(r.punch.shift).name,
      r.punch.in ?? "",
      r.punch.out ?? "",
      (Math.max(0, r.verdict.workedMin) / 60).toFixed(2),
      r.verdict.otMin,
      r.verdict.state,
    ])
  );
  notify(`ส่งออกบันทึกเวลาวันที่ ${day} แล้ว`);
}

function exportPeriod() {
  downloadCsv(
    `บันทึกเวลาทั้งงวด-${PERIOD_START}-${PERIOD_END}`,
    ["วันที่", "รหัส", "พนักงาน", "กะ", "เข้า", "ออก", "ชั่วโมงทำงาน", "สาย (นาที)", "ล่วงเวลา (นาที)", "สถานะ"],
    [...PUNCHES]
      .sort((a, b) => a.date.localeCompare(b.date) || a.employeeId - b.employeeId)
      .map((p) => {
        const j = judge(p);
        const e = EMPLOYEES.find((x) => x.id === p.employeeId);
        return [p.date, e?.code ?? "", empName(p.employeeId), shiftOf(p.shift).name, p.in ?? "", p.out ?? "", (Math.max(0, j.workedMin) / 60).toFixed(2), j.lateMin, j.otMin, j.state];
      })
  );
  notify("ส่งออกบันทึกเวลาทั้งงวดแล้ว ส่งต่อให้ฝ่ายเงินเดือนได้เลย");
}

function exportLeaves(rows: Leave[]) {
  downloadCsv(
    `ทะเบียนใบลา-${TODAY}`,
    ["เลขที่", "พนักงาน", "ประเภท", "ตั้งแต่", "ถึง", "จำนวนวัน", "สถานะ", "ผู้พิจารณา", "เหตุผล"],
    rows.map((l) => [leaveNo(l), empName(l.employeeId), l.type, l.from, l.to, l.days, l.status, l.decidedBy ?? "", l.reason])
  );
  notify(`ส่งออกทะเบียนใบลา ${rows.length} ใบแล้ว`);
}

function exportAttendance() {
  downloadCsv(
    `การเข้างาน-${PERIOD_START}-${PERIOD_END}`,
    ["รหัส", "พนักงาน", "แผนก", "วันตามกะ", "มาทำงาน", "มาสาย", "ขาดงาน", "ลา", "ล่วงเวลาตามเวลาตอก (ชม.)", "ล่วงเวลาอนุมัติ (ชม.)", "อัตราเข้างาน %"],
    rostered().map((e) => {
      const a = attendanceOf(e.id);
      return [e.code, e.name, e.department, a.scheduled, a.worked, a.late, a.absent, a.leaveDays, (a.otMin / 60).toFixed(2), approvedOtHours(e.id), a.rate];
    })
  );
  notify("ส่งออกสรุปการเข้างานรายคนแล้ว");
}

/* ----------------------------------------------------------------- screen */

export default function TmScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;
  const version = useData();

  const [day, setDay] = useState(TODAY);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ทั้งหมด");
  const [openLeaveAt, setOpenLeaveAt] = useState<number | null>(null);
  const [openDayAt, setOpenDayAt] = useState<number | null>(null);
  const [openPersonAt, setOpenPersonAt] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<Rejection | null>(null);
  const [cancelling, setCancelling] = useState<Leave | null>(null);
  const [leaveForm, setLeaveForm] = useState<{ leave?: Leave; preset?: Partial<LeaveDraft> } | null>(null);
  const [printLeave, setPrintLeave] = useState<Leave | null>(null);
  const [editingShift, setEditingShift] = useState<{ employeeId: number; dow: number } | null>(null);
  const [rosterFor, setRosterFor] = useState<{ employeeId?: number } | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [removingHoliday, setRemovingHoliday] = useState<Holiday | null>(null);
  const [fixing, setFixing] = useState<Punch | null>(null);
  const [otFor, setOtFor] = useState<{ employeeId?: number; date?: string } | null>(null);
  const [followUp, setFollowUp] = useState<{ employeeId: number; kind: FollowUpKind } | null>(null);
  const [printWarning, setPrintWarning] = useState<FollowUp | null>(null);

  const waiting = LEAVES.filter((l) => l.status === "รออนุมัติ");

  const needle = q.trim().toLowerCase();
  const leaveRows = byNewest(LEAVES).filter(
    (l) =>
      (status === "ทั้งหมด" || l.status === status) &&
      (needle === "" || [empName(l.employeeId), l.type, l.reason, leaveNo(l)].some((t) => t.toLowerCase().includes(needle)))
  );
  const pickedLeave = openLeaveAt === null ? null : (leaveRows[openLeaveAt] ?? null);

  const dayRows: Day[] = useMemo(
    () =>
      punchesOn(day).flatMap((p) => {
        const employee = EMPLOYEES.find((e) => e.id === p.employeeId);
        return employee ? [{ punch: p, employee, verdict: judge(p) }] : [];
      }),
    // `version` moves on every commit: the punches are the same array after a correction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, version]
  );
  const pickedDay = openDayAt === null ? null : (dayRows[openDayAt] ?? null);

  const people = rostered();
  const pickedPerson = openPersonAt === null ? null : (people[openPersonAt] ?? null);

  /** A day record can be opened from anywhere — the attendance record, an absence list. */
  const openDay = (p: Punch) => {
    setOpenPersonAt(null);
    setDay(p.date);
    setOpenDayAt(punchesOn(p.date).findIndex((x) => x.id === p.id));
  };
  const openLeave = (l: Leave) => {
    setStatus("ทั้งหมด");
    setQ("");
    setOpenLeaveAt(byNewest(LEAVES).indexOf(l));
  };

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
            onApprove={() => approveLeaveOf(pickedLeave)}
            onReject={() => setRejecting({ kind: "leave", item: pickedLeave })}
            onEdit={() => setLeaveForm({ leave: pickedLeave })}
            onCancel={() => setCancelling(pickedLeave)}
            onPrint={() => setPrintLeave(pickedLeave)}
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
            onFix={() => setFixing(pickedDay.punch)}
            onOt={() => setOtFor({ employeeId: pickedDay.employee.id, date: pickedDay.punch.date })}
            onApproveFix={approveFixOf}
            onRejectFix={(f) => setRejecting({ kind: "fix", item: f })}
          />
        )}
      </DetailModal>

      <DetailModal
        open={pickedPerson !== null}
        title="การเข้างานรายคน"
        onClose={() => setOpenPersonAt(null)}
        index={openPersonAt ?? 0}
        total={people.length}
        onStep={(d) => setOpenPersonAt((i) => Math.min(people.length - 1, Math.max(0, (i ?? 0) + d)))}
      >
        {pickedPerson && (
          <PersonRecord
            key={pickedPerson.id}
            employee={pickedPerson}
            onFollowUp={(kind) => setFollowUp({ employeeId: pickedPerson.id, kind })}
            onPrint={setPrintWarning}
            onOpenDay={openDay}
          />
        )}
      </DetailModal>

      <ReasonDialog
        open={rejecting !== null}
        title={rejecting ? REJECTION_TITLE[rejecting.kind] : ""}
        body="ผู้ยื่นจะเห็นผลและเหตุผลนี้ทันที รายการจะไม่มีผลกับบันทึกเวลาหรือสิทธิ์ลา"
        subject={rejecting ? rejectionSubject(rejecting) : undefined}
        confirmLabel="ไม่อนุมัติ"
        placeholder="เช่น ตรงกับวันปิดงบเดือน ขอให้เลื่อนเป็นสัปดาห์ถัดไป"
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => {
          if (rejecting && reject(rejecting, reason)) setRejecting(null);
        }}
      />

      <ReasonDialog
        open={cancelling !== null}
        title="ยกเลิกใบลา"
        body={
          cancelling?.status === "อนุมัติแล้ว"
            ? "ใบลานี้อนุมัติแล้วแต่ยังไม่ถึงวันลา ยกเลิกแล้ววันลาจะคืนเข้าสิทธิ์ และวันดังกล่าวกลับเป็นวันทำงานตามตารางกะ"
            : "ใบลาที่รออนุมัติจะถูกถอนออกจากคิว และวันที่จองไว้คืนเข้าสิทธิ์"
        }
        subject={cancelling ? <Who id={cancelling.employeeId} sub={`${leaveNo(cancelling)} · ${cancelling.type} · ${cancelling.days} วัน`} /> : undefined}
        confirmLabel="ยกเลิกใบลา"
        label="เหตุผลที่ยกเลิก"
        onCancel={() => setCancelling(null)}
        onConfirm={(reason) => {
          if (cancelling && attempt(() => cancelLeave(cancelling.id, reason), `ยกเลิกใบลา ${leaveNo(cancelling)} แล้ว คืนสิทธิ์ ${cancelling.days} วัน`)) {
            setCancelling(null);
          }
        }}
      />

      <ConfirmDialog
        open={removingHoliday !== null}
        title="ลบวันหยุดบริษัท"
        body="วันนั้นจะกลับเป็นวันทำงานตามตารางกะ ใบลาที่ครอบวันนั้นจะหักสิทธิ์เพิ่มตามจริง"
        subject={
          removingHoliday && (
            <span className="block text-center text-[13px] text-slate-800 dark:text-slate-100">
              {removingHoliday.name} · {removingHoliday.date}
            </span>
          )
        }
        confirmLabel="ลบวันหยุด"
        onCancel={() => setRemovingHoliday(null)}
        onConfirm={() => {
          if (removingHoliday && attempt(() => removeHoliday(removingHoliday.date), `ลบ${removingHoliday.name}ออกจากวันหยุดบริษัทแล้ว`)) {
            setRemovingHoliday(null);
          }
        }}
      />

      <ShiftPicker target={editingShift} onCancel={() => setEditingShift(null)} />
      {rosterFor && <RosterForm employeeId={rosterFor.employeeId} onClose={() => setRosterFor(null)} />}
      {swapping && <SwapForm onClose={() => setSwapping(false)} />}
      {addingHoliday && <HolidayForm onClose={() => setAddingHoliday(false)} />}
      {fixing && <PunchForm punch={fixing} onClose={() => setFixing(null)} />}
      {otFor && <OtForm employeeId={otFor.employeeId} date={otFor.date} onClose={() => setOtFor(null)} />}
      {leaveForm && <LeaveForm leave={leaveForm.leave} preset={leaveForm.preset} onClose={() => setLeaveForm(null)} />}
      {followUp && (
        <FollowUpForm
          employeeId={followUp.employeeId}
          kind={followUp.kind}
          onClose={() => setFollowUp(null)}
          onSaved={(f) => {
            setFollowUp(null);
            if (f.kind === "หนังสือเตือน") setPrintWarning(f);
          }}
        />
      )}
      {printLeave && (
        <PrintModal title="พิมพ์ใบลา" subtitle={empName(printLeave.employeeId)} what={`ใบลา ${leaveNo(printLeave)}`} onClose={() => setPrintLeave(null)}>
          <LeavePaper leave={printLeave} />
        </PrintModal>
      )}
      {printWarning && (
        <PrintModal
          title={printWarning.kind === "หนังสือเตือน" ? "พิมพ์หนังสือเตือน" : "พิมพ์บันทึกการตักเตือน"}
          subtitle={empName(printWarning.employeeId)}
          what={`${printWarning.kind} ${printWarning.no}`}
          onClose={() => setPrintWarning(null)}
        >
          <WarningPaper item={printWarning} />
        </PrintModal>
      )}
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          leaves={LEAVES}
          waiting={waiting}
          onOpenSection={onOpenSection}
          onOpenLeave={openLeave}
          onApprove={approveLeaveOf}
          onFile={() => setLeaveForm({})}
        />
        {panels}
      </>
    );
  }

  const exportButton = (onClick: () => void, label = "ส่งออก Excel") => (
    <Button variant="secondary" icon={<FileSpreadsheet size={15} />} onClick={onClick}>
      {label}
    </Button>
  );

  const actions: Record<string, ReactNode> = {
    แผนกะการทำงาน: (
      <>
        {exportButton(exportRoster)}
        <Button variant="secondary" icon={<CalendarPlus size={15} />} onClick={() => setAddingHoliday(true)}>
          เพิ่มวันหยุด
        </Button>
        <Button variant="secondary" icon={<ArrowLeftRight size={15} />} onClick={() => setSwapping(true)}>
          ขอสลับกะ
        </Button>
        <Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setRosterFor({})}>
          จัดตารางกะ
        </Button>
      </>
    ),
    บันทึกเวลาทำงาน: (
      <>
        {exportButton(() => exportDay(dayRows, day), "ส่งออกวันนี้")}
        {exportButton(exportPeriod, "ส่งออกทั้งงวด")}
        <Button variant="primary" icon={<Timer size={15} />} onClick={() => setOtFor({})}>
          ขอทำงานล่วงเวลา
        </Button>
      </>
    ),
    การลาและการขาดงาน: (
      <>
        {exportButton(() => exportLeaves(leaveRows))}
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setLeaveForm({})}>
          ยื่นใบลา
        </Button>
      </>
    ),
    ติดตามการเข้างาน: (
      <>
        {exportButton(exportPeriod, "ส่งออกเวลาทั้งงวด")}
        {exportButton(exportAttendance)}
      </>
    ),
  };

  const firstFollowUp = FOLLOW_UPS.find((f) => f.kind !== "แจ้งเตือน");
  const firstCancellable = LEAVES.find(canCancelLeave);
  const firstFix = PUNCH_FIXES.find((f) => f.status === "รออนุมัติ");

  return (
    <div>
      <PageHead
        title="เวลาทำงานและการลา"
        meta={`${tab} · งวด ${PERIOD_START} ถึง ${PERIOD_END} · รออนุมัติ ${waiting.length} ใบ`}
        right={<div className="flex flex-wrap items-center gap-2">{actions[tab]}</div>}
      />

      {tab === "แผนกะการทำงาน" && (
        <Roster
          onPick={setEditingShift}
          onAssign={(employeeId) => setRosterFor({ employeeId })}
          onRejectSwap={(s) => setRejecting({ kind: "swap", item: s })}
          onRemoveHoliday={setRemovingHoliday}
          onAddHoliday={() => setAddingHoliday(true)}
        />
      )}

      {tab === "บันทึกเวลาทำงาน" && (
        <TimeSheet
          rows={dayRows}
          day={day}
          setDay={setDay}
          onOpen={(r) => setOpenDayAt(dayRows.indexOf(r))}
          onRejectFix={(f) => setRejecting({ kind: "fix", item: f })}
          onRejectOt={(o) => setRejecting({ kind: "ot", item: o })}
          onOpenPunch={openDay}
        />
      )}

      {tab === "การลาและการขาดงาน" && (
        <Leaves
          rows={leaveRows}
          leaves={LEAVES}
          q={q}
          setQ={setQ}
          status={status}
          setStatus={setStatus}
          onOpen={(l) => setOpenLeaveAt(leaveRows.indexOf(l))}
          onApprove={approveLeaveOf}
          onReject={(l) => setRejecting({ kind: "leave", item: l })}
          onFile={(preset) => setLeaveForm({ preset })}
          onFix={setFixing}
          onOpenDay={openDay}
        />
      )}

      {tab === "ติดตามการเข้างาน" && (
        <AttendanceReport
          leaves={LEAVES}
          onOpen={(id) => setOpenPersonAt(people.findIndex((e) => e.id === id))}
          onRemind={(employeeId) => setFollowUp({ employeeId, kind: "แจ้งเตือน" })}
          onPrint={setPrintWarning}
        />
      )}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="แผนกะและเวลาทำงาน" />
        <button data-fitt-screen="อนุมัติการลา" data-fitt-modal onClick={() => setOpenLeaveAt(0)} />
        <button data-fitt-screen="ยื่นใบลา" data-fitt-modal onClick={() => setLeaveForm({})} />
        <button data-fitt-screen="แก้ใบลา" data-fitt-modal onClick={() => waiting[0] && setLeaveForm({ leave: waiting[0] })} />
        <button data-fitt-screen="ไม่อนุมัติใบลา" data-fitt-modal onClick={() => waiting[0] && setRejecting({ kind: "leave", item: waiting[0] })} />
        <button data-fitt-screen="ยกเลิกใบลา" data-fitt-modal onClick={() => firstCancellable && setCancelling(firstCancellable)} />
        <button data-fitt-screen="พิมพ์ใบลา" data-fitt-modal onClick={() => setPrintLeave(LEAVES[0])} />
        <button data-fitt-screen="บันทึกเวลาทำงานรายวัน" data-fitt-modal onClick={() => setOpenDayAt(0)} />
        <button data-fitt-screen="แก้เวลาตอกบัตร" data-fitt-modal onClick={() => setFixing(PUNCHES[0])} />
        <button data-fitt-screen="ไม่อนุมัติคำขอแก้เวลา" data-fitt-modal onClick={() => firstFix && setRejecting({ kind: "fix", item: firstFix })} />
        <button data-fitt-screen="ขอทำงานล่วงเวลา" data-fitt-modal onClick={() => setOtFor({})} />
        <button data-fitt-screen="เปลี่ยนกะ" data-fitt-modal onClick={() => people[0] && setEditingShift({ employeeId: people[0].id, dow: 0 })} />
        <button data-fitt-screen="จัดตารางกะ" data-fitt-modal onClick={() => setRosterFor({})} />
        <button data-fitt-screen="ขอสลับกะ" data-fitt-modal onClick={() => setSwapping(true)} />
        <button data-fitt-screen="เพิ่มวันหยุดบริษัท" data-fitt-modal onClick={() => setAddingHoliday(true)} />
        <button data-fitt-screen="ลบวันหยุดบริษัท" data-fitt-modal onClick={() => { const h = HOLIDAYS.find((x) => x.date > TODAY); if (h) setRemovingHoliday(h); }} />
        <button data-fitt-screen="การเข้างานรายคน" data-fitt-modal onClick={() => setOpenPersonAt(0)} />
        <button data-fitt-screen="ส่งข้อความเตือน" data-fitt-modal onClick={() => people[0] && setFollowUp({ employeeId: people[0].id, kind: "แจ้งเตือน" })} />
        <button data-fitt-screen="ออกหนังสือเตือน" data-fitt-modal onClick={() => people[0] && setFollowUp({ employeeId: people[0].id, kind: "หนังสือเตือน" })} />
        <button data-fitt-screen="พิมพ์หนังสือเตือน" data-fitt-modal onClick={() => firstFollowUp && setPrintWarning(firstFollowUp)} />
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
  onFile,
}: {
  leaves: Leave[];
  waiting: Leave[];
  onOpenSection?: (index: number) => void;
  onOpenLeave: (l: Leave) => void;
  onApprove: (l: Leave) => void;
  onFile: () => void;
}) {
  const stats = rostered().map((e) => ({ e, a: attendanceOf(e.id, leaves) }));
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
    const e = rostered().find((x) => x.nickname === name);
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
        meta={`งวด ${PERIOD_START} ถึง ${PERIOD_END} · ${rostered().length} คนในตารางกะ · ข้อมูล ณ ${TODAY}`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={<Plus size={15} />} onClick={onFile}>
              ยื่นใบลา
            </Button>
            {onOpenSection && (
              <Button variant="primary" icon={<CalendarDays size={15} />} onClick={() => onOpenSection(1)}>
                เปิดบันทึกเวลาทำงาน
              </Button>
            )}
          </div>
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
              rows={rostered().map((e) => e.nickname)}
              cols={heatDays.map((d) => d.slice(8))}
              value={(row, col) => lateOn(row, heatDays.find((d) => d.slice(8) === col)!)}
              format={(n) => (n >= 60 ? "ขาดงาน" : n === 0 ? "ตรงเวลา" : "สาย " + n + " นาที")}
            />
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Hourglass size={15} className="text-slate-400" />ใบลาที่รออนุมัติ</span>}
            action={seeAll(2)}
          >
            <OtherRequests onOpenSection={onOpenSection} />
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

/** The other queues a supervisor clears — corrections, overtime, swaps — counted on the overview. */
function OtherRequests({ onOpenSection }: { onOpenSection?: (index: number) => void }) {
  const count = (list: { status: string }[]) => list.filter((x) => x.status === "รออนุมัติ").length;
  const items = [
    { label: "แก้เวลา", n: count(PUNCH_FIXES), section: 1 },
    { label: "ล่วงเวลา", n: count(OT_REQUESTS), section: 1 },
    { label: "สลับกะ", n: count(SHIFT_SWAPS), section: 0 },
  ].filter((x) => x.n > 0);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-[11.5px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
      คำขออื่นที่รออนุมัติ
      {items.map((x) => (
        <button
          key={x.label}
          onClick={() => onOpenSection?.(x.section)}
          className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 transition hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300"
        >
          {x.label} {x.n}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- roster */

function Roster({
  onPick,
  onAssign,
  onRejectSwap,
  onRemoveHoliday,
  onAddHoliday,
}: {
  onPick: (t: { employeeId: number; dow: number }) => void;
  onAssign: (employeeId: number) => void;
  onRejectSwap: (s: ShiftSwap) => void;
  onRemoveHoliday: (h: Holiday) => void;
  onAddHoliday: () => void;
}) {
  const people = rostered();
  const missing = unrostered();
  const used = (code: string) => people.flatMap((e) => rosterOf(e.id) ?? []).filter((c) => c === code).length;
  const swaps = [...SHIFT_SWAPS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <Note tone="warn">
          <span className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1">
              พนักงาน {missing.length} คนยังใช้กะตั้งต้นตามสัญญาจ้าง (กะเช้าตามวันทำงานในสัญญา) กดที่ชื่อเพื่อจัดกะให้ตรงงานจริง
            </span>
            {missing.map((e) => (
              <MiniButton key={e.id} onClick={() => onAssign(e.id)}>
                <UserPlus size={12} /> {e.name}
              </MiniButton>
            ))}
          </span>
        </Note>
      )}

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
        subtitle="กดที่ช่องเพื่อเปลี่ยนกะวันนั้น หรือกดดินสอท้ายแถวเพื่อจัดใหม่ทั้งสัปดาห์ · มีผลตั้งแต่สัปดาห์หน้า"
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
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {people.map((e) => {
                const week = rosterOf(e.id)!;
                const plannedMin = week.reduce((n, code) => n + plannedMinutes(code), 0);
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
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{hhmm(plannedMin)}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => onAssign(e.id)}
                        title="จัดตารางกะทั้งสัปดาห์"
                        aria-label={`จัดตารางกะทั้งสัปดาห์ของ${e.name}`}
                        className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-800 dark:hover:text-violet-300"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><ArrowLeftRight size={15} className="text-slate-400" />คำขอสลับกะ</span>}
          subtitle="อนุมัติแล้วกะของสองคนในวันนั้นจึงสลับกัน วันอื่นเป็นไปตามตารางเดิม"
        >
          {swaps.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-slate-400">ยังไม่มีคำขอสลับกะ</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {swaps.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="tabular-nums font-medium text-slate-900 dark:text-slate-50">{s.date}</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {empName(s.employeeId)} ({shiftOf(s.shift).name}) ⇄ {empName(s.withEmployeeId)} ({shiftOf(s.withShift).name})
                    </span>
                    <span className="ml-auto">
                      <Badge tone={REQUEST_TONE[s.status]} dot>
                        {s.status}
                      </Badge>
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-[12px] text-slate-500 dark:text-slate-400">
                      {s.reason}
                      {s.note ? ` · ${s.note}` : s.decidedBy ? ` · โดย ${s.decidedBy}` : ""}
                    </span>
                    {s.status === "รออนุมัติ" && (
                      <span className="flex gap-1.5">
                        <MiniButton tone="ok" onClick={() => approveSwapOf(s)}>
                          อนุมัติ
                        </MiniButton>
                        <MiniButton tone="bad" onClick={() => onRejectSwap(s)}>
                          ไม่อนุมัติ
                        </MiniButton>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><CalendarX size={15} className="text-slate-400" />วันหยุดประจำปีที่กระทบตารางกะ</span>}
          subtitle="วันในรายการนี้ไม่นับเป็นวันทำงาน ไม่ต้องตอกบัตร และไม่หักสิทธิ์ลา"
          action={
            <MiniButton onClick={onAddHoliday}>
              <Plus size={12} /> เพิ่มวันหยุด
            </MiniButton>
          }
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
                <button
                  onClick={() => onRemoveHoliday(h)}
                  disabled={h.date <= TODAY}
                  title="ลบวันหยุดนี้"
                  aria-label={`ลบ${h.name}`}
                  className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ timesheet */

function TimeSheet({
  rows,
  day,
  setDay,
  onOpen,
  onRejectFix,
  onRejectOt,
  onOpenPunch,
}: {
  rows: Day[];
  day: string;
  setDay: (d: string) => void;
  onOpen: (r: Day) => void;
  onRejectFix: (f: PunchFix) => void;
  onRejectOt: (o: OtRequest) => void;
  onOpenPunch: (p: Punch) => void;
}) {
  const [view, setView] = useState(TIME_TABS[0]);
  const pending = (list: { status: string }[]) => list.filter((x) => x.status === "รออนุมัติ").length;

  const decision = (item: { status: string; decidedBy?: string }, approve: () => void, reject: () => void) =>
    item.status === "รออนุมัติ" ? (
      <span className="flex items-center justify-end gap-1.5">
        <MiniButton tone="ok" onClick={approve}>
          อนุมัติ
        </MiniButton>
        <MiniButton tone="bad" onClick={reject}>
          ไม่อนุมัติ
        </MiniButton>
      </span>
    ) : (
      <span className="block truncate text-right text-[11px] text-slate-400">{item.decidedBy ?? "—"}</span>
    );

  const fixColumns: Column<PunchFix>[] = [
    { key: "who", header: "พนักงาน", width: "24%", sort: (a, b) => empName(a.employeeId).localeCompare(empName(b.employeeId), "th"), cell: (f) => <Who id={f.employeeId} sub={`ยื่นเมื่อ ${f.filedAt}`} /> },
    { key: "date", header: "วันที่", width: "12%", sort: (a, b) => a.date.localeCompare(b.date), cell: (f) => <span className="tabular-nums">{f.date}</span> },
    { key: "change", header: "เวลาเดิม → ขอแก้เป็น", width: "22%", cell: (f) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{f.before.in ?? "—"}–{f.before.out ?? "—"} → {f.in}–{f.out}</span> },
    { key: "reason", header: "เหตุผล", cell: (f) => <span className="line-clamp-2 text-[12.5px]">{f.reason}{f.note ? ` · ${f.note}` : ""}</span> },
    { key: "status", header: "สถานะ", width: "12%", cell: (f) => <Badge tone={REQUEST_TONE[f.status]} dot>{f.status}</Badge> },
  ];

  const otColumns: Column<OtRequest>[] = [
    { key: "who", header: "พนักงาน", width: "24%", sort: (a, b) => empName(a.employeeId).localeCompare(empName(b.employeeId), "th"), cell: (o) => <Who id={o.employeeId} sub={`ยื่นเมื่อ ${o.filedAt}`} /> },
    { key: "date", header: "วันที่", width: "12%", sort: (a, b) => a.date.localeCompare(b.date), cell: (o) => <span className="tabular-nums">{o.date}</span> },
    { key: "hours", header: "ชั่วโมง", align: "right", width: "9%", sort: (a, b) => a.hours - b.hours, cell: (o) => <span className="tabular-nums">{o.hours}</span> },
    { key: "rate", header: "อัตรา", width: "11%", cell: (o) => <Chip>{o.rate} เท่า</Chip> },
    { key: "reason", header: "งานที่ทำ", cell: (o) => <span className="line-clamp-2 text-[12.5px]">{o.reason}{o.note ? ` · ${o.note}` : ""}</span> },
    { key: "status", header: "สถานะ", width: "12%", cell: (o) => <Badge tone={REQUEST_TONE[o.status]} dot>{o.status}</Badge> },
  ];

  return (
    <div className="space-y-3">
      <Tabs
        tabs={TIME_TABS}
        active={view}
        onPick={setView}
        icons={TIME_TAB_ICONS}
        badges={{ คำขอแก้เวลา: pending(PUNCH_FIXES), คำขอล่วงเวลา: pending(OT_REQUESTS) }}
        id="time"
      />
      {view === "เวลาเข้าออกรายวัน" && <DailyTimes rows={rows} day={day} setDay={setDay} onOpen={onOpen} />}
      {view === "คำขอแก้เวลา" && (
        <DataTable
          rows={byNewest(PUNCH_FIXES)}
          columns={fixColumns}
          getId={(f) => f.id}
          onOpen={(f) => {
            const p = PUNCHES.find((x) => x.id === f.punchId);
            if (p) onOpenPunch(p);
          }}
          empty="ยังไม่มีคำขอแก้เวลา"
          toolbar={
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              เวลาในบันทึกเปลี่ยนเมื่ออนุมัติเท่านั้น เวลาเดิมเก็บไว้ในคำขอให้ตรวจย้อนหลังได้ · กดที่แถวเพื่อเปิดบันทึกของวันนั้น
            </p>
          }
          trailing={(f) => decision(f, () => approveFixOf(f), () => onRejectFix(f))}
        />
      )}
      {view === "คำขอล่วงเวลา" && (
        <DataTable
          rows={byNewest(OT_REQUESTS)}
          columns={otColumns}
          getId={(o) => o.id}
          empty="ยังไม่มีคำขอล่วงเวลา"
          toolbar={
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              จ่ายเฉพาะชั่วโมงที่อนุมัติ · วันทำงาน 1.5 เท่า วันหยุด 3 เท่า · รวมไม่เกิน 36 ชั่วโมงต่อสัปดาห์
            </p>
          }
          trailing={(o) => decision(o, () => approveOtOf(o), () => onRejectOt(o))}
        />
      )}
    </div>
  );
}

function DailyTimes({
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
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={STATE_TONE[r.verdict.state]} dot>
            {r.verdict.state}
            {r.verdict.state === "มาสาย" ? ` ${r.verdict.lateMin} น.` : ""}
          </Badge>
          {pendingFixOf(r.punch.id) && <Badge tone="warn">รอแก้เวลา</Badge>}
        </span>
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
              วันที่ {day} มีมาสาย {late} คน และขาดงาน {absent} คน กดที่แถวเพื่อดูรายละเอียดและขอแก้เวลาตอกบัตรที่บันทึกผิด
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
  onFile,
  onFix,
  onOpenDay,
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
  onFile: (preset: Partial<LeaveDraft>) => void;
  onFix: (p: Punch) => void;
  onOpenDay: (p: Punch) => void;
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
      <Tabs
        tabs={LEAVE_TABS}
        active={view}
        onPick={setView}
        icons={LEAVE_TAB_ICONS}
        badges={{ ใบลา: leaves.filter((l) => l.status === "รออนุมัติ").length }}
        id="leave"
      />

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
              <Select value={status} onChange={setStatus} options={["ทั้งหมด", "รออนุมัติ", "อนุมัติแล้ว", "ไม่อนุมัติ", "ยกเลิก"]} />
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

      {view === "สิทธิ์คงเหลือ" && <Balances onFile={onFile} />}

      {view === "การขาดงาน" && <Absences onFile={onFile} onFix={onFix} onOpenDay={onOpenDay} />}

      {view === "ประวัติการลา" && <LeaveHistory leaves={leaves} onOpen={onOpen} />}
    </div>
  );
}

function Balances({ onFile }: { onFile: (preset: Partial<LeaveDraft>) => void }) {
  const paid = LEAVE_TYPES.filter((t) => t.paid);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {EMPLOYEES.filter((e) => e.status !== "ลาออก").map((e) => {
        const rows = paid.map((t) => ({ t, b: leaveBalance(e.id, t.name) }));
        const total = rows.reduce((n, r) => n + r.b.quota, 0);
        const spent = rows.reduce((n, r) => n + r.b.used, 0);
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
            action={
              <span className="flex items-center gap-1.5">
                <Badge tone={spent > total * 0.7 ? "warn" : "ok"}>ใช้ไป {spent} วัน</Badge>
                <MiniButton onClick={() => onFile({ employeeId: e.id })}>
                  <Plus size={12} /> ยื่นลา
                </MiniButton>
              </span>
            }
          >
            <div className="space-y-3 p-4">
              {rows.map(({ t, b }) => (
                <div key={t.name}>
                  <div className="mb-1 flex items-center gap-2 text-[12.5px]">
                    <Dot className={typeSwatch(t.name).dot} />
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{t.name}</span>
                    <span className={"tabular-nums " + (b.left <= 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400")}>
                      เหลือ {b.left} จาก {b.quota} วัน{b.pending > 0 ? ` · รออนุมัติ ${b.pending}` : ""}
                    </span>
                  </div>
                  <Bar pct={b.quota === 0 ? 0 : (b.used / b.quota) * 100} tone={b.left <= 0 ? "bad" : b.left <= 1 ? "warn" : "ok"} width="w-full" />
                </div>
              ))}
              {rows.some((r) => r.t.name === "ลาพักร้อน" && r.b.quota === 0) && (
                <p className="text-[11.5px] text-slate-400">อายุงานยังไม่ครบหนึ่งปี จึงยังไม่มีสิทธิ์ลาพักร้อน</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** วันที่ขาดงานในงวด พร้อมทางแก้สองทาง: ป่วยก็ยื่นลาย้อนหลัง ลืมตอกก็ขอแก้เวลา */
function Absences({
  onFile,
  onFix,
  onOpenDay,
}: {
  onFile: (preset: Partial<LeaveDraft>) => void;
  onFix: (p: Punch) => void;
  onOpenDay: (p: Punch) => void;
}) {
  const rows = PUNCHES.filter((p) => judge(p).state === "ขาดงาน").sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card
      title={<span className="flex items-center gap-2"><CircleX size={15} className="text-slate-400" />วันที่ขาดงานในงวด</span>}
      subtitle="วันที่อยู่ในตารางกะแต่ไม่มีการตอกบัตรและไม่มีใบลา ถ้าป่วยให้ยื่นลาย้อนหลัง ถ้าลืมตอกบัตรให้ขอแก้เวลา"
    >
      {rows.length === 0 ? (
        <p className="py-14 text-center text-[12.5px] text-slate-400">ไม่มีวันขาดงานในงวดนี้</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((p) => {
            const s = shiftOf(p.shift);
            const pending = pendingFixOf(p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <button onClick={() => onOpenDay(p)} className="min-w-0 flex-1 text-left">
                  <Who id={p.employeeId} sub={`${p.date} วัน${WEEK_DAYS[dowIndex(p.date)]} · ${s.name} ${s.start}–${s.end}`} />
                </button>
                {pending && <Badge tone="warn">มีคำขอแก้เวลารออนุมัติ</Badge>}
                <span className="flex gap-1.5">
                  <MiniButton onClick={() => onFile({ employeeId: p.employeeId, type: "ลาป่วย", from: p.date, to: p.date })}>
                    <FileText size={12} /> ยื่นลาย้อนหลัง
                  </MiniButton>
                  <MiniButton onClick={() => onFix(p)} disabled={pending !== undefined}>
                    <Pencil size={12} /> ขอแก้เวลา
                  </MiniButton>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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

function AttendanceReport({
  leaves,
  onOpen,
  onRemind,
  onPrint,
}: {
  leaves: Leave[];
  onOpen: (employeeId: number) => void;
  onRemind: (employeeId: number) => void;
  onPrint: (f: FollowUp) => void;
}) {
  const rows = rostered().map((e) => ({ e, a: attendanceOf(e.id, leaves) }));
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
        subtitle="วันลาที่อนุมัติแล้วไม่ถูกนับเป็นขาดงาน · กดที่แถวเพื่อดูวันที่สายหรือขาด และส่งข้อความเตือนหรือออกหนังสือเตือน"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-[13px]">
            <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">พนักงาน</th>
                <th className="px-4 py-3 text-right font-medium">วันตามกะ</th>
                <th className="px-4 py-3 text-right font-medium">มาทำงาน</th>
                <th className="px-4 py-3 text-right font-medium">มาสาย</th>
                <th className="px-4 py-3 text-right font-medium">ขาดงาน</th>
                <th className="px-4 py-3 text-right font-medium">ลา</th>
                <th className="px-4 py-3 text-right font-medium">ล่วงเวลา</th>
                <th className="px-4 py-3 text-right font-medium">OT อนุมัติ</th>
                <th className="px-4 py-3 font-medium">อัตราเข้างาน</th>
                <th className="px-4 py-3 text-right font-medium">ติดตาม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(({ e, a }) => (
                <tr key={e.id} onClick={() => onOpen(e.id)} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
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
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {approvedOtHours(e.id) ? approvedOtHours(e.id) + " ชม." : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Bar pct={a.rate} tone={a.rate === 100 ? "ok" : a.rate >= 90 ? "warn" : "bad"} width="w-24" />
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5">
                      {followUpsOf(e.id).length > 0 && <Chip>{followUpsOf(e.id).length} ครั้ง</Chip>}
                      <MiniButton tone={a.late + a.absent > 0 ? "bad" : "idle"} onClick={() => onRemind(e.id)}>
                        <BellRing size={12} /> เตือน
                      </MiniButton>
                    </span>
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

      <Card
        title={<span className="flex items-center gap-2"><BellRing size={15} className="text-slate-400" />บันทึกการติดตามล่าสุด</span>}
        subtitle="ข้อความเตือน การตักเตือนด้วยวาจา และหนังสือเตือน เรียงจากล่าสุด"
      >
        {FOLLOW_UPS.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">ยังไม่มีการติดตาม</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...FOLLOW_UPS]
              .sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id)
              .slice(0, 8)
              .map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <button onClick={() => onOpen(f.employeeId)} className="min-w-0 flex-1 text-left">
                    <Who id={f.employeeId} sub={`${f.no} · ${f.date} · ${f.kind}เรื่อง${f.topic} · ${f.detail}`} />
                  </button>
                  {f.kind !== "แจ้งเตือน" && (
                    <MiniButton onClick={() => onPrint(f)}>
                      <Printer size={12} /> พิมพ์
                    </MiniButton>
                  )}
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
