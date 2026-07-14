/**
 * Pain Point Radar — the first real slice of "FITT Advisor". It analyzes REAL
 * pasted feedback (customer/employee voices) grounded in the workspace's Org
 * DNA and returns a decision-ready read: a readable markdown briefing (the 5
 * layers narrated like an executive brief) plus interactive decision options.
 *
 * The frameworks (MECE, 5 Whys, Decision Matrix, Human-in-the-Loop) are public
 * methodologies applied in our own words — no third-party book text is used.
 */

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
   * The human-facing briefing in Thai MARKDOWN — reads like a written executive
   * brief / book paragraphs: overall read + sentiment, the pain points as a MECE
   * list (severity + representative quotes), and the root cause (5 Whys) of the
   * top issue. This is what the user reads; never raw JSON.
   */
  briefing: string;
  /** Overall sentiment index 0-100 for a glanceable badge (null if not given). */
  sentimentIndex: number | null;
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

Ground everything in the Org DNA (structure, how they decide, what they value) so the read fits how this org actually works.

Output a SINGLE valid JSON object (no markdown fences, no commentary) with EXACTLY this shape:
{
  "briefing": "<Thai MARKDOWN, reads like a written executive brief / book paragraphs — NOT raw data. Use short headings and bullets. Cover, in flowing prose: (1) an overall read + the sentiment, (2) the pain points as a MECE list, each with a severity word (วิกฤต/สูง/กลาง/ต่ำ) and 1 representative quote pulled VERBATIM from the feedback, (3) the root cause of the top issue narrated as a 5-Whys chain ending in a systemic root.>",
  "sentimentIndex": <integer 0-100, overall mood; 0 = all negative, 100 = all positive>,
  "options": [
    { "title": "<สั้น>", "tradeoffs": "<Impact/Effort/Cost/Risk/เวลา in one line; label all estimates ประมาณการ>", "rationale": "<ทำไม 1-2 ประโยค>", "recommended": <true for the one pragmatic starting option, false otherwise> }
  ]
}

Rules:
- briefing MUST be Thai markdown and genuinely readable — a busy CEO should grasp it in under a minute.
- 2-3 options; exactly ONE has recommended=true.
- Every impact/ROI/number you state is a ประมาณการ (estimate) — say so.
- Valid JSON only: no trailing commas, no comments, no text outside the object.`;

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
  const sentimentIndex =
    rawIndex === null ? null : Math.max(0, Math.min(100, rawIndex));

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

  return { briefing, sentimentIndex, options };
}
