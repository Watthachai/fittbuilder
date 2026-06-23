import type { SkillQuestion, SkillTemplate } from "./types";

/** A row from fittbuilder_skill_templates. */
export interface SkillTemplateRow {
  id: string;
  slug: string;
  name: string;
  name_en: string;
  tagline: string;
  icon: string;
  keywords: string[];
  persona: string;
  domain_knowledge: string;
  build_guidance: string;
  seed_data: string;
  design_hints: string | null;
  question_bank: SkillQuestion[];
  status: "draft" | "published";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Pure DB-row → SkillTemplate mapper (slug becomes the runtime skill id). */
export function rowToSkillTemplate(row: SkillTemplateRow): SkillTemplate {
  return {
    id: row.slug,
    name: row.name,
    nameEn: row.name_en,
    tagline: row.tagline,
    icon: row.icon,
    keywords: row.keywords ?? [],
    persona: row.persona,
    questionBank: row.question_bank ?? [],
    domainKnowledge: row.domain_knowledge,
    buildGuidance: row.build_guidance,
    seedData: row.seed_data,
    designHints: row.design_hints ?? undefined,
  };
}
