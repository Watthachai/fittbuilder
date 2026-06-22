/**
 * Spec-to-Demo presets — now a thin adapter over the domain Skill Templates so
 * there is a single source of truth (`lib/skills/`). The Typeform / detect /
 * extract-answers paths keep the same Preset shape; the data lives in skills.
 */

import { SKILLS, getSkill as getSkillById, detectSkillByKeywords } from "./skills/registry";
import type { SkillQuestion } from "./skills/types";

export type QuestionType = SkillQuestion["type"];
/** A preset question is a skill question (same shape; `why` is optional extra). */
export type PresetQuestion = SkillQuestion;

export interface Preset {
  id: string;
  name: string;
  nameEn: string;
  tagline: string;
  keywords: string[];
  questions: PresetQuestion[];
}

export const PRESETS: Preset[] = SKILLS.map((s) => ({
  id: s.id,
  name: s.name,
  nameEn: s.nameEn,
  tagline: s.tagline,
  keywords: s.keywords,
  questions: s.questionBank,
}));

export const PRESET_IDS = PRESETS.map((p) => p.id);

export function getPreset(id: string): Preset | undefined {
  const skill = getSkillById(id);
  if (!skill) return undefined;
  return {
    id: skill.id,
    name: skill.name,
    nameEn: skill.nameEn,
    tagline: skill.tagline,
    keywords: skill.keywords,
    questions: skill.questionBank,
  };
}

/** Keyword-scoring fallback — delegates to the skills registry. */
export function detectPresetByKeywords(text: string): { presetId: string; score: number } {
  const { skillId, score } = detectSkillByKeywords(text);
  return { presetId: skillId, score };
}
