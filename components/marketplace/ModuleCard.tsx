"use client";

import Link from "next/link";
import { Check, Plus, PlayCircle } from "lucide-react";
import { FAMILIES, MODULES } from "@/lib/modules/registry";
import type { Module } from "@/lib/modules/types";

/**
 * A module as something on a shelf: what it does, what it costs, what it needs
 * from the shelf next to it, and two ways to act on it — try it, or take it.
 *
 * The price sits with the capability list on purpose. A buyer comparing two
 * modules is comparing what they get for the days, and splitting those apart is
 * how a catalogue ends up reading like a brochure.
 */
export default function ModuleCard({
  module: m,
  inScope,
  onAdd,
}: {
  module: Module;
  inScope: boolean;
  onAdd: () => void;
}) {
  const reads = m.needs
    .map((e) => MODULES.find((x) => x.provides.includes(e))?.name)
    .filter(Boolean) as string[];

  return (
    <article
      className={
        "flex flex-col rounded-2xl border p-4 transition " +
        (inScope ? "border-shine/50 bg-shine/[0.04]" : "border-chalk/12 bg-night-panel hover:border-chalk/25")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/marketplace/${m.id}`}
            className="font-display text-[15px] font-semibold text-chalk transition hover:text-shine"
          >
            {m.name}
          </Link>
          <p className="mt-0.5 text-[11.5px] text-chalk/40">
            ส่วนหนึ่งของระบบ{FAMILIES.find((f) => f.id === m.family)?.name} · เทียบเท่า SAP {m.sapCode} · {m.keyFeatures.length} ความสามารถ
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[15px] font-semibold tabular-nums text-chalk">
            {m.effortDays} วัน
          </p>
          <p className="text-[11.5px] tabular-nums text-chalk/45">
            ฿{m.maPerMonth.toLocaleString("th-TH")}/ด.
          </p>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-3 text-[12.5px] leading-relaxed text-chalk/65">{m.pitch}</p>

      <ul className="mt-3 flex flex-wrap gap-1">
        {m.keyFeatures.map((f) => (
          <li key={f} className="rounded-full bg-chalk/[0.06] px-2 py-0.5 text-[11px] text-chalk/60">
            {f}
          </li>
        ))}
      </ul>

      {reads.length > 0 && (
        <p className="mt-2.5 text-[11.5px] text-chalk/40">ต้องมี {reads.join(" · ")} อยู่ด้วย</p>
      )}

      <div className="mt-4 flex gap-2 border-t border-chalk/10 pt-3">
        <Link
          href={`/erp/${m.id}?only=${m.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-chalk/15 py-2 text-[12.5px] text-chalk/75 transition hover:border-shine/60 hover:text-shine"
        >
          <PlayCircle size={14} />
          ลองใช้
        </Link>
        <button
          onClick={onAdd}
          disabled={inScope}
          className={
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium transition " +
            (inScope
              ? "cursor-default bg-shine/15 text-shine"
              : "bg-shine text-night hover:brightness-110")
          }
        >
          {inScope ? <Check size={14} /> : <Plus size={14} />}
          {inScope ? "อยู่ในขอบเขตแล้ว" : "เพิ่มลงขอบเขต"}
        </button>
      </div>
    </article>
  );
}
