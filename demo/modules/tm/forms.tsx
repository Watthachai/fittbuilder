import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { EMPLOYEES } from "../pa/data";
import {
  FOLLOW_UP_KINDS, FOLLOW_UP_TOPICS, LEAVE_TYPES, ROSTER, SHIFTS, TODAY, WEEK_DAYS, addDays, addHoliday,
  assignRoster, attendanceOf, empName, fileLeave, followUpErrors, hhmm, holidayErrors, leaveBalance,
  leaveDaysOf, leaveErrors, leaveNo, otErrors, otRateOn, plannedMinutes, punchFixErrors, recordFollowUp,
  requestOt, requestPunchFix, requestSwap, rosterOf, rostered, rosterErrors, setRosterShift, shiftOf, shiftOn, swapErrors,
  unrostered, updateLeave,
} from "./data";
import type { FollowUp, FollowUpDraft, FollowUpKind, FollowUpTopic, Leave, LeaveDraft, Punch } from "./data";
import { Button, FIELD, Note, Progress, Segmented, Select } from "../ui";
import { Field, FormModal, Wizard } from "../kit";
import type { Step } from "../kit";
import { SHIFT_ICON, attempt, shiftSwatch } from "./shared";

/**
 * Every form time and leave opens. Each validates through the rule functions in
 * data.ts — the same ones the save calls — so what the form lets through is what
 * the record accepts, and each one ends in a notification of what happened.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Who a form is about. By id, so two people with one name stay two people. */
function PersonSelect({
  value,
  onChange,
  people,
}: {
  value: number;
  onChange: (id: number) => void;
  people: { id: number; name: string; position: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={FIELD + " w-full"}>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · {p.position}
        </option>
      ))}
    </select>
  );
}

function Actions({ onCancel, onSave, label }: { onCancel: () => void; onSave: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="secondary" onClick={onCancel}>
        ยกเลิก
      </Button>
      <Button variant="primary" onClick={onSave}>
        {label}
      </Button>
    </div>
  );
}

const Area = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    rows={3}
    placeholder={placeholder}
    className={FIELD + " w-full resize-none"}
  />
);

/* ------------------------------------------------------------ the roster */

export function ShiftPicker({
  target,
  onCancel,
}: {
  target: { employeeId: number; dow: number } | null;
  onCancel: () => void;
}) {
  const week = target ? rosterOf(target.employeeId) : undefined;
  const current = target && week ? week[target.dow] : "";
  return (
    <FormModal
      open={target !== null}
      title="เปลี่ยนกะ"
      subtitle={target ? `${empName(target.employeeId)} · วัน${WEEK_DAYS[target.dow]} · มีผลตั้งแต่สัปดาห์หน้า` : undefined}
      onClose={onCancel}
      size="sm"
    >
      <ul className="space-y-1.5">
        {SHIFTS.map((s) => {
          const sw = shiftSwatch(s.code);
          const on = s.code === current;
          const blocked =
            target && week ? rosterErrors(week.map((c, i) => (i === target.dow ? s.code : c))).week : undefined;
          return (
            <li key={s.code}>
              <button
                disabled={blocked !== undefined}
                onClick={() => {
                  if (!target || on) return onCancel();
                  const ok = attempt(
                    () => setRosterShift(target.employeeId, target.dow, s.code),
                    `เปลี่ยนกะของ${empName(target.employeeId)} วัน${WEEK_DAYS[target.dow]} เป็น${s.name}แล้ว`
                  );
                  if (ok) onCancel();
                }}
                className={
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 " +
                  (on ? sw.tint + " " + sw.ring : "ring-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60")
                }
              >
                <span className={"grid size-8 shrink-0 place-items-center rounded-full " + sw.tint}>{SHIFT_ICON[s.code]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">{s.name}</span>
                  <span className="block text-[11.5px] text-slate-400">
                    {blocked ?? `${s.start} – ${s.end}${s.breakMin > 0 ? ` · พัก ${s.breakMin} นาที` : ""}`}
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

const PATTERNS: { label: string; week: string[] }[] = [
  { label: "กะเช้า จันทร์–ศุกร์", week: ["A", "A", "A", "A", "A", "O", "O"] },
  { label: "กะเช้า จันทร์–เสาร์", week: ["A", "A", "A", "A", "A", "A", "O"] },
  { label: "กะบ่าย จันทร์–ศุกร์", week: ["B", "B", "B", "B", "B", "O", "O"] },
  { label: "กะดึก หยุดพฤหัส–ศุกร์", week: ["N", "N", "N", "O", "O", "N", "N"] },
];

/** จัดตารางกะทั้งสัปดาห์ — สำหรับพนักงานใหม่ หรือเปลี่ยนรูปแบบกะทั้งชุด */
export function RosterForm({ employeeId, onClose }: { employeeId?: number; onClose: () => void }) {
  const people = EMPLOYEES.filter((e) => e.status !== "ลาออก");
  const [id, setId] = useState(employeeId ?? unrostered()[0]?.id ?? people[0].id);
  const [week, setWeek] = useState<string[]>(() => [...(rosterOf(id) ?? PATTERNS[0].week)]);
  const [tried, setTried] = useState(false);
  const error = tried ? rosterErrors(week).week : undefined;
  const minutes = week.reduce((n, c) => n + plannedMinutes(c), 0);

  return (
    <FormModal open title="จัดตารางกะ" subtitle="กำหนดกะประจำทั้งสัปดาห์ มีผลตั้งแต่สัปดาห์หน้า วันที่ทำงานไปแล้วไม่เปลี่ยน" onClose={onClose}>
      <div className="space-y-4">
        <Field label="พนักงาน" hint={ROSTER[id] ? "มีตารางกะอยู่แล้ว การบันทึกจะแทนที่ทั้งสัปดาห์" : "ยังใช้กะตั้งต้นตามสัญญาจ้าง"}>
          <PersonSelect
            value={id}
            people={people}
            onChange={(next) => {
              setId(next);
              setWeek([...(rosterOf(next) ?? PATTERNS[0].week)]);
            }}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {PATTERNS.map((p) => (
            <button
              key={p.label}
              onClick={() => setWeek([...p.week])}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300"
            >
              {p.label}
            </button>
          ))}
        </div>
        <Field label="กะรายวัน" error={error} hint={`เวลาทำงานตามแผน ${hhmm(minutes)} ต่อสัปดาห์ · สูงสุด 48 ชั่วโมง`}>
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((code, i) => (
              <div key={i}>
                <span className="mb-1 block text-center text-[11px] text-slate-400">{WEEK_DAYS[i]}</span>
                <select
                  value={code}
                  aria-label={`กะวัน${WEEK_DAYS[i]}`}
                  onChange={(e) => setWeek((w) => w.map((c, j) => (j === i ? e.target.value : c)))}
                  className={FIELD + " w-full px-1 text-center text-[12px]"}
                >
                  {SHIFTS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name.replace("กะ", "")}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Field>
        <Actions
          onCancel={onClose}
          label="บันทึกตารางกะ"
          onSave={() => {
            setTried(true);
            if (rosterErrors(week).week) return;
            if (attempt(() => assignRoster(id, week), `จัดตารางกะให้${empName(id)}แล้ว มีผลตั้งแต่สัปดาห์หน้า`)) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}

/** คำขอสลับกะของสองคนในวันเดียว — เข้าคิวรออนุมัติ */
export function SwapForm({ employeeId, onClose }: { employeeId?: number; onClose: () => void }) {
  const people = rostered();
  const first = employeeId ?? people[0]?.id ?? 0;
  const [d, setD] = useState({
    employeeId: first,
    withEmployeeId: people.find((p) => p.id !== first)?.id ?? first,
    date: addDays(TODAY, 1),
    reason: "",
  });
  const [tried, setTried] = useState(false);
  const errors = tried ? swapErrors(d) : {};
  const shiftName = (id: number) => {
    const code = ISO.test(d.date) ? shiftOn(id, d.date) : undefined;
    return code ? shiftOf(code).name : "—";
  };

  return (
    <FormModal open title="ขอสลับกะ" subtitle="สองคนแลกกะกันหนึ่งวัน หัวหน้าอนุมัติแล้วตารางของวันนั้นจึงเปลี่ยน" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ผู้ขอสลับ" error={errors.employeeId} hint={`วันนั้นเข้า${shiftName(d.employeeId)}`}>
            <PersonSelect value={d.employeeId} people={people} onChange={(v) => setD({ ...d, employeeId: v })} />
          </Field>
          <Field label="สลับกับ" error={errors.withEmployeeId} hint={`วันนั้นเข้า${shiftName(d.withEmployeeId)}`}>
            <PersonSelect value={d.withEmployeeId} people={people} onChange={(v) => setD({ ...d, withEmployeeId: v })} />
          </Field>
        </div>
        <Field label="วันที่" error={errors.date} hint="สลับได้เฉพาะวันที่ยังไม่ถึง ล่วงหน้าไม่เกิน 30 วัน">
          <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={FIELD + " w-full"} />
        </Field>
        <Field label="เหตุผล" error={errors.reason}>
          <Area value={d.reason} onChange={(v) => setD({ ...d, reason: v })} placeholder="เช่น พาแม่ไปโรงพยาบาลช่วงบ่าย" />
        </Field>
        <Actions
          onCancel={onClose}
          label="ส่งคำขอสลับกะ"
          onSave={() => {
            setTried(true);
            if (Object.keys(swapErrors(d)).length) return;
            const ok = attempt(
              () => requestSwap(d),
              `ส่งคำขอสลับกะของ${empName(d.employeeId)}กับ${empName(d.withEmployeeId)} วันที่ ${d.date} แล้ว รออนุมัติ`
            );
            if (ok) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}

/** ประกาศวันหยุดบริษัท */
export function HolidayForm({ onClose }: { onClose: () => void }) {
  const [d, setD] = useState({ date: "", name: "" });
  const [tried, setTried] = useState(false);
  const errors = tried ? holidayErrors(d) : {};
  return (
    <FormModal open title="เพิ่มวันหยุดบริษัท" subtitle="วันนั้นไม่นับเป็นวันทำงาน ไม่หักสิทธิ์ลา และล่วงเวลาคิด 3 เท่า" onClose={onClose} size="sm">
      <div className="space-y-3">
        <Field label="วันที่" error={errors.date}>
          <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={FIELD + " w-full"} />
        </Field>
        <Field label="ชื่อวันหยุด" error={errors.name}>
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="เช่น วันหยุดชดเชยวันพ่อแห่งชาติ" className={FIELD + " w-full"} />
        </Field>
        <Actions
          onCancel={onClose}
          label="เพิ่มวันหยุด"
          onSave={() => {
            setTried(true);
            if (Object.keys(holidayErrors(d)).length) return;
            if (attempt(() => addHoliday(d), `เพิ่ม${d.name.trim()} วันที่ ${d.date} เป็นวันหยุดบริษัทแล้ว`)) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}

/* ------------------------------------------------------------- the clock */

/** คำขอแก้เวลาตอกบัตร — ผลของวันนั้นเปลี่ยนเมื่อหัวหน้าอนุมัติ */
export function PunchForm({ punch, onClose }: { punch: Punch; onClose: () => void }) {
  const s = shiftOf(punch.shift);
  const [d, setD] = useState({ punchId: punch.id, in: punch.in ?? s.start, out: punch.out ?? s.end, reason: "" });
  const [tried, setTried] = useState(false);
  const errors = tried ? punchFixErrors(d) : {};

  return (
    <FormModal open title="ขอแก้เวลาตอกบัตร" subtitle={`${empName(punch.employeeId)} · ${punch.date} · ${s.name} ${s.start}–${s.end}`} onClose={onClose} size="sm">
      <div className="space-y-3">
        <Note tone="idle">
          เวลาเดิมคือ เข้า {punch.in ?? "ไม่ได้ตอก"} ออก {punch.out ?? "ไม่ได้ตอก"} · บันทึกจะยังเป็นเวลาเดิมจนกว่าหัวหน้าอนุมัติ
          และระบบเก็บเวลาเดิมไว้ตรวจสอบย้อนหลังได้
        </Note>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เวลาเข้า" error={errors.in} hint="รูปแบบ ชช:นน">
            <input type="time" value={d.in} onChange={(e) => setD({ ...d, in: e.target.value })} className={FIELD + " w-full tabular-nums"} />
          </Field>
          <Field label="เวลาออก" error={errors.out} hint="รูปแบบ ชช:นน">
            <input type="time" value={d.out} onChange={(e) => setD({ ...d, out: e.target.value })} className={FIELD + " w-full tabular-nums"} />
          </Field>
        </div>
        <Field label="เหตุผล" error={errors.reason}>
          <Area value={d.reason} onChange={(v) => setD({ ...d, reason: v })} placeholder="เช่น ลืมตอกบัตร ไปพบลูกค้านอกสถานที่" />
        </Field>
        <Actions
          onCancel={onClose}
          label="ส่งคำขอแก้เวลา"
          onSave={() => {
            setTried(true);
            if (Object.keys(punchFixErrors(d)).length) return;
            const ok = attempt(
              () => requestPunchFix(d),
              `ส่งคำขอแก้เวลาของ${empName(punch.employeeId)} วันที่ ${punch.date} แล้ว รอหัวหน้าอนุมัติ`
            );
            if (ok) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}

/** คำขอทำงานล่วงเวลา — จ่ายเฉพาะชั่วโมงที่อนุมัติ */
export function OtForm({ employeeId, date, onClose }: { employeeId?: number; date?: string; onClose: () => void }) {
  const people = rostered();
  const [d, setD] = useState({ employeeId: employeeId ?? people[0]?.id ?? 0, date: date ?? TODAY, hours: "2", reason: "" });
  const [tried, setTried] = useState(false);
  const errors = tried ? otErrors(d) : {};
  const rate = ISO.test(d.date) && rosterOf(d.employeeId) ? otRateOn(d.employeeId, d.date) : undefined;

  return (
    <FormModal open title="ขอทำงานล่วงเวลา" subtitle="วันทำงาน 1.5 เท่า วันหยุด 3 เท่า รวมไม่เกิน 36 ชั่วโมงต่อสัปดาห์" onClose={onClose} size="sm">
      <div className="space-y-3">
        <Field label="พนักงาน" error={errors.employeeId}>
          <PersonSelect value={d.employeeId} people={people} onChange={(v) => setD({ ...d, employeeId: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่" error={errors.date} hint={rate ? (rate === 3 ? "วันหยุด คิด 3 เท่า" : "วันทำงาน คิด 1.5 เท่า") : undefined}>
            <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={FIELD + " w-full"} />
          </Field>
          <Field label="จำนวนชั่วโมง" error={errors.hours} hint="ช่วงละครึ่งชั่วโมง">
            <input value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value })} inputMode="decimal" className={FIELD + " w-full tabular-nums"} />
          </Field>
        </div>
        <Field label="งานที่ต้องทำ" error={errors.reason}>
          <Area value={d.reason} onChange={(v) => setD({ ...d, reason: v })} placeholder="เช่น ตรวจนับสต็อกปลายเดือน" />
        </Field>
        <Actions
          onCancel={onClose}
          label="ส่งคำขอล่วงเวลา"
          onSave={() => {
            setTried(true);
            if (Object.keys(otErrors(d)).length) return;
            const ok = attempt(
              () => requestOt(d),
              `ส่งคำขอล่วงเวลา ${d.hours} ชม. ของ${empName(d.employeeId)} วันที่ ${d.date} แล้ว รออนุมัติ`
            );
            if (ok) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}

/* ----------------------------------------------------------------- leave */

/** ยื่นใบลาใหม่ หรือแก้ใบที่ยังรออนุมัติ — สามขั้น ตรวจสิทธิ์คงเหลือระหว่างกรอก */
export function LeaveForm({
  leave,
  preset,
  onClose,
}: {
  leave?: Leave;
  preset?: Partial<LeaveDraft>;
  onClose: () => void;
}) {
  const people = EMPLOYEES.filter((e) => e.status !== "ลาออก");
  const [d, setD] = useState<LeaveDraft>(() =>
    leave
      ? { employeeId: leave.employeeId, type: leave.type, from: leave.from, to: leave.to, reason: leave.reason, certificate: !!leave.certificate }
      : { employeeId: rostered()[0]?.id ?? people[0].id, type: LEAVE_TYPES[0].name, from: "", to: "", reason: "", certificate: false, ...preset }
  );
  const set = (patch: Partial<LeaveDraft>) => setD((x) => ({ ...x, ...patch }));
  const only = (...keys: string[]) => () =>
    Object.fromEntries(Object.entries(leaveErrors(d, leave?.id)).filter(([k]) => keys.includes(k)));

  const b = leaveBalance(d.employeeId, d.type);
  const free = b.left - b.pending + (leave && leave.type === d.type && leave.status === "รออนุมัติ" ? leave.days : 0);
  const span =
    ISO.test(d.from) && ISO.test(d.to) && d.to >= d.from && rosterOf(d.employeeId)
      ? leaveDaysOf(d.employeeId, d.type, d.from, d.to)
      : 0;

  const steps: Step[] = [
    {
      title: "ผู้ลาและประเภท",
      validate: only("employeeId", "type"),
      render: (errors) => (
        <div className="space-y-3">
          <Field label="พนักงาน" error={errors.employeeId}>
            <PersonSelect value={d.employeeId} people={people} onChange={(v) => set({ employeeId: v })} />
          </Field>
          <Field
            label="ประเภทการลา"
            error={errors.type}
            hint={b.limited ? `สิทธิ์ปีนี้ ${b.quota} วัน · อนุมัติแล้ว ${b.used} · รออนุมัติ ${b.pending} · ยื่นได้อีก ${free} วัน` : "ไม่มีเพดาน หักค่าจ้างตามวันที่ลา"}
          >
            <Select value={d.type} onChange={(v) => set({ type: v })} options={LEAVE_TYPES.map((t) => t.name)} className="w-full" />
          </Field>
          {b.limited && <Progress done={b.used + b.pending} total={Math.max(1, b.quota)} label={`ใช้และจองไว้แล้ว ${b.used + b.pending} จาก ${b.quota} วัน`} />}
        </div>
      ),
    },
    {
      title: "ช่วงวัน",
      validate: only("from", "to"),
      render: (errors) => (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ตั้งแต่วันที่" error={errors.from}>
              <input type="date" value={d.from} onChange={(e) => set({ from: e.target.value, to: d.to || e.target.value })} className={FIELD + " w-full"} />
            </Field>
            <Field label="ถึงวันที่" error={errors.to}>
              <input type="date" value={d.to} onChange={(e) => set({ to: e.target.value })} className={FIELD + " w-full"} />
            </Field>
          </div>
          {span > 0 && (
            <Note tone={b.limited && span > free ? "bad" : "idle"}>
              ช่วงนี้มีวันทำงานตามตารางกะ {span} วัน
              {d.type === "ลาคลอด" ? " (ลาคลอดนับทุกวันรวมวันหยุด)" : " วันหยุดประจำสัปดาห์และวันหยุดบริษัทไม่นับ"}
              {b.limited && (span > free ? ` · เกินสิทธิ์ที่ยื่นได้ ${free} วัน` : ` · หลังใบนี้จะเหลือ ${free - span} วัน`)}
            </Note>
          )}
        </div>
      ),
    },
    {
      title: "เหตุผล",
      validate: only("reason", "certificate"),
      render: (errors) => (
        <div className="space-y-3">
          <Field label="เหตุผลการลา" error={errors.reason} hint="หัวหน้างานจะเห็นข้อความนี้ตอนพิจารณา">
            <Area value={d.reason} onChange={(v) => set({ reason: v })} placeholder="เช่น ไข้หวัด ไปพบแพทย์" />
          </Field>
          {d.type === "ลาป่วย" && (
            <Field label="ใบรับรองแพทย์" error={errors.certificate} hint="ต้องมีเมื่อลาป่วยตั้งแต่ 3 วันทำงานขึ้นไป">
              <span className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={d.certificate} onChange={(e) => set({ certificate: e.target.checked })} className="size-4 accent-violet-600" />
                แนบใบรับรองแพทย์แล้ว
              </span>
            </Field>
          )}
        </div>
      ),
    },
  ];

  return (
    <FormModal
      open
      title={leave ? `แก้ใบลา ${leaveNo(leave)}` : "ยื่นใบลา"}
      subtitle="กรอกสามขั้นตอน ระบบตรวจสิทธิ์คงเหลือให้ระหว่างกรอก"
      onClose={onClose}
    >
      <Wizard
        steps={steps}
        onCancel={onClose}
        doneLabel={leave ? "บันทึกการแก้ไข" : "ยื่นใบลา"}
        onDone={() => {
          const ok = attempt(
            () => (leave ? updateLeave(leave.id, d) : fileLeave(d)),
            (l) => `${leave ? "บันทึกการแก้ไข" : "ยื่น"}ใบลา ${leaveNo(l)} ของ${empName(l.employeeId)} ${l.days} วันแล้ว รอหัวหน้าอนุมัติ`
          );
          if (ok) onClose();
        }}
      />
    </FormModal>
  );
}

/* ------------------------------------------------------------- follow-up */

const templateFor = (employeeId: number, topic: FollowUpTopic) => {
  const a = attendanceOf(employeeId);
  const facts: Record<FollowUpTopic, string> = {
    มาสาย: `ในงวดนี้มาสายเกินเกณฑ์ 15 นาทีแล้ว ${a.late} ครั้ง`,
    ขาดงาน: `ในงวดนี้ขาดงานโดยไม่มีใบลา ${a.absent} วัน`,
    ลืมตอกบัตร: "ลืมตอกบัตรเข้าหรือออกงาน ทำให้ต้องยื่นขอแก้เวลาย้อนหลัง",
    ออกก่อนเวลา: "ออกจากงานก่อนเวลาเลิกกะโดยไม่ได้รับอนุญาต",
  };
  return `${facts[topic]} ขอให้ปฏิบัติตามเวลาทำงานของกะและแจ้งหัวหน้างานล่วงหน้าทุกครั้งที่มีเหตุจำเป็น`;
};

/** ส่งข้อความเตือน หรือบันทึกการตักเตือน — หนังสือเตือนพิมพ์ให้พนักงานเซ็นรับทราบได้ทันที */
export function FollowUpForm({
  employeeId,
  kind,
  onClose,
  onSaved,
}: {
  employeeId: number;
  kind: FollowUpKind;
  onClose: () => void;
  onSaved: (f: FollowUp) => void;
}) {
  const a = attendanceOf(employeeId);
  const firstTopic: FollowUpTopic = a.absent > 0 ? "ขาดงาน" : "มาสาย";
  const [d, setD] = useState<FollowUpDraft>({ employeeId, kind, topic: firstTopic, detail: templateFor(employeeId, firstTopic) });
  const [tried, setTried] = useState(false);
  const errors = tried ? followUpErrors(d) : {};
  const verb: Record<FollowUpKind, string> = {
    แจ้งเตือน: "ส่งข้อความเตือน",
    ตักเตือนด้วยวาจา: "บันทึกการตักเตือนด้วยวาจา",
    หนังสือเตือน: "ออกหนังสือเตือน",
  };

  return (
    <FormModal open title={verb[d.kind]} subtitle={`${empName(employeeId)} · มาสาย ${a.late} ครั้ง · ขาดงาน ${a.absent} วันในงวดนี้`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="รูปแบบ">
          <Segmented options={FOLLOW_UP_KINDS} value={d.kind} onChange={(v) => setD({ ...d, kind: v as FollowUpKind })} />
        </Field>
        <Field label="เรื่อง" error={errors.topic}>
          <Select
            value={d.topic}
            onChange={(v) => setD({ ...d, topic: v as FollowUpTopic, detail: templateFor(employeeId, v as FollowUpTopic) })}
            options={FOLLOW_UP_TOPICS}
            className="w-full"
          />
        </Field>
        <Field
          label={d.kind === "แจ้งเตือน" ? "ข้อความถึงพนักงาน" : "รายละเอียด"}
          error={errors.detail}
          hint={d.kind === "หนังสือเตือน" ? "หนังสือเตือนมีผลหนึ่งปีนับจากวันที่ทำผิด ตามมาตรา 119" : undefined}
        >
          <textarea value={d.detail} onChange={(e) => setD({ ...d, detail: e.target.value })} rows={4} className={FIELD + " w-full resize-none"} />
        </Field>
        <Actions
          onCancel={onClose}
          label={verb[d.kind]}
          onSave={() => {
            setTried(true);
            if (Object.keys(followUpErrors(d)).length) return;
            const made = attempt(
              () => recordFollowUp(d),
              (f) => (f.kind === "แจ้งเตือน" ? `ส่งข้อความเตือนถึง${empName(employeeId)}แล้ว` : `${verb[f.kind]} ${f.no} ของ${empName(employeeId)}แล้ว`)
            );
            if (made) onSaved(made);
          }}
        />
      </div>
    </FormModal>
  );
}
