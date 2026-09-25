import { useState } from "react";
import type { ReactNode } from "react";
import { Coffee, MoonStar, Printer, Sun, SunMedium, Timer } from "lucide-react";
import { LEAVE_TYPES, SHIFTS, empName } from "./data";
import type { LeaveStatus, RequestStatus } from "./data";
import { Avatar, Button, FIELD, swatchFor } from "../ui";
import type { Tone } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, printDocument } from "../kit";

/**
 * What the time-and-leave screen, its records, its forms and its printed papers
 * all draw with — one place, so a shift is the same colour on every one of them.
 */

const SHIFT_ORDER = SHIFTS.map((s) => s.code);
export const shiftSwatch = (code: string) => swatchFor(code, SHIFT_ORDER);

export const TYPE_ORDER = LEAVE_TYPES.map((t) => t.name);
export const typeSwatch = (name: string) => swatchFor(name, TYPE_ORDER);

export const SHIFT_ICON: Record<string, ReactNode> = {
  A: <Sun size={14} />,
  B: <SunMedium size={14} />,
  N: <MoonStar size={14} />,
  O: <Coffee size={14} />,
  S: <Timer size={14} />,
};

export const STATUS_TONE: Record<LeaveStatus, Tone> = {
  อนุมัติแล้ว: "ok",
  รออนุมัติ: "warn",
  ไม่อนุมัติ: "bad",
  ยกเลิก: "idle",
};

export const REQUEST_TONE: Record<RequestStatus, Tone> = {
  อนุมัติแล้ว: "ok",
  รออนุมัติ: "warn",
  ไม่อนุมัติ: "bad",
};

export const STATE_TONE: Record<string, Tone> = {
  ปกติ: "ok",
  มาสาย: "warn",
  ขาดงาน: "bad",
  ลา: "info",
};

/** Run an action; say it happened, or say why it did not. Returns what it made, or undefined. */
export function attempt<T>(act: () => T, done: string | ((made: T) => string)): T | undefined {
  try {
    const made = act();
    notify(typeof done === "string" ? done : done(made));
    return made;
  } catch (e) {
    notify(e instanceof Error ? e.message : String(e), "bad");
    return undefined;
  }
}

const MINI: Record<"ok" | "bad" | "idle", string> = {
  ok: "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10",
  bad: "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10",
  idle: "border-slate-300 text-slate-700 hover:border-violet-400 hover:text-violet-700 dark:border-slate-700 dark:text-slate-200",
};

/** The small outlined button a row carries: อนุมัติ, ไม่อนุมัติ, พิมพ์. */
export function MiniButton({
  tone = "idle",
  onClick,
  disabled,
  children,
}: {
  tone?: "ok" | "bad" | "idle";
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={"inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11.5px] transition disabled:cursor-not-allowed disabled:opacity-40 " + MINI[tone]}
    >
      {children}
    </button>
  );
}

/** Avatar, name and one line under it — the subject line of every dialog here. */
export function Who({ id, sub }: { id: number; sub: ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar name={empName(id)} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">{empName(id)}</span>
        <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{sub}</span>
      </span>
    </span>
  );
}

/**
 * A decision that needs a reason on the record: not approving, cancelling.
 * The reason is what the person reads when they ask why, so it is required.
 */
export function ReasonDialog({
  open,
  title,
  body,
  subject,
  confirmLabel,
  label = "เหตุผล",
  placeholder,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  subject?: ReactNode;
  confirmLabel: string;
  label?: string;
  placeholder?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const short = reason.trim().length < 5;
  const reset = () => {
    setReason("");
    setTried(false);
  };
  return (
    <ConfirmDialog
      open={open}
      title={title}
      body={body}
      subject={subject}
      confirmLabel={confirmLabel}
      onCancel={() => {
        reset();
        onCancel();
      }}
      onConfirm={() => {
        setTried(true);
        if (short) return;
        onConfirm(reason.trim());
        reset();
      }}
      fields={
        <Field label={label} error={tried && short ? "เขียนเหตุผลอย่างน้อย 5 ตัวอักษร" : undefined}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={placeholder}
            className={FIELD + " w-full resize-none"}
          />
        </Field>
      }
    />
  );
}

/** A paper on screen with the button that prints it. The paper itself is the page. */
export function PrintModal({
  title,
  subtitle,
  what,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  /** What went to the printer, for the confirmation: "ใบลา LV-2569-0010". */
  what: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <FormModal open title={title} subtitle={subtitle} onClose={onClose} size="lg">
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          ปิด
        </Button>
        <Button
          variant="primary"
          icon={<Printer size={15} />}
          onClick={() => {
            printDocument();
            notify(`ส่ง${what}ไปที่เครื่องพิมพ์แล้ว`);
          }}
        >
          พิมพ์
        </Button>
      </div>
      <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800/60">{children}</div>
    </FormModal>
  );
}
