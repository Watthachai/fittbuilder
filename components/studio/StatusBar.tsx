"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Terminal } from "lucide-react";
import type { GenerationPhase } from "@/lib/types";

const STEPS: { id: GenerationPhase; label: string }[] = [
  { id: "generating", label: "เขียนโค้ด" },
  { id: "installing", label: "ติดตั้ง" },
  { id: "starting", label: "เปิดเซิร์ฟเวอร์" },
  { id: "ready", label: "พร้อม" },
];

interface StatusBarProps {
  phase: GenerationPhase;
  errorMessage: string | null;
  terminal: string[];
  canFix: boolean;
  onRetry: () => void;
  onFixWithAi: () => void;
}

export default function StatusBar({
  phase,
  errorMessage,
  terminal,
  canFix,
  onRetry,
  onFixWithAi,
}: StatusBarProps) {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Pop the terminal open when entering the error state (render-time
  // adjustment instead of an effect — avoids a cascading re-render).
  const [prevPhase, setPrevPhase] = useState(phase);
  if (phase !== prevPhase) {
    setPrevPhase(phase);
    if (phase === "error") setTerminalOpen(true);
  }

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [terminal, terminalOpen]);

  const activeIndex = STEPS.findIndex((step) => step.id === phase);
  const busy = phase === "generating" || phase === "installing" || phase === "starting";

  return (
    <div className="shrink-0 border-t border-night-edge bg-night-panel">
      {/* Sweep progress line while busy */}
      <div className="relative h-0.5 overflow-hidden bg-night">
        {busy && <div className="progress-sweep absolute h-full w-1/3 bg-shine" />}
        {phase === "ready" && <div className="absolute h-full w-full bg-go/60" />}
        {phase === "error" && <div className="absolute h-full w-full bg-halt" />}
      </div>

      <div className="flex h-9 items-center gap-4 px-3">
        {/* Step indicators */}
        <ol className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
          {STEPS.map((step, index) => {
            const isDone =
              (activeIndex > index || phase === "ready") && phase !== "error";
            const isActive = step.id === phase;
            return (
              <li key={step.id} className="flex items-center gap-1">
                {index > 0 && <span className="text-night-edge">—</span>}
                <span
                  className={
                    isActive
                      ? step.id === "ready"
                        ? "text-go"
                        : "animate-pulse text-shine"
                      : isDone
                        ? "text-go"
                        : "text-chalk-dim/50"
                  }
                >
                  {isDone && step.id !== "ready" ? "✓ " : ""}
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        {phase === "error" && errorMessage && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-[12px] text-halt">{errorMessage}</span>
            <button
              onClick={onRetry}
              className="shrink-0 rounded-sm border border-night-edge px-2 py-0.5 text-[11px] text-chalk transition hover:border-shine"
            >
              ลองใหม่
            </button>
            {canFix && (
              <button
                onClick={onFixWithAi}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-shine px-2 py-0.5 text-[11px] font-medium text-black transition hover:bg-shine-soft"
              >
                <Sparkles size={10} /> แก้ด้วย AI
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => setTerminalOpen((open) => !open)}
          className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-chalk-dim transition hover:text-chalk"
        >
          <Terminal size={12} />
          terminal
          {terminalOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {terminalOpen && (
        <div
          ref={logRef}
          className="scroll-thin h-44 overflow-y-auto border-t border-night-edge bg-[#0d0c09] px-3 py-2 font-mono text-[11px] leading-relaxed text-chalk-dim"
        >
          {terminal.length === 0 ? (
            <span className="opacity-50">— ยังไม่มี log —</span>
          ) : (
            terminal.map((line, index) => (
              <div key={index} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
