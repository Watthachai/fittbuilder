"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Dna, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { firstOrg } from "@/lib/orgs";
import { openCreateWorkspace } from "@/lib/workspace-modal";

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
  const [orgBusy, setOrgBusy] = useState(false);

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

  const goOrgDna = async () => {
    setOrgBusy(true);
    try {
      let org = await firstOrg();
      if (!org) {
        org = await openCreateWorkspace();
        if (!org) {
          setOrgBusy(false);
          return;
        }
      }
      router.push(`/org/${org.id}`);
    } catch {
      setOrgBusy(false);
    }
  };

  const onOrg = pathname?.startsWith("/org/") ?? false;
  const initial = (account?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-night text-chalk">
      <aside className="flex w-60 shrink-0 flex-col border-r border-night-edge px-3 py-5">
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

        <nav className="mt-5 space-y-1">
          <button
            onClick={() => void goOrgDna()}
            disabled={orgBusy}
            className={navClass(onOrg)}
          >
            {orgBusy ? <Loader2 size={15} className="animate-spin" /> : <Dna size={15} />}
            Org DNA (workspace)
          </button>
          {isAdmin && (
            <NavLink href="/admin/skills" active={pathname === "/admin/skills"} icon={<ShieldCheck size={15} />}>
              จัดการ Skill Templates
            </NavLink>
          )}
          {isAdmin && (
            <NavLink href="/admin/usage" active={pathname === "/admin/usage"} icon={<BarChart3 size={15} />}>
              รายงานการใช้ AI
            </NavLink>
          )}
        </nav>

        <Link
          href="/"
          className="mt-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm text-chalk-dim transition hover:text-chalk"
        >
          <ArrowLeft size={15} /> กลับหน้าแรก
        </Link>
      </aside>

      <main className="min-h-screen min-w-0 flex-1 overflow-y-auto">{children}</main>
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
