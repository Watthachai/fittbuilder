"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = createClient();
  const redirectTo = typeof window !== "undefined" ? `${location.origin}/auth/callback` : undefined;

  async function google() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }
  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (!error) setSent(true);
  }

  return (
    <main className="min-h-screen grid place-items-center bg-night text-chalk p-6">
      <div className="glass stitch w-full max-w-sm space-y-6 rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">เข้าสู่ระบบ FITT Builder</h1>
        <button onClick={google} className="w-full rounded-lg border border-chalk/15 py-2.5 hover:bg-chalk/5">
          เข้าสู่ระบบด้วย Google
        </button>
        {sent ? (
          <p className="text-sm text-chalk/70">ส่งลิงก์เข้าสู่ระบบไปที่ {email} แล้ว เช็คอีเมลได้เลย</p>
        ) : (
          <form onSubmit={magicLink} className="space-y-3">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-lg bg-chalk/5 border border-chalk/15 px-3 py-2.5 outline-none focus:border-shine"
            />
            <button className="w-full rounded-lg bg-shine text-night font-medium py-2.5">
              ส่งลิงก์เข้าสู่ระบบ (magic link)
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
