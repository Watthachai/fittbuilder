"use client";

import Link from "next/link";
import { ArrowLeft, Check, Plus, PlayCircle, Store } from "lucide-react";
import { FAMILIES, MODULES, getModule, modulesOf } from "@/lib/modules/registry";
import ScopePanel from "./ScopePanel";
import { useScope } from "./scope";

/** One listing in full: every capability it builds, what it reads, what it costs. */
export default function ModuleDetail({ id }: { id: string }) {
  const scope = useScope();
  const m = getModule(id);

  if (!m) {
    return (
      <div className="grid min-h-screen place-items-center bg-night px-5">
        <div className="text-center">
          <p className="font-display text-[15px] font-semibold text-chalk">ไม่มีโมดูลรหัส {id}</p>
          <Link href="/marketplace" className="mt-2 inline-block text-[13px] text-shine hover:underline">
            กลับไปมาร์เก็ตเพลส
          </Link>
        </div>
      </div>
    );
  }

  const family = FAMILIES.find((f) => f.id === m.family);
  const reads = m.needs.map((e) => MODULES.find((x) => x.provides.includes(e))).filter(Boolean);
  const readBy = MODULES.filter((x) => x.needs.some((e) => m.provides.includes(e)));
  const siblings = modulesOf(m.family).filter((x) => x.id !== m.id);
  const inScope = scope.has(m.id);

  return (
    <div className="min-h-screen bg-night">
      <header className="border-b border-chalk/10">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-4">
          <Link
            href="/marketplace"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-chalk/50 transition hover:bg-chalk/[0.05] hover:text-chalk"
          >
            <ArrowLeft size={14} />
            มาร์เก็ตเพลส
          </Link>
          <Store size={15} className="text-chalk/20" />
          <span className="truncate text-[12.5px] text-chalk/40">ระบบ{family?.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_290px]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-[22px] font-semibold text-chalk">{m.name}</h1>
                <p className="mt-0.5 text-[12.5px] text-chalk/45">
                  เทียบเท่า SAP {m.sapCode} · {m.tier === "base" ? "โมดูลฐาน" : "โมดูลเสริม"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-[20px] font-semibold tabular-nums text-chalk">
                  {m.effortDays} วัน
                </p>
                <p className="text-[12px] tabular-nums text-chalk/45">
                  ดูแล ฿{m.maPerMonth.toLocaleString("th-TH")}/เดือน
                </p>
              </div>
            </div>

            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-chalk/75">{m.pitch}</p>

            <div className="mt-5 flex gap-2">
              <Link
                href={`/erp/${m.id}?only=${m.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-chalk/15 px-4 py-2.5 text-[13px] text-chalk/80 transition hover:border-shine/60 hover:text-shine"
              >
                <PlayCircle size={15} />
                ลองใช้ของจริง
              </Link>
              <button
                onClick={() => scope.add(m)}
                disabled={inScope}
                className={
                  "flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-medium transition " +
                  (inScope
                    ? "cursor-default bg-shine/15 text-shine"
                    : "bg-shine text-night hover:brightness-110")
                }
              >
                {inScope ? <Check size={15} /> : <Plus size={15} />}
                {inScope ? "อยู่ในขอบเขตแล้ว" : "เพิ่มลงขอบเขต"}
              </button>
            </div>

            <section className="mt-8">
              <h2 className="font-display text-[14px] font-semibold text-chalk">ความสามารถที่ได้</h2>
              <p className="text-[12.5px] text-chalk/45">
                ครบทุกข้อตามโมดูล SAP ที่ตั้งชื่อตาม — แต่ละข้อเป็นหน้าของตัวเองในระบบ
              </p>
              <ol className="mt-3 divide-y divide-chalk/10 overflow-hidden rounded-xl border border-chalk/12 bg-night-panel">
                {m.keyFeatures.map((f, i) => (
                  <li key={f} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-chalk/[0.06] text-[11.5px] tabular-nums text-chalk/45">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] text-chalk/85">{f}</span>
                    <Link
                      href={`/erp/${m.id}/${i + 1}?only=${m.id}`}
                      className="shrink-0 text-[12px] text-chalk/35 transition hover:text-shine"
                    >
                      เปิดดู
                    </Link>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-chalk/12 bg-night-panel p-4">
                <h3 className="text-[13px] font-medium text-chalk">อ่านข้อมูลจาก</h3>
                {reads.length === 0 ? (
                  <p className="mt-1 text-[12.5px] text-chalk/45">
                    ไม่ต้องพึ่งโมดูลอื่น ซื้อแยกเดี่ยวได้
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {reads.map((r) => (
                      <li key={r!.id}>
                        <Link
                          href={`/marketplace/${r!.id}`}
                          className="text-[12.5px] text-chalk/70 transition hover:text-shine"
                        >
                          {r!.name}
                          <span className="ml-1.5 text-chalk/35">
                            ({m.needs.filter((e) => r!.provides.includes(e)).join(" · ")})
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-chalk/12 bg-night-panel p-4">
                <h3 className="text-[13px] font-medium text-chalk">โมดูลที่อ่านต่อจากตัวนี้</h3>
                {readBy.length === 0 ? (
                  <p className="mt-1 text-[12.5px] text-chalk/45">ยังไม่มีโมดูลไหนอ่านต่อ</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {readBy.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/marketplace/${r.id}`}
                          className="text-[12.5px] text-chalk/70 transition hover:text-shine"
                        >
                          {r.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h2 className="font-display text-[14px] font-semibold text-chalk">
                ส่วนอื่นของระบบ{family?.name}
              </h2>
              <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/marketplace/${s.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-chalk/12 bg-night-panel px-3.5 py-2.5 transition hover:border-chalk/25"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-chalk">{s.name}</span>
                        <span className="block text-[11.5px] text-chalk/40">
                          {s.keyFeatures.length} ความสามารถ
                        </span>
                      </span>
                      <span className="shrink-0 text-[12.5px] tabular-nums text-chalk/50">
                        {s.effortDays} วัน
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {scope.ready && <ScopePanel chosen={scope.chosen} onRemove={scope.remove} />}
        </div>
      </div>
    </div>
  );
}
