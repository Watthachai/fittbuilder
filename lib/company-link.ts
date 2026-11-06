import type { CompanyRole } from "./types";

/** Same order as fittbuilder_accept_company_link (migration 0066). */
const RANK: Record<CompanyRole, number> = { member: 1, reviewer: 2, approver: 3, admin: 4 };

/** The page a person of this company role works on. */
export function companyHome(role: CompanyRole): { href: string; label: string } {
  return role === "approver" || role === "reviewer"
    ? { href: "/approvals", label: "ไปหน้าอนุมัติเอกสาร" }
    : { href: "/company", label: "ไปหน้าบริษัท" };
}

/**
 * What a company link somebody has taken says to whoever opens it again.
 *
 * The link does not record who took it, and everyone on the company's email
 * domain is already staff, so being in the company proves nothing. Holding the
 * role it gives is the test: that person has nothing more to get from a link, and
 * a person without that role still needs one.
 */
export function spentLinkView(
  linkRole: CompanyRole,
  viewer: { signedIn: boolean; role: CompanyRole | null }
): "holds" | "sign-in" | "used" {
  if (!viewer.signedIn) return "sign-in";
  return viewer.role && RANK[viewer.role] >= RANK[linkRole] ? "holds" : "used";
}
