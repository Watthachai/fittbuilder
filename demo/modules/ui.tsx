import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ChevronDown, LayoutGrid, LayoutList } from "lucide-react";

/**
 * The pieces every module screen is built from.
 *
 * One set, composer-owned, shipped like the app shell — so no module can disagree
 * with another about what a card or a badge looks like. Every surface declares
 * both themes: people run a system like this for eight hours a day.
 *
 * The visual language is the one the product was asked to match: a quiet grey
 * page, white cards with hairline borders, one violet accent doing all the
 * pointing, line icons on every label, and motion that answers an action rather
 * than decorating the page.
 */

export const TH = "px-4 py-3";

export const SURFACE =
  "rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900";

export const FIELD =
  "rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition " +
  "focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-400";

/* --------------------------------------------------------------- motion */

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Whether an entrance may begin invisible.
 *
 * An animation that starts at opacity 0 and never ticks leaves the content
 * invisible: a background tab throttles frames, the screen-capture bridge
 * photographs a page nobody is looking at, and a person who asked for reduced
 * motion should not be made to wait for it. In all three the content just
 * appears. Nothing is lost but the flourish.
 */
export function canEnter(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

/** `initial` for an entrance: the hidden pose when it may animate, `false` when it may not. */
export const enter = <T extends object>(pose: T): T | false => (canEnter() ? pose : false);

/** Fades and lifts children in once, on mount. One orchestrated entrance, not confetti. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={enter({ opacity: 0, y: 10 })}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- atoms */

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={"overflow-hidden " + SURFACE + " " + className}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0 text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad" | "idle" | "info" | "accent";

const BADGE: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-500/15 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-500/15 dark:text-rose-300",
  idle: "bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300",
  info: "bg-sky-50 text-sky-700 ring-sky-600/10 dark:bg-sky-500/15 dark:text-sky-300",
  accent: "bg-violet-50 text-violet-700 ring-violet-600/10 dark:bg-violet-500/15 dark:text-violet-300",
};

const DOT: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  idle: "bg-slate-400",
  info: "bg-sky-500",
  accent: "bg-violet-500",
};

export function Badge({
  tone = "idle",
  icon,
  dot,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ring-1 ring-inset " +
        BADGE[tone]
      }
    >
      {dot && <span className={"size-1.5 rounded-full " + DOT[tone]} />}
      {icon}
      {children}
    </span>
  );
}

/** A soft chip for a value that is one of several — a preference, a benefit, a tag. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  icon,
  type = "button",
  disabled,
  className = "",
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  href?: string;
}) {
  const skin =
    variant === "primary"
      ? "bg-violet-600 text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
      : variant === "danger"
        ? "bg-rose-600 text-white hover:bg-rose-700"
        : variant === "ghost"
          ? "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
  const cls =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 " +
    skin +
    " " +
    className;
  if (href) {
    return (
      <motion.a whileTap={{ scale: 0.97 }} href={href} className={cls}>
        {icon}
        {children}
      </motion.a>
    );
  }
  return (
    <motion.button whileTap={{ scale: 0.97 }} type={type} onClick={onClick} disabled={disabled} className={cls}>
      {icon}
      {children}
    </motion.button>
  );
}

export function IconButton({
  children,
  onClick,
  label,
  active,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "grid size-8 place-items-center rounded-lg border transition " +
        (active
          ? "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100") +
        " " +
        className
      }
    >
      {children}
    </motion.button>
  );
}

const HUES = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

/** Initials on a colour picked from the name, so the same person is always the same colour. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const hue = HUES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];
  const dim =
    size === "xl"
      ? "size-16 text-xl"
      : size === "lg"
        ? "size-11 text-base"
        : size === "sm"
          ? "size-6 text-[10px]"
          : "size-8 text-[12px]";
  return (
    <span
      className={
        "grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-slate-900 " +
        hue +
        " " +
        dim
      }
    >
      {name.trim().slice(0, 1)}
    </span>
  );
}

/** "label : value" with an icon in front — the row every profile column is made of. */
export function IconRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-[13px]">
      <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
      <span className="w-28 shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
      <span className="shrink-0 text-slate-300 dark:text-slate-600">:</span>
      <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-100">{children}</span>
    </div>
  );
}

export function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-50">
      <span className="text-slate-500 dark:text-slate-400">{icon}</span>
      {children}
    </h3>
  );
}

/* ------------------------------------------------------------- numbers */

/**
 * The strip at the top of a list: several figures in one card, divided by
 * hairlines, each with an icon, a big number and one line of context beneath.
 */
export function StatStrip({
  title,
  icon,
  cells,
  className = "",
}: {
  title: string;
  icon: ReactNode;
  cells: { icon: ReactNode; label: string; value: ReactNode; sub: ReactNode; tone?: Tone }[];
  className?: string;
}) {
  return (
    <div className={"p-4 " + SURFACE + " " + className}>
      <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-50">
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        {title}
      </div>
      <div className="grid divide-x divide-slate-100 dark:divide-slate-800" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((c, i) => (
          <div key={c.label} className={i === 0 ? "pr-4" : "px-4"}>
            <div className="flex items-center gap-1.5 text-[12.5px] text-slate-600 dark:text-slate-300">
              <span className={c.tone ? "text-" + (c.tone === "accent" ? "violet" : c.tone === "ok" ? "emerald" : c.tone === "warn" ? "amber" : c.tone === "bad" ? "rose" : "sky") + "-500" : "text-slate-400"}>
                {c.icon}
              </span>
              {c.label}
            </div>
            <div className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
              {c.value}
            </div>
            <div className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "warn" | "bad";
}) {
  return (
    <div className={SURFACE + " p-4"}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={
          "mt-1 text-lg font-semibold " +
          (tone === "warn"
            ? "text-amber-700 dark:text-amber-400"
            : tone === "bad"
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-900 dark:text-slate-50")
        }
      >
        {value}
      </div>
    </div>
  );
}

export function Metric({
  label,
  value,
  delta,
  deltaLabel,
  goodWhen = "up",
  icon,
  footer,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  goodWhen?: "up" | "down";
  icon?: ReactNode;
  footer?: ReactNode;
}) {
  const good = delta === undefined ? true : goodWhen === "up" ? delta >= 0 : delta <= 0;
  return (
    <div className={"flex flex-col " + SURFACE}>
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                {icon}
              </span>
            )}
            <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
          </div>
          {delta !== undefined && (
            <Badge tone={good ? "ok" : "bad"}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
            </Badge>
          )}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</div>
        {deltaLabel && <div className="mt-0.5 text-[11.5px] text-slate-400 dark:text-slate-500">{deltaLabel}</div>}
      </div>
      {footer && (
        <div className="border-t border-slate-100 px-4 py-2 text-[11.5px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- controls */

export function Search({
  value,
  onChange,
  placeholder,
  icon,
  className = "w-64",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <label className={"relative block " + className}>
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={FIELD + " w-full placeholder:text-slate-400 dark:placeholder:text-slate-500 " + (icon ? "pl-9" : "")}
      />
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  className?: string;
}) {
  return (
    <span className={"relative inline-block " + className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD + " w-full appearance-none pr-8"}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </span>
  );
}

/** One-of-many, in a pill. The moving highlight is the only thing that animates. */
export function Segmented({
  options,
  value,
  onChange,
  counts,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={
              "relative rounded-lg px-3 py-1.5 text-[12.5px] transition " +
              (on ? "text-slate-900 dark:text-slate-50" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100")
            }
          >
            {on && (
              <motion.span
                layoutId="segmented-pill"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-slate-900"
              />
            )}
            <span className="relative">
              {o}
              {counts?.[o] !== undefined && (
                <span className="ml-1.5 text-[11px] tabular-nums text-slate-400">{counts[o]}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ViewToggle({ value, onChange }: { value: "list" | "grid"; onChange: (v: "list" | "grid") => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
      {(["list", "grid"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-label={v === "list" ? "มุมมองตาราง" : "มุมมองการ์ด"}
          title={v === "list" ? "มุมมองตาราง" : "มุมมองการ์ด"}
          className={
            "grid size-8 place-items-center rounded-lg transition " +
            (value === v
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-400 hover:text-slate-800 dark:hover:text-slate-100")
          }
        >
          {v === "list" ? <LayoutList size={15} /> : <LayoutGrid size={15} />}
        </button>
      ))}
    </div>
  );
}

/** Tabs with a sliding underline. `layoutId` moves the line rather than redrawing it. */
export function Tabs({
  tabs,
  active,
  onPick,
  badges,
  icons,
  id = "tabs",
}: {
  tabs: readonly string[];
  active: string;
  onPick: (tab: string) => void;
  badges?: Record<string, number>;
  icons?: Record<string, ReactNode>;
  id?: string;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {tabs.map((t) => {
        const on = t === active;
        return (
          <button
            key={t}
            onClick={() => onPick(t)}
            className={
              "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] transition " +
              (on
                ? "font-medium text-violet-700 dark:text-violet-300"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100")
            }
          >
            {icons?.[t] && <span className={on ? "text-violet-600 dark:text-violet-300" : "text-slate-400"}>{icons[t]}</span>}
            {t}
            {badges?.[t] ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10.5px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                {badges[t]}
              </span>
            ) : null}
            {on && (
              <motion.span
                layoutId={id + "-underline"}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-600 dark:bg-violet-400"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PageHead({
  title,
  meta,
  right,
}: {
  title: string;
  meta: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[20px] font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">{meta}</p>
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------- tables */

export type Col = { k: string; right?: boolean };

export function Head({ cols }: { cols: Col[] }) {
  return (
    <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
      <tr>
        {cols.map((c, i) => (
          <th key={c.k + i} className={TH + " font-medium" + (c.right ? " text-right" : "")}>
            {c.k}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Row({
  k,
  v,
  bold,
  muted,
  cut,
}: {
  k: ReactNode;
  v: ReactNode;
  bold?: boolean;
  muted?: boolean;
  cut?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt
        className={
          bold
            ? "font-medium text-slate-900 dark:text-slate-100"
            : muted
              ? "text-slate-600 dark:text-slate-400"
              : "text-slate-500 dark:text-slate-400"
        }
      >
        {k}
      </dt>
      <dd
        className={
          "text-right " +
          (bold ? "font-semibold " : "") +
          (cut ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100")
        }
      >
        {v}
      </dd>
    </div>
  );
}

/* --------------------------------------------------------------- signals */

export function Bar({ pct, tone, width = "w-20" }: { pct: number; tone?: Tone; width?: string }) {
  const fill =
    tone === "bad"
      ? "bg-rose-500"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "info"
          ? "bg-sky-500"
          : tone === "accent"
            ? "bg-violet-500"
            : "bg-emerald-500";
  return (
    <span className="flex items-center gap-2">
      <span className={"h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 " + width}>
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: Math.max(0, Math.min(100, pct)) + "%" }}
          transition={{ duration: 0.6, ease: EASE }}
          className={"block h-full rounded-full " + fill}
        />
      </span>
      <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">{Math.round(pct)}%</span>
    </span>
  );
}

/** A completion bar with the gradient the reference uses — for "3 of 4 done". */
export function Progress({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
        <span className="text-slate-700 dark:text-slate-200">{label ?? `${done} จาก ${total}`}</span>
        <span className="font-medium tabular-nums text-slate-900 dark:text-slate-50">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-500/15">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: pct + "%" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600"
        />
      </div>
    </div>
  );
}

export function Note({ tone, children }: { tone: Tone; children: ReactNode }) {
  const skin =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
        : tone === "bad"
          ? "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300"
          : tone === "accent"
            ? "bg-violet-50 text-violet-800 dark:bg-violet-500/10 dark:text-violet-300"
            : "bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
  return <div className={"rounded-xl px-4 py-3.5 text-[13px] leading-relaxed " + skin}>{children}</div>;
}

export type StepState = "done" | "current" | "todo" | "failed";

/**
 * Stages joined by lines. Done stages are ticked, the current one is filled, the
 * rest are outlined — the shape a process has when you glance at it.
 */
export function Stepper({
  steps,
  icons,
}: {
  steps: { label: string; state: StepState }[];
  icons: { done: ReactNode; current: ReactNode; todo: ReactNode; failed: ReactNode };
}) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
      {steps.map((s, i) => {
        const color =
          s.state === "done" || s.state === "current"
            ? "text-violet-600 dark:text-violet-300"
            : s.state === "failed"
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-400 dark:text-slate-500";
        return (
          <li key={s.label} className="flex items-center">
            <span className={"flex items-center gap-1.5 text-[12.5px] " + color + (s.state === "current" ? " font-medium" : "")}>
              {icons[s.state]}
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span
                className={
                  "mx-3 h-px w-8 " +
                  (s.state === "done" ? "bg-violet-300 dark:bg-violet-500/50" : "bg-slate-200 dark:bg-slate-700")
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Entries down a line, grouped under a date heading. */
export function Timeline({
  groups,
}: {
  groups: { heading: string; items: { time: string; avatar?: ReactNode; body: ReactNode; detail?: ReactNode }[] }[];
}) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.heading}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {g.heading}
          </p>
          <ol className="relative ml-[4.5rem] border-l border-slate-200 dark:border-slate-800">
            {g.items.map((it, i) => (
              <li key={i} className="relative mb-4 pl-5 last:mb-0">
                <span className="absolute -left-[4.5rem] top-0.5 w-14 text-right text-[11.5px] tabular-nums text-slate-400 dark:text-slate-500">
                  {it.time}
                </span>
                <span className="absolute -left-[9px] top-0.5">
                  {it.avatar ?? <span className="block size-4 rounded-full border-2 border-white bg-violet-500 dark:border-slate-900" />}
                </span>
                <div className="text-[13px] text-slate-800 dark:text-slate-100">{it.body}</div>
                {it.detail && <div className="mt-1.5">{it.detail}</div>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- loading */

export function Skeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className={"overflow-hidden " + SURFACE}>
      <div className="animate-pulse divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-3 rounded bg-slate-200 dark:bg-slate-800"
                style={{ width: c === 0 ? "18%" : c === 1 ? "30%" : "16%" }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- charts */

export function ColumnChart({
  data,
  format = (n) => String(n),
  height = 160,
}: {
  data: { label: string; value: number; tone?: Tone }[];
  format?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="px-4 py-4">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={d.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[11px] tabular-nums text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-slate-500">
              {format(d.value)}
            </span>
            <motion.span
              initial={{ height: 0 }}
              animate={{ height: Math.max(3, (d.value / max) * (height - 26)) }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.03 }}
              className={
                "w-full rounded-t-md transition " +
                (d.tone === "accent"
                  ? "bg-violet-500"
                  : d.tone === "warn"
                    ? "bg-amber-400"
                    : "bg-violet-500/30 group-hover:bg-violet-500 dark:bg-violet-400/25 dark:group-hover:bg-violet-400")
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d) => (
          <div key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-slate-400 dark:text-slate-500">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Heatmap({
  rows,
  cols,
  value,
  format = (n) => String(n),
}: {
  rows: string[];
  cols: string[];
  value: (row: string, col: string) => number;
  format?: (n: number) => string;
}) {
  const all = rows.flatMap((r) => cols.map((c) => value(r, c)));
  const max = Math.max(1, ...all);
  return (
    <div className="overflow-x-auto px-4 py-4">
      <div className="min-w-max">
        {rows.map((r) => (
          <div key={r} className="mb-1.5 flex items-center gap-1.5">
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">{r}</span>
            {cols.map((c) => {
              const v = value(r, c);
              return (
                <span
                  key={c}
                  title={`${r} · ${c} · ${format(v)}`}
                  className="size-9 rounded-md bg-violet-500 transition hover:ring-2 hover:ring-violet-400/50"
                  style={{ opacity: v === 0 ? 0.07 : 0.15 + (v / max) * 0.85 }}
                />
              );
            })}
          </div>
        ))}
        <div className="flex gap-1.5">
          <span className="w-12 shrink-0" />
          {cols.map((c) => (
            <span key={c} className="w-9 shrink-0 text-center text-[11px] text-slate-400 dark:text-slate-500">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- modal */

/**
 * Reserved for short confirmations. Anything a person needs to read while still
 * seeing the list it came from belongs in a Drawer or a DetailModal (kit.tsx).
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  size = "md",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const width = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-md" : "max-w-lg";
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] dark:bg-black/60"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className={
          "max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800 " +
          width
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------ colour keys */

/**
 * Hues that stay apart from one another, for things that are categories rather
 * than states: departments, event kinds, tags. Picked by index so the same
 * category is the same colour on every screen that draws it.
 */
export const PALETTE = [
  { name: "violet", hex: "#7c3aed", dot: "bg-violet-500", tint: "bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200", ring: "ring-violet-300 dark:ring-violet-500/40" },
  { name: "sky", hex: "#0ea5e9", dot: "bg-sky-500", tint: "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200", ring: "ring-sky-300 dark:ring-sky-500/40" },
  { name: "emerald", hex: "#10b981", dot: "bg-emerald-500", tint: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200", ring: "ring-emerald-300 dark:ring-emerald-500/40" },
  { name: "amber", hex: "#f59e0b", dot: "bg-amber-500", tint: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200", ring: "ring-amber-300 dark:ring-amber-500/40" },
  { name: "rose", hex: "#f43f5e", dot: "bg-rose-500", tint: "bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200", ring: "ring-rose-300 dark:ring-rose-500/40" },
  { name: "teal", hex: "#14b8a6", dot: "bg-teal-500", tint: "bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200", ring: "ring-teal-300 dark:ring-teal-500/40" },
  { name: "orange", hex: "#f97316", dot: "bg-orange-500", tint: "bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200", ring: "ring-orange-300 dark:ring-orange-500/40" },
  { name: "indigo", hex: "#6366f1", dot: "bg-indigo-500", tint: "bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200", ring: "ring-indigo-300 dark:ring-indigo-500/40" },
] as const;

export type Swatch = (typeof PALETTE)[number];

/** A stable swatch for a category name — the same name, the same colour, everywhere. */
export function swatchFor(name: string, order?: readonly string[]): Swatch {
  const i = order ? order.indexOf(name) : -1;
  const idx = i >= 0 ? i : [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  return PALETTE[idx % PALETTE.length];
}

/** A small outlined label in a category's colour — the "MARKETING" pill on a meeting card. */
export function Tag({ swatch, children }: { swatch: Swatch; children: ReactNode }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ring-1 " +
        swatch.tint +
        " " +
        swatch.ring
      }
    >
      {children}
    </span>
  );
}

/** A card washed in a category's colour, so a list of mixed kinds reads at a glance. */
export function TintCard({
  swatch,
  children,
  className = "",
}: {
  swatch: Swatch;
  children: ReactNode;
  className?: string;
}) {
  return <div className={"rounded-2xl p-4 " + swatch.tint + " " + className}>{children}</div>;
}

/** A coloured dot, for a legend or a status. */
export function Dot({ className }: { className: string }) {
  return <span className={"inline-block size-2 shrink-0 rounded-full " + className} />;
}

/* ---------------------------------------------------------------- charts */

const DEG = Math.PI / 180;

/** Half a ring, filled to a fraction — the shape of "16 out of 20". */
export function Gauge({
  value,
  max,
  label,
  hex = "#7c3aed",
  size = 200,
}: {
  value: number;
  max: number;
  label: string;
  hex?: string;
  size?: number;
}) {
  const r = 78;
  const cx = 100;
  const cy = 96;
  const arc = (a0: number, a1: number) => {
    const x0 = cx + r * Math.cos(a0 * DEG);
    const y0 = cy - r * Math.sin(a0 * DEG);
    const x1 = cx + r * Math.cos(a1 * DEG);
    const y1 = cy - r * Math.sin(a1 * DEG);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${a0 - a1 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const frac = max === 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" width={size} height={size * 0.55} className="overflow-visible">
        <path d={arc(180, 0)} fill="none" strokeWidth={16} strokeLinecap="round" className="stroke-slate-100 dark:stroke-slate-800" />
        <motion.path
          d={arc(180, 0)}
          fill="none"
          stroke={hex}
          strokeWidth={16}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: 1 - frac }}
          transition={{ duration: 0.9, ease: EASE }}
        />
        <text x={cx} y={cy - 14} textAnchor="middle" className="fill-slate-900 dark:fill-slate-50" style={{ fontSize: 34, fontWeight: 600 }}>
          {value}
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 10.5, letterSpacing: 1 }}>
          {label}
        </text>
      </svg>
    </div>
  );
}

/** A ring cut into categories, with the legend that gives the colours their names. */
export function Donut({
  segments,
  center,
  size = 150,
  thickness = 18,
}: {
  segments: { label: string; value: number; swatch: Swatch }[];
  center?: ReactNode;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = 50 - thickness / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
          <circle cx={50} cy={50} r={r} fill="none" strokeWidth={thickness} className="stroke-slate-100 dark:stroke-slate-800" />
          {segments.map((s, i) => {
            const len = total === 0 ? 0 : (s.value / total) * C;
            const start = offset;
            offset += len;
            return (
              <motion.circle
                key={s.label}
                cx={50}
                cy={50}
                r={r}
                fill="none"
                stroke={s.swatch.hex}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${C}`}
                strokeDashoffset={-start}
                initial={{ opacity: 0, strokeDasharray: `0 ${C}` }}
                animate={{ opacity: 1, strokeDasharray: `${len} ${C}` }}
                transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
              />
            );
          })}
        </svg>
        {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12.5px]">
            <Dot className={s.swatch.dot} />
            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="tabular-nums text-slate-900 dark:text-slate-50">{s.value}</span>
            <span className="w-9 text-right text-[11px] tabular-nums text-slate-400">
              {total ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A row of days with the chosen one filled and marks under days that carry something. */
export function WeekStrip({
  days,
  active,
  onPick,
}: {
  days: { date: string; dow: string; day: string; marked?: boolean }[];
  active: string;
  onPick: (date: string) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {days.map((d) => {
        const on = d.date === active;
        return (
          <button
            key={d.date}
            onClick={() => onPick(d.date)}
            className={
              "flex min-w-0 flex-1 flex-col items-center rounded-xl px-1 py-2 transition " +
              (on
                ? "bg-violet-600 text-white shadow-sm shadow-violet-600/25"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800")
            }
          >
            <span className={"text-[10.5px] " + (on ? "text-white/80" : "text-slate-400 dark:text-slate-500")}>{d.dow}</span>
            <span className="text-[15px] font-semibold tabular-nums">{d.day}</span>
            <span className={"mt-1 size-1 rounded-full " + (d.marked ? (on ? "bg-white" : "bg-violet-500") : "bg-transparent")} />
          </button>
        );
      })}
    </div>
  );
}
