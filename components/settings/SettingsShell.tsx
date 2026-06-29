"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Loader2, Plus, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listOrgs } from "@/lib/orgs";
import { openCreateWorkspace } from "@/lib/workspace-modal";
import { WorkspaceIcon } from "@/lib/workspace-style";
import type { OrgRecord } from "@/lib/types";

interface Account {
  name: string | null;
  email: string;
  avatar: string | null;
}

/** Shared chrome for the account/settings pages (Org DNA, Skill Templates, AI
 *  usage): a left sidebar with the user's profile + section nav, so the pages feel
 *  like one place instead of three disconnected screens. */
export default function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orgs, setOrgs] = useState<OrgRecord[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      const meta = user.user_metadata ?? {};
      setAccount({
        name: (meta.full_name ?? meta.name ?? null) as string | null,
        email: user.email ?? "",
        avatar: (meta.avatar_url ?? meta.picture ?? null) as string | null,
      });
    });
    void listOrgs()
      .then((list) => {
        if (!cancelled) setOrgs(list);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
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
    setOrgs((prev) => [...(prev ?? []), org]);
    router.push(`/org/${org.id}`);
  };

  const initial = (account?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="flex h-screen bg-night text-chalk">
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-night-edge px-3 py-5">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 font-display text-base font-semibold tracking-tight text-chalk"
        >
          FITT <span className="text-shine">Builder</span>
        </Link>

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
              <p className="truncate font-mono text-[10px] text-chalk-dim">{account.email}</p>
            )}
          </div>
        </div>

        <nav className="mt-5 flex-1 overflow-y-auto">
          <p className="px-3 pb-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-chalk-dim/60">
            Workspaces · Org DNA
          </p>
          <div className="space-y-1">
            {orgs === null ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-chalk-dim">
                <Loader2 size={14} className="animate-spin" /> กำลังโหลด…
              </div>
            ) : orgs.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-chalk-dim">ยังไม่มี workspace</p>
            ) : (
              orgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/org/${o.id}`}
                  className={navClass(pathname === `/org/${o.id}`)}
                >
                  <WorkspaceIcon
                    icon={o.icon}
                    size={15}
                    className="shrink-0"
                    style={{ color: o.color }}
                  />
                  <span className="truncate">{o.name}</span>
                </Link>
              ))
            )}
            <button onClick={() => void onCreate()} className={navClass(false)}>
              <Plus size={15} className="shrink-0" /> สร้าง workspace ใหม่
            </button>
          </div>

          {isAdmin && (
            <>
              <p className="mt-5 px-3 pb-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-chalk-dim/60">
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
    active ? "bg-chalk/10 font-medium text-chalk" : "text-chalk-dim hover:bg-chalk/5 hover:text-chalk"
  }`;
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
