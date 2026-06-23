import { z } from "zod";
import { SKILL_IDS } from "./registry";

/** Validation for admin-authored skill templates (request bodies). */
export const skillQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(300),
  type: z.enum(["single", "multi", "text"]),
  options: z.array(z.string().max(120)).max(12).optional(),
  placeholder: z.string().max(200).optional(),
  why: z.string().max(300).optional(),
});

export const skillTemplateBodySchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug ใช้ได้แค่ a-z 0-9 และ -")
    .min(2)
    .max(40)
    .refine((s) => !SKILL_IDS.includes(s), "slug นี้ชนกับโดเมน built-in"),
  name: z.string().min(1).max(80),
  nameEn: z.string().min(1).max(80),
  tagline: z.string().max(200).default(""),
  icon: z.string().max(40).default("Sparkles"),
  keywords: z.array(z.string().max(60)).max(40).default([]),
  persona: z.string().max(8_000).default(""),
  domainKnowledge: z.string().max(20_000).default(""),
  buildGuidance: z.string().max(20_000).default(""),
  seedData: z.string().max(20_000).default(""),
  designHints: z.string().max(2_000).optional(),
  questionBank: z.array(skillQuestionSchema).max(30).default([]),
});

/** Update: every field optional, slug immutable, plus an optional status change. */
export const skillTemplateUpdateSchema = skillTemplateBodySchema
  .omit({ slug: true })
  .partial()
  .extend({ status: z.enum(["draft", "published"]).optional() });

export type SkillTemplateBody = z.infer<typeof skillTemplateBodySchema>;
export type SkillTemplateUpdate = z.infer<typeof skillTemplateUpdateSchema>;

/** Map a create body → DB row columns (snake_case). */
export function bodyToRow(b: SkillTemplateBody, createdBy: string) {
  return {
    slug: b.slug,
    name: b.name,
    name_en: b.nameEn,
    tagline: b.tagline,
    icon: b.icon,
    keywords: b.keywords,
    persona: b.persona,
    domain_knowledge: b.domainKnowledge,
    build_guidance: b.buildGuidance,
    seed_data: b.seedData,
    design_hints: b.designHints ?? null,
    question_bank: b.questionBank,
    created_by: createdBy,
  };
}

/** Map a partial update body → DB row columns (only present fields). */
export function updateToRow(b: SkillTemplateUpdate): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (b.name !== undefined) row.name = b.name;
  if (b.nameEn !== undefined) row.name_en = b.nameEn;
  if (b.tagline !== undefined) row.tagline = b.tagline;
  if (b.icon !== undefined) row.icon = b.icon;
  if (b.keywords !== undefined) row.keywords = b.keywords;
  if (b.persona !== undefined) row.persona = b.persona;
  if (b.domainKnowledge !== undefined) row.domain_knowledge = b.domainKnowledge;
  if (b.buildGuidance !== undefined) row.build_guidance = b.buildGuidance;
  if (b.seedData !== undefined) row.seed_data = b.seedData;
  if (b.designHints !== undefined) row.design_hints = b.designHints ?? null;
  if (b.questionBank !== undefined) row.question_bank = b.questionBank;
  if (b.status !== undefined) row.status = b.status;
  return row;
}
