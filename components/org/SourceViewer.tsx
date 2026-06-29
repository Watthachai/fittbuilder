"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";

/** Shows the workspace's raw source data, highlighting the cited passage so the
 *  user can see exactly where a piece of Org DNA came from (NotebookLM-style).
 *  Auto-scrolls to the highlight on open. */
export default function SourceViewer({
  sources,
  highlight,
  onClose,
}: {
  sources: string;
  highlight?: string;
  onClose: () => void;
}) {
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  useEffect(() => {
    // Bring the cited passage into view when the viewer opens.
    markRef.current?.scrollIntoView({ block: "center" });
  }, []);

  if (typeof document === "undefined") return null;

  const i = highlight ? sources.indexOf(highlight) : -1;
  const has = i >= 0 && highlight;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong flex h-[90vh] w-[min(96vw,72rem)] flex-col rounded-2xl border border-night-edge p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-chalk">
            <FileText size={18} className="text-shine" /> แหล่งข้อมูลของคุณ
          </h2>
          <button onClick={onClose} className="rounded-sm p-1 text-chalk-dim transition hover:text-chalk">
            <X size={20} />
          </button>
        </div>
        {has && (
          <p className="mt-1.5 text-[13px] text-chalk-dim">
            ส่วนที่ไฮไลต์ = ข้อความที่ AI ใช้อ้างอิงสำหรับฐานรากนี้
          </p>
        )}
        <div className="scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-night-edge bg-night p-5 text-[16px] leading-8 text-chalk/90">
          {has ? (
            <>
              {sources.slice(0, i)}
              <mark ref={markRef} className="rounded bg-shine/30 px-0.5 text-chalk">
                {highlight}
              </mark>
              {sources.slice(i + highlight!.length)}
            </>
          ) : (
            sources || "ยังไม่มีแหล่งข้อมูล"
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
