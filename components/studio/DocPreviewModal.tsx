"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import Markdown from "./Markdown";

/**
 * Preview a phase's document (BRD/PRD/…) with an inline "revise" box: the user
 * types feedback and the phase agent regenerates the doc (streamed in the chat).
 * Editing is also possible directly in the Code tab; this is the quick path.
 */
export default function DocPreviewModal({
  title,
  path,
  content,
  hint,
  busy,
  onRevise,
  onClose,
}: {
  title: string;
  path: string;
  content: string | null;
  /** Extra line under the revise box, e.g. "แก้ BRD แล้วจะ gen PRD ใหม่ให้ด้วย". */
  hint?: string;
  busy: boolean;
  onRevise: (comment: string) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!comment.trim() || busy) return;
    onRevise(comment.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-night-edge bg-night-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-night-edge px-5 py-3">
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

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {content ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="text-sm text-chalk-dim">ยังไม่มีเอกสารในเฟสนี้</p>
          )}
        </div>

        <div className="shrink-0 border-t border-night-edge bg-night px-5 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={comment}
              rows={2}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder='บอกสิ่งที่อยากแก้ เช่น "เพิ่มหน้า pricing", "เปลี่ยนกลุ่มเป้าหมายเป็น SME"'
              className="scroll-thin min-h-0 flex-1 resize-none rounded-lg border border-night-edge bg-night-panel px-3 py-2 text-[14px] leading-relaxed text-chalk outline-none placeholder:text-chalk-dim/50 focus:border-shine/60"
            />
            <button
              onClick={submit}
              disabled={!comment.trim() || busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-shine px-4 py-2.5 font-display text-sm font-semibold text-black transition hover:bg-shine-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles size={14} /> แก้ไขใหม่
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-chalk-dim">
            {hint ?? "คอมเมนต์จะถูกส่งเข้าแชท แล้ว AI จะ regenerate เอกสารนี้ให้"}
            {" · ⌘/Ctrl + Enter เพื่อส่ง"}
          </p>
        </div>
      </div>
    </div>
  );
}
