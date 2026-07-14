"use client";

import { createClient } from "@/lib/supabase/client";
import { rowToSkillTemplate, skillTemplateToInsertRow, type SkillTemplateRow } from "@/lib/skills/db-mapper";
import type { SkillTemplate } from "@/lib/skills/types";
import type { GeneratedSkill } from "@/lib/types";

const SELECT =
  "id, slug, name, name_en, tagline, icon, keywords, persona, domain_knowledge, build_guidance, seed_data, design_hints, question_bank, status, created_by, created_at, updated_at, org_id, source";

/** Deterministic slug for a workspace's single v1 specialist. Uses the FULL org
 *  id so two orgs can never collide (a truncated id is only 32 bits). */
export function orgSkillSlug(orgId: string): string {
  return `org-${orgId}`;
}

export async function getOrgSkill(orgId: string): Promise<SkillTemplate | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_skill_templates")
    .select(SELECT)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSkillTemplate(data as unknown as SkillTemplateRow) : null;
}

/** Upsert the workspace's specialist (one per org in v1) from an AI result. */
export async function saveOrgSkill(orgId: string, generated: GeneratedSkill): Promise<SkillTemplate> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ไม่พบผู้ใช้");
  // Preserve the original author on update — a regenerate/edit by another
  // member shouldn't overwrite who first created this org's specialist.
  const { data: existingRow, error: existingRowError } = await supabase
    .from("fittbuilder_skill_templates")
    .select("created_by")
    .eq("org_id", orgId)
    .maybeSingle();
  if (existingRowError) {
    console.error("[org-skills] created_by pre-check failed:", existingRowError);
  }
  const row = skillTemplateToInsertRow(generated, {
    slug: orgSkillSlug(orgId), orgId, createdBy: existingRow?.created_by ?? user.id, source: "ai",
  });
  const { data, error } = await supabase
    .from("fittbuilder_skill_templates")
    .upsert(row, { onConflict: "slug" })
    .select(SELECT)
    .single();
  if (error) throw error;
  return rowToSkillTemplate(data as unknown as SkillTemplateRow);
}

export async function deleteOrgSkill(orgId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_skill_templates")
    .delete()
    .eq("org_id", orgId);
  if (error) throw error;
}
