"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";

/** Shows the workspace's raw source data, highlighting the cited passage so the
 *  user can see exactly where a piece of Org DNA came from (NotebookLM-style). */
export default function SourceViewer({
  sources,
  highlight,
  onClose,
}: {
  sources: string;
  highlight?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const i = highlight ? sources.indexOf(highlight) : -1;
  const has = i >= 0 && highlight;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong flex max-h-[85vh] w-[min(92vw,44rem)] flex-col rounded-2xl border border-night-edge p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-chalk">
            <FileText size={16} className="text-shine" /> แหล่งข้อมูลของคุณ
          </h2>
          <button onClick={onClose} className="rounded-sm p-1 text-chalk-dim transition hover:text-chalk">
            <X size={18} />
          </button>
        </div>
        {has && (
          <p className="mt-1 text-[12px] text-chalk-dim">
            ส่วนที่ไฮไลต์ = ข้อความที่ AI ใช้อ้างอิงสำหรับฐานรากนี้
          </p>
        )}
        <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-night-edge bg-night p-3.5 text-[13px] leading-relaxed text-chalk/85">
          {has ? (
            <>
              {sources.slice(0, i)}
              <mark className="rounded bg-shine/30 px-0.5 text-chalk">{highlight}</mark>
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
