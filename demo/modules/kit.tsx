import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, X } from "lucide-react";
import { Button, FIELD, Overlay, SURFACE, Skeleton, enter } from "./ui";

/**
 * The working parts of a management screen: the table people live in, the panel
 * that shows one record without losing the list, the confirmation that makes a
 * destructive act deliberate, and the form that does not ask for forty fields
 * at once.
 *
 * They are here rather than inside a module because every module needs the same
 * ones, and a table that sorts differently on the payroll screen than on the
 * personnel screen is a defect nobody files and everybody feels.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Supplying this makes the column sortable; leaving it off means it is not. */
  sort?: (a: T, b: T) => number;
  align?: "right";
  width?: string;
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
  trailing,
}: {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string | number;
  /** Opening a row shows it over the list, so the list stays where it was. */
  onOpen?: (row: T) => void;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  toolbar?: ReactNode;
  empty?: string;
  loading?: boolean;
  /** Per-row controls at the far right — favourite, menu — that must not open the row. */
  trailing?: (row: T) => ReactNode;
}) {
  const [sortKey, setSortKey] = useState<string>();
  const [desc, setDesc] = useState(false);
  const [density, setDensity] = useState<Density>("comfortable");
  const [picked, setPicked] = useState<Set<string | number>>(new Set());

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
    <div className="space-y-3">
      {toolbar}

      {/* The contextual bar only exists while something is ticked, so the screen
          is not carrying a row of disabled buttons the rest of the time. */}
      <AnimatePresence initial={false}>
        {selectable && selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 dark:border-violet-500/30 dark:bg-violet-500/10"
          >
            <span className="text-[12.5px] font-medium text-violet-800 dark:text-violet-200">
              เลือกไว้ {selected.length} รายการ
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              {bulkActions?.(selected, () => setPicked(new Set()))}
              <button
                onClick={() => setPicked(new Set())}
                className="rounded-lg px-2 py-1 text-[12px] text-violet-700 transition hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-500/20"
              >
                ยกเลิกการเลือก
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={"overflow-hidden " + SURFACE}>
        <div className="max-h-[calc(100dvh-20rem)] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-slate-50/95 text-left text-[11.5px] text-slate-500 backdrop-blur dark:bg-slate-800/95 dark:text-slate-400">
              <tr>
                {selectable && (
                  <th className={pad + " w-10"}>
                    <input
                      type="checkbox"
                      checked={allOn}
                      aria-label="เลือกทั้งหมด"
                      onChange={() => setPicked(allOn ? new Set() : new Set(sorted.map(getId)))}
                      className="size-3.5 rounded accent-violet-600"
                    />
                  </th>
                )}
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={c.width ? { width: c.width } : undefined}
                    className={pad + " font-medium" + (c.align === "right" ? " text-right" : "")}
                  >
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
                          "inline-flex items-center gap-1 transition hover:text-slate-900 dark:hover:text-slate-100 " +
                          (sortKey === c.key ? "text-slate-900 dark:text-slate-100" : "")
                        }
                      >
                        {c.header}
                        {sortKey === c.key ? (
                          desc ? <ChevronDown size={13} /> : <ChevronUp size={13} />
                        ) : (
                          <ChevronsUpDown size={13} className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
                {trailing && <th className={pad + " w-24"} />}
                {(toolbar || selectable) && !trailing && (
                  <th className={pad + " w-16 text-right"}>
                    <button
                      onClick={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}
                      title={density === "compact" ? "แถวห่าง อ่านสบาย" : "แถวถี่ เห็นข้อมูลเยอะ"}
                      className="text-[11px] font-normal text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                    >
                      {density === "compact" ? "ห่าง" : "ถี่"}
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((r, i) => {
                const id = getId(r);
                const on = picked.has(id);
                return (
                  <motion.tr
                    key={id}
                    initial={enter({ opacity: 0, y: 4 })}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: EASE, delay: Math.min(i, 12) * 0.025 }}
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
                      "outline-none focus-visible:bg-violet-50 dark:focus-visible:bg-violet-500/10 " +
                      (on ? "bg-violet-50/60 dark:bg-violet-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50")
                    }
                  >
                    {selectable && (
                      <td className={pad} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label="เลือกแถวนี้"
                          onChange={() => toggle(id)}
                          className="size-3.5 rounded accent-violet-600"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={pad + (c.align === "right" ? " text-right" : "") + " text-slate-600 dark:text-slate-300"}
                      >
                        {c.cell(r)}
                      </td>
                    ))}
                    {trailing && (
                      <td className={pad + " text-right"} onClick={(e) => e.stopPropagation()}>
                        {trailing(r)}
                      </td>
                    )}
                    {(toolbar || selectable) && !trailing && <td className={pad} />}
                  </motion.tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0) + 1}
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
 * One record, large, over the list — with a way to step to the next one.
 *
 * The list stays behind it dimmed, so the filters and scroll position survive.
 * The pager is what makes it a working tool rather than a preview: someone
 * reviewing twenty records reads them in sequence without closing anything.
 */
export function DetailModal({
  open,
  title,
  onClose,
  index,
  total,
  onStep,
  children,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  index?: number;
  total?: number;
  onStep?: (delta: 1 | -1) => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (onStep && e.key === "ArrowRight") onStep(1);
      if (onStep && e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onStep]);

  return (
    <Overlay>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] dark:bg-black/65 sm:p-6"
            onClick={onClose}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                  {title}
                </h2>
                {onStep && index !== undefined && total !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onStep(-1)}
                      disabled={index <= 0}
                      aria-label="รายการก่อนหน้า"
                      className="grid size-8 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => onStep(1)}
                      disabled={index >= total - 1}
                      aria-label="รายการถัดไป"
                      className="grid size-8 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <ChevronRight size={15} />
                    </button>
                    <span className="ml-1 text-[12.5px] tabular-nums text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-slate-50">
                        {String(index + 1).padStart(2, "0")}
                      </span>{" "}
                      จาก {total}
                    </span>
                  </div>
                )}
                <button
                  onClick={onClose}
                  aria-label="ปิด"
                  className="ml-2 grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1">{children}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Overlay>
  );
}

/**
 * A short, self-contained task: create this, edit that.
 *
 * It is centred and only as tall as it needs to be. A drawer was wrong for this —
 * a drawer is full height because it exists to show one row of a list without
 * losing the list, so a six-field form left most of the screen empty with its
 * buttons stranded at the bottom of it.
 */
export function FormModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  size = "md",
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const width = size === "lg" ? "max-w-3xl" : size === "sm" ? "max-w-md" : "max-w-xl";

  return (
    <Overlay>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px] dark:bg-black/65"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className={
                "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800 " +
                width
              }
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
                  {subtitle && (
                    <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">{subtitle}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  aria-label="ปิด"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Overlay>
  );
}

/**
 * Detail beside the list rather than instead of it.
 *
 * The panel slides over, the list stays behind, and Escape puts them back.
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

  return (
    <Overlay>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] dark:bg-black/60"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className={
                "absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800 " +
                width
              }
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
                  {subtitle && <p className="mt-0.5 truncate text-[12.5px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="ปิดแผงรายละเอียด"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
              {footer && <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Overlay>
  );
}

/**
 * Deliberate destruction.
 *
 * `subject` is the record about to be acted on, shown so nobody confirms the
 * wrong one. `fields` is whatever the act needs recorded — a reason, a message.
 * `confirmWord` makes the person type something first; it is for the acts that
 * cannot be taken back, not for every delete, or people learn to type it
 * without reading.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  subject,
  fields,
  confirmWord,
  confirmLabel = "ยืนยัน",
  onConfirm,
  onCancel,
  disabled,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  subject?: ReactNode;
  fields?: ReactNode;
  confirmWord?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const armed = (!confirmWord || typed.trim() === confirmWord) && !disabled;

  return (
    <Overlay>
      <AnimatePresence>
        {open && (
          <motion.div
            role="alertdialog"
            aria-modal="true"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] dark:bg-black/70"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
            >
              {/* The dotted field behind the title is the reference's tell for
                  "stop and read" — texture, not colour, so it survives dark mode. */}
              <div
                className="px-6 pb-4 pt-6 text-center"
                style={{
                  backgroundImage: "radial-gradient(circle, rgb(148 163 184 / 0.25) 1px, transparent 1px)",
                  backgroundSize: "10px 10px",
                }}
              >
                <h2 className="text-[17px] font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
                <div className="mt-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{body}</div>
              </div>

              <div className="space-y-4 px-6 pb-6">
                {subject}
                {fields}

                {confirmWord && (
                  <label className="block">
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">
                      พิมพ์{" "}
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{confirmWord}</span>{" "}
                      เพื่อยืนยัน
                    </span>
                    <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className={FIELD + " mt-1 w-full"} />
                  </label>
                )}

                <div className="flex justify-between gap-2 pt-1">
                  <Button variant="secondary" onClick={onCancel}>
                    ยกเลิก
                  </Button>
                  <Button variant="primary" onClick={onConfirm} disabled={!armed}>
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Overlay>
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
    <div className="flex flex-col">
      <div ref={topRef}>
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s.title} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <motion.span
                  initial={false}
                  animate={{ width: i <= at ? "100%" : "0%" }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="block h-full rounded-full bg-violet-500"
                />
              </span>
              <span
                className={
                  "truncate text-[11px] " +
                  (i === at ? "font-medium text-violet-700 dark:text-violet-300" : "text-slate-400 dark:text-slate-500")
                }
              >
                {i + 1}. {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={at}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="mt-5 space-y-4"
        >
          {step.render(errors)}
        </motion.div>
      </AnimatePresence>

      {/* Sticky, so a long step keeps its actions reachable without scrolling. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        <Button variant="secondary" onClick={() => (at === 0 ? onCancel() : setAt((i) => i - 1))}>
          {at === 0 ? "ยกเลิก" : "ย้อนกลับ"}
        </Button>
        <span className="text-[11.5px] text-slate-400 dark:text-slate-500">
          ขั้นที่ {at + 1} จาก {steps.length}
        </span>
        <Button variant="primary" onClick={advance} className="min-w-[8rem]">
          {last ? doneLabel : "ถัดไป"}
        </Button>
      </div>
    </div>
  );
}
