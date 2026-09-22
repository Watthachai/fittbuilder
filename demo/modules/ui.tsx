import type { ReactNode } from "react";

/**
 * The pieces every module screen is built from.
 *
 * Each screen used to carry its own Card, Stat, Head and modal — ten copies that
 * drifted in padding and tone names. They are one set now, and the composer ships
 * this file the same way it ships the app shell: no module owns it, so no module
 * can disagree with another about what a table header looks like.
 *
 * Every surface declares both themes. People run a system like this for eight
 * hours, so dark is a first-class mode, not an afterthought bolted on later.
 */

export const TH = "px-4 py-3";

export const SURFACE =
  "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

export function Card({
  title,
  action,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={"overflow-hidden " + SURFACE}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100">{title}</div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad" | "idle" | "info";

/** `warn` is something to watch, `bad` is a number that should not be there. */
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

/**
 * The headline number with its movement.
 *
 * A figure on its own answers "how many"; the delta answers "and is that good?",
 * which is the question someone opening a management screen actually has. The
 * direction that counts as good is the caller's to say — resignations rising is
 * not the same news as hires rising.
 */
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
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
                {icon}
              </span>
            )}
            <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
          </div>
          {delta !== undefined && (
            <span
              className={
                "shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums " +
                (good
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400")
              }
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          {value}
        </div>
        {deltaLabel && (
          <div className="mt-0.5 text-[11.5px] text-slate-400 dark:text-slate-500">{deltaLabel}</div>
        )}
      </div>
      {footer && (
        <div className="border-t border-slate-100 px-4 py-2 text-[11.5px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
}

export type Col = { k: string; right?: boolean };

export function Head({ cols }: { cols: Col[] }) {
  return (
    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
      <tr>
        {cols.map((c, i) => (
          <th key={c.k + i} className={TH + (c.right ? " text-right" : "")}>
            {c.k}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Tabs({
  tabs,
  active,
  onPick,
  badges,
}: {
  tabs: readonly string[];
  active: string;
  onPick: (tab: string) => void;
  badges?: Record<string, number>;
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onPick(t)}
          className={
            t === active
              ? "whitespace-nowrap border-b-2 border-sky-600 px-3 py-2.5 text-[13px] font-medium text-sky-700 dark:border-sky-400 dark:text-sky-400"
              : "whitespace-nowrap px-3 py-2.5 text-[13px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          }
        >
          {t}
          {badges?.[t] ? (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              {badges[t]}
            </span>
          ) : null}
        </button>
      ))}
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
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{meta}</p>
      </div>
      {right}
    </div>
  );
}

const BADGE: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  bad: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  idle: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
};

export function Badge({ tone = "idle", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={"rounded-full px-2 py-1 text-xs " + BADGE[tone]}>{children}</span>;
}

/** A proportion bar. Over 100% clamps, because the colour already says it. */
export function Bar({ pct, tone, width = "w-20" }: { pct: number; tone?: Tone; width?: string }) {
  const fill =
    tone === "bad"
      ? "bg-rose-500"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "info"
          ? "bg-sky-500"
          : "bg-emerald-500";
  return (
    <span className="flex items-center gap-2">
      <span className={"h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 " + width}>
        <span
          className={"block h-full rounded-full " + fill}
          style={{ width: Math.max(0, Math.min(100, pct)) + "%" }}
        />
      </span>
      <span className="text-xs text-slate-600 dark:text-slate-400">{Math.round(pct)}%</span>
    </span>
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

export function Note({ tone, children }: { tone: Tone; children: ReactNode }) {
  const skin =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
        : tone === "bad"
          ? "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300"
          : "bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
  return <div className={"rounded-xl px-4 py-3.5 text-sm " + skin}>{children}</div>;
}

/**
 * Fixed to the viewport, never to whatever box it was rendered inside — the
 * containing-block trap that made every earlier modal cover only its own panel.
 *
 * Reserved for short, safety-critical confirmations. Anything a person needs to
 * read while still seeing the list it came from belongs in a Drawer.
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
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          "max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800 " +
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
      </div>
    </div>
  );
}

const FIELD =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400";

export function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={FIELD + " w-64 placeholder:text-slate-400 dark:placeholder:text-slate-500"}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

export { FIELD };

/**
 * A grey stand-in shaped like the thing that is loading.
 *
 * A spinner says "wait"; this says "here is what is coming", which reads as
 * faster even when it is not, and stops the layout jumping when data lands.
 */
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

/**
 * A column chart drawn with divs.
 *
 * A charting library would be a megabyte of dependency for one shape, and this
 * has to run inside a demo project that a customer may take away and build on.
 */
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
        {data.map((d) => (
          <div key={d.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[11px] tabular-nums text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-slate-500">
              {format(d.value)}
            </span>
            <span
              className={
                "w-full rounded-t-md transition " +
                (d.tone === "info"
                  ? "bg-sky-500"
                  : d.tone === "warn"
                    ? "bg-amber-400"
                    : "bg-sky-500/35 group-hover:bg-sky-500 dark:bg-sky-400/25 dark:group-hover:bg-sky-400")
              }
              style={{ height: Math.max(3, (d.value / max) * (height - 26)) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d) => (
          <div
            key={d.label}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-slate-400 dark:text-slate-500"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Intensity over two axes — the shape an attendance pattern actually has. */
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
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {r}
            </span>
            {cols.map((c) => {
              const v = value(r, c);
              return (
                <span
                  key={c}
                  title={`${r} · ${c} · ${format(v)}`}
                  className="size-9 rounded-md bg-sky-500 transition hover:ring-2 hover:ring-sky-400/50"
                  style={{ opacity: v === 0 ? 0.07 : 0.15 + (v / max) * 0.85 }}
                />
              );
            })}
          </div>
        ))}
        <div className="flex gap-1.5">
          <span className="w-12 shrink-0" />
          {cols.map((c) => (
            <span
              key={c}
              className="w-9 shrink-0 text-center text-[11px] text-slate-400 dark:text-slate-500"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
