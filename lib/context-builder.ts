import { getPreset } from "./presets";
import type { SpecAnswers } from "./types";

/** Per-document character budget (PRD §9.6 caps the whole context ≤ ~8k tokens). */
const DOC_CHAR_BUDGET = 6000;

/**
 * The brief gets a budget of its own, and a bigger one.
 *
 * The Define phase caps a prompt at 10k characters, so in practice a brief is
 * never cut here at all — which is the point. The BRD/PRD are a summary written
 * by an agent; the brief is what the customer actually said, and it is the only
 * place a hex value, a pixel measurement or an asset URL survives.
 */
const BRIEF_CHAR_BUDGET = 12_000;

/**
 * Truncate a long document while keeping its skeleton: headings, table rows
 * and list items are kept first, then remaining budget is filled with the
 * leading prose.
 */
export function truncateDoc(text: string, budget = DOC_CHAR_BUDGET): string {
  const trimmed = text.trim();
  if (trimmed.length <= budget) return trimmed;

  const lines = trimmed.split("\n");
  const skeleton: string[] = [];
  let used = 0;
  for (const line of lines) {
    const isStructural = /^(#{1,6}\s|\||-\s|\*\s|\d+\.\s)/.test(line.trim());
    if (isStructural && used + line.length + 1 <= budget) {
      skeleton.push(line);
      used += line.length + 1;
    }
  }
  if (used < budget * 0.5) {
    // Document has little structure — fall back to a hard cut.
    return trimmed.slice(0, budget) + "\n…(ตัดเนื้อหาส่วนที่เหลือ)";
  }
  return skeleton.join("\n") + "\n…(แสดงเฉพาะโครงสร้างหลักของเอกสาร)";
}

/**
 * Trim an over-long brief from the MIDDLE, never the end.
 *
 * Deliberately not truncateDoc: that keeps "structural" lines and drops prose,
 * which is exactly backwards for a design brief, where the load-bearing detail
 * ("Overlay gradient: linear-gradient(...)") is prose and the headings are the
 * disposable part. And a spec habitually ends on its palette and font stack, so
 * a head-only cut throws away the values most worth carrying.
 */
export function truncateBrief(text: string, budget = BRIEF_CHAR_BUDGET): string {
  const trimmed = text.trim();
  if (trimmed.length <= budget) return trimmed;
  const head = Math.floor(budget * 0.7);
  const tail = budget - head;
  return `${trimmed.slice(0, head)}\n…(ตัดเนื้อหาช่วงกลางออก)…\n${trimmed.slice(-tail)}`;
}

/**
 * Compose the Spec-to-Demo context block injected into the generation
 * system prompt (PRD §9.6): brief → BRD excerpt → PRD excerpt → domain →
 * clarifications.
 *
 * The brief leads for a reason. The build turn used to receive the BRD and PRD
 * and nothing else, so everything a business document has no reason to record —
 * exact colours, pixel measurements, asset URLs, the wording of the copy, the
 * language it is written in — was gone by the time anyone wrote code. What came
 * back was a plausible demo of the right subject rather than the thing that was
 * asked for. The documents describe the scope; only the brief carries the specifics.
 */
export function buildSpecContext(options: {
  /** The user's own words, verbatim — the first message of the project. */
  brief?: string;
  brd?: string;
  prd?: string;
  presetId?: string;
  answers?: SpecAnswers;
}): string | undefined {
  const { brief, brd, prd, presetId, answers } = options;
  if (!brief && !brd && !prd && !presetId) return undefined;

  const parts: string[] = ["PROJECT SPECIFICATION CONTEXT — the demo MUST reflect this:"];

  if (brief?.trim()) {
    parts.push(
      `[0] ORIGINAL BRIEF FROM THE USER — verbatim, and the source of truth:
Anything stated EXACTLY here is a requirement, not a suggestion: colour values, pixel
sizes and aspect ratios, font families, class names, asset URLs (images/video — use the
exact URL given), the wording of every visible string, and the language that wording is
written in. Reproduce them as written; do not translate the copy, do not substitute a
gradient for a video, do not round a measurement, and do not invent extra content the
brief does not ask for. The documents below SUMMARISE this brief — where they are
vaguer than it, the brief governs.

${truncateBrief(brief)}`
    );
  }
  if (brd) {
    parts.push(`[1] BUSINESS REQUIREMENTS (BRD excerpt):\n${truncateDoc(brd)}`);
  }
  if (prd) {
    parts.push(`[2] PRODUCT REQUIREMENTS (PRD excerpt):\n${truncateDoc(prd)}`);
  }

  const preset = presetId ? getPreset(presetId) : undefined;
  if (preset) {
    parts.push(`[3] DOMAIN: ${preset.nameEn} (${preset.name})`);
  }

  if (preset && answers && Object.keys(answers).length > 0) {
    const lines = preset.questions
      .filter((q) => answers[q.id] !== undefined && String(answers[q.id]).length > 0)
      .map((q) => {
        const value = answers[q.id];
        return `- ${q.label} → ${Array.isArray(value) ? value.join(", ") : value}`;
      });
    if (lines.length > 0) {
      parts.push(`[4] CLARIFICATIONS FROM THE USER:\n${lines.join("\n")}`);
    }
  }

  parts.push(
    "[5] Build a demo that matches this domain and spec — correct terminology, realistic workflows and mock data drawn from the documents above. An ERP must look like an ERP, not a landing page."
  );

  return parts.join("\n\n");
}
