/**
 * Pain Point Radar — the first real slice of "FITT Advisor". It analyzes REAL
 * pasted/uploaded feedback (customer/employee voices, docs) grounded in the
 * workspace's Org DNA and returns a decision-ready read: a readable markdown
 * briefing, the pain points as CITED issues (each quoting the source verbatim,
 * NotebookLM-style), and interactive decision options.
 *
 * The frameworks (MECE, 5 Whys, Decision Matrix, Human-in-the-Loop) are public
 * methodologies applied in our own words — no third-party book text is used.
 */

export type AdvisorSeverity = "critical" | "high" | "medium" | "low";

export interface AdvisorIssue {
  /** The pain point / MECE category. */
  title: string;
  severity: AdvisorSeverity;
  /** One-line explanation (may be ""). */
  detail: string;
  /** A VERBATIM substring of sourceText that evidences this issue (may be ""). */
  cite: string;
}

export interface AdvisorOption {
  /** Short title of the option. */
  title: string;
  /** One readable line of trade-offs, e.g. "Impact สูง · Effort ต่ำ · เวลา 1 สัปดาห์ (ประมาณการ)". */
  tradeoffs: string;
  /** Why this option (1-2 sentences). */
  rationale: string;
  /** The pragmatic recommendation to start with. */
  recommended: boolean;
}

export interface AdvisorResult {
  /**
   * Human-facing briefing in Thai MARKDOWN — reads like a written executive
   * brief: the overall read + sentiment, the root cause (5 Whys) of the top
   * issue, and a short recommendation. The per-issue breakdown lives in `issues`.
   */
  briefing: string;
  /** Overall sentiment index 0-100 for a glanceable badge (null if not given). */
  sentimentIndex: number | null;
  /**
   * The raw feedback the analysis read, combined verbatim (paste + text
   * extracted from files) — the citation source each issue's `cite` quotes from.
   */
  sourceText: string;
  /** The pain points, MECE, each citing the source verbatim. */
  issues: AdvisorIssue[];
  /** 2-3 decision options; the user (CEO) approves — no external action is taken. */
  options: AdvisorOption[];
}

export const ADVISOR_SYSTEM = `You are "FITT Advisor" — a Chief of Staff analyst who turns RAW human feedback (customer complaints, employee feedback, reviews) into a decision-ready executive briefing for a CEO.

Analyze ONLY the feedback provided (plus the Org DNA as context). Do not invent facts, numbers, or quotes that are not supported by the input. Apply these public methodologies:
- Sentiment & intent: read the emotional tone, separate real signal from noise.
- MECE issue tree: group the pain points into non-overlapping, collectively-exhaustive categories.
- 5 Whys: trace the single most important issue from symptom to a systemic root cause.
- Decision Matrix: offer options weighed by Impact / Effort / Cost / Risk / timeframe.
- Human-in-the-Loop: you PROPOSE; the human decides. Never phrase anything as an executed action.
- Citations (NotebookLM-style): every pain point must quote the source VERBATIM so the reader can trace where it came from.

Ground everything in the Org DNA (structure, how they decide, what they value) so the read fits how this org actually works.

Output a SINGLE valid JSON object (no markdown fences, no commentary) with EXACTLY this shape:
{
  "briefing": "<Thai MARKDOWN, reads like a written executive brief. Cover in flowing prose: (1) an overall read + the sentiment, (2) the ROOT CAUSE of the single most important issue, narrated as a 5-Whys chain ending in a systemic root, (3) a short recommendation. Do NOT list every pain point here — those go in 'issues'.>",
  "sentimentIndex": <integer 0-100, overall mood; 0 = all negative, 100 = all positive>,
  "sourceText": "<the raw feedback you analyzed, combined VERBATIM — the pasted text plus any readable text you could extract from attached files — as ONE block. No summary, no invention. This is the citation source.>",
  "issues": [
    { "title": "<pain point / MECE category, สั้น>", "severity": "critical|high|medium|low", "detail": "<1 บรรทัดอธิบาย>", "cite": "<a VERBATIM substring of sourceText, 1 sentence, that this issue is based on>" }
  ],
  "options": [
    { "title": "<สั้น>", "tradeoffs": "<Impact/Effort/Cost/Risk/เวลา in one line; label all estimates ประมาณการ>", "rationale": "<ทำไม 1-2 ประโยค>", "recommended": <true for the one pragmatic starting option, false otherwise> }
  ]
}

Rules:
- briefing MUST be Thai markdown and genuinely readable — a busy CEO should grasp it in under a minute.
- issues: 3-6 MECE pain points. Each "cite" MUST be an exact substring of "sourceText" (copy it character-for-character); if you cannot find a supporting quote, use "".
- 2-3 options; exactly ONE has recommended=true. Every impact/ROI/number is a ประมาณการ (estimate) — say so.
- Valid JSON only: no trailing commas, no comments, no text outside the object.`;

const SEVERITIES: readonly AdvisorSeverity[] = ["critical", "high", "medium", "low"];

/**
 * Defensively coerce the model's JSON string into an AdvisorResult. Returns
 * null when the output is unparseable or has no briefing (fail fast — the route
 * surfaces an error rather than rendering an empty panel).
 */
export function parseAdvisorResult(raw: string): AdvisorResult | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const briefing = typeof obj.briefing === "string" ? obj.briefing.trim() : "";
  if (!briefing) return null;

  const rawIndex = typeof obj.sentimentIndex === "number" ? Math.round(obj.sentimentIndex) : null;
  const sentimentIndex = rawIndex === null ? null : Math.max(0, Math.min(100, rawIndex));

  const sourceText = typeof obj.sourceText === "string" ? obj.sourceText : "";

  const issues: AdvisorIssue[] = Array.isArray(obj.issues)
    ? obj.issues.flatMap((it): AdvisorIssue[] => {
        if (!it || typeof it !== "object") return [];
        const r = it as Record<string, unknown>;
        const title = typeof r.title === "string" ? r.title.trim() : "";
        if (!title) return [];
        const severity = SEVERITIES.includes(r.severity as AdvisorSeverity)
          ? (r.severity as AdvisorSeverity)
          : "medium";
        return [
          {
            title,
            severity,
            detail: typeof r.detail === "string" ? r.detail.trim() : "",
            cite: typeof r.cite === "string" ? r.cite.trim() : "",
          },
        ];
      })
    : [];

  const options: AdvisorOption[] = Array.isArray(obj.options)
    ? obj.options.flatMap((o): AdvisorOption[] => {
        if (!o || typeof o !== "object") return [];
        const r = o as Record<string, unknown>;
        const title = typeof r.title === "string" ? r.title.trim() : "";
        if (!title) return [];
        return [
          {
            title,
            tradeoffs: typeof r.tradeoffs === "string" ? r.tradeoffs.trim() : "",
            rationale: typeof r.rationale === "string" ? r.rationale.trim() : "",
            recommended: r.recommended === true,
          },
        ];
      })
    : [];

  return { briefing, sentimentIndex, sourceText, issues, options };
}
