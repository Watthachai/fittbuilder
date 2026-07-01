"use client";

import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { PHASES, phaseIndex, type PhaseId } from "@/lib/phases";
import ApprovalRoster from "./ApprovalRoster";

interface PhaseStepperProps {
  phase: PhaseId;
  /** Current project id — for the shared-project approval roster. */
  projectId: string;
  busy: boolean;
  /** The current phase's exit gate is satisfied (doc/app ready). */
  canAdvance: boolean;
  /** An app + BRD/PRD exist, so the user can regenerate from the docs. */
  canRework: boolean;
  /** Multi-party approval tally for the current phase (null = solo project). */
  approval: { approved: number; total: number; mine: boolean } | null;
  onAdvance: () => void;
  /** Click a completed step → preview that phase's document (does not move phase). */
  onPreview: (phase: PhaseId) => void;
  onRework: () => void;
}

export default function PhaseStepper({
  phase,
  projectId,
  busy,
  canAdvance,
  canRework,
  approval,
  onAdvance,
  onPreview,
  onRework,
}: PhaseStepperProps) {
  const currentIndex = phaseIndex(phase);
  const isLast = currentIndex === PHASES.length - 1;
  // Shared project: this member approved but others haven't → wait.
  const waiting = approval ? approval.mine && approval.approved < approval.total : false;
  const advanceLabel = approval
    ? `${waiting ? "รออนุมัติ" : "อนุมัติ"} ${approval.approved}/${approval.total}`
    : "อนุมัติ & ไปต่อ";

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-night-edge bg-night-panel px-3">
      <ol className="scroll-thin flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {PHASES.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          // Only completed steps are clickable — they open a doc preview. The
          // active step is where you are; future steps aren't reachable yet.
          return (
            <li key={step.id} className="flex shrink-0 items-center gap-1">
              {index > 0 && (
                <span className={`h-px w-3 ${done || active ? "bg-shine/50" : "bg-night-edge"}`} />
              )}
              <button
                type="button"
                disabled={!done}
                onClick={() => done && onPreview(step.id)}
                title={done ? `ดูเอกสาร ${step.user}` : `${step.user} / ${step.dev} — ${step.blurb}`}
                className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs transition ${
                  active
                    ? "bg-shine font-semibold text-night"
                    : done
                      ? "cursor-pointer text-go hover:bg-chalk/5"
                      : "cursor-default text-chalk-dim/50"
                }`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${
                    active
                      ? "bg-night/20 text-night"
                      : done
                        ? "bg-go/20 text-go"
                        : "border border-night-edge text-chalk-dim/50"
                  }`}
                >
                  {done ? <Check size={10} /> : index + 1}
                </span>
                {step.user}
              </button>
            </li>
          );
        })}
      </ol>

      {canRework && (
        <button
          onClick={onRework}
          disabled={busy}
          title="สร้างเว็บใหม่จาก BRD/PRD ปัจจุบัน (แทนที่โค้ดเดิม · ย้อนได้ด้วย Undo)"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 font-display text-xs font-medium text-chalk-dim transition hover:border-shine/60 hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={12} /> สร้างใหม่จากเอกสาร
        </button>
      )}

      {approval && <ApprovalRoster projectId={projectId} phase={phase} />}

      {!isLast && (
        <button
          onClick={onAdvance}
          disabled={!canAdvance || busy || waiting}
          title={
            !canAdvance
              ? "ยังทำเฟสนี้ไม่เสร็จ"
              : approval
                ? waiting
                  ? "คุณอนุมัติแล้ว — รอสมาชิกที่เหลืออนุมัติให้ครบ"
                  : "อนุมัติเฟสนี้ (จะไปต่อเมื่อทุกคนอนุมัติครบ)"
                : "อนุมัติเฟสนี้แล้วไปเฟสถัดไป"
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-shine px-3 py-1.5 font-display text-xs font-semibold text-night transition hover:bg-shine-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {advanceLabel} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
