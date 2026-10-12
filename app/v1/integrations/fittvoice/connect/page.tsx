import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AUTHORIZE_FIELDS, CONNECTION_IDLE_DAYS, checkAuthorizeRequest } from "@/lib/fittvoice/connect";
import { getClient, workspacesOf } from "@/lib/fittvoice/connection-store";
import ConnectForm from "./ConnectForm";

export const metadata = { title: "เชื่อมบัญชีกับ FITT Voice" };

/**
 * The consent page of a FITT Voice account connection (OAuth 2.0 authorization
 * endpoint, lib/fittvoice/connect.ts). FITT Voice sends its user here; they
 * sign in to Builder as usual, choose one workspace and allow or decline, and
 * go back to FITT Voice's redirect URI with a code or an error.
 *
 * A request whose client or redirect URI cannot be trusted stops on this page.
 * /v1/integrations is outside the login wall (lib/supabase/middleware.ts), so
 * the sign-in step is offered here, with the whole request carried in `next`.
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, one);
  }
  const client = await getClient(params.get("client_id") ?? "");
  const check = checkAuthorizeRequest(params, client);
  // What stops on this page; anything else wrong goes back to the client.
  const problem = check.ok ? null : check.redirect === null ? check.message : redirect(check.redirect);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: React.ReactNode;
  if (problem !== null || !client) {
    body = (
      <>
        <h1 className="font-display text-lg font-semibold text-chalk">เปิดลิงก์เชื่อมบัญชีไม่ได้</h1>
        <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
          {problem} — กลับไปที่ FITT Voice แล้วกดเชื่อมบัญชีอีกครั้ง
        </p>
      </>
    );
  } else {
    const fields = Object.fromEntries(AUTHORIZE_FIELDS.map((k) => [k, params.get(k) ?? ""]));
    const next = `/v1/integrations/fittvoice/connect?${params.toString()}`;
    const workspaces = user ? await workspacesOf(user.id) : [];
    body = (
      <>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-shine/10 text-shine">
          <Link2 size={22} />
        </span>
        <h1 className="mt-5 font-display text-xl font-semibold leading-snug text-chalk">
          {client.name} ขอเชื่อมกับบัญชี FITT Builder ของคุณ
        </h1>
        <ul className="mt-4 space-y-1.5 text-left text-[13px] leading-relaxed text-chalk-dim">
          <li>• ส่งบทสรุปที่คุณตรวจแล้วเข้ามาเป็นโปรเจกต์ในเฟส Define ของ workspace ที่เลือก และอัปเดตโปรเจกต์ที่ส่งมาเอง</li>
          <li>• เห็นอีเมลของคุณ ชื่อ workspace และบทบาทของคุณใน workspace นั้น</li>
          <li>• เปิดหรือแก้โปรเจกต์อื่นไม่ได้</li>
          <li>
            • ถอนได้ทุกเมื่อที่หน้า workspace ใน FITT Builder และหมดอายุเองเมื่อไม่ได้ใช้ {CONNECTION_IDLE_DAYS} วัน
          </li>
        </ul>
        {!user ? (
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shine py-3 font-display text-sm font-semibold text-night transition hover:brightness-110"
          >
            เข้าสู่ระบบ FITT Builder เพื่อเชื่อม
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <>
            <p className="mt-5 text-xs text-chalk-dim">เข้าสู่ระบบเป็น {user.email}</p>
            <ConnectForm fields={fields} workspaces={workspaces} clientName={client.name} />
          </>
        )}
      </>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-night px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-8 flex w-fit items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="font-display text-base font-semibold tracking-tight text-chalk">FITT Builder</span>
        </div>
        <div className="rounded-2xl border border-night-edge bg-night-panel px-8 py-9 text-center">{body}</div>
      </div>
    </main>
  );
}
