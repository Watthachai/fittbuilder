"use client";

import { currentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/client";
import type { Company, CompanyInvite, CompanyMember, CompanyRole } from "@/lib/types";

/**
 * The company a person works for, its people and its links (migration 0065).
 * Reads go through RLS (one's own company only); every write is a function
 * that checks the caller is the company's admin.
 */

export const COMPANY_ROLE_LABEL: Record<CompanyRole, string> = {
  admin: "ผู้ดูแลบริษัท",
  approver: "ผู้อนุมัติ",
  reviewer: "ผู้ตรวจ",
  member: "พนักงาน",
};

/** My company and my role in it, or null when I am in none. */
export async function myCompany(): Promise<{ company: Company; role: CompanyRole } | null> {
  const supabase = createClient();
  const me = (await currentUser())?.id;
  if (!me) return null;
  const { data: mine, error } = await supabase
    .from("fittbuilder_company_members")
    .select("company_id, role")
    .eq("user_id", me)
    .maybeSingle();
  if (error) throw error;
  if (!mine) return null;
  const { data: c, error: cErr } = await supabase
    .from("fittbuilder_companies")
    .select("id, name, email_domain")
    .eq("id", mine.company_id)
    .single();
  if (cErr) throw cErr;
  return {
    company: { id: c.id, name: c.name, emailDomain: c.email_domain },
    role: mine.role as CompanyRole,
  };
}

export async function listCompanyMembers(): Promise<CompanyMember[]> {
  const { data, error } = await createClient().rpc("fittbuilder_company_members_detailed");
  if (error) throw error;
  return (data ?? []).map((m) => ({
    userId: m.user_id,
    email: m.email ?? "",
    name: m.name,
    role: m.role as CompanyRole,
    createdAt: m.created_at,
  }));
}

export async function setCompanyRole(userId: string, role: CompanyRole): Promise<void> {
  const { error } = await createClient().rpc("fittbuilder_set_company_role", { target: userId, new_role: role });
  if (error) throw error;
}

export async function removeCompanyMember(userId: string): Promise<void> {
  const { error } = await createClient().rpc("fittbuilder_remove_company_member", { target: userId });
  if (error) throw error;
}

const toInvite = (i: { id: string; role: string; token: string; expires_at: string; created_at: string }): CompanyInvite => ({
  id: i.id,
  role: i.role as CompanyRole,
  token: i.token,
  expiresAt: i.expires_at,
  createdAt: i.created_at,
});

/** Links not yet taken, revoked or expired. Admins only (RLS). */
export async function listCompanyInvites(companyId: string): Promise<CompanyInvite[]> {
  const { data, error } = await createClient()
    .from("fittbuilder_company_invites")
    .select("id, role, token, expires_at, created_at")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(toInvite);
}

export async function createCompanyLink(role: CompanyRole): Promise<CompanyInvite> {
  const { data, error } = await createClient().rpc("fittbuilder_create_company_link", { r: role });
  if (error) throw error;
  return toInvite(data);
}

export async function revokeCompanyInvite(inviteId: string): Promise<void> {
  const { error } = await createClient().rpc("fittbuilder_revoke_company_invite", { iid: inviteId });
  if (error) throw error;
}

/** The message a function raised, in Thai, for the toast. */
export function companyErrorText(e: unknown): string | undefined {
  const message = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "";
  if (message.includes("the company needs an admin")) return "บริษัทต้องมีผู้ดูแลอย่างน้อย 1 คน";
  if (message.includes("cannot remove yourself")) return "เอาตัวเองออกจากบริษัทไม่ได้";
  if (message.includes("only a company admin")) return "เฉพาะผู้ดูแลบริษัทเท่านั้น";
  return message || undefined;
}
