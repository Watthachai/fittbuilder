"use client";

import Link from "next/link";
import { Check, ChevronRight, Plus, PlayCircle } from "lucide-react";
import { FAMILIES, modulesOf } from "@/lib/modules/registry";
import type { ModuleFamily } from "@/lib/modules/types";
import { systemPrice, systemsNeededBy } from "./scope";

/**
 * A system as one thing on the shelf.
 *
 * The parts are listed inside it with their own prices, because a buyer wants to
 * see what the number is made of — but the two actions act on the whole. Trying
 * the system opens all of it, and taking it takes all of it. Which people then
 * see which parts is a permission inside the system, not a purchasing decision.
 */
export default function SystemCard({
  family,
  inScope,
  onAdd,
}: {
  family: ModuleFamily;
  inScope: boolean;
  onAdd: () => void;
}) {
  const system = FAMILIES.find((f) => f.id === family)!;
  const parts = modulesOf(family);
  const price = systemPrice(family);
  const needs = systemsNeededBy(family).map((f) => FAMILIES.find((x) => x.id === f)!.name);
  const capabilities = parts.reduce((n, m) => n + m.keyFeatures.length, 0);

  return (
    <article
      className={
        "flex flex-col rounded-2xl border transition " +
        (inScope ? "border-shine/50 bg-shine/[0.04]" : "border-chalk/12 bg-night-panel hover:border-chalk/25")
      }
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-4">
        <div className="min-w-0">
          <Link
            href={`/marketplace/${family}`}
            className="font-display text-[17px] font-semibold text-chalk transition hover:text-shine"
          >
            ระบบ{system.name}
          </Link>
          <p className="mt-1 text-[12.5px] leading-relaxed text-chalk/60">{system.blurb}</p>
          <p className="mt-2 text-[11.5px] text-chalk/40">
            {parts.length} ส่วนประกอบ · {capabilities} ความสามารถ
            {needs.length > 0 && <> · ต้องมีระบบ{needs.join(" และ ")}ด้วย</>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[20px] font-semibold tabular-nums text-chalk">{price.days} วัน</p>
          <p className="text-[11.5px] tabular-nums text-chalk/45">฿{price.ma.toLocaleString("th-TH")}/ด.</p>
        </div>
      </div>

      <ul className="divide-y divide-chalk/8 border-y border-chalk/8">
        {parts.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-chalk/85">{m.name}</span>
              <span className="block truncate text-[11.5px] text-chalk/40">
                {m.keyFeatures.join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-[11.5px] tabular-nums text-chalk/45">{m.effortDays} วัน</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 p-4">
        <Link
          href={`/erp?system=${family}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-chalk/15 py-2 text-[12.5px] text-chalk/75 transition hover:border-shine/60 hover:text-shine"
        >
          <PlayCircle size={14} />
          ลองใช้ทั้งระบบ
        </Link>
        <button
          onClick={onAdd}
          disabled={inScope}
          className={
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium transition " +
            (inScope ? "cursor-default bg-shine/15 text-shine" : "bg-shine text-night hover:brightness-110")
          }
        >
          {inScope ? <Check size={14} /> : <Plus size={14} />}
          {inScope ? "อยู่ในขอบเขตแล้ว" : "เพิ่มลงขอบเขต"}
        </button>
        <Link
          href={`/marketplace/${family}`}
          aria-label="รายละเอียด"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-chalk/15 text-chalk/50 transition hover:border-shine/60 hover:text-shine"
        >
          <ChevronRight size={15} />
        </Link>
      </div>
    </article>
  );
}
