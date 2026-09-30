"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, Loader2, Sparkles, X } from "lucide-react";
import Markdown from "./Markdown";
import DocPrint from "./DocPrint";
import { docFileName } from "@/lib/doc-number";
import { printSheet } from "@/lib/print-sheet";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";

interface DocTab {
  kind: string;
  label: string;
  path: string;
  content: string;
}

/**
 * Preview a phase's document(s) with an inline "revise" box: the user types
 * feedback and the phase agent regenerates the doc(s) (streamed in the chat).
 * A phase can produce several docs (Define → IDEA + BRD), shown as tabs.
 */
export default function DocPreviewModal({
  title,
  projectName,
  docs,
  hint,
  busy,
  onRevise,
  onClose,
}: {
  title: string;
  /** Printed on every page of the PDF and in its file name. */
  projectName: string;
  docs: DocTab[];
  /** Extra line under the revise box, e.g. "แก้ BRD แล้วจะ gen PRD ใหม่ให้ด้วย". */
  hint?: string;
  busy: boolean;
  onRevise: (comment: string) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");
  const [active, setActive] = useState(0);
  const doc = docs[active] ?? null;
  const [sheet, setSheet] = useState<DocTab | null>(null);
  const [printing, setPrinting] = useState(false);

  // Same route as the quotation: the browser's print dialog, "Save as PDF".
  const savePdf = async () => {
    if (!doc || printing) return;
    setPrinting(true);
    try {
      await printSheet(() => setSheet(doc), () => setSheet(null), {
        fileName: docFileName(doc.label, projectName),
      });
    } finally {
      setPrinting(false);
    }
  };

  const submit = () => {
    if (!comment.trim() || busy) return;
    onRevise(comment.trim());
  };

  return (
    <Overlay open onClose={onClose} placement="center">
      <GlassSurface
        strong
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-night-edge px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <p className="shrink-0 font-display text-sm font-semibold text-chalk">{title}</p>
            {docs.length > 1 && (
              <div className="flex items-center gap-1 rounded-full border border-night-edge bg-night p-0.5">
                {docs.map((d, i) => (
                  <button
                    key={d.kind}
                    onClick={() => setActive(i)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      i === active ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
            {doc && (
              <span className="truncate font-mono text-[11px] text-chalk-dim">{doc.path}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {doc && (
              <button
                onClick={() => void savePdf()}
                disabled={printing}
                title="เปิดหน้าต่างพิมพ์ แล้วเลือกปลายทางเป็น “Save as PDF”"
                className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-1.5 text-xs font-medium text-chalk transition hover:border-shine/60 hover:text-shine disabled:opacity-60"
              >
                {printing ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                บันทึก {doc.label} เป็น PDF
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="ปิด"
              className="text-chalk-dim transition hover:text-chalk"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {doc ? (
            <Markdown>{doc.content}</Markdown>
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-shine px-4 py-2.5 font-display text-sm font-semibold text-night transition hover:bg-shine-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles size={14} /> แก้ไขใหม่
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-chalk-dim">
            {hint ?? "คอมเมนต์จะถูกส่งเข้าแชท แล้ว AI จะ regenerate เอกสารนี้ให้"}
            {" · ⌘/Ctrl + Enter เพื่อส่ง"}
          </p>
        </div>
      </GlassSurface>
      {sheet &&
        createPortal(
          <DocPrint
            label={sheet.label}
            projectName={projectName}
            printedAt={new Date().toISOString().slice(0, 10)}
            content={sheet.content}
          />,
          document.body
        )}
    </Overlay>
  );
}
