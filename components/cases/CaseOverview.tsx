"use client";

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Hourglass, Loader2, Minus, Moon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CASE_AREA, CASE_CAUSE, CASE_CAUSES } from "@/lib/cases";
import { CAUSE_KEYS, type CaseStats, type CauseKey, type PeriodStat } from "@/lib/case-stats";
import { fetchCaseStats, useCaseChanges } from "@/lib/cases-client";
import { CAUSE_COLOR } from "./CaseBits";

/**
 * ภาพรวม — is FITT Builder getting better or worse, why do cases happen, and
 * where. Counts only (/api/cases/stats), so everyone signed in sees the same
 * page and nobody's case is on it. It follows the cases live: a new case or a
 * close anywhere redraws it.
 */

const causeLabel = (k: CauseKey): string => (k === "unclassified" ? "ยังไม่ระบุสาเหตุ" : CASE_CAUSE[k].label);
const isProblemKey = (k: CauseKey): boolean => k === "unclassified" || CASE_CAUSE[k].problem;
/** Bottom of the stack up: our bugs first, the wishes last and faint. */
const STACK: CauseKey[] = ["platform_bug", "ai_code", "external", "unclassified", "feature", "not_issue"];

const PERIOD = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
/** A day, or the Monday a week starts on — YYYY-MM-DD in Bangkok, shown as "13 ต.ค.". */
const periodLabel = (start: string) => PERIOD.format(new Date(`${start}T00:00:00Z`));

type Grain = "days" | "weeks";
const GRAIN: Record<Grain, { label: string; each: string }> = {
  days: { label: "รายวัน", each: "วัน" },
  weeks: { label: "รายสัปดาห์", each: "สัปดาห์" },
};
const CLOCK = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });

function duration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} นาที`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} ชม.`;
  return `${(hours / 24).toFixed(1)} วัน`;
}

/** An axis tick: minutes under an hour, the team closes most cases inside one. */
const hoursTick = (v: number): string => (v < 1 ? `${Math.round(v * 60)} นาที` : `${Math.round(v * 10) / 10} ชม.`);

const problemsIn = (w: PeriodStat) => CAUSE_KEYS.filter(isProblemKey).reduce((n, k) => n + w.opened[k], 0);

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export default function CaseOverview() {
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStats(await fetchCaseStats());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดภาพรวมไม่สำเร็จ");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useCaseChanges(useCallback(() => void load(), [load]));

  if (!stats) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-chalk-dim">
        {error ? (
          <p className="rounded border border-halt/40 bg-halt/10 px-3 py-2 text-xs text-halt">{error}</p>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> กำลังรวมตัวเลข…
          </span>
        )}
      </div>
    );
  }
  if (stats.totals.total === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-center text-[13px] text-chalk-dim">
        ยังไม่มีเคส พอมีคนแจ้งเคสแรก กราฟจะเริ่มขึ้นที่นี่
      </div>
    );
  }
  return <Overview stats={stats} />;
}

function Overview({ stats }: { stats: CaseStats }) {
  const animate = !useReducedMotion();
  // A young record is a couple of weekly bars; by day it already shows a shape.
  const [grain, setGrain] = useState<Grain>(() => (stats.weeks.length < 4 ? "days" : "weeks"));
  const periods = stats[grain];
  const each = GRAIN[grain].each;
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-16 pt-5 sm:px-6">
        <Verdict stats={stats} periods={periods} grain={grain} animate={animate} />
        <Totals stats={stats} />
        <Panel
          title="เคสเข้ามากี่เคส ปิดไปกี่เคส"
          note={`${GRAIN[grain].label} แท่งคือเคสใหม่แยกตามสาเหตุ เส้นคือเคสที่ปิดใน${each}นั้น`}
          action={<GrainSwitch grain={grain} onChange={setGrain} />}
        >
          <CasesChart key={grain} periods={periods} animate={animate} />
        </Panel>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="ทำไมถึงเกิด" note="ทุกเคสตั้งแต่เปิดระบบแจ้งเคส">
            <WhyChart stats={stats} animate={animate} />
          </Panel>
          <Panel title="เกิดที่ส่วนไหนของระบบ" note="เฉพาะเคสที่ทีมระบุสาเหตุแล้ว">
            <WhereChart stats={stats} animate={animate} />
          </Panel>
        </div>
        <Panel title="แก้เร็วแค่ไหน" note={`ค่ากลางของเวลาตั้งแต่แจ้งจนปิด ของเคสที่ปิดในแต่ละ${each} ยิ่งต่ำยิ่งดี`}>
          <SpeedChart key={grain} periods={periods} animate={animate} />
        </Panel>
        <p className="text-[11.5px] leading-relaxed text-chalk-dim">
          เคสปัญหา คือ บั๊กของ FITT Builder, AI เขียนโค้ดเดโมผิด, เน็ตหรือระบบภายนอก และเคสที่ทีมยังไม่ระบุสาเหตุ
          ส่วนขอฟีเจอร์และเคสที่ไม่ใช่ปัญหาของระบบไม่นับว่าระบบแย่ลง · สัปดาห์เริ่มวันจันทร์ เวลาไทย ·
          อัปเดตล่าสุด {CLOCK.format(new Date(stats.asOf))} น. และอัปเดตเองทุกครั้งที่มีเคสเปลี่ยน
        </p>
      </div>
    </div>
  );
}

// ---------- the verdict: one sentence and the line behind it ----------

const TREND = {
  better: { word: "ระบบดีขึ้น", tone: "var(--go)", Icon: ArrowDownRight },
  worse: { word: "ระบบแย่ลง", tone: "var(--halt)", Icon: ArrowUpRight },
  same: { word: "ระบบทรงตัว", tone: "var(--shine)", Icon: Minus },
  quiet: { word: "ไม่มีเคสปัญหาใหม่", tone: "var(--go)", Icon: Moon },
  early: { word: "เพิ่งเริ่มเก็บข้อมูล", tone: "var(--shine)", Icon: Hourglass },
} as const;

const DAY_MONTH = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });

function verdictLine({ trend, recent, previous, comparableAt }: CaseStats["verdict"]): string {
  if (trend === "quiet") return "14 วันที่ผ่านมาไม่มีใครเจอปัญหาจากระบบ";
  if (trend === "early") {
    return `7 วันล่าสุดมีเคสปัญหาใหม่ ${recent} เคส ระบบแจ้งเคสยังเปิดไม่ถึง 14 วัน เลยยังไม่มีสัปดาห์ก่อนหน้าให้เทียบ จะเทียบได้ตั้งแต่ ${DAY_MONTH.format(new Date(comparableAt!))}`;
  }
  const pct = previous > 0 ? Math.round((Math.abs(recent - previous) / previous) * 100) : null;
  if (trend === "same") return `เคสปัญหาใหม่ ${recent} เคสใน 7 วันล่าสุด เท่ากับ 7 วันก่อนหน้า`;
  const moved = trend === "better" ? "ลดลง" : "เพิ่มขึ้น";
  return `เคสปัญหาใหม่ ${recent} เคสใน 7 วันล่าสุด ${moved}จาก ${previous} เคส${pct !== null ? ` (${moved} ${pct}%)` : ""}`;
}

function Verdict({
  stats,
  periods,
  grain,
  animate,
}: {
  stats: CaseStats;
  periods: PeriodStat[];
  grain: Grain;
  animate: boolean;
}) {
  const t = TREND[stats.verdict.trend];
  const gradient = useId();
  const line = periods.map((p) => ({ label: periodLabel(p.start), problems: problemsIn(p) }));
  return (
    <section
      className="relative overflow-hidden rounded-2xl border px-5 py-5 sm:px-7 sm:py-6"
      style={{
        borderColor: `color-mix(in srgb, ${t.tone} 35%, transparent)`,
        background: `linear-gradient(120deg, color-mix(in srgb, ${t.tone} 13%, transparent), transparent 62%)`,
      }}
    >
      <div className="grid items-end gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0">
          <p className="font-display text-[12.5px] text-chalk-dim">
            {stats.verdict.trend === "early" ? "7 วันล่าสุด" : "7 วันล่าสุด เทียบกับ 7 วันก่อนหน้า"}
          </p>
          <h2
            className="mt-1.5 flex items-center gap-3 font-display text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.05] tracking-tight"
            style={{ color: t.tone }}
          >
            <t.Icon className="h-[0.9em] w-[0.9em] shrink-0" strokeWidth={2.4} />
            {t.word}
          </h2>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-chalk/90">{verdictLine(stats.verdict)}</p>
        </div>
        <div className="h-24 w-full" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            {/* Decoration: the sentence beside it says the same in words. */}
            <AreaChart data={line} margin={{ top: 6, right: 4, bottom: 0, left: 4 }} accessibilityLayer={false}>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.tone} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={t.tone} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="problems"
                stroke={t.tone}
                strokeWidth={2.5}
                fill={`url(#${gradient})`}
                isAnimationActive={animate}
                animationDuration={1100}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-1 text-right font-display text-[11px] text-chalk-dim">เคสปัญหา{GRAIN[grain].label}</p>
        </div>
      </div>
    </section>
  );
}

// ---------- the totals strip ----------

function Totals({ stats }: { stats: CaseStats }) {
  const since = stats.firstAt ? DAY_MONTH.format(new Date(stats.firstAt)) : "";
  const items: { value: string; label: string }[] = [
    { value: String(stats.totals.open), label: "เคสที่ยังไม่ปิด" },
    { value: String(stats.totals.closed7d), label: "ปิดใน 7 วันล่าสุด" },
    { value: duration(stats.totals.medianHours30d), label: "เวลาแก้ (ค่ากลาง 30 วัน)" },
    { value: String(stats.totals.total), label: `เคสทั้งหมดตั้งแต่ ${since}` },
  ];
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-night-edge sm:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`px-5 py-4 ${i % 2 ? "border-l border-night-edge" : ""} ${i > 1 ? "border-t border-night-edge sm:border-t-0" : ""} ${
            i === 2 ? "sm:border-l" : ""
          }`}
        >
          <dt className="text-[12px] text-chalk-dim">{it.label}</dt>
          <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-chalk">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- shared chart pieces ----------

function Panel({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-night-edge bg-night-panel/60 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold text-chalk">{title}</h3>
          <p className="mt-0.5 text-[12px] text-chalk-dim">{note}</p>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function GrainSwitch({ grain, onChange }: { grain: Grain; onChange: (g: Grain) => void }) {
  return (
    <div className="flex shrink-0 rounded-full border border-night-edge p-0.5" role="group" aria-label="ช่วงเวลา">
      {(Object.keys(GRAIN) as Grain[]).map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          aria-pressed={grain === g}
          className={`rounded-full px-2.5 py-0.5 font-display text-[11.5px] transition ${
            grain === g ? "bg-chalk text-night" : "text-chalk-dim hover:text-chalk"
          }`}
        >
          {GRAIN[g].label}
        </button>
      ))}
    </div>
  );
}

/** "ยังไม่ระบุ" is hatched: a case still waiting for its reason should look unfinished. */
function Hatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill={CAUSE_COLOR.unclassified} fillOpacity={0.18} />
      <line x1="0" y1="0" x2="0" y2="6" stroke={CAUSE_COLOR.unclassified} strokeWidth="3" />
    </pattern>
  );
}

const fillFor = (k: CauseKey, hatch: string) => (k === "unclassified" ? `url(#${hatch})` : CAUSE_COLOR[k]);

const AXIS = { fill: "var(--chalk-dim)", fontSize: 11 };

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ dataKey?: unknown; name?: unknown; value?: unknown; color?: string }>;
}

function ChartTip({ active, label, payload, format }: TipProps & { format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => Number(p.value) > 0 || payload.length === 1);
  if (rows.length === 0) return null;
  return (
    <div className="min-w-44 rounded-xl border border-night-edge bg-night-panel/95 px-3 py-2.5 text-[12px] shadow-xl backdrop-blur">
      {label !== undefined && <p className="mb-1.5 font-display font-semibold text-chalk">{label}</p>}
      <ul className="flex flex-col gap-1">
        {rows.map((p) => {
          const key = String(p.dataKey);
          const color = key in CAUSE_COLOR ? CAUSE_COLOR[key as CauseKey] : p.color;
          return (
            <li key={key} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
              <span className="text-chalk-dim">{String(p.name)}</span>
              <span className="ml-auto pl-4 font-mono tabular-nums text-chalk">
                {format ? format(Number(p.value)) : String(p.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- cases in, cases out ----------

function CasesChart({ periods, animate }: { periods: PeriodStat[]; animate: boolean }) {
  const hatch = useId();
  const data = periods.map((p) => ({ label: periodLabel(p.start), ...p.opened, closed: p.closed }));
  const used = STACK.filter((k) => periods.some((p) => p.opened[k] > 0));
  return (
    <>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%" maxBarSize={72}>
            <defs>
              <Hatch id={hatch} />
            </defs>
            <CartesianGrid vertical={false} stroke="var(--night-edge)" strokeDasharray="3 4" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--night-edge)" }} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "var(--chalk)", fillOpacity: 0.05 }} content={(p) => <ChartTip {...p} />} />
            {used.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                name={causeLabel(k)}
                stackId="opened"
                fill={fillFor(k, hatch)}
                fillOpacity={isProblemKey(k) ? 1 : 0.55}
                radius={i === used.length - 1 ? [5, 5, 0, 0] : 0}
                isAnimationActive={animate}
                animationDuration={700}
                animationBegin={150 + i * 90}
              />
            ))}
            <Line
              type="monotone"
              dataKey="closed"
              name="ปิดแล้ว"
              stroke="var(--chalk)"
              strokeWidth={2}
              dot={{ r: 3.5, fill: "var(--night)", stroke: "var(--chalk)", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={animate}
              animationBegin={700}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-chalk-dim">
        {used.map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <Swatch k={k} />
            {causeLabel(k)}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-chalk" />
          ปิดแล้ว
        </li>
      </ul>
    </>
  );
}

function Swatch({ k }: { k: CauseKey }) {
  return k === "unclassified" ? (
    <span
      className="h-2.5 w-2.5 rounded-sm"
      style={{
        background: `repeating-linear-gradient(45deg, ${CAUSE_COLOR.unclassified} 0 2px, transparent 2px 4px)`,
      }}
    />
  ) : (
    <span
      className="h-2.5 w-2.5 rounded-sm"
      style={{ background: CAUSE_COLOR[k], opacity: isProblemKey(k) ? 1 : 0.55 }}
    />
  );
}

// ---------- why ----------

function WhyChart({ stats, animate }: { stats: CaseStats; animate: boolean }) {
  const hatch = useId();
  const total = stats.totals.total;
  const problems = stats.causes.filter((c) => isProblemKey(c.cause));
  const others = stats.causes.filter((c) => !isProblemKey(c.cause));
  const problemTotal = problems.reduce((n, c) => n + c.count, 0);
  const data = stats.causes.map((c) => ({ ...c, name: causeLabel(c.cause) }));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <Hatch id={hatch} />
            </defs>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={animate}
              animationDuration={900}
            >
              {data.map((d) => (
                <Cell key={d.cause} fill={fillFor(d.cause, hatch)} fillOpacity={isProblemKey(d.cause) ? 1 : 0.55} />
              ))}
            </Pie>
            <Tooltip content={(p) => <ChartTip {...p} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-semibold tabular-nums text-chalk">{problemTotal}</span>
          <span className="text-[11px] text-chalk-dim">เคสปัญหา จาก {total}</span>
        </div>
      </div>
      <div className="w-full min-w-0 flex-1 text-[13px]">
        <CauseList title="นับเป็นปัญหา" rows={problems} total={total} />
        {others.length > 0 && <CauseList title="ไม่นับ" rows={others} total={total} />}
      </div>
    </div>
  );
}

function CauseList({ title, rows, total }: { title: string; rows: CaseStats["causes"]; total: number }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[11px] text-chalk-dim">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((c) => (
          <li key={c.cause} className="flex items-center gap-2">
            <Swatch k={c.cause} />
            <span className="min-w-0 flex-1 text-chalk/90">{causeLabel(c.cause)}</span>
            <span className="font-mono tabular-nums text-chalk">{c.count}</span>
            <span className="w-10 text-right font-mono text-[11px] tabular-nums text-chalk-dim">
              {Math.round((c.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- where ----------

function WhereChart({ stats, animate }: { stats: CaseStats; animate: boolean }) {
  const data = stats.areas.map((a) => ({ label: CASE_AREA[a.area], ...a.counts }));
  const used = CASE_CAUSES.filter((k) => stats.areas.some((a) => a.counts[k] > 0));
  if (data.length === 0) {
    return <p className="py-10 text-center text-[13px] text-chalk-dim">ยังไม่มีเคสที่ระบุสาเหตุ</p>;
  }
  return (
    <div className="w-full" style={{ height: data.length * 44 + 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={176}
            tick={{ ...AXIS, fill: "var(--chalk)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip cursor={{ fill: "var(--chalk)", fillOpacity: 0.05 }} content={(p) => <ChartTip {...p} />} />
          {used.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={causeLabel(k)}
              stackId="area"
              fill={CAUSE_COLOR[k]}
              fillOpacity={isProblemKey(k) ? 1 : 0.55}
              radius={i === used.length - 1 ? [0, 5, 5, 0] : 0}
              isAnimationActive={animate}
              animationDuration={700}
              animationBegin={200 + i * 90}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- how fast ----------

function SpeedChart({ periods, animate }: { periods: PeriodStat[]; animate: boolean }) {
  const gradient = useId();
  const data = useMemo(
    () => periods.map((p) => ({ label: periodLabel(p.start), hours: p.medianHours })),
    [periods]
  );
  if (!data.some((d) => d.hours !== null)) {
    return <p className="py-10 text-center text-[13px] text-chalk-dim">ยังไม่มีเคสที่ปิด</p>;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--shine)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--shine)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--night-edge)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--night-edge)" }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={hoursTick} width={64} />
          <Tooltip content={(p) => <ChartTip {...p} format={duration} />} />
          <Area
            type="monotone"
            dataKey="hours"
            name="ค่ากลางเวลาแก้"
            stroke="var(--shine)"
            strokeWidth={2.5}
            fill={`url(#${gradient})`}
            connectNulls
            dot={{ r: 3.5, fill: "var(--night)", stroke: "var(--shine)", strokeWidth: 2 }}
            isAnimationActive={animate}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
