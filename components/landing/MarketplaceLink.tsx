"use client";

import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { FAMILIES, MODULES } from "@/lib/modules/registry";

/**
 * The entry to the module shop.
 *
 * It used to be a picker in a modal: tick things, press build — configuring a
 * product before seeing one. The shop shows each module as a listing with a price
 * and a way to open the running system on that exact screen, so the decision is
 * made after using it rather than before.
 */
export default function MarketplaceLink({ disabled }: { disabled: boolean }) {
  return (
    <Link
      href="/marketplace"
      aria-disabled={disabled}
      className={
        "group flex h-full w-full items-center gap-2.5 rounded-xl border border-chalk/15 px-3.5 py-2.5 text-left transition hover:border-shine/60 hover:bg-chalk/[0.03] " +
        (disabled ? "pointer-events-none opacity-40" : "")
      }
    >
      <Store size={17} className="shrink-0 text-shine" />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[13px] font-semibold text-chalk group-hover:text-shine">
          มาร์เก็ตเพลสระบบ
        </span>
        <span className="block text-[12px] leading-snug text-chalk/55">
          {FAMILIES.length} ระบบสำเร็จรูป {MODULES.length} ส่วนประกอบ ลองใช้ของจริงได้ก่อนเลือก
        </span>
      </span>
      <ArrowRight
        size={15}
        className="shrink-0 text-chalk/30 transition group-hover:translate-x-0.5 group-hover:text-shine"
      />
    </Link>
  );
}
