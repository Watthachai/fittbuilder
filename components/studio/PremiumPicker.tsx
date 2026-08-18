"use client";

import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import type { PremiumOption } from "@/lib/skills/types";

/**
 * What to build into the Premium version.
 *
 * Switching tier used to drop the user into an empty chat box — the studio knew
 * a second version existed but had no idea what made it worth more money, so
 * every Premium build was whatever that person happened to type. The catalogue
 * (lib/skills/premium.ts) answers that per domain, and this is where it is
 * offered.
 *
 * Days are shown, not hidden: the same number goes onto the quotation as a line
 * item, so the person choosing here is choosing what to charge for.
 */
export default function PremiumPicker({
  open,
  options,
  onClose,
  onBuild,
}: {
  open: boolean;
  options: PremiumOption[];
  onClose: () => void;
  onBuild: (chosen: PremiumOption[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = options.filter((o) => picked.includes(o.id));
  const days = chosen.reduce((sum, o) => sum + o.effortDays, 0);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Overlay open={open} onClose={onClose} blur>
      <GlassSurface className="w-full max-w-2xl overflow-hidden rounded-2xl">
        <div className="border-b border-chalk/10 px-6 py-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-chalk">
            <Sparkles className="h-4 w-4 text-shine" />
            เวอร์ชัน Premium จะขายอะไรเพิ่ม
          </h2>
          <p className="mt-1 text-sm text-chalk-dim">
            เวอร์ชันปกติยังอยู่ครบไม่ถูกแตะ — ที่เลือกตรงนี้จะถูกสร้างเพิ่มลงในเวอร์ชัน Premium
            เท่านั้น และตอน Export จะได้คนละไฟล์กัน
          </p>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
          <ul className="flex flex-col gap-2">
            {options.map((o) => {
              const on = picked.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => toggle(o.id)}
                    aria-pressed={on}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      on
                        ? "border-shine/60 bg-shine/10"
                        : "border-chalk/15 hover:border-chalk/30 hover:bg-chalk/5"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        on ? "border-shine bg-shine text-night" : "border-chalk/30"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-chalk">{o.name}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-chalk-dim">
                        {o.pitch}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-chalk/10 px-2 py-1 text-xs tabular-nums text-chalk-dim">
                      ~{o.effortDays} วัน
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-chalk/10 px-6 py-4">
          <p className="text-sm text-chalk-dim">
            {chosen.length === 0 ? (
              "ยังไม่ได้เลือก"
            ) : (
              <>
                เลือกแล้ว {chosen.length} รายการ ·{" "}
                <span className="tabular-nums text-chalk">~{days} วัน</span> สำหรับใบเสนอราคา
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-chalk-dim transition hover:bg-chalk/5 hover:text-chalk"
            >
              ไว้ทีหลัง
            </button>
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => onBuild(chosen)}
              className="rounded-lg bg-shine px-4 py-2 text-sm font-medium text-night transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              สร้างเวอร์ชัน Premium
            </button>
          </div>
        </div>
      </GlassSurface>
    </Overlay>
  );
}
