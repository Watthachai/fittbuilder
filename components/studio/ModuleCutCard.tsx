"use client";

import { Boxes, X } from "lucide-react";
import type { ProposalModule } from "@/lib/proposal-modules";
import { formatTHB, quoteTotals, type QuoteDoc } from "@/lib/quote";
import { rowsFromModules } from "@/lib/quote-modules";

/**
 * What re-cutting the quotation by module will do, before it does it: how many
 * lines go, how many stay, and what the lines add up to before and after. The
 * sender confirms — nothing in the quotation changes on the button that opened
 * this.
 */
export default function ModuleCutCard({
  doc,
  modules,
  onApply,
  onClose,
}: {
  doc: QuoteDoc;
  modules: ProposalModule[];
  onApply: () => void;
  onClose: () => void;
}) {
  const { rows, replaced } = rowsFromModules(doc, modules);
  const kept = rows.length - modules.length;
  // The rows' own sum: under a lump sum the subtotal is the one figure either way.
  const sum = (d: QuoteDoc) => quoteTotals({ ...d, lumpSum: { ...d.lumpSum, enabled: false } }).subtotal;
  const before = sum(doc);
  const after = sum({ ...doc, rows });

  return (
    <div className="mt-2 rounded-xl border border-shine/50 bg-shine/10 p-3">
      <div className="flex items-start gap-2">
        <Boxes size={14} className="mt-0.5 shrink-0 text-shine" />
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-chalk">
          <p className="font-display text-[14px]">สร้างรายการจากโมดูลในข้อเสนอโครงการ</p>
          <p className="mt-1 text-chalk-dim">
            ได้ {modules.length} รายการโมดูล ({modules.map((m) => m.name).join(" · ")}) แทน {replaced.length}{" "}
            รายการที่โมดูลครอบคลุม · รายการอื่นอีก {kept} รายการคงไว้ตามเดิม เช่น ค่าบริการหรือส่วนลดที่เพิ่มเอง
          </p>
          <p className="mt-1 text-chalk-dim">
            ราคารวมของรายการ{" "}
            {before === after ? (
              <span className="font-mono text-chalk">฿{formatTHB(after)} เท่าเดิม</span>
            ) : (
              <>
                <span className="font-mono text-chalk">฿{formatTHB(before)}</span> →{" "}
                <span className="font-mono text-chalk">฿{formatTHB(after)}</span> — ราคาที่พิมพ์ไว้บนโมดูลเดิมยังอยู่
                แต่รายการหน้าจอที่ถูกแทนหายไป
              </>
            )}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={onApply}
              className="rounded-lg bg-shine px-3 py-1.5 font-display text-[13px] font-semibold text-night transition hover:brightness-110"
            >
              แทนรายการ
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-night-edge px-3 py-1.5 font-display text-[13px] text-chalk-dim transition hover:text-chalk"
            >
              ยกเลิก
            </button>
          </div>
        </div>
        <button onClick={onClose} aria-label="ปิด" className="rounded-md p-1 text-chalk-dim transition hover:text-chalk">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
