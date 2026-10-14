import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingBinding, BillingRow, BillingSnapshot, DocRecord, OrgRecord, OwnerRecord, ProjectBundle, ProjectRecord } from "./types";

/**
 * Every database read behind the FITT Billing API (migration 0054). Service
 * role, server only. A Billing credential reads every project — every
 * workspace's and everyone's personal ones — so the boundary here is which
 * credentials count as Billing's. Each read throws on a database error; the
 * caller answers "try again", never a guess.
 */

const PRODUCER = "FITT_BILLING";
/** `.in()` travels in the URL; batches keep a long id list under its limit. */
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
    .select("id")
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
const PROJECT = "id, name, phase, active_version, org_id, owner_id, runner_last, created_at, updated_at";
const BILLING = "project_id, status, reason, changed_at, license_key_hash";

/** Every project in FITT Builder, without its files, plus what is needed to list them. */
export async function loadSnapshot(): Promise<BillingSnapshot> {
  const db = createAdminClient();
  // Paged by id: an unpaged read stops silently at PAGE rows, and Billing would
  // never learn the rest exist.
  const projects: ProjectRecord[] = [];
  for (let from = 0; ; from += PAGE) {
    const page =
      must(await db.from("fittbuilder_projects").select(PROJECT).order("id").range(from, from + PAGE - 1), "billing projects") ?? [];
    projects.push(...page);
    if (page.length < PAGE) break;
  }
  const snapshot: BillingSnapshot = { projects, quotes: [], proposals: [], billing: [], orgs: [], owners: [] };
  for (const ids of batches(projects.map((p) => p.id))) {
    const [quotes, proposals, billing] = await Promise.all([
      db.from("fittbuilder_project_quotes").select("project_id, version, payload, updated_at").in("project_id", ids),
      db.from("fittbuilder_project_proposals").select("project_id, version, updated_at").in("project_id", ids),
      db.from("fittbuilder_project_billing").select(BILLING).in("project_id", ids),
    ]);
    snapshot.quotes.push(...(must(quotes, "billing quotes") as DocRecord[]));
    snapshot.proposals.push(...(must(proposals, "billing proposals") as DocRecord[]));
    snapshot.billing.push(...(must(billing, "billing status") as BillingRow[]));
  }
  const orgIds = [...new Set(projects.map((p) => p.org_id).filter((id): id is string => !!id))];
  for (const ids of batches(orgIds)) {
    snapshot.orgs.push(...((must(await db.from("fittbuilder_orgs").select("id, name").in("id", ids), "billing orgs") ?? []) as OrgRecord[]));
  }
  for (const ids of batches([...new Set(projects.map((p) => p.owner_id))])) {
    snapshot.owners.push(
      ...((must(await db.from("fittbuilder_profiles").select("id, name, email").in("id", ids), "billing owners") ?? []) as OwnerRecord[])
    );
  }
  return snapshot;
}

/** One project with everything the detail needs; null when there is no such project. */
export async function loadProjectBundle(projectId: string): Promise<ProjectBundle | null> {
  const db = createAdminClient();
  const project = must(
    await db.from("fittbuilder_projects").select(`${PROJECT}, files`).eq("id", projectId).maybeSingle(),
    "billing project"
  ) as ProjectRecord | null;
  if (!project) return null;
  const [org, owner, quotes, proposals, billing] = await Promise.all([
    project.org_id ? db.from("fittbuilder_orgs").select("id, name").eq("id", project.org_id).maybeSingle() : null,
    db.from("fittbuilder_profiles").select("id, name, email").eq("id", project.owner_id).maybeSingle(),
    db.from("fittbuilder_project_quotes").select("project_id, version, payload, updated_at").eq("project_id", projectId),
    db.from("fittbuilder_project_proposals").select("project_id, version, payload, updated_at").eq("project_id", projectId),
    db.from("fittbuilder_project_billing").select(BILLING).eq("project_id", projectId).maybeSingle(),
  ]);
  return {
    project,
    org: org ? (must(org, "billing org") as OrgRecord | null) : null,
    owner: must(owner, "billing owner") as OwnerRecord | null,
    quotes: must(quotes, "billing quotes") as DocRecord[],
    proposals: must(proposals, "billing proposals") as DocRecord[],
    billing: must(billing, "billing status") as BillingRow | null,
  };
}
