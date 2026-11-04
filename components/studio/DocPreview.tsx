"use client";

import type { ReactNode } from "react";
import { BadgeCheck, Eye, FileText, Loader2, X } from "lucide-react";
import Overlay from "@/components/ui/Overlay";

/**
 * The quotation or proposal on screen exactly as it prints, before it is
 * approved. Senders edit a document many times before it is right; without
 * this the only way to read the paper was to send it for approval each round.
 * It issues no document number. Unapproved, the paper carries a "ตัวอย่าง"
 * mark (DraftMark, drawn by the paper itself), so a screenshot of it does not
 * pass for the document.
 *
 * The screen shows one long sheet; where the A4 pages break only the browser's
 * print engine knows — the letterhead repeats on each page and rows refuse to
 * split. "ดูแบบแบ่งหน้า A4" opens that engine on the draft, every page still
 * marked (case #46).
 */
export default function DocPreview({
  title,
  approved,
  onClose,
  onPages,
  pagesBusy,
  children,
}: {
  title: string;
  /** Whether this document may be printed — the same answer the print button has. */
  approved: boolean;
  onClose: () => void;
  /** Open the print dialog on the marked draft, to read its real pages. */
  onPages: () => void;
  pagesBusy: boolean;
  children: ReactNode;
}) {
  return (
    <Overlay open onClose={onClose} placement="none">
      <div className="fixed inset-0 flex flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-night-edge bg-night px-4 py-2.5">
          <Eye size={15} className="shrink-0 text-shine" />
          <p className="font-display text-[0.875rem] font-semibold text-chalk">ตัวอย่าง{title}</p>
          {approved ? (
            <span className="flex items-center gap-1 text-[0.78125rem] text-go">
              <BadgeCheck size={13} /> อนุมัติแล้ว — ปิดหน้านี้แล้วกดพิมพ์หรือบันทึก Word ได้
            </span>
          ) : (
            <span className="text-[0.78125rem] text-halt">
              ยังไม่ได้อนุมัติ — ดูได้อย่างเดียว พอพร้อมแล้วกด “ส่งอนุมัติ” เพื่อพิมพ์หรือบันทึกไฟล์
            </span>
          )}
          {!approved && (
            <button
              onClick={onPages}
              disabled={pagesBusy}
              title="เปิดหน้าต่างพิมพ์ของเบราว์เซอร์เพื่อดูการแบ่งหน้าจริง ทุกหน้ามีลายน้ำ “ตัวอย่าง”"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-shine/50 px-2.5 py-1 font-display text-[0.78125rem] text-chalk transition hover:bg-shine/10 disabled:opacity-60"
            >
              {pagesBusy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} ดูแบบแบ่งหน้า A4
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="ปิดตัวอย่าง"
            className={`${approved ? "ml-auto " : ""}grid h-8 w-8 place-items-center rounded-lg text-chalk-dim transition hover:bg-chalk/10 hover:text-chalk`}
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto bg-night-panel px-4 py-8">
          <div className="relative mx-auto w-[210mm] max-w-full overflow-hidden shadow-xl">
            {children}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/**
 * A faint diagonal "ตัวอย่าง · ยังไม่อนุมัติ" across a draft: over the whole
 * sheet on screen, and on every printed page (.fitt-draft-mark in globals.css).
 * Inside the paper, because printing shows the paper and nothing beside it.
 */
export function DraftMark() {
  return (
    <div
      aria-hidden
      className="fitt-draft-mark"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='300'><text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' transform='rotate(-30 210 150)' font-family='sans-serif' font-size='44' font-weight='700' fill='rgba(225,29,72,0.10)'>ตัวอย่าง · ยังไม่อนุมัติ</text></svg>`
        )}")`,
      }}
    />
  );
}

/** "ดูตัวอย่าง": always available — reading the paper needs no approval. */
export function PreviewButton({
  busy,
  onClick,
  className = "",
}: {
  busy: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-shine/50 px-3 py-2 font-display text-[0.875rem] text-chalk transition hover:bg-shine/10 disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} ดูตัวอย่างเอกสาร
    </button>
  );
}
