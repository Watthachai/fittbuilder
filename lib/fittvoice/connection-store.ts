import { createAdminClient } from "@/lib/supabase/admin";
import type { ConnectionRole, IntegrationClient } from "./connect";

/**
 * Every database read and write behind FITT Voice account connections
 * (migration 0053). Service role, server only — the routes that call these
 * have already decided who is asking. Each throws on a database error; the
 * caller answers "try again", never a guess.
 */

const PRODUCER = "FITT_VOICE";

function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

/** For queries that always return data when they succeed: lists, .single(), insert…select. */
function need<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  const data = must(r, what);
  if (data === null) throw new Error(`${what}: no data`);
  return data;
}

export interface BindingRow {
  id: string;
  org_id: string;
  user_id: string | null;
  client_id: string | null;
  created_at: string;
  last_used_at: string | null;
}

const BINDING = "id, org_id, user_id, client_id, created_at, last_used_at";

/** The live binding a bearer token hashes to — a service credential or a connection. */
export async function findBinding(tokenHash: string): Promise<BindingRow | null> {
  const r = await createAdminClient()
    .from("fittbuilder_integration_bindings")
    .select(BINDING)
    .eq("token_hash", tokenHash)
    .eq("producer", PRODUCER)
    .is("revoked_at", null)
    .maybeSingle();
  return must(r, "binding lookup");
}

export async function touchBinding(id: string, now: Date): Promise<void> {
  const r = await createAdminClient()
    .from("fittbuilder_integration_bindings")
    .update({ last_used_at: now.toISOString() })
    .eq("id", id);
  must(r, "binding touch");
}

/** The person's role in the workspace, or null when they are not in it (any more). */
export async function roleOf(orgId: string, userId: string): Promise<ConnectionRole | null> {
  const db = createAdminClient();
  const org = must(
    await db.from("fittbuilder_orgs").select("owner_id").eq("id", orgId).maybeSingle(),
    "workspace lookup"
  );
  if (!org) return null;
  if (org.owner_id === userId) return "OWNER";
  const member = must(
    await db
      .from("fittbuilder_org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle(),
    "membership lookup"
  );
  if (member?.role === "admin") return "ADMIN";
  if (member?.role === "member") return "MEMBER";
  return null;
}

/** Every workspace the person may connect, oldest first (their default leads). */
export async function workspacesOf(
  userId: string
): Promise<{ id: string; name: string; role: ConnectionRole }[]> {
  const db = createAdminClient();
  const memberships = need(
    await db.from("fittbuilder_org_members").select("org_id, role").eq("user_id", userId),
    "memberships"
  );
  const memberOf = new Map(
    memberships.map((m) => [m.org_id, m.role === "admin" ? "ADMIN" : "MEMBER"] as const)
  );
  const ids = [...memberOf.keys()];
  const orgs = need(
    await db
      .from("fittbuilder_orgs")
      .select("id, name, owner_id, created_at")
      .or(ids.length ? `owner_id.eq.${userId},id.in.(${ids.join(",")})` : `owner_id.eq.${userId}`)
      .order("created_at", { ascending: true }),
    "workspaces"
  );
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    role: o.owner_id === userId ? "OWNER" : (memberOf.get(o.id) ?? "MEMBER"),
  }));
}

export async function workspaceName(orgId: string): Promise<string> {
  const org = need<{ name: string }>(
    await createAdminClient().from("fittbuilder_orgs").select("name").eq("id", orgId).single(),
    "workspace name"
  );
  return org.name;
}

export async function userEmail(userId: string): Promise<string> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error(`user lookup: ${error?.message ?? "not found"}`);
  return data.user.email ?? "";
}

export async function getClient(id: string): Promise<IntegrationClient | null> {
  return must(
    await createAdminClient()
      .from("fittbuilder_integration_clients")
      .select("id, name, redirect_uris, disabled_at")
      .eq("id", id)
      .eq("producer", PRODUCER)
      .maybeSingle(),
    "client lookup"
  );
}

export interface CodeRow {
  client_id: string;
  user_id: string;
  org_id: string;
  redirect_uri: string;
  code_challenge: string;
}

export async function saveCode(row: CodeRow & { code_hash: string; expires_at: string }): Promise<void> {
  must(await createAdminClient().from("fittbuilder_integration_codes").insert(row), "code save");
}

/**
 * Spend a code: marks it used in the same statement that finds it unused and
 * unexpired, so two exchanges racing get it once. A spent code stays spent
 * even if what comes with it (redirect_uri, verifier) turns out wrong.
 */
export async function takeCode(codeHash: string, now: Date): Promise<CodeRow | null> {
  return must(
    await createAdminClient()
      .from("fittbuilder_integration_codes")
      .update({ used_at: now.toISOString() })
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .gt("expires_at", now.toISOString())
      .select("client_id, user_id, org_id, redirect_uri, code_challenge")
      .maybeSingle(),
    "code exchange"
  );
}

/**
 * A new connection. Connecting the same person to the same workspace again
 * replaces the earlier one — FITT Voice keeps one token per person, and an
 * older token left alive would be a credential nobody remembers holding.
 */
export async function issueConnection(c: {
  orgId: string;
  userId: string;
  clientId: string;
  tokenHash: string;
  label: string;
  now: Date;
}): Promise<BindingRow> {
  const db = createAdminClient();
  must(
    await db
      .from("fittbuilder_integration_bindings")
      .update({ revoked_at: c.now.toISOString() })
      .eq("user_id", c.userId)
      .eq("client_id", c.clientId)
      .eq("org_id", c.orgId)
      .is("revoked_at", null),
    "replace connection"
  );
  return need(
    await db
      .from("fittbuilder_integration_bindings")
      .insert({
        org_id: c.orgId,
        producer: PRODUCER,
        token_hash: c.tokenHash,
        label: c.label.slice(0, 200),
        user_id: c.userId,
        client_id: c.clientId,
        last_used_at: c.now.toISOString(),
      })
      .select(BINDING)
      .single(),
    "issue connection"
  );
}

/** RFC 7009: only the client a connection was issued to may revoke it this way. */
export async function revokeByToken(tokenHash: string, clientId: string, now: Date): Promise<void> {
  must(
    await createAdminClient()
      .from("fittbuilder_integration_bindings")
      .update({ revoked_at: now.toISOString() })
      .eq("token_hash", tokenHash)
      .eq("client_id", clientId)
      .is("revoked_at", null),
    "revoke by token"
  );
}

export interface ConnectionSummary {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** The person's live connections into one workspace, newest first. */
export async function connectionsOf(userId: string, orgId: string): Promise<ConnectionSummary[]> {
  const db = createAdminClient();
  const found = need(
    await db
      .from("fittbuilder_integration_bindings")
      .select("id, client_id, created_at, last_used_at")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    "connections"
  );
  const clientIds = [...new Set(found.map((r) => r.client_id).filter((id): id is string => !!id))];
  const clients = clientIds.length
    ? need(
        await db.from("fittbuilder_integration_clients").select("id, name").in("id", clientIds),
        "client names"
      )
    : [];
  const name = new Map(clients.map((c) => [c.id, c.name]));
  return found.map((r) => ({
    id: r.id,
    clientName: (r.client_id && name.get(r.client_id)) || "FITT Voice",
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

/** Revoke one of the person's own connections. False when it is not theirs or already gone. */
export async function revokeConnection(id: string, userId: string, now: Date): Promise<boolean> {
  const revoked = need(
    await createAdminClient()
      .from("fittbuilder_integration_bindings")
      .update({ revoked_at: now.toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .select("id"),
    "revoke connection"
  );
  return revoked.length > 0;
}
