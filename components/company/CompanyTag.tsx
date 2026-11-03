"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { COMPANY_ROLE_LABEL } from "@/lib/company";
import type { Company, CompanyRole } from "@/lib/types";

/**
 * Which company I am in and as what — or that I am in none. A company decides
 * whose documents I approve and whose workspaces I read, so it is always shown.
 */
export default function CompanyTag({
  mine,
  className = "",
}: {
  mine: { company: Company; role: CompanyRole } | null;
  className?: string;
}) {
  if (!mine) {
    return (
      <p
        className={`flex items-center gap-2 rounded-lg border border-dashed border-night-edge px-3 py-1.5 text-[0.75rem] text-chalk-dim ${className}`}
      >
        <Building2 size={13} className="shrink-0" /> ยังไม่อยู่ในบริษัท
      </p>
    );
  }
  return (
    <Link
      href="/company"
      title="บริษัทและผู้อนุมัติ"
      className={`flex items-center gap-2 rounded-lg border border-shine/30 bg-shine/5 px-3 py-1.5 text-[0.75rem] transition hover:border-shine/60 ${className}`}
    >
      <Building2 size={13} className="shrink-0 text-shine" />
      <span className="min-w-0 flex-1 truncate font-medium text-chalk">{mine.company.name}</span>
      <span className="shrink-0 text-chalk-dim">{COMPANY_ROLE_LABEL[mine.role]}</span>
    </Link>
  );
}
