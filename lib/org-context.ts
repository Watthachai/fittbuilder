import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrgDnaContext } from "@/lib/org-dna";
import type { OrgDna } from "@/lib/types";

/**
 * SERVER-ONLY. Resolve a project's workspace Org DNA into a prompt context block.
 * Read via service role so it works for any project member during generation; the
 * DNA only shapes the prompt (never returned to the client). Returns "" when the
 * project has no org or the DNA is empty, so generation is unchanged in that case.
 */
export async function getProjectOrgDnaContext(projectId: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data: proj } = await admin
      .from("fittbuilder_projects")
      .select("org_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!proj?.org_id) return "";
    const { data: org } = await admin
      .from("fittbuilder_orgs")
      .select("org_dna")
      .eq("id", proj.org_id)
      .maybeSingle();
    return buildOrgDnaContext((org?.org_dna ?? null) as OrgDna | null);
  } catch (e) {
    console.error("[org-context] failed:", e);
    return "";
  }
}
