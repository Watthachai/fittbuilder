"use client";

import { createClient } from "@/lib/supabase/client";
import type { ProjectInvite, ProjectMember, ShareRole } from "@/lib/types";

function token(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function setShareLink(projectId: string, role: ShareRole): Promise<string> {
  const supabase = createClient();
  const tok = token();
  const { error } = await supabase
    .from("fittbuilder_projects")
    .update({ share_token: tok, share_role: role })
    .eq("id", projectId);
  if (error) throw error;
  return tok;
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
): Promise<{ token: string; role: ShareRole } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fittbuilder_projects")
    .select("share_token, share_role")
    .eq("id", projectId)
    .maybeSingle();
  if (!data?.share_token || !data.share_role) return null;
  return { token: data.share_token, role: data.share_role as ShareRole };
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fittbuilder_project_members")
    .select("project_id, user_id, role, created_at, fittbuilder_profiles(email, name)")
    .eq("project_id", projectId);
  // The hand-authored Database type has empty Relationships, so the nested
  // join result cannot be inferred. Cast via unknown to an explicit shape.
  type MemberRow = {
    project_id: string;
    user_id: string;
    role: string;
    created_at: string;
    fittbuilder_profiles: { email: string; name: string | null } | null;
  };
  return (data as unknown as MemberRow[] ?? []).map((m) => ({
    projectId: m.project_id,
    userId: m.user_id,
    email: m.fittbuilder_profiles?.email ?? "",
    name: m.fittbuilder_profiles?.name ?? null,
    role: m.role as ShareRole,
    createdAt: m.created_at,
  }));
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
  const { data } = await supabase
    .from("fittbuilder_project_invites")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "pending");
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
  role: ShareRole,
  senderName: string,
  projectName: string
): Promise<ProjectInvite> {
  const supabase = createClient();
  const tok = token();
  const { data, error } = await supabase
    .from("fittbuilder_project_invites")
    .insert({ project_id: projectId, email: email.toLowerCase(), role, token: tok })
    .select("*")
    .single();
  if (error) throw error;
  const inviteLink = `${location.origin}/join/${tok}`;
  // best-effort email via server route (Task 11); a 404 during the gap is harmless
  void fetch("/api/invite-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: email, projectName, role, inviteLink, senderName }),
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
