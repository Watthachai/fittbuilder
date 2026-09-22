"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FAMILIES, MODULES, modulesOf } from "@/lib/modules/registry";
import { ROLES, DEMO_PASSWORD_HINT, clearSession, readSession, writeSession } from "./session";
import type { Role } from "./session";
import TakeProject from "./TakeProject";

/**
 * The workspace a buyer walks into: sign in, then a sidebar of the modules that
 * role can open. Nothing is composed and nothing is generated — this is the
 * running system, and the same screens are what a project gets when it is built.
 */
export default function ErpShell({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | undefined>();
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setRole(readSession());
    setReady(true);
  }, []);

  // Nothing renders until the stored session has been read, or a signed-in
  // viewer would see the login form flash on every navigation.
  if (!ready) return <div className="min-h-screen bg-slate-100" />;

  if (!role) {
    return (
      <SignIn
        onSignIn={(r) => {
          writeSession(r.id);
          setRole(r);
        }}
      />
    );
  }

  const open = MODULES.filter((m) => role.families.includes(m.family));
  const current = MODULES.find((m) => pathname === `/erp/${m.id}`);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <Link href="/erp" className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-600 text-[13px] font-bold text-white">
            F
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-slate-900">
              บจก. ตัวอย่างอุตสาหกรรม
            </span>
            <span className="block text-[11.5px] text-slate-500">ระบบบริหารทรัพยากรองค์กร</span>
          </span>
        </Link>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {FAMILIES.filter((f) => role.families.includes(f.id)).map((family) => (
            <div key={family.id} className="mb-4">
              <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {family.name}
              </p>
              {modulesOf(family.id).map((m) => {
                const on = current?.id === m.id;
                return (
                  <Link
                    key={m.id}
                    href={`/erp/${m.id}`}
                    className={
                      "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] transition " +
                      (on
                        ? "bg-sky-50 font-medium text-sky-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
                    }
                  >
                    <span className="min-w-0 truncate">{m.name}</span>
                    <span className={"shrink-0 text-[10.5px] " + (on ? "text-sky-500" : "text-slate-300")}>
                      {m.sapCode}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 px-1">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 text-[12px] font-semibold text-slate-600">
              {role.name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-slate-900">{role.name}</span>
              <span className="block truncate text-[11.5px] text-slate-500">{role.title}</span>
            </span>
          </div>
          <button
            onClick={() => {
              clearSession();
              setRole(undefined);
              router.push("/erp");
            }}
            className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-[12px] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-slate-900">
              {current ? current.name : "ภาพรวมระบบ"}
            </p>
            <p className="truncate text-[11.5px] text-slate-500">
              {current ? `เทียบเท่า SAP ${current.sapCode}` : `${open.length} โมดูลที่เปิดให้ ${role.title}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TakeProject role={role} />
            <Link
              href="/"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-600 transition hover:border-sky-400 hover:text-sky-700"
            >
              กลับหน้า FITT Builder
            </Link>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

function SignIn({ onSignIn }: { onSignIn: (role: Role) => void }) {
  const [picked, setPicked] = useState(ROLES[0].id);
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const role = ROLES.find((r) => r.id === picked)!;

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-sky-600 text-base font-bold text-white">
            F
          </span>
          <h1 className="text-lg font-semibold text-slate-900">บจก. ตัวอย่างอุตสาหกรรม</h1>
          <p className="mt-0.5 text-sm text-slate-500">เข้าสู่ระบบบริหารทรัพยากรองค์กร</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (password.trim()) onSignIn(role);
          }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <label className="block text-xs font-medium text-slate-600">เข้าใช้งานในนาม</label>
          <div className="mt-1.5 space-y-1.5">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setPicked(r.id)}
                className={
                  "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition " +
                  (r.id === picked
                    ? "border-sky-500 bg-sky-50"
                    : "border-slate-200 hover:border-slate-300")
                }
              >
                <span
                  className={
                    "grid size-4 shrink-0 place-items-center rounded-full border " +
                    (r.id === picked ? "border-sky-600" : "border-slate-300")
                  }
                >
                  {r.id === picked && <span className="size-2 rounded-full bg-sky-600" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900">{r.title}</span>
                  <span className="block truncate text-[11.5px] text-slate-500">{r.email}</span>
                </span>
              </button>
            ))}
          </div>

          <label htmlFor="pw" className="mt-4 block text-xs font-medium text-slate-600">
            รหัสผ่าน
          </label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={DEMO_PASSWORD_HINT}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
          {tried && !password.trim() && (
            <p className="mt-1.5 text-[12px] text-rose-600">กรอกรหัสผ่านก่อนเข้าสู่ระบบ</p>
          )}

          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            เข้าสู่ระบบ
          </button>

          <p className="mt-3 text-center text-[11.5px] leading-snug text-slate-500">
            ระบบตัวอย่าง — เลือกฝ่ายเพื่อดูว่าสิทธิ์นั้นเปิดโมดูลอะไรได้บ้าง
          </p>
        </form>
      </div>
    </div>
  );
}
