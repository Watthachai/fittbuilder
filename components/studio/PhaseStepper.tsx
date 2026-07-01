"use client";

import { ArrowRight, Check, FileText, RotateCcw } from "lucide-react";
import { PHASES, phaseDef, phaseIndex, type PhaseId } from "@/lib/phases";

/** Review phases whose advance gate needs an AI-generated report doc. */
const REPORT_PHASES: PhaseId[] = ["verify", "review"];

/** Why the current phase can't advance yet (shown as the disabled tooltip). */
function gateHint(phase: PhaseId): string {
  switch (phase) {
    case "define":
      return "ยังไม่มี BRD — คุยกับ AI ให้ช่วยร่างก่อน";
    case "plan":
      return "ยังไม่มี PRD — คุยกับ AI ให้ช่วยร่างก่อน";
    case "build":
      return "ยังไม่มีแอป — สั่ง AI ให้สร้างก่อน";
    case "verify":
      return "ยังไม่มีรายงาน Verify — กด “สร้างรายงาน Verify” ก่อน";
    case "review":
      return "ยังไม่มีรายงาน Review — กด “สร้างรายงาน Review” ก่อน";
    default:
      return "ยังทำเฟสนี้ไม่เสร็จ";
  }
}

interface PhaseStepperProps {
  phase: PhaseId;
  busy: boolean;
  /** The current phase's exit gate is satisfied (doc/app ready). */
  canAdvance: boolean;
  /** An app + BRD/PRD exist, so the user can regenerate from the docs. */
  canRework: boolean;
  /** Multi-party approval tally for the current phase (null = solo project). */
  approval: { approved: number; total: number; mine: boolean } | null;
  onAdvance: () => void;
  /** Click a completed step → jump back to that phase or preview its doc. */
  onStep: (phase: PhaseId) => void;
  /** Force the current review phase's agent to emit its report doc. */
  onGenerateDoc: () => void;
  onRework: () => void;
}

export default function PhaseStepper({
  phase,
  busy,
  canAdvance,
  canRework,
  approval,
  onAdvance,
  onStep,
  onGenerateDoc,
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
                onClick={() => done && onStep(step.id)}
                title={done ? `${step.user} — ย้อนกลับมาแก้ หรือดูเอกสาร` : `${step.user} / ${step.dev} — ${step.blurb}`}
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

      {/* Escape hatch: if a review phase's report doc doesn't exist yet, let the
          user (re)generate it so the approve gate can open. */}
      {REPORT_PHASES.includes(phase) && !canAdvance && (
        <button
          onClick={onGenerateDoc}
          disabled={busy}
          title={`ให้ผู้ตรวจสอบสร้างรายงาน ${phaseDef(phase).user} ให้ (docs/${phase.toUpperCase()}.md)`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-shine/50 px-2.5 py-1.5 font-display text-xs font-medium text-shine transition hover:bg-shine/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FileText size={12} /> สร้างรายงาน {phaseDef(phase).user}
        </button>
      )}

      {/* Shared projects: this stays clickable even after you've approved, so you
          can reopen the modal to see who's still pending. Solo: `waiting` is never
          true (no approval tally), so it advances directly. */}
      {!isLast && (
        <button
          onClick={onAdvance}
          disabled={!canAdvance || busy}
          title={
            !canAdvance
              ? gateHint(phase)
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
