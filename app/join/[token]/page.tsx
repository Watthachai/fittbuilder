import Link from "next/link";
import { ArrowRight, Eye, Pencil, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AcceptInvite from "./AcceptInvite";

export const metadata = { title: "คำเชิญเข้าร่วมโปรเจกต์" };

/**
 * Accept-invitation landing. Replaces the old silent redirect route: the invitee
 * sees what they're joining (project + role) and confirms, rather than being
 * bounced straight in. A token is either a project share-link (share_token) or a
 * per-email invite (invites.token); we preview either via the service role since
 * RLS hides both from a not-yet-member.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  let entityName: string | null = null;
  let role: string | null = null;
  let isOrg = false;
  let invalidReason: string | null = null;

  const { data: proj } = await admin
    .from("fittbuilder_projects")
    .select("name, share_role, share_expires_at")
    .eq("share_token", token)
    .maybeSingle();

  if (proj?.share_role) {
    if (proj.share_expires_at && new Date(proj.share_expires_at) < new Date()) {
      invalidReason = "ลิงก์แชร์นี้หมดอายุแล้ว";
    } else {
      entityName = proj.name;
      role = proj.share_role;
    }
  } else {
    const { data: invite } = await admin
      .from("fittbuilder_project_invites")
      .select("role, status, expires_at, project_id")
      .eq("token", token)
      .maybeSingle();
    if (invite) {
      if (invite.status === "revoked") invalidReason = "คำเชิญนี้ถูกยกเลิกแล้ว";
      else if (new Date(invite.expires_at) < new Date()) invalidReason = "คำเชิญนี้หมดอายุแล้ว";
      else {
        role = invite.role;
        const { data: p } = await admin
          .from("fittbuilder_projects")
          .select("name")
          .eq("id", invite.project_id)
          .maybeSingle();
        entityName = p?.name ?? "โปรเจกต์ที่ไม่มีชื่อ";
      }
    } else {
      // Workspace invite?
      const { data: orgInvite } = await admin
        .from("fittbuilder_org_invites")
        .select("role, status, expires_at, org_id")
        .eq("token", token)
        .maybeSingle();
      if (!orgInvite) invalidReason = "ลิงก์คำเชิญนี้ไม่ถูกต้อง";
      else if (orgInvite.status === "revoked") invalidReason = "คำเชิญนี้ถูกยกเลิกแล้ว";
      else if (new Date(orgInvite.expires_at) < new Date()) invalidReason = "คำเชิญนี้หมดอายุแล้ว";
      else {
        isOrg = true;
        role = orgInvite.role;
        const { data: o } = await admin
          .from("fittbuilder_orgs")
          .select("name")
          .eq("id", orgInvite.org_id)
          .maybeSingle();
        entityName = o?.name ?? "workspace ที่ไม่มีชื่อ";
      }
    }
  }

  // Role presentation differs by invite kind: projects use editor/viewer,
  // workspaces use admin/member.
  const elevated = role === "editor" || role === "admin";
  const roleLabel = isOrg
    ? role === "admin" ? "ผู้ดูแล" : "สมาชิก"
    : elevated ? "ผู้แก้ไข" : "ผู้ชม";
  const roleHint = isOrg
    ? role === "admin" ? "จัดการสมาชิกและทุกโปรเจกต์ได้" : "ทำงานกับทุกโปรเจกต์ใน workspace ได้"
    : elevated ? "แก้ไขและสร้างร่วมกันได้" : "เปิดดูได้อย่างเดียว";
  const RoleIcon = isOrg ? Users : elevated ? Pencil : Eye;
  const eyebrow = isOrg ? "คำเชิญเข้าร่วม workspace" : "คำเชิญเข้าร่วมโปรเจกต์";

  return (
    <main className="grid min-h-screen place-items-center bg-night px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 flex w-fit items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-chalk">
            <span className="h-2.5 w-2.5 rounded-full bg-chalk" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-chalk">
            FITT Builder
          </span>
        </Link>

        <div className="rounded-2xl border border-night-edge bg-night-panel px-8 py-9 text-center">
          {invalidReason ? (
            <>
              <h1 className="font-display text-lg font-semibold text-chalk">
                {invalidReason}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
                ขอลิงก์คำเชิญใหม่จากเจ้าของโปรเจกต์ แล้วลองอีกครั้ง
              </p>
              <Link
                href="/"
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-chalk/15 bg-chalk/[0.03] py-3 font-display text-sm font-medium text-chalk transition hover:border-chalk/30 hover:bg-chalk/[0.06]"
              >
                กลับหน้าแรก
              </Link>
            </>
          ) : (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-shine/10 text-shine">
                <Users size={22} />
              </span>
              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.22em] text-shine">
                {eyebrow}
              </p>
              <h1 className="mt-2 font-display text-xl font-semibold leading-snug text-chalk">
                {entityName}
              </h1>
              <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-night-edge bg-chalk/[0.03] px-3.5 py-1.5">
                <RoleIcon size={13} className="text-chalk-dim" />
                <span className="text-xs text-chalk">
                  ในฐานะ<span className="font-semibold">{roleLabel}</span>
                </span>
                <span className="text-xs text-chalk-dim/70">· {roleHint}</span>
              </div>

              {user ? (
                <AcceptInvite token={token} />
              ) : (
                <>
                  <p className="mt-6 text-sm leading-relaxed text-chalk-dim">
                    เข้าสู่ระบบเพื่อตอบรับคำเชิญและเริ่มทำงานร่วมกัน
                  </p>
                  <Link
                    href={`/login?next=/join/${token}`}
                    className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shine py-3 font-display text-sm font-semibold text-night transition hover:brightness-110"
                  >
                    เข้าสู่ระบบเพื่อตอบรับ
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
