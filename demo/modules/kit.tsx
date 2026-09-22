import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FIELD, SURFACE, Skeleton } from "./ui";

/**
 * The working parts of a management screen: the table people live in, the panel
 * that shows one row without losing the list, the confirmation that makes a
 * destructive act deliberate, and the form that does not ask for forty fields at
 * once.
 *
 * They are here rather than inside a module because every module needs the same
 * ones, and a table that sorts differently on the payroll screen than on the
 * personnel screen is a defect nobody files and everybody feels.
 */

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Supplying this makes the column sortable; leaving it off means it is not. */
  sort?: (a: T, b: T) => number;
  align?: "right";
  /** Hidden by default in compact density, for columns that are nice-to-have. */
  secondary?: boolean;
};

type Density = "comfortable" | "compact";

export function DataTable<T>({
  rows,
  columns,
  getId,
  onOpen,
  selectable,
  bulkActions,
  toolbar,
  empty = "ไม่มีข้อมูลที่ตรงกับเงื่อนไข",
  loading,
}: {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string | number;
  /** Opening a row shows it beside the list, so the list stays where it was. */
  onOpen?: (row: T) => void;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  toolbar?: ReactNode;
  empty?: string;
  loading?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string>();
  const [desc, setDesc] = useState(false);
  const [density, setDensity] = useState<Density>("comfortable");
  const [picked, setPicked] = useState<Set<string | number>>(new Set());

  const shown = density === "compact" ? columns : columns;
  const pad = density === "compact" ? "px-3 py-1.5" : "px-4 py-3";

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const out = [...rows].sort(col.sort);
    return desc ? out.reverse() : out;
  }, [rows, columns, sortKey, desc]);

  // A filter can drop rows that were ticked; keeping them selected would let a
  // bulk action hit records the person can no longer see.
  useEffect(() => {
    const visible = new Set(rows.map(getId));
    setPicked((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows, getId]);

  const selected = sorted.filter((r) => picked.has(getId(r)));
  const allOn = sorted.length > 0 && selected.length === sorted.length;

  const toggle = (id: string | number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) return <Skeleton rows={6} cols={Math.min(5, columns.length)} />;

  return (
    <div className="space-y-2">
      {(toolbar || selectable) && (
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
            {(["comfortable", "compact"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                title={d === "comfortable" ? "แถวห่าง อ่านสบาย" : "แถวถี่ เห็นข้อมูลเยอะ"}
                className={
                  "rounded-md px-2 py-1 text-[11.5px] transition " +
                  (density === d
                    ? "bg-slate-100 font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")
                }
              >
                {d === "comfortable" ? "ห่าง" : "ถี่"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The contextual bar only exists while something is ticked, so the screen
          is not carrying a row of disabled buttons the rest of the time. */}
      {selectable && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-500/30 dark:bg-sky-500/10">
          <span className="text-[12.5px] font-medium text-sky-800 dark:text-sky-300">
            เลือกไว้ {selected.length} รายการ
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {bulkActions?.(selected, () => setPicked(new Set()))}
            <button
              onClick={() => setPicked(new Set())}
              className="rounded-md px-2 py-1 text-[12px] text-sky-700 transition hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-500/20"
            >
              ยกเลิกการเลือก
            </button>
          </span>
        </div>
      )}

      <div className={"overflow-hidden " + SURFACE}>
        <div className="max-h-[calc(100vh-19rem)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                {selectable && (
                  <th className={pad + " w-10"}>
                    <input
                      type="checkbox"
                      checked={allOn}
                      aria-label="เลือกทั้งหมด"
                      onChange={() =>
                        setPicked(allOn ? new Set() : new Set(sorted.map(getId)))
                      }
                      className="size-3.5 accent-sky-600"
                    />
                  </th>
                )}
                {shown.map((c) => (
                  <th key={c.key} className={pad + (c.align === "right" ? " text-right" : "")}>
                    {c.sort ? (
                      <button
                        onClick={() => {
                          if (sortKey === c.key) setDesc((d) => !d);
                          else {
                            setSortKey(c.key);
                            setDesc(false);
                          }
                        }}
                        className={
                          "inline-flex items-center gap-1 transition hover:text-slate-800 dark:hover:text-slate-100 " +
                          (sortKey === c.key ? "text-slate-800 dark:text-slate-100" : "")
                        }
                      >
                        {c.header}
                        <span className="text-[9px] opacity-60">
                          {sortKey === c.key ? (desc ? "▼" : "▲") : "↕"}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((r) => {
                const id = getId(r);
                const on = picked.has(id);
                return (
                  <tr
                    key={id}
                    tabIndex={onOpen ? 0 : undefined}
                    onClick={onOpen ? () => onOpen(r) : undefined}
                    onKeyDown={
                      onOpen
                        ? (e) => {
                            if (e.key === "Enter") onOpen(r);
                          }
                        : undefined
                    }
                    className={
                      (onOpen ? "cursor-pointer " : "") +
                      "outline-none focus-visible:bg-sky-100/60 dark:focus-visible:bg-sky-500/15 " +
                      (on
                        ? "bg-sky-50/60 dark:bg-sky-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50")
                    }
                  >
                    {selectable && (
                      <td className={pad} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label="เลือกแถวนี้"
                          onChange={() => toggle(id)}
                          className="size-3.5 accent-sky-600"
                        />
                      </td>
                    )}
                    {shown.map((c) => (
                      <td
                        key={c.key}
                        className={
                          pad +
                          (c.align === "right" ? " text-right" : "") +
                          " text-slate-600 dark:text-slate-300"
                        }
                      >
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={shown.length + (selectable ? 1 : 0)}
                    className="px-4 py-14 text-center text-[13px] text-slate-400 dark:text-slate-500"
                  >
                    {empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Detail beside the list rather than instead of it.
 *
 * Sending someone to a new page to read one row costs them their scroll position,
 * their filters and their place in the queue they were working through. The panel
 * slides over, the list stays behind it, and Escape puts them back.
 */
export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 dark:bg-black/60" />
      <div
        className={
          "absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800 " +
          width
        }
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-[12.5px] text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="ปิดแผงรายละเอียด"
            className="shrink-0 rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Sticky, so the actions are reachable without scrolling back up. */}
        {footer && (
          <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Deliberate destruction.
 *
 * `confirmWord` makes the person type something before the button works. It is
 * for the acts that cannot be taken back — not for every delete, or people learn
 * to type it without reading.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmWord,
  confirmLabel = "ยืนยัน",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmWord?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  if (!open) return null;
  const armed = !confirmWord || typed.trim() === confirmWord;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      onClick={onCancel}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/70"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
        <div className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{body}</div>

        {confirmWord && (
          <label className="mt-4 block">
            <span className="text-[12px] text-slate-500 dark:text-slate-400">
              พิมพ์ <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{confirmWord}</span> เพื่อยืนยัน
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={FIELD + " mt-1 w-full"}
            />
          </label>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={!armed}
            className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <div className="mt-1">{children}</div>
      {/* The message replaces the hint rather than pushing it down, so the form
          does not reflow every time someone is mid-typing. */}
      {error ? (
        <span className="mt-1 block text-[11.5px] text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] text-slate-400 dark:text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

export type Step = {
  title: string;
  /** Returns the fields that are wrong; an empty object means the step passes. */
  validate?: () => Record<string, string>;
  render: (errors: Record<string, string>) => ReactNode;
};

/**
 * A long form cut into steps.
 *
 * Validation runs when someone tries to leave a step, not when they submit at the
 * end — finding out on the last screen that the first one was wrong is the thing
 * that makes people abandon a form.
 */
export function Wizard({
  steps,
  onDone,
  onCancel,
  doneLabel = "บันทึก",
}: {
  steps: Step[];
  onDone: () => void;
  onCancel: () => void;
  doneLabel?: string;
}) {
  const [at, setAt] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const step = steps[at];
  const last = at === steps.length - 1;
  const topRef = useRef<HTMLDivElement>(null);

  const advance = () => {
    const found = step.validate?.() ?? {};
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (last) onDone();
    else {
      setAt((i) => i + 1);
      topRef.current?.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={topRef}>
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s.title} className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={
                  "h-1 rounded-full transition " +
                  (i <= at ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-800")
                }
              />
              <span
                className={
                  "truncate text-[11px] " +
                  (i === at
                    ? "font-medium text-sky-700 dark:text-sky-400"
                    : "text-slate-400 dark:text-slate-500")
                }
              >
                {i + 1}. {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto">{step.render(errors)}</div>

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          onClick={() => (at === 0 ? onCancel() : setAt((i) => i - 1))}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {at === 0 ? "ยกเลิก" : "ย้อนกลับ"}
        </button>
        <button
          onClick={advance}
          className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700"
        >
          {last ? doneLabel : "ถัดไป"}
        </button>
      </div>
    </div>
  );
}
