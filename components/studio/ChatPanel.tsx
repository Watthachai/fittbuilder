"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FilePenLine,
  FileText,
  GitCompare,
  Lightbulb,
  ListChecks,
  Loader2,
  type LucideIcon,
  Paperclip,
  Send,
  Sparkles,
  Square,
  Wrench,
  X,
} from "lucide-react";
import { isBuildPhase, type PhaseId } from "@/lib/phases";
import type { AgentAction, ChatMessage, LiveMessage } from "@/lib/types";
import DiffViewer from "./DiffViewer";
import Markdown from "./Markdown";

/** Grouped action kinds → header icon + a count-aware Thai header label. */
const GROUP_META: Record<string, { icon: LucideIcon; header: (n: number) => string }> = {
  file: { icon: FilePenLine, header: (n) => `แก้ไข ${n} ไฟล์` },
  deps: { icon: Download, header: (n) => `ติดตั้ง ${n} package` },
  doc: { icon: FileText, header: (n) => `อัปเดตเอกสาร ${n} รายการ` },
};

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
  /** File paths attached as reference chips for the next message. */
  attachments: string[];
  onRemoveAttachment: (path: string) => void;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

/**
 * Collapsible "ความคิด" block, Markdown-rendered. `expanded` forces it open (used
 * while the live turn is still thinking, i.e. no answer text yet) — it
 * auto-collapses once the answer starts; the user can always toggle.
 */
function Thinking({ text, expanded }: { text: string; expanded: boolean }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const show = open || expanded;
  return (
    <div className="mb-1.5 rounded-lg border border-night-edge bg-night/40 px-3 py-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim transition hover:text-chalk"
      >
        <Sparkles size={11} className="text-shine" />
        ความคิด
        {show ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {show && (
        <div className="mt-1.5">
          <Markdown muted>{text}</Markdown>
        </div>
      )}
    </div>
  );
}

type ActionGroup = { kind: string; items: string[] };

/** Split a deps action ("a, b") into individual package names; others stay whole. */
function actionItems(a: AgentAction): string[] {
  return a.icon === "deps" ? a.label.split(", ").filter(Boolean) : [a.label];
}

/** Merge consecutive same-kind actions into groups (drops the legacy "done" summary). */
function groupActions(actions: AgentAction[]): ActionGroup[] {
  const groups: ActionGroup[] = [];
  for (const a of actions) {
    if (a.icon === "done") continue; // group headers already carry the counts
    const last = groups[groups.length - 1];
    if (last && last.kind === a.icon) last.items.push(...actionItems(a));
    else groups.push({ kind: a.icon, items: actionItems(a) });
  }
  return groups;
}

/**
 * "Action history" card (Google AI Studio style): grouped actions with a header,
 * per-item green checkmarks, and a live "working" spinner while the turn streams.
 */
function ActionHistory({ actions, live }: { actions: AgentAction[]; live: boolean }) {
  const groups = groupActions(actions);
  if (groups.length === 0) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-night-edge bg-night/30">
      <div className="flex items-center gap-1.5 border-b border-night-edge px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
        <ListChecks size={12} className="text-shine" />
        Action history
      </div>
      <div className="space-y-2.5 px-3 py-2.5">
        {groups.map((g, gi) => {
          // "Thought for Xs" is a single standalone line — no count header / rows.
          if (g.kind === "thought") {
            return (
              <div key={gi} className="flex items-center gap-1.5 text-[12px] text-chalk">
                <Lightbulb size={13} className="shrink-0 text-chalk-dim" />
                <span>{g.items[0]}</span>
              </div>
            );
          }
          const meta = GROUP_META[g.kind] ?? { icon: Wrench, header: (n: number) => `${n} รายการ` };
          const Icon = meta.icon;
          const lastGroup = gi === groups.length - 1;
          return (
            <div key={gi}>
              <div className="flex items-center gap-1.5 text-[12px] text-chalk">
                <Icon size={13} className="shrink-0 text-chalk-dim" />
                <span>{meta.header(g.items.length)}</span>
              </div>
              <div className="mt-1 space-y-1 pl-[19px]">
                {g.items.map((item, ii) => {
                  const working = live && lastGroup && ii === g.items.length - 1;
                  return (
                    <div key={ii} className="flex items-center justify-between gap-2 text-[12px] text-chalk-dim">
                      <span className="truncate font-mono">{item}</span>
                      {working ? (
                        <Loader2 size={13} className="shrink-0 animate-spin text-shine" />
                      ) : (
                        <CheckCircle2 size={13} className="shrink-0 text-go" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {live && (
          <div className="flex items-center gap-1.5 text-[12px] text-chalk-dim">
            <Loader2 size={13} className="shrink-0 animate-spin text-shine" />
            กำลังทำงาน…
          </div>
        )}
      </div>
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
  attachments,
  onRemoveAttachment,
  onSubmit,
  onCancel,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedAskId, setPickedAskId] = useState<string | null>(null);
  const [diffMsg, setDiffMsg] = useState<ChatMessage | null>(null);
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
              <Thinking text={message.thinking} expanded={false} />
            )}
            <div
              className={`rounded-lg px-3.5 py-2.5 ${
                message.role === "user"
                  ? "whitespace-pre-wrap border border-night-edge bg-night text-[14px] leading-relaxed text-chalk"
                  : "border border-night-edge border-l-2 border-l-shine bg-shine/[0.05] text-chalk"
              }`}
            >
              {message.role === "user" ? message.content : <Markdown>{message.content}</Markdown>}
            </div>
            {message.role === "assistant" && message.actions && (
              <ActionHistory actions={message.actions} live={false} />
            )}
            {message.role === "assistant" && message.changes && message.changes.length > 0 && (
              <button
                onClick={() => setDiffMsg(message)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-night-edge bg-night px-2.5 py-1 font-mono text-[11px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
              >
                <GitCompare size={12} className="text-shine" />
                ดูการเปลี่ยนแปลง ({message.changes.length})
              </button>
            )}
          </div>
        ))}
        {live && (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim">
              {agentName}
            </p>
            <Thinking text={live.thinking} expanded={!live.content} />
            {(live.content || !live.thinking) && (
              <div className="rounded-lg border border-night-edge border-l-2 border-l-shine bg-shine/[0.05] px-3.5 py-2.5 text-chalk">
                {live.content ? (
                  <Markdown>{live.content}</Markdown>
                ) : (
                  <span className="text-[14px] text-chalk-dim">
                    {inBuild ? "กำลังเขียนโค้ด" : "กำลังพิมพ์"}
                  </span>
                )}
                <span className="caret-blink text-shine">▍</span>
              </div>
            )}
            <ActionHistory actions={live.actions} live />
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
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
              {attachments.map((path) => (
                <span
                  key={path}
                  className="inline-flex items-center gap-1 rounded-md border border-night-edge bg-night-panel px-2 py-0.5 font-mono text-[10px] text-chalk-dim"
                >
                  <Paperclip size={9} className="text-shine" />
                  <span className="max-w-[160px] truncate">{path}</span>
                  <button
                    onClick={() => onRemoveAttachment(path)}
                    title="เอาออก"
                    className="text-chalk-dim transition hover:text-halt"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
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

      {diffMsg?.changes && (
        <DiffViewer
          changes={diffMsg.changes}
          title={diffMsg.content.split("\n")[0].slice(0, 60)}
          onClose={() => setDiffMsg(null)}
        />
      )}
    </div>
  );
}
