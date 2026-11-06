import Link from "next/link";
import { ArrowRight, Building2, Eye, Pencil, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyHome, spentLinkView } from "@/lib/company-link";
import type { CompanyRole } from "@/lib/types";
import AcceptInvite from "./AcceptInvite";

export const metadata = { title: "คำเชิญ" };

/**
 * Accept-invitation landing. Replaces the old silent redirect route: the invitee
 * sees what they're joining (project + role) and confirms, rather than being
 * bounced straight in. A token is a project share-link (share_token), a per-email
 * project or workspace invite, or a company link (0065); we preview each via the
 * service role since RLS hides them from a not-yet-member.
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
  let kind: "project" | "org" | "company" = "project";
  let invalidReason: string | null = null;
  let invalidHint = "ขอลิงก์คำเชิญใหม่จากเจ้าของโปรเจกต์ แล้วลองอีกครั้ง";
  let invalidAction = { href: "/", label: "กลับหน้าแรก" };
  // The company link is spent, and this person holds the role it gives.
  let alreadyIn = false;

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
      // Company link (migration 0065)?
      const { data: companyInvite } = await admin
        .from("fittbuilder_company_invites")
        .select("role, status, expires_at, company_id")
        .eq("token", token)
        .maybeSingle();
      // Workspace invite?
      const { data: orgInvite } = companyInvite
        ? { data: null }
        : await admin
            .from("fittbuilder_org_invites")
            .select("role, status, expires_at, org_id")
            .eq("token", token)
            .maybeSingle();
      if (companyInvite) {
        invalidHint = "ขอลิงก์ใหม่จากผู้ดูแลบริษัท แล้วลองอีกครั้ง";
        // Spent by the first person who takes it, who has no reason to ask for another.
        const spent = companyInvite.status === "accepted";
        const { data: mine } =
          spent && user
            ? await admin
                .from("fittbuilder_company_members")
                .select("role")
                .eq("user_id", user.id)
                .eq("company_id", companyInvite.company_id)
                .maybeSingle()
            : { data: null };
        const view = spent
          ? spentLinkView(companyInvite.role as CompanyRole, {
              signedIn: Boolean(user),
              role: (mine?.role as CompanyRole | undefined) ?? null,
            })
          : null;
        if (companyInvite.status === "revoked") invalidReason = "คำเชิญนี้ถูกยกเลิกแล้ว";
        else if (view === "used") invalidReason = "ลิงก์นี้ถูกใช้ไปแล้ว";
        else if (view === "sign-in") {
          invalidReason = "ลิงก์นี้ถูกใช้ไปแล้ว";
          invalidHint = "ถ้าคุณตอบรับลิงก์นี้ไว้แล้ว เข้าสู่ระบบเพื่อใช้งานต่อได้เลย ไม่ต้องขอลิงก์ใหม่";
          invalidAction = { href: `/login?next=/join/${token}`, label: "เข้าสู่ระบบ" };
        } else if (!spent && new Date(companyInvite.expires_at) < new Date()) invalidReason = "คำเชิญนี้หมดอายุแล้ว";
        else {
          kind = "company";
          alreadyIn = spent;
          role = mine?.role ?? companyInvite.role;
          const { data: c } = await admin
            .from("fittbuilder_companies")
            .select("name")
            .eq("id", companyInvite.company_id)
            .maybeSingle();
          entityName = c?.name ?? "บริษัท";
        }
      } else if (!orgInvite) invalidReason = "ลิงก์คำเชิญนี้ไม่ถูกต้อง";
      else if (orgInvite.status === "revoked") invalidReason = "คำเชิญนี้ถูกยกเลิกแล้ว";
      else if (new Date(orgInvite.expires_at) < new Date()) invalidReason = "คำเชิญนี้หมดอายุแล้ว";
      else {
        kind = "org";
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
  // workspaces admin/member, companies admin/approver/reviewer/member.
  const elevated = role === "editor" || role === "admin";
  const roleLabel =
    kind === "company"
      ? role === "admin" ? "ผู้ดูแลบริษัท" : role === "approver" ? "ผู้อนุมัติ" : role === "reviewer" ? "ผู้ตรวจ" : "พนักงาน"
      : kind === "org"
        ? role === "admin" ? "ผู้ดูแล" : "สมาชิก"
        : elevated ? "ผู้แก้ไข" : "ผู้ชม";
  const roleHint =
    kind === "company"
      ? role === "admin"
        ? "จัดการคนในบริษัท และอนุมัติเอกสารของทุก workspace ในบริษัท"
        : role === "approver"
          ? "ตรวจและอนุมัติใบเสนอราคากับข้อเสนอโครงการของทุก workspace ในบริษัท เปิดดูได้อย่างเดียว"
          : role === "reviewer"
            ? "อ่านใบเสนอราคากับข้อเสนอโครงการก่อน แล้วส่งต่อให้ผู้อนุมัติ ทุก workspace ในบริษัท เปิดดูได้อย่างเดียว"
            : "workspace ของคุณจะส่งเอกสารให้ผู้อนุมัติของบริษัทได้"
      : kind === "org"
        ? role === "admin" ? "จัดการสมาชิกและทุกโปรเจกต์ได้" : "ทำงานกับทุกโปรเจกต์ใน workspace ได้"
        : elevated ? "แก้ไขและสร้างร่วมกันได้" : "เปิดดูได้อย่างเดียว";
  const RoleIcon = kind === "company" ? Building2 : kind === "org" ? Users : elevated ? Pencil : Eye;
  const eyebrow = alreadyIn
    ? "คุณอยู่ในบริษัทนี้แล้ว"
    : kind === "company" ? "คำเชิญเข้าร่วมบริษัท" : kind === "org" ? "คำเชิญเข้าร่วม workspace" : "คำเชิญเข้าร่วมโปรเจกต์";
  const home = alreadyIn ? companyHome(role as CompanyRole) : null;

  return (
    <main className="grid min-h-screen place-items-center bg-night px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 flex w-fit items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
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
                {invalidHint}
              </p>
              <Link
                href={invalidAction.href}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-chalk/15 bg-chalk/[0.03] py-3 font-display text-sm font-medium text-chalk transition hover:border-chalk/30 hover:bg-chalk/[0.06]"
              >
                {invalidAction.label}
              </Link>
            </>
          ) : (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-shine/10 text-shine">
                {kind === "company" ? <Building2 size={22} /> : <Users size={22} />}
              </span>
              <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-shine">
                {eyebrow}
              </p>
              <h1 className="mt-2 font-display text-xl font-semibold leading-snug text-chalk">
                {entityName}
              </h1>
              <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-night-edge bg-chalk/[0.03] px-3.5 py-1.5">
                <RoleIcon size={13} className="text-chalk-dim" />
                {/* The role never wraps mid-word; a long hint beside it does the wrapping. */}
                <span className="shrink-0 whitespace-nowrap text-xs text-chalk">
                  ในฐานะ<span className="font-semibold">{roleLabel}</span>
                </span>
                <span className="text-xs text-chalk-dim/70">· {roleHint}</span>
              </div>

              {home ? (
                <>
                  <p className="mt-6 text-sm leading-relaxed text-chalk-dim">
                    ลิงก์เชิญใช้ได้ครั้งเดียว ครั้งต่อไปเข้าหน้าที่ใช้งานได้เลย ไม่ต้องใช้ลิงก์เดิม
                  </p>
                  <Link
                    href={home.href}
                    className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shine py-3 font-display text-sm font-semibold text-night transition hover:brightness-110"
                  >
                    {home.label}
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </>
              ) : user ? (
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
