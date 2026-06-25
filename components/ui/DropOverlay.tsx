"use client";

import { ImageDown } from "lucide-react";

/** Animated overlay shown while files are dragged over a chat. Fills its nearest
 *  positioned ancestor; pointer-events off so the drop still reaches the target. */
export default function DropOverlay({ label = "วางรูปหรือไฟล์ที่นี่" }: { label?: string }) {
  return (
    <div className="drop-overlay pointer-events-none absolute inset-0 z-40 m-1.5 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-shine bg-night/85 backdrop-blur-sm">
      <ImageDown size={30} className="text-shine" />
      <p className="font-display text-sm font-semibold text-chalk">{label}</p>
      <p className="font-mono text-[11px] text-chalk-dim">รูปภาพ · PDF · ไฟล์เอกสาร</p>
    </div>
  );
}
