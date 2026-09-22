"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules/registry";
import type { Module } from "@/lib/modules/types";

type Entry = { id: string; label: string; group: string; href: string };

/**
 * Everything the system can open, one keystroke away.
 *
 * People who use a system all day stop reading menus; they type where they want
 * to go. The list is built from the same registry the sidebar is, so a capability
 * can never be reachable from one and missing from the other.
 */
export default function CommandPalette({
  open,
  onClose,
  allowed,
}: {
  open: boolean;
  onClose: () => void;
  allowed: Module[];
}) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(
    () =>
      allowed.flatMap((m) => [
        { id: m.id, label: `ภาพรวม${m.name}`, group: m.name, href: `/erp/${m.id}` },
        ...m.keyFeatures.map((f, i) => ({
          id: `${m.id}-${i}`,
          label: f,
          group: m.name,
          href: `/erp/${m.id}/${i + 1}`,
        })),
      ]),
    [allowed]
  );

  // Every character has to appear in order, so "ขาลา" still finds "ขาดลามาสาย".
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries.slice(0, 12);
    return entries
      .filter((e) => {
        const hay = (e.label + " " + e.group).toLowerCase();
        let i = 0;
        for (const ch of needle) {
          i = hay.indexOf(ch, i);
          if (i === -1) return false;
          i += 1;
        }
        return true;
      })
      .slice(0, 20);
  }, [entries, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setAt(0);
      // The input mounts with the dialog, so focus waits for the frame.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setAt(0), [q]);

  if (!open) return null;

  const go = (e: Entry) => {
    router.push(e.href);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ค้นหาคำสั่ง"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] dark:bg-black/70"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAt((i) => Math.min(matches.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAt((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && matches[at]) {
              go(matches[at]);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="ไปที่โมดูลหรือความสามารถ…"
          className="w-full border-b border-slate-100 bg-transparent px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-slate-800 dark:text-slate-50 dark:placeholder:text-slate-500"
        />

        <ul className="max-h-80 overflow-y-auto py-1">
          {matches.map((e, i) => (
            <li key={e.id}>
              <button
                onMouseEnter={() => setAt(i)}
                onClick={() => go(e)}
                className={
                  "flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition " +
                  (i === at ? "bg-sky-50 dark:bg-sky-500/10" : "")
                }
              >
                <span className="min-w-0 truncate text-[13px] text-slate-800 dark:text-slate-100">
                  {e.label}
                </span>
                <span className="shrink-0 text-[11.5px] text-slate-400 dark:text-slate-500">{e.group}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-4 py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
              ไม่พบ “{q}”
            </li>
          )}
        </ul>

        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <span>↑↓ เลื่อน</span>
          <span>↵ เปิด</span>
          <span>esc ปิด</span>
        </div>
      </div>
    </div>
  );
}
