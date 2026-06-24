"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

interface Account {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/** Logged-in user chip + dropdown (avatar/name + sign out) for post-login headers. */
export default function AccountMenu() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    function apply(user: { email?: string; user_metadata?: Record<string, unknown> } | null) {
      if (cancelled) return;
      if (!user) {
        setAccount(null);
        return;
      }
      const meta = user.user_metadata ?? {};
      setAccount({
        email: user.email ?? "",
        name: (meta.full_name ?? meta.name ?? null) as string | null,
        avatarUrl: (meta.avatar_url ?? meta.picture ?? null) as string | null,
      });
    }

    // Initial read, then react to login/logout/token-refresh so the chip
    // appears or clears without a manual page refresh (e.g. signing in on
    // another tab while this page is already open).
    void supabase.auth.getUser().then(({ data: { user } }) => apply(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only clear on a real sign-out; transient null sessions from other
      // events must not wipe a chip that getUser() already validated.
      if (event === "SIGNED_OUT") apply(null);
      else if (session?.user) apply(session.user);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Admin flag (server-checked) — drives the badge + management link.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!account) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      try {
        const res = await fetch("/api/me");
        const data = res.ok ? ((await res.json()) as { isAdmin?: boolean }) : null;
        if (!cancelled) setIsAdmin(Boolean(data?.isAdmin));
      } catch {
        /* keep false */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account]);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!account) return null;

  const label = account.name ?? account.email;
  const initial = (account.email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-chalk/20 py-1 pl-1 pr-3 transition hover:border-chalk/40"
      >
        <Avatar avatarUrl={account.avatarUrl} initial={initial} />
        <span className="max-w-[10rem] truncate font-display text-sm text-chalk/80">{label}</span>
        {isAdmin && (
          <span className="rounded-full bg-shine/15 px-1.5 py-0.5 font-display text-[10px] font-semibold text-shine">
            Admin
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-chalk/15 bg-night-panel shadow-xl">
            <div className="flex items-center gap-3 border-b border-chalk/10 px-4 py-3">
              <Avatar avatarUrl={account.avatarUrl} initial={initial} />
              <div className="min-w-0">
                {account.name && (
                  <p className="truncate font-display text-sm text-chalk">{account.name}</p>
                )}
                <p className="truncate font-mono text-[11px] text-chalk/50">{account.email}</p>
              </div>
            </div>
            {isAdmin && (
              <Link
                href="/admin/skills"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 border-b border-chalk/10 px-4 py-2.5 text-left font-display text-sm text-chalk/70 transition hover:bg-chalk/5 hover:text-chalk"
              >
                <ShieldCheck size={14} className="text-shine" /> จัดการ Skill Templates
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin/usage"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 border-b border-chalk/10 px-4 py-2.5 text-left font-display text-sm text-chalk/70 transition hover:bg-chalk/5 hover:text-chalk"
              >
                <BarChart3 size={14} className="text-shine" /> รายงานการใช้ AI
              </Link>
            )}
            <div className="flex items-center justify-between gap-2 border-b border-chalk/10 px-4 py-2.5">
              <span className="font-display text-sm text-chalk/70">ธีม</span>
              <ThemeToggle />
            </div>
            <button
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-display text-sm text-chalk/70 transition hover:bg-chalk/5 hover:text-chalk disabled:opacity-50"
            >
              <LogOut size={14} />
              {signingOut ? "กำลังออก…" : "ออกจากระบบ"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ avatarUrl, initial }: { avatarUrl: string | null; initial: string }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-chalk/10 font-display text-xs font-semibold text-chalk/80">
      {initial}
    </span>
  );
}
