import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToSkillTemplate, type SkillTemplateRow } from "@/lib/skills/db-mapper";
import { resolveSkill } from "@/lib/skills/db";
import type { SkillTemplate } from "@/lib/skills/types";

/** Explicit skillId wins; otherwise the project's workspace specialist (if any). */
export async function resolveSkillForProject(
  skillId: string | null | undefined,
  projectId: string | null | undefined
): Promise<SkillTemplate | undefined> {
  if (skillId) return resolveSkill(skillId);
  if (!projectId) return undefined;
  const admin = createAdminClient();
  const { data: proj, error: projError } = await admin
    .from("fittbuilder_projects").select("org_id").eq("id", projectId).maybeSingle();
  if (projError) console.error("[org-resolve] project lookup failed:", projError);
  if (!proj?.org_id) return undefined;
  const { data: row, error: rowError } = await admin
    .from("fittbuilder_skill_templates").select("*").eq("org_id", proj.org_id).maybeSingle();
  if (rowError) console.error("[org-resolve] skill template lookup failed:", rowError);
  return row ? rowToSkillTemplate(row as unknown as SkillTemplateRow) : undefined;
}
