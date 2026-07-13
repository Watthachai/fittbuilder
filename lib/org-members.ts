"use client";

import { createClient } from "@/lib/supabase/client";
import type { OrgInvite, OrgInviteRole, OrgMember, OrgRole } from "@/lib/types";

/** Random opaque token for an org invite link (mirrors lib/sharing.ts). */
function token(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Workspace roster (owner + members) with emails. RPC is SECURITY DEFINER and
 *  membership-gated — the owner shows up as an implicit 'owner' row. */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fittbuilder_org_members_detailed", {
    oid: orgId,
  });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    orgId,
    userId: m.user_id,
    email: m.email ?? "",
    name: m.name ?? null,
    role: m.role as OrgRole,
    createdAt: m.created_at,
  }));
}

/** Change a member's role. Owner is implicit and can't be re-roled here. */
export async function updateOrgMemberRole(
  orgId: string,
  userId: string,
  role: OrgInviteRole
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Remove a member from the workspace (admins) or leave it yourself. */
export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listOrgInvites(orgId: string): Promise<OrgInvite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_org_invites")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending");
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    orgId: i.org_id,
    email: i.email,
    role: i.role as OrgInviteRole,
    token: i.token,
    status: i.status as OrgInvite["status"],
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));
}

export async function createOrgInvite(
  orgId: string,
  email: string,
  role: OrgInviteRole
): Promise<OrgInvite> {
  const supabase = createClient();
  const tok = token();
  const { data, error } = await supabase
    .from("fittbuilder_org_invites")
    .insert({ org_id: orgId, email: email.toLowerCase(), role, token: tok })
    .select("*")
    .single();
  if (error) throw error;
  // Best-effort email via the server route; all fields derived server-side from
  // the invite row (never trust the client for the recipient/link).
  void fetch("/api/org-invite-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteId: data.id }),
  }).catch((e) => console.error("[org-members] invite email failed:", e));
  return {
    id: data.id,
    orgId: data.org_id,
    email: data.email,
    role: data.role as OrgInviteRole,
    token: data.token,
    status: data.status as OrgInvite["status"],
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
}

export async function revokeOrgInvite(inviteId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_org_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) throw error;
}
