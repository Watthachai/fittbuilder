"use client";

import { useEffect, useState } from "react";
import { GitCommitVertical, History, Loader2, RotateCcw, Sparkles, Undo2, Zap } from "lucide-react";
import { listRevisions, revisionChanges, shaOf, type Revision, type RevisionKind } from "@/lib/revisions";
import { toast } from "@/lib/toast";
import type { FileChange, ProjectFiles } from "@/lib/types";
import DiffViewer from "./DiffViewer";

/**
 * Version history, read like a commit log.
 *
 * Rolling back is a destructive act on the working state, so it belongs here —
 * a place you go on purpose — not inline in the conversation where it sits under
 * the cursor while you read. The chat only carries the checkpoint's identity.
 */

const KIND_META: Record<RevisionKind, { label: string; icon: typeof Sparkles; className: string }> =
  {
    ai: { label: "AI", icon: Sparkles, className: "text-shine" },
    quick: { label: "ปรับเร็ว", icon: Zap, className: "text-amber-300" },
    restore: { label: "ย้อนกลับ", icon: Undo2, className: "text-chalk-dim" },
  };

function when(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "เมื่อครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ชม.ที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

interface HistoryPanelProps {
  projectId: string;
  /** Bump to refetch (a new checkpoint just landed). */
  refreshKey: number;
  /** Restore this checkpoint's files (absent for read-only viewers). */
  onRollback?: (sha: string) => void | Promise<void>;
  /**
   * The project's files right now — used to find which checkpoint it is
   * actually sitting on.
   *
   * Position in the list does not answer that. Files can move without a
   * checkpoint being written (work that landed in the background used to do
   * exactly that), and then the newest row is not where the project is: a real
   * session showed "ล่าสุด" on a 32-file snapshot of a 41-file project. A label
   * that names the wrong state is worse than no label, because rolling "back"
   * to it silently discards everything since.
   */
  currentFiles: ProjectFiles | null;
}

export default function HistoryPanel({
  projectId,
  refreshKey,
  onRollback,
  currentFiles,
}: HistoryPanelProps) {
  const [rows, setRows] = useState<Revision[] | null>(null);
  /** sha of what is on screen — matched against the list, never assumed. */
  const [currentSha, setCurrentSha] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ sha: string; changes: FileChange[] } | null>(null);
  const [loadingSha, setLoadingSha] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRevisions(projectId)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sha = currentFiles ? await shaOf(currentFiles) : null;
      if (!cancelled) setCurrentSha(sha);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFiles]);

  const openDiff = async (rev: Revision) => {
    setLoadingSha(rev.sha);
    try {
      const changes = await revisionChanges(projectId, rev.sha, rev.parentSha);
      if (!changes) {
        toast.error("ดูการเปลี่ยนแปลงไม่ได้", { description: "เวอร์ชันนี้ถูกลบออกจากประวัติแล้ว" });
        return;
      }
      setDiff({ sha: rev.sha, changes });
    } finally {
      setLoadingSha(null);
    }
  };

  if (rows === null) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-chalk-dim">
        <Loader2 size={14} className="animate-spin text-shine" /> กำลังโหลดประวัติ…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-grid flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <History size={22} className="text-chalk-dim" />
        <p className="font-display text-sm text-chalk-dim">ยังไม่มีประวัติเวอร์ชัน</p>
        <p className="max-w-sm text-xs leading-relaxed text-chalk-dim/70">
          ทุกครั้งที่ AI แก้โค้ดให้ หรือคุณใช้ Wand ปรับอะไรสักอย่าง ระบบจะบันทึกจุดกลับไว้ที่นี่
          — ย้อนกลับไปจุดไหนก็ได้ โดยไม่ทำให้จุดอื่นหาย
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto bg-night">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-night-edge bg-night-panel px-4 py-2">
        <History size={13} className="text-shine" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim">
          ประวัติเวอร์ชัน · {rows.length}
        </span>
        <span className="ml-auto text-[10px] text-chalk-dim/70">เก็บ 30 จุดล่าสุด</span>
      </div>
      {/* No row matches what is on screen: the project has moved past every
          checkpoint. Say so — otherwise the newest row looks like where you are,
          and rolling "back" to it quietly throws away everything since. */}
      {rows && rows.length > 0 && currentSha !== null && !rows.some((r) => r.sha === currentSha) && (
        <div className="border-b border-night-edge bg-night-panel/60 px-4 py-2 text-[11px] leading-relaxed text-chalk-dim">
          ไฟล์ตอนนี้ยังไม่ตรงกับจุดใดในประวัติ — มีการแก้ไขหลังจุดล่าสุด
          กดย้อนกลับจะทิ้งส่วนนั้นไป
        </div>
      )}

      <ol className="px-4 py-3">
        {rows.map((rev, i) => {
          const meta = KIND_META[rev.kind] ?? KIND_META.ai;
          const Icon = meta.icon;
          // Content, not position: this is the checkpoint the project is on.
          const latest = currentSha !== null && rev.sha === currentSha;
          return (
            <li key={rev.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Timeline rail */}
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                    latest ? "border-shine bg-shine/15" : "border-night-edge bg-night-panel"
                  }`}
                >
                  <Icon size={12} className={meta.className} />
                </span>
                {i < rows.length - 1 && <span className="mt-1 w-px flex-1 bg-night-edge" />}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <code className="rounded bg-night-panel px-1.5 py-0.5 font-mono text-[11px] text-shine">
                    {rev.sha}
                  </code>
                  {latest && (
                    <span className="rounded-full bg-go/15 px-1.5 py-0.5 font-display text-[10px] text-go">
                      ล่าสุด
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-chalk-dim/70">{when(rev.createdAt)}</span>
                </div>
                <p className="mt-0.5 break-words text-[13px] leading-relaxed text-chalk">
                  {rev.label}
                </p>
                {rev.targetLoc && (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-chalk-dim">
                    {rev.targetLoc.split("/").pop()}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => void openDiff(rev)}
                    disabled={loadingSha === rev.sha}
                    className="inline-flex items-center gap-1.5 rounded-md border border-night-edge bg-night-panel px-2 py-1 font-display text-[11px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk disabled:opacity-50"
                  >
                    {loadingSha === rev.sha ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <GitCommitVertical size={11} className="text-shine" />
                    )}
                    ดูการเปลี่ยนแปลง
                  </button>
                  {onRollback && !latest && (
                    <button
                      onClick={() => void onRollback(rev.sha)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-night-edge bg-night-panel px-2 py-1 font-display text-[11px] text-chalk-dim transition hover:border-halt/60 hover:text-chalk"
                    >
                      <RotateCcw size={11} className="text-halt" />
                      ย้อนกลับมาที่นี่
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {diff && (
        <DiffViewer
          changes={diff.changes}
          title={`การเปลี่ยนแปลงในเวอร์ชัน ${diff.sha}`}
          onClose={() => setDiff(null)}
        />
      )}
    </div>
  );
}
