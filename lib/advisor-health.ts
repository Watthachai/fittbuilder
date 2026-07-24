/**
 * Business Health Check — FITT Advisor's second lens. Reads the REAL numbers
 * and documents an owner provides (P&L, cash summaries, sales exports, debt
 * lists, staff feedback) and scores the business across five standard health
 * areas: cash flow, profit structure, sales, debt & receivables, and people.
 *
 * The framework is standard, public business fundamentals expressed in our own
 * words (like the Pain Point Radar's MECE/5-Whys) — no third-party book or
 * video text is reproduced.
 */

export type HealthStatus = "strong" | "watch" | "critical";

export type HealthFactorKey = "cashflow" | "profit" | "sales" | "debt" | "people";

export interface HealthFinding {
  /** One observation, grounded in the provided data. */
  detail: string;
  /** A VERBATIM substring of sourceText that evidences this finding (may be ""). */
  cite: string;
}

export interface HealthFactor {
  key: HealthFactorKey;
  /** Thai display name of the area. */
  name: string;
  /** 0-100 health score; null when the input has no data for this area. */
  score: number | null;
  status: HealthStatus;
  /** 1-2 readable sentences: the state of this area (or that data is missing). */
  summary: string;
  findings: HealthFinding[];
  /** Proposed next moves (HITL — proposals only, never executed actions). */
  actions: string[];
}

export interface HealthResult {
  /** Thai MARKDOWN executive brief — overall condition + what to fix first. */
  briefing: string;
  /** Overall health 0-100 (null if the model couldn't judge). */
  overallScore: number | null;
  factors: HealthFactor[];
  /** The raw provided data, combined verbatim — the citation source. */
  sourceText: string;
}

const FACTOR_KEYS: readonly HealthFactorKey[] = [
  "cashflow",
  "profit",
  "sales",
  "debt",
  "people",
];
const STATUSES: readonly HealthStatus[] = ["strong", "watch", "critical"];

/** Thai display names, used when the model omits/mangles `name`. */
const FACTOR_NAMES: Record<HealthFactorKey, string> = {
  cashflow: "กระแสเงินสด",
  profit: "โครงสร้างกำไร",
  sales: "ยอดขาย",
  debt: "หนี้สินและลูกหนี้",
  people: "คนและพลังองค์กร",
};

export const HEALTH_SYSTEM = `You are "FITT Advisor" — a business health-check analyst for SME owners. The owner gives you REAL business data (P&L numbers, cash summaries, sales exports, debt/receivable lists, staff or customer feedback). You produce an honest, decision-ready health check.

Analyze ONLY the data provided (plus Org DNA as context). Never invent numbers. Where you must estimate or the data is incomplete, SAY SO explicitly (label estimates "ประมาณการ"). Score the business across EXACTLY these five standard areas:

1. cashflow (กระแสเงินสด) — the ground truth of the business: do inflows and outflows balance; how much cash is trapped in inventory or long-overdue receivables; is short-term borrowing being used to fund long-term investment (a classic red flag).
2. profit (โครงสร้างกำไร) — can the owner see their true margin: revenue, DISCOUNTS/PROMOTIONS separated out explicitly (discount-heavy selling silently distorts the margin picture), cost of goods, operating expenses, net profit.
3. sales (ยอดขาย) — quality over volume: revenue per channel vs the cost of that channel; growing sales that shrink profit; sales is the hardest lever to fix if cash flow and profit structure are broken first.
4. debt (หนี้สินและลูกหนี้) — debt is a tool, not a sin: debt-to-equity balance, whether borrowing generates returns above its cost, aging receivables, and any expensive/informal debt that must be flagged.
5. people (คนและพลังองค์กร) — signals about the team from the provided feedback/data: turnover hints, morale, load, management friction.

Rules of judgement:
- Human-in-the-Loop: you PROPOSE actions; the owner decides. Never phrase anything as an executed action.
- Citations (NotebookLM-style): every finding should quote the source VERBATIM so the owner can trace it.
- If the input contains NO data for an area, set its score to null, status "watch", and say plainly in summary that the data wasn't provided and what to bring next time.

Output a SINGLE valid JSON object (no markdown fences, no commentary) with EXACTLY this shape:
{
  "briefing": "<Thai MARKDOWN executive brief, readable in under a minute: overall condition, the ONE area to fix first and why, and what to re-check next round. Do NOT repeat every factor's detail here.>",
  "overallScore": <integer 0-100 weighing the five areas, or null if unjudgeable>,
  "factors": [
    {
      "key": "cashflow|profit|sales|debt|people",
      "name": "<Thai display name>",
      "score": <integer 0-100 or null when no data>,
      "status": "strong|watch|critical",
      "summary": "<1-2 Thai sentences on this area's state (or that data is missing)>",
      "findings": [ { "detail": "<Thai, 1 บรรทัด>", "cite": "<VERBATIM substring of sourceText, or \\"\\">" } ],
      "actions": [ "<proposed next move, Thai, 1 บรรทัด>" ]
    }
  ],
  "sourceText": "<the raw data you analyzed, combined VERBATIM (pasted text + text extracted from files) as ONE block — the citation source>"
}

Rules:
- factors MUST contain all five keys exactly once, in the order above.
- Each cite MUST be an exact substring of sourceText (character-for-character) or "".
- 0-3 findings and 0-3 actions per factor. All derived numbers are ประมาณการ — say so.
- Valid JSON only: no trailing commas, no comments, no text outside the object.`;

/** Defensively coerce the model's JSON into a HealthResult (null = unusable). */
export function parseHealthResult(raw: string): HealthResult | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const briefing = typeof obj.briefing === "string" ? obj.briefing.trim() : "";
  if (!briefing) return null;

  const clamp = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.min(100, Math.round(v)))
      : null;

  const byKey = new Map<HealthFactorKey, HealthFactor>();
  if (Array.isArray(obj.factors)) {
    for (const f of obj.factors) {
      if (!f || typeof f !== "object") continue;
      const r = f as Record<string, unknown>;
      const key = FACTOR_KEYS.includes(r.key as HealthFactorKey)
        ? (r.key as HealthFactorKey)
        : null;
      if (!key || byKey.has(key)) continue;
      const findings: HealthFinding[] = Array.isArray(r.findings)
        ? r.findings.flatMap((it): HealthFinding[] => {
            const fr = it as Record<string, unknown> | null;
            const detail = typeof fr?.detail === "string" ? fr.detail.trim() : "";
            return detail
              ? [{ detail, cite: typeof fr?.cite === "string" ? fr.cite.trim() : "" }]
              : [];
          })
        : [];
      byKey.set(key, {
        key,
        name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : FACTOR_NAMES[key],
        score: clamp(r.score),
        status: STATUSES.includes(r.status as HealthStatus)
          ? (r.status as HealthStatus)
          : "watch",
        summary: typeof r.summary === "string" ? r.summary.trim() : "",
        findings,
        actions: Array.isArray(r.actions)
          ? r.actions.filter((a): a is string => typeof a === "string" && a.trim() !== "")
          : [],
      });
    }
  }
  // Always render all five areas — a missing one becomes an explicit "no data" row.
  const factors: HealthFactor[] = FACTOR_KEYS.map(
    (key) =>
      byKey.get(key) ?? {
        key,
        name: FACTOR_NAMES[key],
        score: null,
        status: "watch",
        summary: "ไม่มีข้อมูลด้านนี้ในรอบนี้",
        findings: [],
        actions: [],
      }
  );

  return {
    briefing,
    overallScore: clamp(obj.overallScore),
    factors,
    sourceText: typeof obj.sourceText === "string" ? obj.sourceText : "",
  };
}

/** Coerce a persisted (possibly stale-shaped) report back into a HealthResult. */
export function normalizeHealthResult(
  r: Partial<HealthResult> | null | undefined
): HealthResult | null {
  if (!r?.briefing) return null;
  return {
    briefing: r.briefing,
    overallScore: typeof r.overallScore === "number" ? r.overallScore : null,
    factors: Array.isArray(r.factors) ? r.factors : [],
    sourceText: r.sourceText ?? "",
  };
}
