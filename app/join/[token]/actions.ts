"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Accept an invitation, then land the user where the invite points. A
 * `/join/<token>` link is one of THREE kinds and we resolve which by looking the
 * token up:
 *   1. a project share-link → `fittbuilder_projects.share_token` (role = share_role)
 *   2. a per-email project invite → `fittbuilder_project_invites.token`
 *   3. a per-email workspace invite → `fittbuilder_org_invites.token`
 *
 * Identity comes from the authenticated server session, never the client — the
 * accept RPC is keyed on the verified user.id/email so a token can't be redeemed
 * on someone else's behalf.
 */
export async function joinProject(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  if (!token) return "ลิงก์คำเชิญไม่ถูกต้อง";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/join/${token}`);

  // Service role resolves the token past RLS (the invitee can't read it yet).
  const admin = createAdminClient();

  // ── 1. Share-link token? ────────────────────────────────────────────────
  const { data: proj } = await admin
    .from("fittbuilder_projects")
    .select("id, share_role, share_expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (proj?.share_role) {
    if (proj.share_expires_at && new Date(proj.share_expires_at) < new Date())
      return "ลิงก์แชร์นี้หมดอายุแล้ว — ขอลิงก์ใหม่จากเจ้าของโปรเจกต์";
    const { data: pid, error } = await supabase.rpc("fittbuilder_join_by_token", {
      tok: token,
      uid: user.id,
    });
    if (error || !pid) return "เข้าร่วมไม่สำเร็จ ลองอีกครั้ง";
    redirect(`/project/${pid}`);
  }

  // ── 2. Per-email PROJECT invite token? ──────────────────────────────────
  const { data: invite } = await admin
    .from("fittbuilder_project_invites")
    .select("project_id, email, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (invite) {
    if (invite.status === "revoked") return "คำเชิญนี้ถูกยกเลิกแล้ว";
    if (new Date(invite.expires_at) < new Date()) return "คำเชิญนี้หมดอายุแล้ว";
    if (user.email && invite.email.toLowerCase() !== user.email.toLowerCase())
      return `คำเชิญนี้ส่งถึง ${invite.email} — คุณกำลังเข้าสู่ระบบด้วยอีเมลอื่น`;

    // Accept by the SERVER-verified email (idempotent — login may have already
    // accepted it). Passing user.email here, not anything from the client.
    const { error } = await supabase.rpc("fittbuilder_accept_invites", {
      uid: user.id,
      mail: user.email!,
    });
    if (error) return "เข้าร่วมไม่สำเร็จ ลองอีกครั้ง";
    redirect(`/project/${invite.project_id}`);
  }

  // ── 3. Per-email WORKSPACE invite token? ────────────────────────────────
  const { data: orgInvite } = await admin
    .from("fittbuilder_org_invites")
    .select("org_id, email, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!orgInvite) return "ลิงก์คำเชิญไม่ถูกต้องหรือหมดอายุ";
  if (orgInvite.status === "revoked") return "คำเชิญนี้ถูกยกเลิกแล้ว";
  if (new Date(orgInvite.expires_at) < new Date()) return "คำเชิญนี้หมดอายุแล้ว";
  if (user.email && orgInvite.email.toLowerCase() !== user.email.toLowerCase())
    return `คำเชิญนี้ส่งถึง ${orgInvite.email} — คุณกำลังเข้าสู่ระบบด้วยอีเมลอื่น`;

  const { error } = await supabase.rpc("fittbuilder_accept_org_invites", {
    uid: user.id,
    mail: user.email!,
  });
  if (error) return "เข้าร่วมไม่สำเร็จ ลองอีกครั้ง";
  redirect(`/org/${orgInvite.org_id}`);
}
