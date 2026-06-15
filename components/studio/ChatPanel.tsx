"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import { isBuildPhase, type PhaseId } from "@/lib/phases";
import type { ChatMessage, GenerationPhase } from "@/lib/types";

const MAX_CHARS = 500;

interface ChatPanelProps {
  messages: ChatMessage[];
  /** WebContainer build/run status. */
  busy: boolean;
  phase: GenerationPhase;
  /** Current workflow phase (define → … → ship). */
  workflowPhase: PhaseId;
  /** Display name of the agent that owns the current phase. */
  agentName: string;
  streamedChars: number;
  /** A runnable app exists (package.json generated). */
  hasApp: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export default function ChatPanel({
  messages,
  busy,
  phase,
  workflowPhase,
  agentName,
  streamedChars,
  hasApp,
  onSubmit,
  onCancel,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  const submit = () => {
    if (!draft.trim() || busy) return;
    onSubmit(draft.trim());
    setDraft("");
  };

  const inBuild = isBuildPhase(workflowPhase);
  const placeholder = inBuild
    ? hasApp
      ? 'แก้ด้วยภาษาธรรมดา เช่น "เปลี่ยนสีปุ่มเป็นน้ำเงิน"'
      : 'อยากได้เว็บแบบไหน? เช่น "landing page ร้านกาแฟ"'
    : `พิมพ์ข้อความถึง ${agentName}…`;
  const sendLabel = inBuild ? (hasApp ? "แก้ไข" : "สร้าง") : "ส่ง";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-night-panel">
      <div
        ref={scrollRef}
        className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && !busy && (
          <div className="mt-8 text-center">
            <p className="font-display text-sm text-chalk-dim">
              {inBuild ? (
                <>
                  พิมพ์สิ่งที่อยากได้ด้านล่าง
                  <br />
                  แล้วดู demo ก่อตัวขึ้นทางขวา
                </>
              ) : (
                <>
                  {agentName}กำลังเริ่มบทสนทนา
                  <br />
                  ตอบคำถามทีละข้อเพื่อสร้างเอกสาร
                </>
              )}
            </p>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim">
              {message.role === "user" ? "คุณ" : agentName}
            </p>
            <div
              className={`whitespace-pre-wrap rounded-md px-3.5 py-2.5 text-[14px] leading-relaxed ${
                message.role === "user"
                  ? "border border-night-edge bg-night text-chalk"
                  : "border-l-2 border-shine bg-shine/[0.07] text-chalk"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {phase === "generating" && (
          <div className="rounded-md border-l-2 border-shine bg-shine/[0.08] px-3.5 py-2.5">
            <p className="font-display text-[13px] text-chalk">
              {inBuild ? "กำลังเขียนโค้ด" : "กำลังพิมพ์"}
              <span className="caret-blink text-shine">▍</span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-chalk-dim">
              {streamedChars.toLocaleString()} ตัวอักษร… (กด Esc เพื่อยกเลิก)
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-night-edge p-3">
        <div className="rounded-md border border-night-edge bg-night focus-within:border-shine">
          <textarea
            value={draft}
            maxLength={MAX_CHARS}
            rows={2}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="block w-full resize-none bg-transparent px-3 py-2.5 text-[14px] text-chalk outline-none placeholder:text-chalk-dim/60 disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="font-mono text-[10px] text-chalk-dim">
              {draft.length}/{MAX_CHARS}
            </span>
            {busy ? (
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-sm border border-halt/60 px-3 py-1.5 font-display text-xs font-medium text-halt transition hover:bg-halt/10"
              >
                <Square size={11} /> หยุด (Esc)
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-sm bg-shine px-3 py-1.5 font-display text-xs font-semibold text-black transition hover:bg-shine-soft disabled:opacity-40"
              >
                <Send size={11} /> {sendLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
