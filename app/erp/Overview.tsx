"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { FAMILIES, MODULES, modulesOf } from "@/lib/modules/registry";
import { mayOpen, readSession } from "./session";
import type { Role } from "./session";

/**
 * Where a signed-in account lands: the systems it belongs to, each drawn whole,
 * with the parts this seat may open and the parts it may not. The locked parts
 * are drawn on purpose — a system is one thing, and a permission is a line
 * across it, not a smaller system.
 */
export default function Overview() {
  const [role, setRole] = useState<Role | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(readSession());
    setReady(true);
  }, []);

  if (!ready || !role) return null;

  const systems = FAMILIES.filter((f) => modulesOf(f.id).some((m) => mayOpen(role, m.id)));
  const openCount = MODULES.filter((m) => mayOpen(role, m.id)).length;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[20px] font-semibold text-slate-900 dark:text-slate-50">สวัสดี {role.name}</h1>
      <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
        บัญชี{role.title} เปิดได้ {openCount} จาก {MODULES.length} ส่วน ใน {systems.length} ระบบ
      </p>

      {systems.map((family) => {
        const parts = modulesOf(family.id);
        const mine = parts.filter((m) => mayOpen(role, m.id));
        return (
          <section key={family.id} className="mt-6">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">ระบบ{family.name}</h2>
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{family.blurb}</p>
              </div>
              <span className="shrink-0 text-[12px] text-slate-400 dark:text-slate-500">
                เปิดได้ {mine.length} จาก {parts.length} ส่วน
              </span>
            </div>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              {parts.map((m) => {
                const locked = !mayOpen(role, m.id);
                const body = (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={
                          "text-[14px] font-semibold " +
                          (locked ? "text-slate-400 dark:text-slate-600" : "text-slate-900 group-hover:text-violet-700 dark:text-slate-50")
                        }
                      >
                        {m.name}
                      </span>
                      {locked ? (
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400 dark:text-slate-600">
                          <Lock size={11} /> ไม่มีสิทธิ์
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-slate-400">{m.keyFeatures.length} ความสามารถ</span>
                      )}
                    </div>
                    <p
                      className={
                        "mt-1 line-clamp-2 text-[12.5px] leading-snug " +
                        (locked ? "text-slate-300 dark:text-slate-700" : "text-slate-500 dark:text-slate-400")
                      }
                    >
                      {m.pitch}
                    </p>
                  </>
                );
                return locked ? (
                  <div
                    key={m.id}
                    title={`บัญชี${role.title}ไม่มีสิทธิ์เปิด${m.name}`}
                    className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    {body}
                  </div>
                ) : (
                  <Link
                    key={m.id}
                    href={`/erp/${m.id}`}
                    className="group rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-violet-300 hover:shadow-md hover:shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-500/40"
                  >
                    {body}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
