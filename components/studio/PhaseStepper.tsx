"use client";

import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { PHASES, phaseIndex, type PhaseId } from "@/lib/phases";

interface PhaseStepperProps {
  phase: PhaseId;
  busy: boolean;
  /** The current phase's exit gate is satisfied (doc/app ready). */
  canAdvance: boolean;
  /** An app + BRD/PRD exist, so the user can regenerate from the docs. */
  canRework: boolean;
  onAdvance: () => void;
  onNavigate: (phase: PhaseId) => void;
  onRework: () => void;
}

export default function PhaseStepper({
  phase,
  busy,
  canAdvance,
  canRework,
  onAdvance,
  onNavigate,
  onRework,
}: PhaseStepperProps) {
  const currentIndex = phaseIndex(phase);
  const isLast = currentIndex === PHASES.length - 1;

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-night-edge bg-night-panel px-3">
      <ol className="scroll-thin flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {PHASES.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const reachable = index <= currentIndex;
          return (
            <li key={step.id} className="flex shrink-0 items-center gap-1">
              {index > 0 && (
                <span className={`h-px w-3 ${done || active ? "bg-shine/50" : "bg-night-edge"}`} />
              )}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onNavigate(step.id)}
                title={`${step.user} / ${step.dev} — ${step.blurb}`}
                className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs transition ${
                  active
                    ? "bg-shine font-semibold text-black"
                    : done
                      ? "text-go hover:bg-white/5"
                      : "cursor-default text-chalk-dim/50"
                } ${reachable && !active ? "cursor-pointer" : ""}`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${
                    active
                      ? "bg-black/20 text-black"
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

      {!isLast && (
        <button
          onClick={onAdvance}
          disabled={!canAdvance || busy}
          title={canAdvance ? "อนุมัติเฟสนี้แล้วไปเฟสถัดไป" : "ยังทำเฟสนี้ไม่เสร็จ"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-shine px-3 py-1.5 font-display text-xs font-semibold text-black transition hover:bg-shine-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          อนุมัติ & ไปต่อ <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
