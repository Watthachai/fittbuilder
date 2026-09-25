import type { ReactNode } from "react";
import { Briefcase, Building, CalendarDays } from "lucide-react";
import { GENDER, baht, departments } from "./data";
import type { Employee, PersonnelAction } from "./data";
import { Avatar, Badge, Button, FIELD, SURFACE, Select, swatchFor } from "../ui";
import { Field } from "../kit";

/**
 * Small pieces the register, the record and the forms all draw the same way —
 * kept apart so a form never has to import the screen it is opened from.
 */

/** Departments take their swatch from catalogue order, so ฝ่ายขาย is one hue everywhere. */
export const deptSwatch = (name: string) => swatchFor(name, departments());

export const BAD = "border-rose-400 dark:border-rose-500";

export function GenderMark({ id }: { id: number }) {
  const g = GENDER[id];
  if (!g) return null;
  return (
    <span className={"text-[12px] " + (g === "ชาย" ? "text-sky-500" : "text-pink-500")} title={g}>
      {g === "ชาย" ? "♂" : "♀"}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge dot tone={status === "ทำงานอยู่" ? "ok" : status === "ทดลองงาน" ? "warn" : "idle"}>
      {status}
    </Badge>
  );
}

/** The person a dialog is about, shown so nobody confirms the wrong one. */
export function EmployeeSubject({ e }: { e: Employee }) {
  return (
    <div className={"flex items-center gap-3 p-3 " + SURFACE}>
      <Avatar name={e.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-50">
          {e.name} <GenderMark id={e.id} />
        </p>
        <p className="flex items-center gap-1 text-[11.5px] text-slate-500 dark:text-slate-400">
          <CalendarDays size={11} /> เริ่มงาน {e.contract.startedAt} · #{e.code.slice(4)}
        </p>
      </div>
      <div className="text-right text-[11.5px] text-slate-500 dark:text-slate-400">
        <p className="flex items-center justify-end gap-1"><Briefcase size={11} />{e.position}</p>
        <p className="flex items-center justify-end gap-1"><Building size={11} />{e.department}</p>
      </div>
    </div>
  );
}

/**
 * A text box inside a Field. Declared out here, not inside a form: a component
 * defined during render is a new type every render, so React remounts the
 * input and takes the caret.
 */
export function TextInput({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  type = "text",
  list,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  type?: "text" | "date" | "number" | "email";
  list?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <input
        type={type}
        value={value}
        list={list}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD + " w-full " + (error ? BAD : "")}
      />
    </Field>
  );
}

export function Choice({
  label,
  value,
  onChange,
  options,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  error?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <Select value={value} onChange={onChange} options={options} className="w-full" />
    </Field>
  );
}

export function LongText({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD + " w-full resize-none " + (error ? BAD : "")}
      />
    </Field>
  );
}

/**
 * One of a few, as cards to tap. Not a Segmented: its pill shares one layoutId
 * across the page, so a second one inside a dialog would pull the pill out of
 * the register behind it. Not inside Field either: a label wrapping several
 * buttons clicks the first of them when its caption is tapped.
 */
export function OptionCards({
  label,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <div role="radiogroup" aria-label={label} className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o)}
              className={
                "rounded-xl border px-3 py-2 text-[12.5px] transition " +
                (on
                  ? "border-violet-500 bg-violet-50 font-medium text-violet-700 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-200"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600")
              }
            >
              {o}
            </button>
          );
        })}
      </div>
      {error ? (
        <span className="mt-1 block text-[11.5px] text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] text-slate-400 dark:text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
}

/** Ticks for a set — documents received, benefits enrolled. */
export function CheckList({
  items,
  checked,
  onToggle,
  locked = [],
}: {
  items: readonly string[];
  checked: readonly string[];
  onToggle: (item: string) => void;
  /** Shown ticked and greyed: set somewhere else, listed so the picture is whole. */
  locked?: readonly string[];
}) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {[...locked, ...items].map((it) => {
        const fixed = locked.includes(it);
        const on = fixed || checked.includes(it);
        return (
          <li key={it}>
            <label
              className={
                "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[12.5px] transition " +
                (fixed
                  ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-500"
                  : on
                    ? "cursor-pointer border-violet-300 bg-violet-50/60 text-slate-800 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-slate-100"
                    : "cursor-pointer border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300")
              }
            >
              <input
                type="checkbox"
                checked={on}
                disabled={fixed}
                onChange={() => onToggle(it)}
                className="size-3.5 rounded accent-violet-600"
              />
              {it}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** The save row at the bottom of a form, kept in reach the way the wizard keeps its own. */
export function FormFooter({
  onCancel,
  onSave,
  saveLabel = "บันทึก",
  note,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  note?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
      <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
      {note && <span className="text-[11.5px] text-slate-400 dark:text-slate-500">{note}</span>}
      <Button variant="primary" onClick={onSave} className="min-w-[8rem]">{saveLabel}</Button>
    </div>
  );
}

/** A compact button for a row of actions inside a list. */
export function RowButton({
  children,
  onClick,
  tone = "plain",
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "plain" | "go" | "stop";
  icon?: ReactNode;
}) {
  const skin =
    tone === "go"
      ? "border-violet-600 bg-violet-600 text-white hover:bg-violet-700 dark:border-violet-500"
      : tone === "stop"
        ? "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
        : "border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-violet-300";
  return (
    <button
      onClick={onClick}
      className={"inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] transition " + skin}
    >
      {icon}
      {children}
    </button>
  );
}

export const ACTION_TONE = { รออนุมัติ: "warn", อนุมัติแล้ว: "ok", ไม่อนุมัติ: "idle" } as const;

const pctChange = (from: number, to: number) => {
  const p = ((to - from) / from) * 100;
  return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
};

/** "ฝ่ายขาย → ฝ่ายการตลาด" — what a personnel action changes, in one line. */
export function actionSummary(a: PersonnelAction): string {
  const salary = a.from.salary !== a.to.salary ? `${baht(a.from.salary)} → ${baht(a.to.salary)} (${pctChange(a.from.salary, a.to.salary)})` : "";
  if (a.kind === "ตักเตือน") return a.reason;
  if (a.kind === "ปรับเงินเดือน") return salary;
  const moved = a.from.department !== a.to.department ? `${a.from.department} → ${a.to.department}` : "";
  const retitled = a.from.position !== a.to.position ? `${a.from.position} → ${a.to.position}` : "";
  return (a.kind === "ย้ายแผนก" ? [moved, retitled] : [retitled, moved]).concat(salary).filter(Boolean).join(" · ");
}
