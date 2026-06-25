"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  EMPTY_GENERATIONS,
  getActiveGenerations,
  subscribeGenerations,
} from "@/lib/generation/registry";

/**
 * Floating, site-wide indicator of projects generating in the background. Shows
 * only projects you're NOT currently viewing (the studio shows its own status).
 * Click a pill to jump back to that project.
 */
export default function GlobalGenerationIndicator() {
  const active = useSyncExternalStore(
    subscribeGenerations,
    getActiveGenerations,
    () => EMPTY_GENERATIONS,
  );
  const pathname = usePathname();

  const others = active.filter(
    (e) => !pathname.startsWith(`/project/${e.projectId}`),
  );
  if (others.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-5 z-[70] flex flex-col gap-2 print:hidden">
      {others.map((e) => (
        <Link
          key={e.projectId}
          href={`/project/${e.projectId}`}
          className="glass flex items-center gap-2.5 rounded-full py-2 pl-3 pr-4 shadow-lg transition hover:text-shine"
        >
          <Loader2 size={15} className="shrink-0 animate-spin text-shine" />
          <span className="max-w-[12rem] truncate font-display text-xs text-chalk">
            {e.name} · กำลังทำงานเบื้องหลัง
          </span>
        </Link>
      ))}
    </div>
  );
}
