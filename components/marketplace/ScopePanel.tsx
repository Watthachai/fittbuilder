"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { startProjectFromModules } from "@/lib/modules/start-project";
import type { Module } from "@/lib/modules/types";

/** The basket: what has been chosen, what it costs, and the one action on it. */
export default function ScopePanel({
  chosen,
  onRemove,
}: {
  chosen: Module[];
  onRemove: (m: Module) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();

  const days = chosen.reduce((n, m) => n + m.effortDays, 0);
  const ma = chosen.reduce((n, m) => n + m.maPerMonth, 0);

  const build = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      router.push(`/project/${await startProjectFromModules(chosen)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="rounded-2xl border border-chalk/12 bg-night-panel p-4">
        <h2 className="font-display text-[14px] font-semibold text-chalk">ขอบเขตที่เลือก</h2>

        {chosen.length === 0 ? (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-chalk/50">
            ยังไม่ได้เลือกโมดูล เดินดูในแคตตาล็อกแล้วกด “เพิ่มลงขอบเขต” — หรือกด “ลองใช้”
            เพื่อเข้าไปใช้ของจริงก่อนตัดสินใจ
          </p>
        ) : (
          <>
            <ul className="mt-2.5 space-y-1">
              {chosen.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-chalk/75">{m.name}</span>
                  <span className="shrink-0 tabular-nums text-chalk/45">{m.effortDays} วัน</span>
                  <button
                    onClick={() => onRemove(m)}
                    aria-label={`เอา${m.name}ออก`}
                    className="shrink-0 rounded p-1 text-chalk/30 transition hover:bg-halt/10 hover:text-halt"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-1 border-t border-chalk/10 pt-3 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-chalk/60">แรงงานรวม</dt>
                <dd className="font-semibold tabular-nums text-chalk">{days} วัน</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-chalk/60">ดูแลรายเดือน</dt>
                <dd className="font-semibold tabular-nums text-chalk">
                  {ma.toLocaleString("th-TH")} บาท
                </dd>
              </div>
            </dl>
          </>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-halt/40 bg-halt/10 p-2.5 text-[12px] leading-snug text-halt">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <button
          onClick={() => void build()}
          disabled={busy || chosen.length === 0}
          className="mt-4 w-full rounded-lg bg-shine py-2.5 font-display text-[13.5px] font-semibold text-night transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {busy ? "กำลังสร้าง…" : "สร้างโปรเจ็กต์จากขอบเขตนี้"}
        </button>
        <p className="mt-2 text-center text-[11.5px] text-chalk/40">
          โค้ดพร้อมอยู่แล้ว ไม่ต้องรอ AI เขียน
        </p>
      </div>
    </aside>
  );
}
