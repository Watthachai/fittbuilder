"use client";

import { createClient } from "@/lib/supabase/client";

/** A pending invite addressed to the signed-in user (project or workspace). */
export interface MyInvite {
  kind: "project" | "org";
  inviteId: string;
  entityId: string;
  entityName: string;
  role: string;
  createdAt: string;
}

/** Pending invites for the current user's email (project + workspace), newest
 *  first. Uses a SECURITY DEFINER RPC so an invitee can see invites that
 *  owner/admin-only RLS would otherwise hide. */
export async function listMyInvites(): Promise<MyInvite[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fittbuilder_my_invites");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    kind: r.kind === "org" ? "org" : "project",
    inviteId: r.invite_id,
    entityId: r.entity_id,
    entityName: r.entity_name ?? (r.kind === "org" ? "workspace" : "โปรเจกต์"),
    role: r.role,
    createdAt: r.created_at,
  }));
}

/**
 * Accept the caller's pending invites of one kind. The accept RPCs are keyed on
 * the server-verified email (not a token), so this redeems every pending invite
 * of that kind addressed to the user — then the caller navigates to `entityId`.
 */
export async function acceptMyInvite(invite: MyInvite): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("ไม่พบผู้ใช้");
  const rpc = invite.kind === "org" ? "fittbuilder_accept_org_invites" : "fittbuilder_accept_invites";
  const { error } = await supabase.rpc(rpc, { uid: user.id, mail: user.email });
  if (error) throw error;
}
