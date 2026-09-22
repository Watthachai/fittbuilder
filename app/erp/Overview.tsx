"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FAMILIES, MODULES, modulesOf } from "@/lib/modules/registry";
import { readSession } from "./session";
import type { Role } from "./session";

/** Where a signed-in account lands: what it can open, and what it cannot. */
export default function Overview() {
  const [role, setRole] = useState<Role | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(readSession());
    setReady(true);
  }, []);

  if (!ready || !role) return null;

  const closed = MODULES.filter((m) => !role.families.includes(m.family));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-900">สวัสดี {role.name}</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        บัญชี{role.title} เปิดใช้งานได้ {MODULES.length - closed.length} จาก {MODULES.length} โมดูล
      </p>

      {FAMILIES.filter((f) => role.families.includes(f.id)).map((family) => (
        <section key={family.id} className="mt-6">
          <h2 className="text-[13.5px] font-semibold text-slate-900">{family.name}</h2>
          <p className="text-[12.5px] text-slate-500">{family.blurb}</p>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {modulesOf(family.id).map((m) => (
              <Link
                key={m.id}
                href={`/erp/${m.id}`}
                className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-400 hover:shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                    {m.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">SAP {m.sapCode}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-slate-500">{m.pitch}</p>
                <p className="mt-2 text-[11.5px] text-slate-400">
                  {m.keyFeatures.length} ความสามารถ · {m.keyFeatures.slice(0, 2).join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {closed.length > 0 && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-[13px] font-medium text-slate-900">โมดูลที่สิทธิ์นี้ไม่ครอบคลุม</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            ออกจากระบบแล้วเข้าใหม่ด้วยฝ่ายอื่นเพื่อดูว่าสิทธิ์นั้นเห็นอะไร
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {closed.map((m) => (
              <li key={m.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-500">
                {m.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
