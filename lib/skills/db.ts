import { createClient } from "@/lib/supabase/server";
import { getSkill, SKILLS } from "./registry";
import { rowToSkillTemplate, type SkillTemplateRow } from "./db-mapper";
import type { SkillTemplate } from "./types";

/** Published GLOBAL templates (org_id null). Org specialists are never returned here. */
export async function listPublishedSkills(): Promise<SkillTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fittbuilder_skill_templates")
    .select("*")
    .eq("status", "published")
    .is("org_id", null);
  if (error) {
    console.error("[skills/db] listPublishedSkills failed:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as SkillTemplateRow[]).map(rowToSkillTemplate);
}

/** A single published GLOBAL template by slug (org_id null). Never resolves an org specialist. */
export async function getSkillFromDb(slug: string): Promise<SkillTemplate | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fittbuilder_skill_templates")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .is("org_id", null)
    .maybeSingle();
  return data ? rowToSkillTemplate(data as unknown as SkillTemplateRow) : null;
}

/** Built-in templates + published custom (built-ins win on slug collision). */
export async function getAllSkills(): Promise<SkillTemplate[]> {
  const builtinIds = new Set(SKILLS.map((s) => s.id));
  const custom = (await listPublishedSkills()).filter((c) => !builtinIds.has(c.id));
  return [...SKILLS, ...custom];
}

/** Resolve a skill id to a built-in or a published custom template. */
export async function resolveSkill(
  id: string | null | undefined
): Promise<SkillTemplate | undefined> {
  if (!id) return undefined;
  return getSkill(id) ?? (await getSkillFromDb(id)) ?? undefined;
}
