import type { ReactNode } from "react";

/**
 * The pieces every module screen is built from.
 *
 * Each screen used to carry its own Card, Stat, Head and modal — ten copies that
 * drifted in padding and tone names. They are one set now, and the composer ships
 * this file the same way it ships the app shell: no module owns it, so no module
 * can disagree with another about what a table header looks like.
 */

export const TH = "px-4 py-3";

export function Card({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {title && (
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={
          "mt-1 text-lg font-semibold " +
          (tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-rose-600" : "text-slate-900")
        }
      >
        {value}
      </div>
    </div>
  );
}

export type Col = { k: string; right?: boolean };

export function Head({ cols }: { cols: Col[] }) {
  return (
    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
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
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onPick(t)}
          className={
            t === active
              ? "whitespace-nowrap border-b-2 border-sky-600 px-3 py-2.5 text-[13px] font-medium text-sky-700"
              : "whitespace-nowrap px-3 py-2.5 text-[13px] text-slate-500 hover:text-slate-800"
          }
        >
          {t}
          {badges?.[t] ? (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">
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
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{meta}</p>
      </div>
      {right}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad" | "idle" | "info";

const BADGE: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700",
  idle: "bg-slate-100 text-slate-600",
  info: "bg-sky-50 text-sky-700",
};

export function Badge({ tone = "idle", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={"rounded-full px-2 py-1 text-xs " + BADGE[tone]}>{children}</span>;
}

/** A proportion bar. Over 100% clamps, because the colour already says it. */
export function Bar({ pct, tone, width = "w-20" }: { pct: number; tone?: Tone; width?: string }) {
  const fill =
    tone === "bad" ? "bg-rose-500" : tone === "warn" ? "bg-amber-500" : tone === "info" ? "bg-sky-500" : "bg-emerald-500";
  return (
    <span className="flex items-center gap-2">
      <span className={"h-2 overflow-hidden rounded-full bg-slate-100 " + width}>
        <span className={"block h-full rounded-full " + fill} style={{ width: Math.max(0, Math.min(100, pct)) + "%" }} />
      </span>
      <span className="text-xs text-slate-600">{Math.round(pct)}%</span>
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
      <dt className={bold ? "font-medium text-slate-900" : muted ? "text-slate-600" : "text-slate-500"}>{k}</dt>
      <dd
        className={
          "text-right " + (bold ? "font-semibold " : "") + (cut ? "text-rose-600" : "text-slate-900")
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
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800"
        : tone === "bad"
          ? "bg-rose-50 text-rose-800"
          : "bg-slate-50 text-slate-600";
  return <div className={"rounded-xl px-4 py-3.5 text-sm " + skin}>{children}</div>;
}

/**
 * Fixed to the viewport, never to whatever box it was rendered inside — the
 * containing-block trap that made every earlier modal cover only its own panel.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={"max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl " + width}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="ปิด" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

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
      className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500"
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}
