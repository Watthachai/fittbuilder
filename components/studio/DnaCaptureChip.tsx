"use client";

import { Check, Dna, X } from "lucide-react";
import { DNA_BLOCKS } from "@/lib/org-dna";
import type { DnaCapture } from "@/lib/dna-capture";

export default function DnaCaptureChip({
  capture, onAdd, onDismiss, busy,
}: {
  capture: DnaCapture;
  onAdd: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const label = DNA_BLOCKS.find((b) => b.key === capture.block)?.th ?? capture.block;
  return (
    <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-shine/40 bg-shine/[0.06] px-3 py-2">
      <Dna size={14} className="mt-0.5 shrink-0 text-shine" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-shine">เจอข้อมูลองค์กร · {label}</p>
        <p className="mt-0.5 line-clamp-2 text-[12px] text-chalk">“{capture.snippet}”</p>
      </div>
      <button onClick={onAdd} disabled={busy}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-shine px-2.5 py-1 font-display text-[11px] font-semibold text-night transition hover:brightness-110 disabled:opacity-50">
        <Check size={12} /> เพิ่มเข้า Org DNA
      </button>
      <button onClick={onDismiss} disabled={busy} aria-label="ข้าม"
        className="shrink-0 rounded-sm p-1 text-chalk-dim transition hover:text-chalk disabled:opacity-50">
        <X size={13} />
      </button>
    </div>
  );
}
