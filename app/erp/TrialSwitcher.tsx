"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Grid3x3, Store } from "lucide-react";
import { FAMILIES, modulesOf } from "@/lib/modules/registry";
import type { Module } from "@/lib/modules/types";

/**
 * Switch what is being trialled without going back to the shop.
 *
 * A one-way "see everything" link assumed the only thing anyone would want next
 * is the whole suite. The likelier move is sideways — someone evaluating the
 * personnel module wants payroll next, and making them return to the listing
 * page to get there is a step that exists for no reason.
 */
export default function TrialSwitcher({
  trial,
  licensed,
}: {
  trial: Module;
  licensed: Module[];
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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

  const families = FAMILIES.filter((f) => licensed.some((m) => m.family === f.id));

  return (
    <div ref={box} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg border border-sky-300 px-2.5 py-1.5 text-[12px] text-sky-700 transition hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-400 dark:hover:bg-sky-500/10"
      >
        <span className="hidden max-w-[10rem] truncate sm:inline">กำลังลอง {trial.name}</span>
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
              <span className="block text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                ดูทั้งระบบ
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {licensed.length} โมดูลที่สิทธิ์นี้เปิดได้ ทำงานเชื่อมกัน
              </span>
            </span>
          </Link>

          <div className="max-h-80 overflow-y-auto py-1">
            {families.map((family) => (
              <div key={family.id}>
                <p className="px-3.5 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {family.name}
                </p>
                {modulesOf(family.id)
                  .filter((m) => licensed.some((l) => l.id === m.id))
                  .map((m) => {
                    const on = m.id === trial.id;
                    return (
                      <Link
                        key={m.id}
                        href={`/erp/${m.id}?only=${m.id}`}
                        onClick={() => setOpen(false)}
                        className={
                          "flex items-center gap-2.5 px-3.5 py-1.5 transition " +
                          (on
                            ? "bg-sky-50 dark:bg-sky-500/10"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/60")
                        }
                      >
                        <Check
                          size={13}
                          className={"shrink-0 " + (on ? "text-sky-600 dark:text-sky-400" : "opacity-0")}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-700 dark:text-slate-200">
                          {m.name}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-slate-300 dark:text-slate-600">
                          {m.sapCode}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            ))}
          </div>

          <Link
            href={`/marketplace/${trial.id}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 border-t border-slate-100 px-3.5 py-2.5 text-[12px] text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60"
          >
            <Store size={13} className="shrink-0" />
            ดูราคาและรายละเอียดใน มาร์เก็ตเพลส
          </Link>
        </div>
      )}
    </div>
  );
}
