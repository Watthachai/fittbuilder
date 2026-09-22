"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Grid3x3, Store } from "lucide-react";
import { FAMILIES, modulesOf } from "@/lib/modules/registry";
import type { Module, ModuleFamily } from "@/lib/modules/types";

/**
 * Switch which system is being trialled without going back to the shop.
 *
 * A one-way "see everything" link assumed the only thing anyone would want next
 * is the whole suite. The likelier move is sideways — someone evaluating the HR
 * system wants the accounting one next, and making them return to the listing
 * page to get there is a step that exists for no reason.
 */
export default function TrialSwitcher({ trial, licensed }: { trial: ModuleFamily; licensed: Module[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = FAMILIES.find((f) => f.id === trial)!;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg border border-violet-300 px-2.5 py-1.5 text-[12px] text-violet-700 transition hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
      >
        <span className="hidden max-w-[12rem] truncate sm:inline">กำลังลองระบบ{current.name}</span>
        <span className="sm:hidden">ทดลองใช้</span>
        <ChevronDown size={12} className={"transition " + (open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <Link
            href="/erp"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-2.5 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
          >
            <Grid3x3 size={14} className="shrink-0 text-slate-400" />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-slate-800 dark:text-slate-100">ดูทุกระบบ</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                เปิดได้ {licensed.length} ส่วน ทุกส่วนทำงานเชื่อมถึงกัน
              </span>
            </span>
          </Link>

          <div className="py-1">
            {FAMILIES.map((f) => {
              const on = f.id === trial;
              const mine = modulesOf(f.id).filter((m) => licensed.some((l) => l.id === m.id)).length;
              return (
                <Link
                  key={f.id}
                  href={`/erp?system=${f.id}`}
                  onClick={() => setOpen(false)}
                  className={
                    "flex items-center gap-2.5 px-3.5 py-2 transition " +
                    (on ? "bg-violet-50 dark:bg-violet-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")
                  }
                >
                  <Check size={13} className={"shrink-0 " + (on ? "text-violet-600 dark:text-violet-300" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-slate-700 dark:text-slate-200">ระบบ{f.name}</span>
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                      เปิดได้ {mine} จาก {modulesOf(f.id).length} ส่วน
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <Link
            href={`/marketplace/${trial}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 border-t border-slate-100 px-3.5 py-2.5 text-[12px] text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60"
          >
            <Store size={13} className="shrink-0" />
            ดูราคาและรายละเอียดในมาร์เก็ตเพลส
          </Link>
        </div>
      )}
    </div>
  );
}
