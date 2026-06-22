"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Account {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/** Logged-in user chip + dropdown (avatar/name + sign out) for post-login headers. */
export default function AccountMenu() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

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
        className="inline-flex items-center gap-2 rounded-full border border-white/20 py-1 pl-1 pr-3 transition hover:border-white/40"
      >
        <Avatar avatarUrl={account.avatarUrl} initial={initial} />
        <span className="max-w-[10rem] truncate font-display text-sm text-white/80">{label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-white/15 bg-night-panel shadow-xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Avatar avatarUrl={account.avatarUrl} initial={initial} />
              <div className="min-w-0">
                {account.name && (
                  <p className="truncate font-display text-sm text-white">{account.name}</p>
                )}
                <p className="truncate font-mono text-[11px] text-white/50">{account.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-display text-sm text-white/70 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
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
    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 font-display text-xs font-semibold text-white/80">
      {initial}
    </span>
  );
}
