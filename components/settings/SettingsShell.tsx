"use client";

import AppVersion from "@/components/AppVersion";
import { useApprovalInbox } from "@/components/approvals/ApprovalInbox";
import CaseBell from "@/components/cases/CaseBell";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, BarChart3, Building2, ChevronRight, Handshake, LifeBuoy, Loader2, Plus, ShieldCheck } from "lucide-react";
import CompanyTag from "@/components/company/CompanyTag";
import { listCompanyMembers, myCompany } from "@/lib/company";
import { currentUser } from "@/lib/current-user";
import { listWorkspaces, type Workspaces } from "@/lib/orgs";
import { openCreateWorkspace } from "@/lib/workspace-modal";
import { WorkspaceIcon } from "@/lib/workspace-style";
import type { Company, CompanyRole, OrgRecord } from "@/lib/types";

interface Account {
  name: string | null;
  email: string;
  avatar: string | null;
}

/** Shared chrome for the account/settings pages (Org DNA, cases, Skill Templates,
 *  AI usage): a left sidebar with the user's profile + section nav, so the pages
 *  feel like one place instead of disconnected screens. */
export default function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { waiting: waitingDocs } = useApprovalInbox();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspaces | null>(null);
  // undefined while loading; null when I am in no company.
  const [company, setCompany] = useState<{ company: Company; role: CompanyRole } | null | undefined>(undefined);
  const [ownerNames, setOwnerNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [openOwners, setOpenOwners] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void currentUser().then((user) => {
      if (cancelled || !user) return;
      setAccount({
        name: user.name,
        email: user.email ?? "",
        avatar: user.avatar,
      });
    });
    void listWorkspaces()
      .then((found) => {
        if (!cancelled) setWorkspaces(found);
      })
      .catch((e) => {
        console.error("[settings] workspaces failed:", e);
        if (!cancelled) setWorkspaces({ mine: [], joined: [], company: [] });
      });
    void myCompany()
      .then(async (mine) => {
        if (cancelled) return;
        setCompany(mine);
        if (!mine) return;
        // Whose each company workspace is: they are all the company's people.
        const people = await listCompanyMembers();
        if (!cancelled) setOwnerNames(new Map(people.map((p) => [p.userId, p.name || p.email])));
      })
      .catch((e) => {
        console.error("[settings] company failed:", e);
        if (!cancelled) setCompany(null);
      });
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { isAdmin?: boolean } | null) => {
        if (!cancelled) setIsAdmin(Boolean(d?.isAdmin));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = async () => {
    const org = await openCreateWorkspace();
    if (!org) return;
    setWorkspaces((prev) => (prev ? { ...prev, mine: [...prev.mine, org] } : prev));
    router.push(`/org/${org.id}`);
  };

  const initial = (account?.email || "?").charAt(0).toUpperCase();

  // The company's workspaces, one folder per person who created them.
  const companyGroups = useMemo(() => {
    const byOwner = new Map<string, OrgRecord[]>();
    for (const o of workspaces?.company ?? []) byOwner.set(o.ownerId, [...(byOwner.get(o.ownerId) ?? []), o]);
    return [...byOwner]
      .map(([ownerId, orgs]) => ({ ownerId, name: ownerNames.get(ownerId) ?? "ไม่ทราบชื่อ", orgs }))
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [workspaces, ownerNames]);
  // The folder of the workspace on screen stays open.
  const activeOwner = workspaces?.company.find((o) => pathname === `/org/${o.id}`)?.ownerId;
  const toggleOwner = (ownerId: string) =>
    setOpenOwners((prev) => {
      const next = new Set(prev);
      if (!next.delete(ownerId)) next.add(ownerId);
      return next;
    });
  const worksSomewhere = workspaces !== null && workspaces.mine.length + workspaces.joined.length > 0;

  return (
    <div className="flex h-screen bg-night text-chalk">
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-night-edge px-3 py-5">
        <div className="flex items-baseline gap-2 px-2">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-chalk"
          >
            FITT <span className="text-shine">Builder</span>
          </Link>
          <AppVersion />
          <div className="ml-auto self-center">
            <CaseBell align="left" />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-night-edge bg-night-panel px-3 py-2.5">
          {account?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={account.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chalk/10 font-display text-sm font-semibold text-chalk/80">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-medium text-chalk">
              {account?.name ?? account?.email ?? "ผู้ใช้"}
            </p>
            {account?.name && (
              <p className="truncate font-mono text-[0.625rem] text-chalk-dim">{account.email}</p>
            )}
          </div>
        </div>

        {company !== undefined && <CompanyTag mine={company} className="mt-2" />}

        <nav className="mt-5 flex-1 overflow-y-auto">
          <SectionHead>Workspace ของฉัน · Org DNA</SectionHead>
          <div className="space-y-1">
            {workspaces === null ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-chalk-dim">
                <Loader2 size={14} className="animate-spin" /> กำลังโหลด…
              </div>
            ) : workspaces.mine.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-chalk-dim">ยังไม่มี workspace</p>
            ) : (
              workspaces.mine.map((o) => <WorkspaceLink key={o.id} org={o} active={pathname === `/org/${o.id}`} />)
            )}
            <button onClick={() => void onCreate()} className={navClass(false)}>
              <Plus size={15} className="shrink-0" /> สร้าง workspace ใหม่
            </button>
          </div>

          {workspaces !== null && workspaces.joined.length > 0 && (
            <>
              <SectionHead className="mt-5">ที่ร่วมทำงาน</SectionHead>
              <div className="space-y-1">
                {workspaces.joined.map((o) => (
                  <WorkspaceLink key={o.id} org={o} active={pathname === `/org/${o.id}`} />
                ))}
              </div>
            </>
          )}

          {company && companyGroups.length > 0 && (
            <>
              <SectionHead className="mt-5">{company.company.name} · ดูอย่างเดียว</SectionHead>
              <div className="space-y-0.5">
                {companyGroups.map((g) => {
                  const open = openOwners.has(g.ownerId) || g.ownerId === activeOwner;
                  return (
                    <div key={g.ownerId}>
                      <button
                        onClick={() => toggleOwner(g.ownerId)}
                        aria-expanded={open}
                        className={navClass(false)}
                        title={`workspace ที่ ${g.name} สร้าง`}
                      >
                        <ChevronRight size={14} className={`shrink-0 transition ${open ? "rotate-90" : ""}`} />
                        <span className="min-w-0 flex-1 truncate">{g.name}</span>
                        <span className="shrink-0 rounded-full bg-chalk/10 px-1.5 font-mono text-[0.625rem]">
                          {g.orgs.length}
                        </span>
                      </button>
                      {open && (
                        <div className="ml-4 space-y-0.5 border-l border-night-edge pl-1">
                          {g.orgs.map((o) => (
                            <WorkspaceLink key={o.id} org={o} active={pathname === `/org/${o.id}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {(worksSomewhere || company) && (
            <>
              <SectionHead className="mt-5">เอกสาร</SectionHead>
              <div className="space-y-1">
                <NavLink
                  href="/approvals"
                  active={pathname === "/approvals"}
                  icon={<BadgeCheck size={15} className="shrink-0" />}
                >
                  <span className="min-w-0 flex-1">อนุมัติเอกสาร</span>
                  {waitingDocs > 0 && (
                    <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-red-600 px-1 text-[0.625rem] font-semibold text-white">
                      {waitingDocs}
                    </span>
                  )}
                </NavLink>
                {company && (
                  <NavLink
                    href="/company"
                    active={pathname === "/company"}
                    icon={<Building2 size={15} className="shrink-0" />}
                  >
                    บริษัทและผู้อนุมัติ
                  </NavLink>
                )}
              </div>
            </>
          )}

          <p className="mt-5 px-3 pb-1.5 font-display text-[0.6875rem] font-semibold uppercase tracking-wide text-chalk-dim/60">
            ช่วยเหลือ
          </p>
          <NavLink
            href="/cases"
            active={pathname === "/cases"}
            icon={<LifeBuoy size={15} className="shrink-0" />}
          >
            แจ้งเคส / ติดตามปัญหา
          </NavLink>

          {isAdmin && (
            <>
              <p className="mt-5 px-3 pb-1.5 font-display text-[0.6875rem] font-semibold uppercase tracking-wide text-chalk-dim/60">
                Admin
              </p>
              <div className="space-y-1">
                <NavLink
                  href="/admin/skills"
                  active={pathname === "/admin/skills"}
                  icon={<ShieldCheck size={15} className="shrink-0" />}
                >
                  จัดการ Skill Templates
                </NavLink>
                <NavLink
                  href="/admin/usage"
                  active={pathname === "/admin/usage"}
                  icon={<BarChart3 size={15} className="shrink-0" />}
                >
                  รายงานการใช้ AI
                </NavLink>
                <NavLink
                  href="/admin/partners"
                  active={pathname === "/admin/partners"}
                  icon={<Handshake size={15} className="shrink-0" />}
                >
                  คำขอเป็น Partner
                </NavLink>
              </div>
            </>
          )}
        </nav>

        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-sm text-chalk-dim transition hover:text-chalk"
        >
          <ArrowLeft size={15} /> กลับหน้าแรก
        </Link>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function navClass(active: boolean): string {
  return `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
    active
      ? "bg-chalk/10 font-medium text-chalk light:bg-selected light:text-selected-ink"
      : "text-chalk-dim hover:bg-chalk/5 hover:text-chalk"
  }`;
}

function SectionHead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`truncate px-3 pb-1.5 font-display text-[0.6875rem] font-semibold uppercase tracking-wide text-chalk-dim/60 ${className}`}
    >
      {children}
    </p>
  );
}

function WorkspaceLink({ org, active }: { org: OrgRecord; active: boolean }) {
  return (
    <Link href={`/org/${org.id}`} className={navClass(active)}>
      <WorkspaceIcon icon={org.icon} size={15} className="shrink-0" style={{ color: org.color }} />
      <span className="truncate">{org.name}</span>
    </Link>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={navClass(active)}>
      {icon}
      {children}
    </Link>
  );
}
