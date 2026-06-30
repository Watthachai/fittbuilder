"use client";

import { useState } from "react";
import { ChevronDown, FileText, Rocket, Send, Server, X } from "lucide-react";
import Markdown from "./Markdown";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import type { ProjectRecord } from "@/lib/types";
import {
  buildFittcorePayload,
  buildFittcoreSpec,
  type FittcoreRunnerResult,
} from "@/lib/fittcore";
import { toast } from "@/lib/toast";

/** Human-readable KB from a raw byte/char count. */
function kb(chars: number): string {
  return `${(chars / 1024).toFixed(chars < 102_400 ? 1 : 0)} KB`;
}

/**
 * PREVIEW-then-send modal for handing a project off to the FITT Code Runner.
 * Shows exactly what will be POSTed (summary + per-file list + the human spec),
 * then on confirm sends `buildFittcorePayload(project)` to /api/fittcore and
 * reports the Runner's queued build (build #, branch).
 */
export default function FittcoreExportModal({
  open,
  onClose,
  project,
  orgName,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectRecord;
  orgName?: string;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<FittcoreRunnerResult | null>(null);
  const [showSpec, setShowSpec] = useState(false);

  if (!open) return null;

  const payload = buildFittcorePayload(project, orgName);
  const totalChars = payload.files.reduce((n, f) => n + f.content.length, 0);
  const files = [...payload.files].sort((a, b) => a.path.localeCompare(b.path));

  const close = () => {
    if (sending) return;
    setResult(null);
    setShowSpec(false);
    onClose();
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/fittcore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Partial<FittcoreRunnerResult> & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `ส่งไม่สำเร็จ (HTTP ${res.status})`);

      const ok = data as FittcoreRunnerResult;
      setResult(ok);
      toast.success(`ส่งสำเร็จ — build #${ok.build_no}, branch ${ok.git_branch}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ส่งไป Code Runner ไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  return (
    <Overlay open onClose={close} placement="center">
      <GlassSurface
        strong
        className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-night-edge px-5 py-3.5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-shine/10 text-shine">
              <Server size={16} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-chalk">ส่งไป FITT Code Runner</p>
              <p className="truncate font-mono text-[11px] text-chalk-dim">
                target · Watthachai/coderunner_test.git
              </p>
            </div>
          </div>
          <button
            onClick={close}
            disabled={sending}
            aria-label="ปิด"
            className="shrink-0 text-chalk-dim transition hover:text-chalk disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {result ? (
            <SuccessPanel result={result} />
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-night-edge bg-night-edge sm:grid-cols-3">
                <Stat label="โปรเจกต์" value={project.name} />
                <Stat label="project_id" value={project.id} mono />
                <Stat label="org_id" value={payload.org_id || "—"} mono />
                <Stat label="ไฟล์" value={`${payload.files.length} ไฟล์`} />
                <Stat label="ขนาดรวม" value={kb(totalChars)} />
                <Stat label="prompts" value={`${payload.prompts.length} ข้อความ`} />
                <Stat label="BRD" value={payload.brd ? "มี" : "—"} />
                <Stat label="PRD" value={payload.prd ? "มี" : "—"} />
                {orgName ? <Stat label="org_name" value={orgName} /> : null}
              </div>

              {/* File list */}
              <p className="mb-1.5 mt-4 font-display text-xs font-semibold text-chalk-dim">
                ไฟล์ที่จะส่ง ({files.length})
              </p>
              <ul className="scroll-thin max-h-64 overflow-y-auto rounded-lg border border-night-edge bg-night">
                {files.map((f) => (
                  <li
                    key={f.path}
                    className="flex items-center justify-between gap-3 border-b border-night-edge px-3 py-1.5 text-[12px] last:border-b-0"
                  >
                    <span className="truncate font-mono text-chalk/85">{f.path}</span>
                    <span className="shrink-0 font-mono text-[11px] text-chalk-dim">
                      {kb(f.content.length)}
                    </span>
                  </li>
                ))}
                {files.length === 0 && (
                  <li className="px-3 py-2 text-[12px] text-chalk-dim">(ยังไม่มีไฟล์)</li>
                )}
              </ul>

              {/* Collapsible human spec */}
              <button
                onClick={() => setShowSpec((v) => !v)}
                className="mt-4 flex w-full items-center gap-2 rounded-lg border border-night-edge bg-night px-3 py-2 text-left text-xs text-chalk/80 transition hover:text-chalk"
              >
                <FileText size={13} className="text-shine" />
                <span className="flex-1 font-display font-semibold">ดู spec แบบเต็ม (Markdown)</span>
                <ChevronDown
                  size={15}
                  className={`shrink-0 text-chalk-dim transition ${showSpec ? "rotate-180" : ""}`}
                />
              </button>
              {showSpec && (
                <div className="scroll-thin mt-2 max-h-96 overflow-y-auto rounded-lg border border-night-edge bg-night px-4 py-3">
                  <Markdown>{buildFittcoreSpec(project)}</Markdown>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-night-edge bg-night px-5 py-3">
          {result ? (
            <button
              onClick={close}
              className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:bg-shine-soft"
            >
              เสร็จสิ้น
            </button>
          ) : (
            <>
              <button
                onClick={close}
                disabled={sending}
                className="rounded-lg border border-night-edge px-4 py-2 text-sm text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void send()}
                disabled={sending || payload.files.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:bg-shine-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <>
                    <Rocket size={14} className="animate-pulse" /> กำลังส่ง…
                  </>
                ) : (
                  <>
                    <Send size={14} /> ยืนยันส่ง
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </GlassSurface>
    </Overlay>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-night-panel px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-chalk-dim">{label}</p>
      <p className={`truncate text-[13px] text-chalk ${mono ? "font-mono text-[11px]" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function SuccessPanel({ result }: { result: FittcoreRunnerResult }) {
  return (
    <div>
      <div className="flex items-center gap-3 rounded-lg border border-shine/40 bg-shine/[0.06] px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-shine/15 text-shine">
          <Rocket size={18} />
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-chalk">
            เข้าคิว build แล้ว — build #{result.build_no}
          </p>
          <p className="text-[12px] text-chalk-dim">สถานะ: {result.status}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-night-edge bg-night-edge">
        <Stat label="project_id" value={result.project_id} mono />
        <Stat label="job_id" value={result.job_id} mono />
        <Stat label="branch" value={result.git_branch} mono />
        <Stat label="org_id" value={result.org_id || "—"} mono />
      </div>
      <p className="mb-1.5 mt-3 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
        git remote
      </p>
      <a
        href={result.git_remote}
        target="_blank"
        rel="noreferrer"
        className="block truncate rounded-lg border border-night-edge bg-night px-3 py-2 font-mono text-[12px] text-shine underline-offset-2 hover:underline"
      >
        {result.git_remote}
      </a>
    </div>
  );
}
