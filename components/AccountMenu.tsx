"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, LogOut, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDismiss } from "@/lib/useDismiss";
import { THEME_OPTIONS, useTheme } from "@/lib/useTheme";

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
  const [theme, setTheme] = useTheme();

  useDismiss(open, () => setOpen(false));

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

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:items-start md:justify-end md:p-3"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                className="glass max-h-[90vh] w-[min(92vw,22rem)] overflow-y-auto rounded-2xl p-4 shadow-2xl md:mr-2 md:mt-14"
              >
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-semibold tracking-tight text-chalk">
                FITT Builder
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                className="text-chalk-dim transition hover:text-chalk"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <Avatar avatarUrl={account.avatarUrl} initial={initial} big />
              <div className="min-w-0">
                {account.name && (
                  <p className="truncate font-display text-base font-semibold text-chalk">
                    {account.name}
                  </p>
                )}
                <p className="truncate font-mono text-xs text-chalk/50">
                  {account.email}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-chalk/50">
                ธีม
              </p>
              <div className="flex gap-1 rounded-full border border-chalk/15 p-1">
                {THEME_OPTIONS.map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    aria-pressed={theme === key}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 font-display text-xs transition ${
                      theme === key
                        ? "bg-shine text-night"
                        : "text-chalk-dim hover:bg-chalk/5 hover:text-chalk"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {isAdmin && (
                <Link
                  href="/admin/skills"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-chalk/15 py-2.5 font-display text-sm text-chalk/85 transition hover:bg-chalk/5 hover:text-chalk"
                >
                  <ShieldCheck size={15} className="text-shine" /> จัดการ Skill
                  Templates
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin/usage"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-chalk/15 py-2.5 font-display text-sm text-chalk/85 transition hover:bg-chalk/5 hover:text-chalk"
                >
                  <BarChart3 size={15} className="text-shine" /> รายงานการใช้ AI
                </Link>
              )}
              <button
                onClick={signOut}
                disabled={signingOut}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-chalk/15 py-2.5 font-display text-sm text-chalk/85 transition hover:bg-chalk/5 hover:text-chalk disabled:opacity-50"
              >
                <LogOut size={15} />
                {signingOut ? "กำลังออก…" : "ออกจากระบบ"}
              </button>
            </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function Avatar({
  avatarUrl,
  initial,
  big = false,
}: {
  avatarUrl: string | null;
  initial: string;
  big?: boolean;
}) {
  const size = big ? "h-14 w-14 text-lg" : "h-7 w-7 text-xs";
  if (avatarUrl) {
    // Google (lh3.googleusercontent.com) rejects requests carrying a Referer
    // header, so the image 403s without referrerPolicy="no-referrer".
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-full bg-chalk/10 font-display font-semibold text-chalk/80`}
    >
      {initial}
    </span>
  );
}
