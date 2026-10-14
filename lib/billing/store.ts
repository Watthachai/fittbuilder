import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingBinding, BillingRow, DocRecord, OrgSnapshot, ProjectBundle, ProjectRecord } from "./types";

/**
 * Every database read behind the FITT Billing API (migration 0054). Service
 * role, server only — the routes have already decided which workspace is
 * asking, and every read here is scoped to it. Each throws on a database
 * error; the caller answers "try again", never a guess.
 */

const PRODUCER = "FITT_BILLING";
/** `.in()` travels in the URL; batches keep a large workspace under its limit. */
const IN_BATCH = 100;

function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

function batches(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_BATCH) out.push(ids.slice(i, i + IN_BATCH));
  return out;
}

export async function findBillingBinding(tokenHash: string): Promise<BillingBinding | null> {
  const r = await createAdminClient()
    .from("fittbuilder_integration_bindings")
    .select("id, org_id")
    .eq("token_hash", tokenHash)
    .eq("producer", PRODUCER)
    .is("revoked_at", null)
    .maybeSingle();
  return must(r, "billing binding lookup");
}

export async function touchBillingBinding(id: string, now: Date): Promise<void> {
  const r = await createAdminClient()
    .from("fittbuilder_integration_bindings")
    .update({ last_used_at: now.toISOString() })
    .eq("id", id);
  must(r, "billing binding touch");
}

/** PostgREST answers at most this many rows per request (Supabase's default max_rows). */
const PAGE = 1000;

/** Every project of the workspace, without its files, plus what is needed to list them. */
export async function loadOrgSnapshot(orgId: string): Promise<OrgSnapshot> {
  const db = createAdminClient();
  // Paged by id: an unpaged read stops silently at PAGE rows, and Billing would
  // never learn the rest of a large workspace exists.
  const projects: ProjectRecord[] = [];
  for (let from = 0; ; from += PAGE) {
    const page =
      must(
        await db
          .from("fittbuilder_projects")
          .select("id, name, phase, active_version, created_at, updated_at")
          .eq("org_id", orgId)
          .order("id")
          .range(from, from + PAGE - 1),
        "billing projects"
      ) ?? [];
    projects.push(...page);
    if (page.length < PAGE) break;
  }
  const snapshot: OrgSnapshot = { projects, quotes: [], proposals: [], billing: [] };
  for (const ids of batches(projects.map((p) => p.id))) {
    const [quotes, proposals, billing] = await Promise.all([
      db.from("fittbuilder_project_quotes").select("project_id, version, payload, updated_at").in("project_id", ids),
      db.from("fittbuilder_project_proposals").select("project_id, version, updated_at").in("project_id", ids),
      db
        .from("fittbuilder_project_billing")
        .select("project_id, status, reason, changed_at, license_key_hash")
        .in("project_id", ids),
    ]);
    snapshot.quotes.push(...(must(quotes, "billing quotes") as DocRecord[]));
    snapshot.proposals.push(...(must(proposals, "billing proposals") as DocRecord[]));
    snapshot.billing.push(...(must(billing, "billing status") as BillingRow[]));
  }
  return snapshot;
}

/** One project of the workspace with everything the detail needs; null when it isn't the workspace's. */
export async function loadProjectBundle(orgId: string, projectId: string): Promise<ProjectBundle | null> {
  const db = createAdminClient();
  const project = must(
    await db
      .from("fittbuilder_projects")
      .select("id, name, phase, active_version, files, created_at, updated_at")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    "billing project"
  ) as ProjectRecord | null;
  if (!project) return null;
  const [org, quotes, proposals, billing] = await Promise.all([
    db.from("fittbuilder_orgs").select("name").eq("id", orgId).maybeSingle(),
    db.from("fittbuilder_project_quotes").select("project_id, version, payload, updated_at").eq("project_id", projectId),
    db.from("fittbuilder_project_proposals").select("project_id, version, payload, updated_at").eq("project_id", projectId),
    db
      .from("fittbuilder_project_billing")
      .select("project_id, status, reason, changed_at, license_key_hash")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);
  return {
    project,
    orgId,
    orgName: (must(org, "billing org") as { name: string } | null)?.name ?? "",
    quotes: must(quotes, "billing quotes") as DocRecord[],
    proposals: must(proposals, "billing proposals") as DocRecord[],
    billing: must(billing, "billing status") as BillingRow | null,
  };
}
