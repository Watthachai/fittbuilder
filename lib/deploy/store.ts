import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryRow, DeployBinding, DeployEnv, DeployEventRow } from "./types";

/**
 * Every database read and write behind the Code Runner deploy API (migration
 * 0059). Service role, server only. Each call throws on a database error; the
 * caller answers "try again", never a guess.
 */

const PRODUCER = "CODE_RUNNER";
const DELIVERY = "project_id, target, admin_email, updated_at";
const EVENT = "project_id, env, stage, build_no, digest, url, message, at";

function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

export async function findDeployBinding(tokenHash: string): Promise<DeployBinding | null> {
  const r = await createAdminClient()
    .from("fittbuilder_integration_bindings")
    .select("id")
    .eq("token_hash", tokenHash)
    .eq("producer", PRODUCER)
    .is("revoked_at", null)
    .maybeSingle();
  return must(r, "deploy binding lookup");
}

export async function touchDeployBinding(id: string, now: Date): Promise<void> {
  must(await createAdminClient().from("fittbuilder_integration_bindings").update({ last_used_at: now.toISOString() }).eq("id", id), "deploy binding touch");
}

/** A project's name and delivery choice, or null when there is no such project. */
export async function loadDeployProject(id: string): Promise<{ id: string; name: string; delivery: DeliveryRow | null } | null> {
  const db = createAdminClient();
  const project = must(await db.from("fittbuilder_projects").select("id, name").eq("id", id).maybeSingle(), "deploy project");
  if (!project) return null;
  const delivery = must(await db.from("fittbuilder_project_delivery").select(DELIVERY).eq("project_id", id).maybeSingle(), "deploy delivery");
  return { id: project.id as string, name: (project.name as string) ?? "", delivery: (delivery as DeliveryRow | null) ?? null };
}

export async function loadCloudDeliveries(): Promise<DeliveryRow[]> {
  return (must(await createAdminClient().from("fittbuilder_project_delivery").select(DELIVERY).eq("target", "cloud"), "cloud deliveries") ?? []) as DeliveryRow[];
}

/** Per project, the newest UAT events — enough to count MAX_FAILURES of one build. */
const EVENTS_PER_PROJECT = 10;
export async function loadUatEvents(projectIds: string[]): Promise<DeployEventRow[]> {
  const db = createAdminClient();
  const pages = await Promise.all(
    projectIds.map(async (id) =>
      must(
        await db.from("fittbuilder_project_deploy_events").select(EVENT).eq("project_id", id).eq("env", "uat").order("at", { ascending: false }).limit(EVENTS_PER_PROJECT),
        "uat events",
      ),
    ),
  );
  return pages.flatMap((p) => (p ?? []) as DeployEventRow[]);
}

export async function insertDeployEvent(e: Omit<DeployEventRow, "at"> & { binding_id: string }): Promise<void> {
  must(await createAdminClient().from("fittbuilder_project_deploy_events").insert(e), "deploy event insert");
}

/** Keeps a sealed password until it is shown; one that was shown already is never replaced. */
export async function storeInitialPassword(projectId: string, env: DeployEnv, sealed: string): Promise<void> {
  const db = createAdminClient();
  const existing = must(
    await db.from("fittbuilder_project_initial_passwords").select("revealed_at").eq("project_id", projectId).eq("env", env).maybeSingle(),
    "initial password lookup",
  );
  if (existing?.revealed_at) return;
  must(
    await db.from("fittbuilder_project_initial_passwords").upsert({ project_id: projectId, env, ciphertext: sealed, created_at: new Date().toISOString() }),
    "initial password store",
  );
}
