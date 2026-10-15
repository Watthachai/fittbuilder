import {
  CASE_AREAS,
  CASE_CAUSE,
  CASE_CAUSES,
  isClosed,
  type CaseArea,
  type CaseCause,
  type CaseKind,
  type CaseStatus,
} from "@/lib/cases";

/**
 * The cases overview (/cases → ภาพรวม): is FITT Builder getting better or
 * worse, why do cases happen, and where. Pure — the route reads the rows, this
 * counts them — so every number on the page is pinned by a test.
 *
 * Weeks are Bangkok weeks, Monday to Sunday: the team's week, not UTC's.
 */

export interface StatCase {
  number: number;
  kind: CaseKind;
  status: CaseStatus;
  cause: CaseCause | null;
  area: CaseArea | null;
  createdAt: string;
  /** When it last closed (released / not_bug); null while it is open. */
  closedAt: string | null;
}

export type CauseKey = CaseCause | "unclassified";

/** One day or one week of cases. */
export interface PeriodStat {
  /** Its first day, YYYY-MM-DD in Bangkok: the day itself, or the week's Monday. */
  start: string;
  /** Cases reported in it, by cause; "unclassified" until the team names one. */
  opened: Record<CauseKey, number>;
  /** Cases that closed in it. */
  closed: number;
  /** Median hours from report to close, of the cases that closed in it. */
  medianHours: number | null;
}

export interface CaseStats {
  asOf: string;
  /** When the first case came in: the start of the record. */
  firstAt: string | null;
  /**
   * Problem cases reported in the last 7 days against the 7 before. A problem
   * is a bug, demo code the AI got wrong, or the network — or a case the team
   * hasn't classified yet. Feature requests and non-issues never count.
   * "early" while the record is younger than 14 days: the 7 days before would
   * be days nobody could report in, and every count beats zero.
   */
  verdict: {
    trend: "better" | "same" | "worse" | "quiet" | "early";
    recent: number;
    previous: number;
    /** When "early" ends: 14 days after the first case. */
    comparableAt: string | null;
  };
  totals: { total: number; open: number; closed7d: number; medianHours30d: number | null };
  /** Up to the last 12 weeks, from the first case's week. */
  weeks: PeriodStat[];
  /** Up to the last 28 days, from the first case's day: a young record reads better by day. */
  days: PeriodStat[];
  causes: { cause: CauseKey; count: number }[];
  /** Areas with classified cases, most first; ties keep CASE_AREAS order. */
  areas: { area: CaseArea; total: number; counts: Record<CaseCause, number> }[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BANGKOK = 7 * HOUR;
const MAX_WEEKS = 12;
const MAX_DAYS = 28;
export const CAUSE_KEYS: readonly CauseKey[] = [...CASE_CAUSES, "unclassified"];

/** The Monday (Bangkok) of the week an instant falls in. */
export function bangkokWeek(at: number): string {
  const local = new Date(at + BANGKOK);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  return new Date(local.getTime() - sinceMonday * DAY).toISOString().slice(0, 10);
}

/** The Bangkok day an instant falls in. */
export function bangkokDay(at: number): string {
  return new Date(at + BANGKOK).toISOString().slice(0, 10);
}

const after = (start: string, days: number): string =>
  new Date(Date.parse(`${start}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  const m = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return Math.round(m * 10) / 10;
}

const hoursToClose = (c: StatCase): number => (Date.parse(c.closedAt!) - Date.parse(c.createdAt)) / HOUR;

export const isProblem = (c: Pick<StatCase, "cause">): boolean => c.cause === null || CASE_CAUSE[c.cause].problem;

const zeroCauses = (): Record<CauseKey, number> =>
  Object.fromEntries(CAUSE_KEYS.map((k) => [k, 0])) as Record<CauseKey, number>;

export function caseStats(cases: StatCase[], now: Date): CaseStats {
  const t = now.getTime();
  const first = cases.reduce<StatCase | null>(
    (a, c) => (a === null || Date.parse(c.createdAt) < Date.parse(a.createdAt) ? c : a),
    null
  );
  const firstAt = first?.createdAt ?? null;

  /** Every period from the first case's to now's, the last `max` of them. */
  const periods = (periodOf: (at: number) => string, length: number, max: number): PeriodStat[] => {
    if (firstAt === null) return [];
    const starts: string[] = [];
    for (let p = periodOf(Date.parse(firstAt)); p <= periodOf(t); p = after(p, length)) starts.push(p);
    return starts.slice(-max).map((start) => {
      const opened = zeroCauses();
      for (const c of cases) if (periodOf(Date.parse(c.createdAt)) === start) opened[c.cause ?? "unclassified"]++;
      const closedThen = cases.filter((c) => c.closedAt !== null && periodOf(Date.parse(c.closedAt)) === start);
      return { start, opened, closed: closedThen.length, medianHours: median(closedThen.map(hoursToClose)) };
    });
  };

  const problemsBetween = (from: number, to: number) =>
    cases.filter((c) => {
      const at = Date.parse(c.createdAt);
      return at > from && at <= to && isProblem(c);
    }).length;
  const comparableAt = firstAt !== null ? Date.parse(firstAt) + 14 * DAY : null;
  const early = comparableAt !== null && comparableAt > t;
  const recent = problemsBetween(t - 7 * DAY, t);
  const previous = problemsBetween(t - 14 * DAY, t - 7 * DAY);
  const trend = early
    ? "early"
    : recent === 0 && previous === 0
      ? "quiet"
      : recent < previous
        ? "better"
        : recent > previous
          ? "worse"
          : "same";

  const closedWithin = (days: number) =>
    cases.filter((c) => c.closedAt !== null && Date.parse(c.closedAt) > t - days * DAY);

  const causeCount = zeroCauses();
  for (const c of cases) causeCount[c.cause ?? "unclassified"]++;

  const areas = CASE_AREAS.map((area) => {
    const counts = Object.fromEntries(CASE_CAUSES.map((k) => [k, 0])) as Record<CaseCause, number>;
    for (const c of cases) if (c.area === area && c.cause !== null) counts[c.cause]++;
    return { area, total: CASE_CAUSES.reduce((n, k) => n + counts[k], 0), counts };
  })
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    asOf: now.toISOString(),
    firstAt,
    verdict: { trend, recent, previous, comparableAt: early ? new Date(comparableAt!).toISOString() : null },
    totals: {
      total: cases.length,
      open: cases.filter((c) => !isClosed(c.status)).length,
      closed7d: closedWithin(7).length,
      medianHours30d: median(closedWithin(30).map(hoursToClose)),
    },
    weeks: periods(bangkokWeek, 7, MAX_WEEKS),
    days: periods(bangkokDay, 1, MAX_DAYS),
    causes: CAUSE_KEYS.filter((k) => causeCount[k] > 0).map((cause) => ({ cause, count: causeCount[cause] })),
    areas,
  };
}

/** The case rows and their status moves, as the route reads them. */
export interface CaseStatRow {
  id: string;
  number: number;
  kind: CaseKind;
  status: CaseStatus;
  cause: CaseCause | null;
  area: CaseArea | null;
  created_at: string;
}
export interface StatusMoveRow {
  case_id: string;
  status_to: CaseStatus;
  created_at: string;
}

/**
 * A closed case closed at its last move to released or not_bug. Every status
 * comes from a message (0047's trigger), so a closed case without one is a
 * broken row, not a case to guess a date for.
 */
export function toStatCases(rows: CaseStatRow[], moves: StatusMoveRow[]): StatCase[] {
  const closedAt = new Map<string, string>();
  for (const m of moves) {
    if (!isClosed(m.status_to)) continue;
    const prev = closedAt.get(m.case_id);
    if (!prev || Date.parse(m.created_at) > Date.parse(prev)) closedAt.set(m.case_id, m.created_at);
  }
  return rows.map((r) => {
    const closed = isClosed(r.status) ? closedAt.get(r.id) : null;
    if (closed === undefined) throw new Error(`case #${r.number} is ${r.status} but no message closed it`);
    return {
      number: r.number,
      kind: r.kind,
      status: r.status,
      cause: r.cause,
      area: r.area,
      createdAt: r.created_at,
      closedAt: closed,
    };
  });
}
