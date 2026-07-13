"use client";

import { createClient } from "@/lib/supabase/client";
import type { ProjectInvite, ProjectMember, ShareRole } from "@/lib/types";

function token(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Free-tier share links expire after 30 days; paid plans never expire (null). */
const SHARE_TTL_DAYS = 30;

/** Expiry to stamp on a NEW/renewed share link, based on the caller's plan.
 *  Returns an ISO timestamp for free (and unknown) plans, null for paid. */
async function shareExpiryForCaller(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Date(Date.now() + SHARE_TTL_DAYS * 86_400_000).toISOString();
  const { data: profile } = await supabase
    .from("fittbuilder_profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile?.plan ?? "free") !== "free") return null; // paid → no expiry
  return new Date(Date.now() + SHARE_TTL_DAYS * 86_400_000).toISOString();
}

export async function setShareLink(projectId: string, role: ShareRole): Promise<string> {
  const supabase = createClient();
  const tok = token();
  const { error } = await supabase
    .from("fittbuilder_projects")
    .update({ share_token: tok, share_role: role, share_expires_at: await shareExpiryForCaller() })
    .eq("id", projectId);
  if (error) throw error;
  return tok;
}

/** Extend an existing share link by another window WITHOUT rotating the token,
 *  so links already handed out keep working. Returns the new expiry (null=paid). */
export async function renewShareLink(projectId: string): Promise<string | null> {
  const supabase = createClient();
  const expiresAt = await shareExpiryForCaller();
  const { error } = await supabase
    .from("fittbuilder_projects")
    .update({ share_expires_at: expiresAt })
    .eq("id", projectId);
  if (error) throw error;
  return expiresAt;
}

export async function disableShareLink(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_projects")
    .update({ share_token: null, share_role: null })
    .eq("id", projectId);
  if (error) throw error;
}

export async function getShareToken(
  projectId: string
): Promise<{ token: string; role: ShareRole; expiresAt: string | null } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .select("share_token, share_role, share_expires_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.share_token || !data.share_role) return null;
  return {
    token: data.share_token,
    role: data.share_role as ShareRole,
    expiresAt: data.share_expires_at ?? null,
  };
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = createClient();
  // RPC (SECURITY DEFINER, membership-gated): a PostgREST embed to profiles isn't
  // possible (no FK) and profiles_select_own would hide other members anyway.
  const { data, error } = await supabase.rpc("fittbuilder_project_members_detailed", {
    pid: projectId,
  });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    projectId,
    userId: m.user_id,
    email: m.email ?? "",
    name: m.name ?? null,
    role: m.role as ShareRole,
    createdAt: m.created_at,
  }));
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ShareRole
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listInvites(projectId: string): Promise<ProjectInvite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_project_invites")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "pending");
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    projectId: i.project_id,
    email: i.email,
    role: i.role as ShareRole,
    token: i.token,
    status: i.status as ProjectInvite["status"],
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));
}

export async function createInvite(
  projectId: string,
  email: string,
  role: ShareRole
): Promise<ProjectInvite> {
  const supabase = createClient();
  const tok = token();
  const { data, error } = await supabase
    .from("fittbuilder_project_invites")
    .insert({ project_id: projectId, email: email.toLowerCase(), role, token: tok })
    .select("*")
    .single();
  if (error) throw error;
  // best-effort email via server route; all email fields derived server-side from invite row
  void fetch("/api/invite-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteId: data.id }),
  }).catch((e) => console.error("[sharing] invite email failed:", e));
  return {
    id: data.id,
    projectId: data.project_id,
    email: data.email,
    role: data.role as ShareRole,
    token: data.token,
    status: data.status as ProjectInvite["status"],
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_project_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) throw error;
}
