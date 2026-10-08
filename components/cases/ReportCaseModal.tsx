"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Flag, Loader2, Send, X } from "lucide-react";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import { latestVersion } from "@/lib/changelog";
import {
  buildCaseContext,
  CASE_KIND,
  CASE_KINDS,
  suggestCaseTitle,
  type CaseContext,
  type CaseKind,
} from "@/lib/cases";
import { createCase } from "@/lib/cases-client";
import type { GenerationPhase } from "@/lib/types";
import { useFileDrop } from "@/lib/useFileDrop";
import { ImagePickButton, PendingImages, useCaseImages } from "./CaseBits";

/** What the screen knows at the moment someone presses "รายงานปัญหา". */
export interface CaseReportPreset {
  kind: CaseKind;
  error?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  phase?: string | null;
  log?: readonly string[];
  fileCount?: number | null;
}

/**
 * Report a problem. Opened from an error screen it arrives filled in — the
 * kind, a title from the error, and the context the team needs — so the person
 * only has to say what they were doing. Everything attached automatically is
 * listed before sending, including that the team will open the project itself.
 */
export default function ReportCaseModal({
  preset,
  onClose,
  onOpenCase,
}: {
  preset: CaseReportPreset;
  onClose: () => void;
  /** Already on the cases page: open the new case there instead of a new tab. */
  onOpenCase?: (id: string) => void;
}) {
  const [kind, setKind] = useState<CaseKind>(preset.kind);
  const [title, setTitle] = useState(() => suggestCaseTitle(preset.kind, preset.error));
  const [titleEdited, setTitleEdited] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; number: number } | null>(null);
  const [showContext, setShowContext] = useState(false);
  const images = useCaseImages();
  const { dragging, dropHandlers } = useFileDrop((files) => void images.add(Array.from(files)));

  const [context] = useState<CaseContext>(() =>
    buildCaseContext({
      phase: preset.phase,
      error: preset.error,
      log: preset.log,
      fileCount: preset.fileCount,
      appVersion: latestVersion(),
      userAgent: navigator.userAgent,
      page: location.pathname,
    })
  );

  const pickKind = (next: CaseKind) => {
    setKind(next);
    // Follow the kind until the person writes their own title.
    if (!titleEdited) setTitle(suggestCaseTitle(next, preset.error));
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      setCreated(
        await createCase({
          title: title.trim(),
          kind,
          body: body.trim(),
          projectId: preset.projectId ?? null,
          context,
          attachments: images.images,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "แจ้งเคสไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const canSend = title.trim().length > 0 && images.uploading === 0 && !sending;

  return (
    <Overlay open onClose={onClose} placement="center" blur>
      <GlassSurface strong className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-night-edge px-4 py-3">
          <div className="flex items-center gap-2">
            <Flag size={15} className="text-shine" />
            <h2 className="font-display text-[15px] font-semibold text-chalk">รายงานปัญหาให้ทีม</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk"
          >
            <X size={14} />
          </button>
        </div>

        {created ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 size={36} className="text-go" />
            <p className="font-display text-lg font-semibold text-chalk">ส่งเคส #{created.number} แล้ว</p>
            <p className="max-w-sm text-[13px] leading-relaxed text-chalk-dim">
              ทีมจะตอบในเคสนี้ เมื่อมีคำตอบจะมีตัวเลขขึ้นที่ปุ่มบัญชีมุมขวาบน ติดตามทุกเคสได้ที่หน้า แจ้งเคส / ติดตามปัญหา
            </p>
            <div className="mt-2 flex gap-2">
              {onOpenCase ? (
                <button
                  onClick={() => onOpenCase(created.id)}
                  className="rounded-full bg-shine px-4 py-2 font-display text-[13px] font-semibold text-night transition hover:brightness-110"
                >
                  เปิดดูเคส
                </button>
              ) : (
                // A new tab: the studio behind this dialog may still be building.
                <a
                  href={`/cases?id=${created.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-shine px-4 py-2 font-display text-[13px] font-semibold text-night transition hover:brightness-110"
                >
                  เปิดดูเคส
                </a>
              )}
              <button
                onClick={onClose}
                className="rounded-full border border-night-edge px-4 py-2 font-display text-[13px] text-chalk transition hover:bg-chalk/5"
              >
                ปิด
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              {...dropHandlers}
              className={`scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 ${
                dragging ? "ring-2 ring-inset ring-shine/60" : ""
              }`}
            >
              {error && (
                <p className="rounded border border-halt/40 bg-halt/10 px-3 py-2 text-xs text-halt">{error}</p>
              )}

              <div className="flex flex-col gap-1.5">
                <span className="font-display text-[12px] text-chalk-dim">ปัญหาแบบไหน</span>
                <div className="flex flex-wrap gap-1.5">
                  {CASE_KINDS.map((k) => (
                    <button
                      key={k}
                      onClick={() => pickKind(k)}
                      aria-pressed={kind === k}
                      className={`rounded-full border px-3 py-1 font-display text-[12px] transition ${
                        kind === k
                          ? "border-shine bg-shine/15 text-shine"
                          : "border-night-edge text-chalk-dim hover:text-chalk"
                      }`}
                    >
                      {CASE_KIND[k]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-display text-[12px] text-chalk-dim">หัวข้อ</span>
                <input
                  value={title}
                  maxLength={200}
                  placeholder="สรุปปัญหาสั้น ๆ เช่น กดสร้างแล้วหน้าค้างที่ติดตั้งแพ็กเกจ"
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleEdited(true);
                  }}
                  className="rounded-md border border-night-edge bg-night px-3 py-2 text-[13px] text-chalk outline-none placeholder:text-chalk-dim/60 focus:border-shine"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-display text-[12px] text-chalk-dim">เล่าให้ทีมฟัง (ไม่บังคับ)</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onPaste={images.onPaste}
                  rows={4}
                  maxLength={10_000}
                  placeholder="ตอนนั้นกำลังทำอะไร สั่ง AI ว่าอะไร หรืออยากให้ได้ผลแบบไหน — วางภาพหน้าจอตรงนี้ได้เลย"
                  className="resize-y rounded-md border border-night-edge bg-night px-3 py-2 text-[13px] leading-relaxed text-chalk outline-none placeholder:text-chalk-dim/60 focus:border-shine"
                />
              </label>

              <div className="flex flex-col gap-2">
                <ImagePickButton onFiles={(files) => void images.add(files)} disabled={sending} />
                <PendingImages images={images.images} uploading={images.uploading} onRemove={images.remove} />
              </div>

              <div className="rounded-lg border border-night-edge bg-night/60">
                <button
                  onClick={() => setShowContext((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-display text-[12px] text-chalk-dim transition hover:text-chalk"
                >
                  {showContext ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  ข้อมูลที่ระบบแนบให้ทีมด้วย
                </button>
                {showContext && <ContextRows context={context} projectName={preset.projectName ?? null} />}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-night-edge px-4 py-3">
              <button
                onClick={onClose}
                className="rounded-full px-4 py-2 font-display text-[13px] text-chalk-dim transition hover:text-chalk"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void send()}
                disabled={!canSend}
                className="inline-flex items-center gap-1.5 rounded-full bg-shine px-4 py-2 font-display text-[13px] font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                ส่งให้ทีม
              </button>
            </div>
          </>
        )}
      </GlassSurface>
    </Overlay>
  );
}

const PREVIEW_PHASE: Record<GenerationPhase, string> = {
  idle: "ยังไม่ได้เปิด preview",
  generating: "กำลังเขียนโค้ด",
  installing: "กำลังติดตั้งแพ็กเกจ",
  starting: "กำลังเปิดเซิร์ฟเวอร์",
  ready: "preview พร้อมใช้",
  error: "preview มี error",
};

/** The automatic part of a case, as the reporter and the team both see it. */
export function ContextRows({ context, projectName }: { context: CaseContext; projectName: string | null }) {
  const [showLog, setShowLog] = useState(false);
  const phase = context.phase ? (PREVIEW_PHASE[context.phase as GenerationPhase] ?? context.phase) : null;
  const rows: [string, string][] = [
    ...(projectName ? ([["โปรเจกต์", projectName]] as [string, string][]) : []),
    ...(phase ? ([["preview ตอนนั้น", phase]] as [string, string][]) : []),
    ...(context.fileCount !== null ? ([["ไฟล์ที่บันทึกไว้", `${context.fileCount} ไฟล์`]] as [string, string][]) : []),
    ["เวอร์ชัน FITT Builder", context.appVersion],
    ["หน้า", context.page],
    ["เบราว์เซอร์", context.userAgent],
  ];
  return (
    <div className="flex flex-col gap-2 border-t border-night-edge px-3 py-3 text-[12px]">
      {context.error && (
        <pre className="scroll-thin max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-halt/30 bg-halt/5 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-halt">
          {context.error}
        </pre>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-chalk-dim">{k}</dt>
            <dd className="min-w-0 break-words text-chalk">{v}</dd>
          </div>
        ))}
      </dl>
      {context.log.length > 0 && (
        <div>
          <button
            onClick={() => setShowLog((v) => !v)}
            className="inline-flex items-center gap-1 font-display text-[12px] text-chalk-dim transition hover:text-chalk"
          >
            {showLog ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            ล็อก {context.log.length} บรรทัดสุดท้าย
          </button>
          {showLog && (
            <pre className="scroll-thin mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-night-edge bg-night px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-chalk-dim">
              {context.log.join("\n")}
            </pre>
          )}
        </div>
      )}
      {projectName && (
        <p className="text-[11px] text-chalk-dim/80">ทีมดูแลจะเปิดดูไฟล์ในโปรเจกต์นี้เพื่อหาสาเหตุ</p>
      )}
    </div>
  );
}
