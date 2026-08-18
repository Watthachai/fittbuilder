"use client";

import { RotateCcw } from "lucide-react";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import type { GenerationDraft } from "@/lib/storage";

const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });

/**
 * A turn that never got to finish, offered back.
 *
 * The model stream is held by the tab, so closing or reloading the page ends it
 * mid-build. What arrived before that is parked (migration 0034) and shown here
 * rather than applied on its own: a half-streamed file set is not a runnable
 * project, and silently making it the project's files is how you get a demo
 * that opens to a white screen.
 */
export default function DraftRecovery({
  draft,
  onRecover,
  onDiscard,
}: {
  draft: GenerationDraft | null;
  onRecover: () => void;
  onDiscard: () => void;
}) {
  if (!draft) return null;
  const count = Object.keys(draft.files).length;

  return (
    <Overlay open onClose={onDiscard} blur>
      <GlassSurface className="w-full max-w-lg overflow-hidden rounded-2xl">
        <div className="px-6 py-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-chalk">
            <RotateCcw className="h-4 w-4 text-shine" />
            มีรอบที่สร้างค้างไว้
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
            รอบก่อนหน้าถูกตัดกลางคัน (ปิดหรือรีเฟรชหน้าจอ) แต่ไฟล์ที่ได้มาแล้ว{" "}
            <span className="text-chalk">{count} ไฟล์</span> ถูกเก็บไว้ให้ — เมื่อ{" "}
            {when(draft.updatedAt)}
          </p>
          {draft.prompt && (
            <p className="mt-3 rounded-lg border border-chalk/15 bg-chalk/5 px-3 py-2 text-xs leading-relaxed text-chalk-dim">
              “{draft.prompt.slice(0, 240)}
              {draft.prompt.length > 240 ? "…" : ""}”
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-chalk-dim">
            ไฟล์ชุดนี้อาจยังไม่ครบเพราะถูกตัดกลางทาง — กู้คืนแล้วสั่ง AI ทำต่อได้เลย
            และกด Undo ย้อนกลับได้ถ้าไม่เอา
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-chalk/10 px-6 py-4">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg px-4 py-2 text-sm text-chalk-dim transition hover:bg-chalk/5 hover:text-chalk"
          >
            ทิ้งไป
          </button>
          <button
            type="button"
            onClick={onRecover}
            className="rounded-lg bg-shine px-4 py-2 text-sm font-medium text-night transition hover:brightness-110"
          >
            กู้คืน {count} ไฟล์
          </button>
        </div>
      </GlassSurface>
    </Overlay>
  );
}
