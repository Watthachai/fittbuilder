"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import Markdown from "./Markdown";

/** Read-only preview of a phase's document (BRD/PRD/…), shown when the user
 *  clicks a completed step in the phase stepper. Editing happens in the Code tab. */
export default function DocPreviewModal({
  title,
  path,
  content,
  onClose,
}: {
  title: string;
  path: string;
  content: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-night-edge bg-night-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-night-edge px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-chalk">{title}</p>
            <p className="truncate font-mono text-[11px] text-chalk-dim">{path}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="shrink-0 text-chalk-dim transition hover:text-chalk"
          >
            <X size={18} />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {content ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="text-sm text-chalk-dim">ยังไม่มีเอกสารในเฟสนี้</p>
          )}
        </div>
      </div>
    </div>
  );
}
