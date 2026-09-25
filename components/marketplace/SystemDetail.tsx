"use client";

import Link from "next/link";
import { ArrowLeft, Check, Plus, PlayCircle, Store } from "lucide-react";
import { FAMILIES, MODULES, modulesOf } from "@/lib/modules/registry";
import type { ModuleFamily } from "@/lib/modules/types";
import ScopePanel from "./ScopePanel";
import { systemPrice, systemsNeededBy, useScope } from "./scope";

/** One system in full: every part, every capability, what it reads from and what it costs. */
export default function SystemDetail({ family }: { family: ModuleFamily }) {
  const scope = useScope();
  const system = FAMILIES.find((f) => f.id === family)!;
  const parts = modulesOf(family);
  const price = systemPrice(family);
  const needs = systemsNeededBy(family).map((f) => FAMILIES.find((x) => x.id === f)!);
  const neededBy = FAMILIES.filter((f) => f.id !== family && systemsNeededBy(f.id).includes(family));
  const inScope = scope.hasSystem(family);
  const others = FAMILIES.filter((f) => f.id !== family);

  return (
    <div className="min-h-screen bg-night">
      <header className="sticky top-0 z-30 border-b border-chalk/10 bg-night/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-4">
          <Link
            href="/marketplace"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-chalk/50 transition hover:bg-chalk/[0.05] hover:text-chalk"
          >
            <ArrowLeft size={14} />
            มาร์เก็ตเพลส
          </Link>
          <Store size={15} className="text-chalk/20" />
          <span className="truncate text-[12.5px] text-chalk/40">ระบบ{system.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_290px]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-[22px] font-semibold text-chalk">ระบบ{system.name}</h1>
                <p className="mt-0.5 text-[12.5px] text-chalk/45">
                  {parts.length} ส่วนประกอบ · {parts.reduce((n, m) => n + m.keyFeatures.length, 0)} ความสามารถ
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-[20px] font-semibold tabular-nums text-chalk">{price.days} วัน</p>
                <p className="text-[12px] tabular-nums text-chalk/45">ดูแล ฿{price.ma.toLocaleString("th-TH")}/เดือน</p>
              </div>
            </div>

            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-chalk/75">{system.blurb}</p>

            <div className="mt-5 flex gap-2">
              <Link
                href={`/erp?system=${family}`}
                className="flex items-center gap-1.5 rounded-lg border border-chalk/15 px-4 py-2.5 text-[13px] text-chalk/80 transition hover:border-shine/60 hover:text-shine"
              >
                <PlayCircle size={15} />
                ลองใช้ทั้งระบบ
              </Link>
              <button
                onClick={() => scope.addSystem(family)}
                disabled={inScope}
                className={
                  "flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-medium transition " +
                  (inScope ? "cursor-default bg-shine/15 text-shine" : "bg-shine text-night hover:brightness-110")
                }
              >
                {inScope ? <Check size={15} /> : <Plus size={15} />}
                {inScope ? "อยู่ในขอบเขตแล้ว" : "เพิ่มลงขอบเขต"}
              </button>
            </div>

            <section className="mt-8 space-y-3">
              <h2 className="font-display text-[14px] font-semibold text-chalk">ส่วนประกอบและความสามารถ</h2>
              <p className="-mt-2 text-[12.5px] text-chalk/45">
                แต่ละส่วนเป็นหน่วยที่ตั้งสิทธิ์ได้ กำหนดในระบบได้ว่าฝ่ายไหนเห็นส่วนใดบ้าง
              </p>
              {parts.map((m) => (
                <div key={m.id} className="overflow-hidden rounded-xl border border-chalk/12 bg-night-panel">
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-chalk">{m.name}</p>
                      <p className="mt-0.5 text-[12px] text-chalk/45">เทียบเท่า SAP {m.sapCode} · {m.pitch}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold tabular-nums text-chalk">{m.effortDays} วัน</p>
                      <p className="text-[11px] tabular-nums text-chalk/45">฿{m.maPerMonth.toLocaleString("th-TH")}/ด.</p>
                    </div>
                  </div>
                  <ol className="divide-y divide-chalk/8 border-t border-chalk/8">
                    {m.keyFeatures.map((f, i) => (
                      <li key={f} className="flex items-center gap-3 px-4 py-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded bg-chalk/[0.06] text-[10.5px] tabular-nums text-chalk/45">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-[12.5px] text-chalk/80">{f}</span>
                        <Link
                          href={`/erp/${m.id}/${i + 1}?system=${family}`}
                          className="shrink-0 text-[11.5px] text-chalk/35 transition hover:text-shine"
                        >
                          เปิดดู
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-chalk/12 bg-night-panel p-4">
                <h3 className="text-[13px] font-medium text-chalk">อ่านข้อมูลจากระบบ</h3>
                {needs.length === 0 ? (
                  <p className="mt-1 text-[12.5px] text-chalk/45">ระบบนี้ทำงานได้ด้วยตัวเอง ไม่ต้องมีระบบอื่นประกอบ</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {needs.map((f) => (
                      <li key={f.id}>
                        <Link href={`/marketplace/${f.id}`} className="text-[12.5px] text-chalk/70 transition hover:text-shine">
                          ระบบ{f.name}
                          <span className="ml-1.5 text-chalk/35">
                            ({[...new Set(parts.flatMap((m) => m.needs.filter((e) => MODULES.find((x) => x.provides.includes(e))?.family === f.id)))].join(" · ")})
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-chalk/12 bg-night-panel p-4">
                <h3 className="text-[13px] font-medium text-chalk">ระบบที่อ่านต่อจากระบบนี้</h3>
                {neededBy.length === 0 ? (
                  <p className="mt-1 text-[12.5px] text-chalk/45">ยังไม่มีระบบอื่นที่อ่านข้อมูลต่อจากระบบนี้</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {neededBy.map((f) => (
                      <li key={f.id}>
                        <Link href={`/marketplace/${f.id}`} className="text-[12.5px] text-chalk/70 transition hover:text-shine">
                          ระบบ{f.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h2 className="font-display text-[14px] font-semibold text-chalk">ระบบอื่น</h2>
              <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {others.map((f) => {
                  const p = systemPrice(f.id);
                  return (
                    <li key={f.id}>
                      <Link
                        href={`/marketplace/${f.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-chalk/12 bg-night-panel px-3.5 py-2.5 transition hover:border-chalk/25"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-chalk">ระบบ{f.name}</span>
                          <span className="block text-[11.5px] text-chalk/40">{modulesOf(f.id).length} ส่วนประกอบ</span>
                        </span>
                        <span className="shrink-0 text-[12.5px] tabular-nums text-chalk/50">{p.days} วัน</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {scope.ready && <ScopePanel chosen={scope.chosen} onRemoveSystem={scope.removeSystem} />}
        </div>
      </div>
    </div>
  );
}
