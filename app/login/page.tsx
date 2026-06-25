"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Real example briefs from the product — shown "typing" in the showcase so the
// page previews what you'll actually do after signing in.
const EXAMPLES = [
  "Landing page ร้านกาแฟ สไตล์ minimal โทนครีม-น้ำตาล",
  "Dashboard ยอดขาย มี KPI cards และกราฟรายเดือน",
  "หน้าจองโต๊ะร้านอาหาร เลือกวัน เวลา จำนวนคน",
  "Kanban board ลาก task ระหว่างคอลัมน์ได้",
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ex, setEx] = useState(0);
  const supabase = createClient();
  const redirectTo =
    typeof window !== "undefined" ? `${location.origin}/auth/callback` : undefined;

  // Rotate the showcase prompt (skips when the user prefers reduced motion).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setEx((i) => (i + 1) % EXAMPLES.length), 3600);
    return () => clearInterval(id);
  }, []);

  async function google() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
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

      {/* ── Right: product showcase (prompt → live demo) ──────────────── */}
      <section className="bg-grid relative hidden overflow-hidden border-l border-night-edge bg-night-panel lg:block">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--shine), transparent 70%)" }}
        />

        <div className="relative flex h-full flex-col justify-center gap-6 px-12 xl:px-20">
          {/* The brief you'd type */}
          <div className="glass max-w-md rounded-2xl p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/60">
                FITT-001 · Demo Brief
              </span>
              <span className="font-mono text-[10px] text-chalk/40">Auto</span>
            </div>
            <p key={ex} className="tip-fade min-h-[3.25rem] text-[15px] leading-relaxed text-chalk">
              {EXAMPLES[ex]}
              <span className="caret-blink ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-shine align-middle" />
            </p>
            <div className="mt-4 flex justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-shine px-3.5 py-1.5 font-display text-xs font-semibold text-night">
                สร้างเลย <ArrowRight size={13} />
              </span>
            </div>
          </div>

          {/* …becomes a real running demo */}
          <div className="ml-10 max-w-md overflow-hidden rounded-2xl border border-night-edge bg-night shadow-2xl xl:ml-16">
            <div className="flex items-center gap-2 border-b border-night-edge bg-night-panel px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-halt/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-shine/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-go/70" />
              <span className="ml-2 flex items-center gap-1.5 font-mono text-[10px] text-chalk-dim">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-go" /> your-demo.fitt.app
              </span>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="h-2.5 w-16 rounded-full bg-chalk/20" />
                <span className="h-2.5 w-10 rounded-full bg-shine/60" />
              </div>
              <div className="h-4 w-3/4 rounded bg-chalk/25" />
              <div className="h-3 w-1/2 rounded bg-chalk/15" />
              <span className="inline-block rounded-md bg-shine px-3 py-1.5 text-[10px] font-semibold text-night">
                เริ่มเลย
              </span>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="h-12 rounded-lg bg-chalk/[0.06]" />
                <div className="h-12 rounded-lg bg-chalk/[0.06]" />
                <div className="h-12 rounded-lg bg-chalk/[0.06]" />
              </div>
            </div>
          </div>
        </div>
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
