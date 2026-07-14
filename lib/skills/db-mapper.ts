import type { SkillQuestion, SkillTemplate } from "./types";
import type { GeneratedSkill } from "@/lib/types";
import type { Database } from "@/lib/db/types";

type SkillInsert = Database["public"]["Tables"]["fittbuilder_skill_templates"]["Insert"];

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
  org_id: string | null;
  source: "manual" | "ai";
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

/** GeneratedSkill (AI output) → a fittbuilder_skill_templates Insert row. */
export function skillTemplateToInsertRow(
  t: GeneratedSkill,
  opts: { slug: string; orgId: string; createdBy: string; source: "manual" | "ai" }
): SkillInsert {
  return {
    slug: opts.slug,
    name: t.name ?? "ผู้เชี่ยวชาญองค์กร",
    name_en: t.nameEn ?? "Org Specialist",
    tagline: t.tagline ?? "",
    icon: t.icon ?? "Sparkles",
    keywords: (t.keywords ?? []) as unknown as SkillInsert["keywords"],
    persona: t.persona ?? "",
    domain_knowledge: t.domainKnowledge ?? "",
    build_guidance: t.buildGuidance ?? "",
    seed_data: t.seedData ?? "",
    design_hints: t.designHints ?? null,
    question_bank: (t.questionBank ?? []) as unknown as SkillInsert["question_bank"],
    status: "published",
    created_by: opts.createdBy,
    org_id: opts.orgId,
    source: opts.source,
  };
}
