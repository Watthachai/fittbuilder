"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LoginShowcase from "@/components/landing/LoginShowcase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  // BARE callback URL — no `?next=` query. A query makes the redirect URL fail
  // Supabase's allow-list match, which silently falls back to the Site URL and
  // sends every environment (localhost, UAT, …) to production. The bare path
  // matches the allow list exactly; `next` rides through the round-trip in a
  // short-lived same-site cookie the /auth/callback route reads instead.
  const redirectTo =
    typeof window !== "undefined" ? `${location.origin}/auth/callback` : undefined;

  /** Stash where to land after auth in a one-shot cookie the callback reads.
   *  Only same-origin paths (leading "/", not "//") — never an open redirect. */
  function stashNext() {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(location.search).get("next");
    const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `sb_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax${secure}`;
  }

  async function google() {
    setBusy(true);
    setError(null);
    stashNext();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // `prompt: select_account` forces Google's account chooser every time
      // instead of silently reusing the only/last signed-in account.
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setError("เปิด Google ไม่สำเร็จ ลองอีกครั้ง");
      setBusy(false);
    }
    // success → the browser is already navigating to Google; leave busy=true.
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    stashNext();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) setError("ส่งลิงก์ไม่สำเร็จ ลองอีกครั้ง");
    else setSent(true);
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* ── Left: brand + sign-in ─────────────────────────────────────── */}
      <section className="flex flex-col justify-between bg-night px-6 py-8 sm:px-10 lg:px-14">
        <Link href="/" className="inline-flex w-fit items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-chalk">
            <span className="h-2.5 w-2.5 rounded-full bg-chalk" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-chalk">
            FITT Builder
          </span>
        </Link>

        <div className="mx-auto w-full max-w-sm py-10">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-shine">
            FITT-001 · เข้าสู่ระบบ
          </p>
          <h1
            className="text-chalk"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(34px, 5vw, 50px)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            พิมพ์ไอเดีย
            <br />
            ได้<span className="text-shine">เว็บจริง</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
            เข้าสู่ระบบเพื่อเริ่มสร้าง demo ที่รันได้จริงในเบราว์เซอร์ — ไม่ต้องเขียนโค้ด
          </p>

          <div className="mt-8 space-y-4">
            <button
              onClick={google}
              disabled={busy}
              className="group flex w-full items-center justify-center gap-3 rounded-xl border border-chalk/15 bg-chalk/[0.03] py-3 font-display text-sm font-medium text-chalk transition hover:border-chalk/30 hover:bg-chalk/[0.06] disabled:opacity-50"
            >
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-chalk/30 border-t-chalk" />
              ) : (
                <GoogleMark />
              )}
              {busy ? "กำลังเปิด Google…" : "เข้าสู่ระบบด้วย Google"}
            </button>

            {sent ? (
              <div className="rounded-xl border border-go/30 bg-go/10 px-4 py-3 text-sm text-chalk">
                ส่งลิงก์เข้าสู่ระบบไปที่ <span className="font-medium">{email}</span> แล้ว — เช็คอีเมลได้เลย
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-chalk-dim/60">
                  <span className="h-px flex-1 bg-chalk/10" /> หรือ
                  <span className="h-px flex-1 bg-chalk/10" />
                </div>
                <form onSubmit={magicLink} className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-chalk/15 bg-chalk/[0.03] px-3.5 focus-within:border-shine">
                    <Mail size={16} className="shrink-0 text-chalk-dim" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full bg-transparent py-3 text-sm text-chalk outline-none placeholder:text-chalk-dim/50"
                    />
                  </div>
                  <button
                    disabled={busy}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shine py-3 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
                  >
                    ส่งลิงก์เข้าสู่ระบบ
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                </form>
              </>
            )}

            {error && <p className="text-sm text-halt">{error}</p>}
          </div>
        </div>

        <p className="font-mono text-[11px] text-chalk-dim/70">
          สร้าง demo แรกของคุณภายใน 60 วินาที — ฟรี
        </p>
      </section>

      {/* ── Right: self-running product showcase (drawn in code) ──────── */}
      <section className="relative hidden overflow-hidden border-l border-night-edge bg-night-panel lg:block">
        <LoginShowcase />
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.2 44 30.6 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
