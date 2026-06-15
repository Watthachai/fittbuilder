import { getPreset } from "./presets";
import type { SpecAnswers } from "./types";

/** Per-document character budget (PRD §9.6 caps the whole context ≤ ~8k tokens). */
const DOC_CHAR_BUDGET = 6000;

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
 * Compose the Spec-to-Demo context block injected into the generation
 * system prompt (PRD §9.6): BRD excerpt → PRD excerpt → domain → clarifications.
 */
export function buildSpecContext(options: {
  brd?: string;
  prd?: string;
  presetId?: string;
  answers?: SpecAnswers;
}): string | undefined {
  const { brd, prd, presetId, answers } = options;
  if (!brd && !prd && !presetId) return undefined;

  const parts: string[] = ["PROJECT SPECIFICATION CONTEXT — the demo MUST reflect this:"];

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
