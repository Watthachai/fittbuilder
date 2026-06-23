import type { SkillTemplate } from "./types";
import { ERP } from "./erp";
import { CRM } from "./crm";
import { ECOMMERCE } from "./ecommerce";
import { DASHBOARD } from "./dashboard";
import { BOOKING } from "./booking";
import { LANDING } from "./landing";

/** All domain skill templates. ERP is the deep one; the rest are shallow (v1). */
export const SKILLS: SkillTemplate[] = [ERP, CRM, ECOMMERCE, DASHBOARD, BOOKING, LANDING];

export const SKILL_IDS: string[] = SKILLS.map((s) => s.id);

export function getSkill(id: string | null | undefined): SkillTemplate | undefined {
  if (!id) return undefined;
  return SKILLS.find((s) => s.id === id);
}

/**
 * Keyword-scoring detection used as the fallback when the model can't classify,
 * and to seed the model's choice. Returns the best match (defaults to "landing"
 * with score 0 when nothing matches — caller should treat score 0 as "no clear match").
 */
export function detectSkillByKeywords(
  text: string,
  skills: SkillTemplate[] = SKILLS
): { skillId: string; score: number } {
  const lower = text.toLowerCase();
  let best = { skillId: "landing", score: 0 };
  for (const skill of skills) {
    let score = 0;
    for (const kw of skill.keywords) {
      if (lower.includes(kw.toLowerCase())) score += 1;
    }
    if (score > best.score) best = { skillId: skill.id, score };
  }
  return best;
}
