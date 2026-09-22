"use client";

import Link from "next/link";
import { ArrowRight, MonitorPlay } from "lucide-react";
import { MODULES } from "@/lib/modules/registry";

/**
 * The entry to the running system.
 *
 * It used to be a picker: tick modules, get a demo generated. That asked a buyer
 * to configure a thing before they had seen one. This is the other way round —
 * sign in, use it, and decide afterwards which parts of it you want.
 */
export default function LiveSystemLink({ disabled }: { disabled: boolean }) {
  return (
    <Link
      href="/erp"
      aria-disabled={disabled}
      className={
        "group flex h-full w-full items-center gap-2.5 rounded-xl border border-chalk/15 px-3.5 py-2.5 text-left transition hover:border-shine/60 hover:bg-chalk/[0.03] " +
        (disabled ? "pointer-events-none opacity-40" : "")
      }
    >
      <MonitorPlay size={17} className="shrink-0 text-shine" />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[13px] font-semibold text-chalk group-hover:text-shine">
          เปิดระบบตัวอย่าง
        </span>
        <span className="block text-[12px] leading-snug text-chalk/55">
          เข้าสู่ระบบแล้วใช้งานได้เลย {MODULES.length} โมดูล
        </span>
      </span>
      <ArrowRight
        size={15}
        className="shrink-0 text-chalk/30 transition group-hover:translate-x-0.5 group-hover:text-shine"
      />
    </Link>
  );
}
