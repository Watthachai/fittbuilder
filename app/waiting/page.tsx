import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import SwitchAccount from "./SwitchAccount";

export const metadata = { title: "ยังไม่ได้รับสิทธิ์ใช้งาน" };

/**
 * Where the proxy sends a signed-in account that is neither on the team nor a
 * partner (migration 0061).
 *
 * The likeliest reader is a partner or a colleague who signed in with a
 * different email from the one we know, so the page leads with the address they
 * are on and the way back to the sign-in screen. An account that is let in has
 * nothing to wait for and goes home.
 */
export default async function WaitingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isAdminEmail(user.email)) redirect("/");
  const { data: allowed, error } = await supabase.rpc("fittbuilder_has_access");
  if (error) throw new Error(`access check failed: ${error.message}`);
  if (allowed) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-night px-6 py-10 text-chalk">
      <div className="w-full max-w-md">
        <div className="inline-flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="font-display text-base font-semibold tracking-tight text-chalk">FITT Builder</span>
        </div>

        <h1
          className="mt-10 text-chalk"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(30px, 5vw, 42px)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
          FITT Builder เปิดให้ใช้เฉพาะทีมงาน FITT และ Partner ตอนนี้คุณเข้าสู่ระบบด้วย
        </p>
        <p className="mt-2 break-all rounded-xl border border-chalk/15 bg-chalk/[0.03] px-4 py-3 font-mono text-sm text-chalk">
          {user.email}
        </p>

        <ul className="mt-6 space-y-3 text-[14px] leading-relaxed text-chalk-dim">
          <li>
            <span className="text-chalk">เป็น Partner แล้ว?</span> เข้าสู่ระบบด้วยอีเมลที่ได้รับอีเมลแจ้งสิทธิ์ Partner
            ไม่ใช่อีเมลนี้
          </li>
          <li>
            <span className="text-chalk">เป็นทีมงาน FITT?</span> เข้าสู่ระบบด้วยอีเมลบริษัท
          </li>
          <li>
            <span className="text-chalk">ยังไม่ได้เป็น Partner?</span> ส่งคำขอได้ที่หน้าสมัคร เราจะติดต่อกลับภายใน 2 วันทำการ
          </li>
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <SwitchAccount />
          <Link
            href="/partner#apply"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-chalk/15 py-3 font-display text-sm font-medium text-chalk transition hover:border-chalk/30 hover:bg-chalk/[0.06]"
          >
            สมัครเป็น Partner
          </Link>
        </div>
      </div>
    </main>
  );
}
