"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Send, Square } from "lucide-react";
import { isBuildPhase, type PhaseId } from "@/lib/phases";
import type { AgentAction, ChatMessage, LiveMessage } from "@/lib/types";

const MAX_CHARS = 500;

interface ChatPanelProps {
  messages: ChatMessage[];
  /** Input is disabled while the phase's worker runs. */
  busy: boolean;
  /** The agent/model is actively producing this phase's output. */
  streaming: boolean;
  /** Current workflow phase (define → … → ship). */
  workflowPhase: PhaseId;
  /** Display name of the agent that owns the current phase. */
  agentName: string;
  /** The in-progress assistant turn (thinking/text/actions), or null when idle. */
  live: LiveMessage | null;
  /** A runnable app exists (package.json generated). */
  hasApp: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

/** Collapsible "💭 ความคิด" block. Expanded while live; collapsed (toggle) otherwise. */
function Thinking({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mb-1.5 rounded-md border-l-2 border-night-edge bg-night/40 px-2.5 py-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim transition hover:text-chalk"
      >
        💭 ความคิด {open ? "▾" : "▸"}
      </button>
      {(open || live) && (
        <p className="mt-1 whitespace-pre-wrap text-[12px] italic leading-relaxed text-chalk-dim">
          {text}
        </p>
      )}
    </div>
  );
}

/** Inline "what the AI did" chips. */
function ActionChips({ actions }: { actions: AgentAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {actions.map((a, i) => (
        <span
          key={i}
          className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-night-edge bg-night px-2 py-0.5 font-mono text-[10px] text-chalk-dim"
        >
          {a.icon} <span className="truncate">{a.label}</span>
        </span>
      ))}
    </div>
  );
}

export default function ChatPanel({
  messages,
  busy,
  streaming,
  workflowPhase,
  agentName,
  live,
  hasApp,
  onSubmit,
  onCancel,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedAskId, setPickedAskId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The clickable choices belong to the latest assistant turn, and only while
  // we're idle (a new streaming turn or a user reply clears them).
  const last = messages[messages.length - 1];
  const activeAsk =
    !busy && !streaming && last?.role === "assistant" && last.ask ? last.ask : null;
  const activeAskId = activeAsk ? last!.id : null;

  // Reset multi-select when a new question appears (render-time sync, not an effect).
  if (activeAskId !== pickedAskId) {
    setPickedAskId(activeAskId);
    setPicked([]);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy, activeAskId, live]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    onSubmit(text.trim());
    setDraft("");
  };

  const onOption = (option: string) => {
    if (busy) return;
    if (activeAsk?.multi) {
      setPicked((prev) =>
        prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
      );
    } else {
      send(option);
    }
  };

  const inBuild = isBuildPhase(workflowPhase);
  const placeholder = activeAsk
    ? activeAsk.allowText === false
      ? "เลือกตัวเลือกด้านบน หรือพิมพ์เพิ่มเติม…"
      : "หรือพิมพ์คำตอบเอง…"
    : inBuild
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
            {message.role === "assistant" && message.thinking && (
              <Thinking text={message.thinking} live={false} />
            )}
            <div
              className={`whitespace-pre-wrap rounded-md px-3.5 py-2.5 text-[14px] leading-relaxed ${
                message.role === "user"
                  ? "border border-night-edge bg-night text-chalk"
                  : "border-l-2 border-shine bg-shine/[0.07] text-chalk"
              }`}
            >
              {message.content}
            </div>
            {message.role === "assistant" && message.actions && (
              <ActionChips actions={message.actions} />
            )}
          </div>
        ))}
        {live && (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim">
              {agentName}
            </p>
            <Thinking text={live.thinking} live />
            {(live.content || !live.thinking) && (
              <div className="whitespace-pre-wrap rounded-md border-l-2 border-shine bg-shine/[0.08] px-3.5 py-2.5 text-[14px] leading-relaxed text-chalk">
                {live.content || (inBuild ? "กำลังเขียนโค้ด" : "กำลังพิมพ์")}
                <span className="caret-blink text-shine">▍</span>
              </div>
            )}
            <ActionChips actions={live.actions} />
          </div>
        )}
      </div>

      {/* Interactive choices for the latest question */}
      {activeAsk && (
        <div className="shrink-0 border-t border-night-edge bg-night px-3 pt-3">
          {activeAsk.question && (
            <p className="mb-2 font-display text-[12px] text-chalk-dim">
              {activeAsk.question}
              {activeAsk.multi && <span className="ml-1 text-chalk-dim/60">(เลือกได้หลายข้อ)</span>}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            {activeAsk.options.map((option, index) => {
              const selected = picked.includes(option);
              return (
                <button
                  key={option}
                  onClick={() => onOption(option)}
                  className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[13px] transition ${
                    selected
                      ? "border-shine bg-shine/10 text-chalk"
                      : "border-night-edge bg-night-panel text-chalk hover:border-shine/60"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold ${
                      selected ? "bg-shine text-black" : "border border-night-edge text-chalk-dim"
                    }`}
                  >
                    {activeAsk.multi && selected ? <Check size={11} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{option}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {activeAsk.multi && (
              <button
                onClick={() => send(picked.join(", "))}
                disabled={picked.length === 0}
                className="inline-flex items-center gap-1.5 rounded-sm bg-shine px-3 py-1.5 font-display text-xs font-semibold text-black transition hover:bg-shine-soft disabled:opacity-40"
              >
                ยืนยัน{picked.length > 0 ? ` (${picked.length})` : ""}
              </button>
            )}
            <button
              onClick={() => send("ข้ามคำถามนี้")}
              className="rounded-sm border border-night-edge px-3 py-1.5 font-display text-xs text-chalk-dim transition hover:text-chalk"
            >
              ข้าม
            </button>
          </div>
        </div>
      )}

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
                send(draft);
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
                onClick={() => send(draft)}
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
