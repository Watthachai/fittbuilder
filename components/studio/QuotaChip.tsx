"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import type { GenerationQuota } from "@/lib/ai-usage";

/**
 * Live "generations left this month" chip for free-plan users. Fetches the
 * signed-in user's quota once; renders nothing for unlimited plans (limit=null).
 * `refreshKey` lets the parent re-poll after a generation completes.
 */
export default function QuotaChip({ refreshKey = 0 }: { refreshKey?: number }) {
  const [quota, setQuota] = useState<GenerationQuota | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((q: GenerationQuota | null) => {
        if (!cancelled) setQuota(q);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!quota || quota.limit === null || quota.remaining === null) return null;

  const out = quota.remaining <= 0;
  const low = quota.remaining <= 1;
  const tone = out
    ? "border-halt/40 bg-halt/10 text-halt"
    : low
      ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
      : "border-night-edge text-chalk-dim";

  return (
    <span
      title={
        out
          ? `ใช้ครบโควตาสร้างเดโมของแพลนฟรีแล้ว (${quota.used}/${quota.limit} เดือนนี้) — รีเซ็ตต้นเดือนหน้า`
          : `เหลือโควตาสร้างเดโม ${quota.remaining} จาก ${quota.limit} ครั้งในเดือนนี้ (แพลนฟรี)`
      }
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] ${tone}`}
    >
      <Zap size={11} />
      <span className="hidden lg:inline">{out ? "โควตาหมด" : "เหลือ"}</span> {quota.remaining}/{quota.limit}
    </span>
  );
}
