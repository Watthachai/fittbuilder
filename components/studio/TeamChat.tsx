"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CornerUpLeft,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listMembers } from "@/lib/sharing";
import {
  deleteMessage,
  loadMessages,
  sendMessage,
  sendSystemMessage,
  toggleReaction,
  uploadAttachment,
} from "@/lib/team-chat";
import { onSystemLog } from "@/lib/team-chat-bus";
import { toast } from "@/lib/toast";
import { useFileDrop } from "@/lib/useFileDrop";
import DropOverlay from "@/components/ui/DropOverlay";
import ImageLightbox from "@/components/ui/ImageLightbox";
import type { TeamChatAttachment, TeamChatMessage, TeamChatReplyRef } from "@/lib/types";

const TYPING_TTL = 2500;
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏"];

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/** Pure: add/remove a user's emoji on a message's reaction tallies. */
function applyReaction(
  m: TeamChatMessage,
  emoji: string,
  userId: string,
  op: "add" | "remove"
): TeamChatMessage {
  const reactions = m.reactions.map((r) => ({ ...r, userIds: [...r.userIds] }));
  const idx = reactions.findIndex((r) => r.emoji === emoji);
  if (op === "add") {
    if (idx === -1) reactions.push({ emoji, userIds: [userId] });
    else if (!reactions[idx].userIds.includes(userId)) reactions[idx].userIds.push(userId);
  } else if (idx !== -1) {
    reactions[idx].userIds = reactions[idx].userIds.filter((u) => u !== userId);
    if (reactions[idx].userIds.length === 0) reactions.splice(idx, 1);
  }
  return { ...m, reactions };
}

/** A one-line preview of a message for the reply quote. */
function replyExcerpt(m: TeamChatMessage): string {
  if (m.body.trim()) return m.body.trim().slice(0, 90);
  if (m.attachments.some((a) => a.type.startsWith("image/"))) return "📷 รูปภาพ";
  if (m.attachments.length) return `📎 ${m.attachments[0].name}`;
  return "ข้อความ";
}

/**
 * Per-project team chat — people, not the AI builder. A dropdown that drops down
 * from its toolbar button. Self-contained: owns its open/unread state and the
 * realtime channel. Stays mounted (button always rendered, panel only hidden) so
 * it keeps receiving messages and counting unreads even while closed. Realtime is
 * Broadcast (same transport as Presence), so it needs no realtime publication.
 */
export default function TeamChat({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<TeamChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typers, setTypers] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [myId, setMyId] = useState("");
  // Render-safe mirror of meRef.current.name (refs can't be read during render).
  const [myName, setMyName] = useState("");
  const [replyTarget, setReplyTarget] = useState<TeamChatReplyRef | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  // Bumped per arriving message while closed → remounts <ChatBurst> so the
  // one-shot particle effect replays. 0 = never fired (no render).
  const [burst, setBurst] = useState(0);
  // Project members (RPC) for the @-mention picker; merged with everyone who
  // has ever spoken in the room, which also covers the owner (not in the RPC).
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const meRef = useRef<{ id: string; name: string }>({ id: "", name: "" });
  const openRef = useRef(open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingSent = useRef(0);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Subscribe once per project; stays alive while closed so unreads accumulate.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const timers = typingTimers.current;

    const markTyper = (id: string, name: string) => {
      const existing = timers.get(id);
      if (existing) clearTimeout(existing);
      setTypers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      timers.set(
        id,
        setTimeout(() => {
          setTypers((prev) => prev.filter((n) => n !== name));
          timers.delete(id);
        }, TYPING_TTL)
      );
    };

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata ?? {};
        meRef.current = {
          id: user.id,
          name: (meta.full_name ?? meta.name ?? user.email ?? "ผู้ใช้") as string,
        };
        if (!cancelled) {
          setMyId(user.id);
          setMyName(meRef.current.name);
        }
      }
      try {
        const initial = await loadMessages(projectId);
        if (!cancelled) setMessages(initial);
      } catch (e) {
        console.error("[team-chat] load failed:", e);
      }
      try {
        const members = await listMembers(projectId);
        if (!cancelled)
          setMemberNames(members.map((m) => m.name?.trim() || m.email).filter(Boolean));
      } catch {
        // Not readable (e.g. signed-out share view) → mention picker just
        // falls back to names seen in the transcript.
      }
    })();

    const channel = supabase.channel(`chat:project:${projectId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        const msg = payload as TeamChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.userId) {
          const t = timers.get(msg.userId);
          if (t) clearTimeout(t);
          timers.delete(msg.userId);
          setTypers((prev) => prev.filter((n) => n !== msg.authorName));
        }
        if (!openRef.current) {
          setUnread((u) => u + 1);
          if (msg.kind === "message") {
            // Make the arrival impossible to miss: replay the burst on the
            // chat chip and drop a toast preview (stronger when tagged).
            setBurst((b) => b + 1);
            const tagged =
              !!meRef.current.name && msg.body.includes(`@${meRef.current.name}`);
            toast.info(
              tagged
                ? `📣 ${msg.authorName ?? "ทีม"} แท็กถึงคุณในแชท`
                : `💬 ${msg.authorName ?? "ทีม"} ส่งข้อความในแชท`,
              { description: replyExcerpt(msg) }
            );
          }
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { id, name } = payload as { id: string; name: string };
        if (id && id !== meRef.current.id) markTyper(id, name);
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const { messageId, emoji, userId, op } = payload as {
          messageId: string;
          emoji: string;
          userId: string;
          op: "add" | "remove";
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? applyReaction(m, emoji, userId, op) : m))
        );
      })
      .on("broadcast", { event: "delete" }, ({ payload }) => {
        const { messageId } = payload as { messageId: string };
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      })
      .subscribe();

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId]);

  // Activity logs (phase approvals) emitted by Studio: this mounted room is the
  // single writer — persist, show locally, and broadcast so others see it live.
  useEffect(() => {
    return onSystemLog(projectId, (body) => {
      void (async () => {
        try {
          const msg = await sendSystemMessage(projectId, body);
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          channelRef.current?.send({ type: "broadcast", event: "message", payload: msg });
        } catch (e) {
          console.error("[team-chat] system log failed:", e);
        }
      })();
    });
  }, [projectId]);

  // Opening the room (or a new message while open) clears unreads and jumps to
  // the latest. setUnread runs in the rAF callback, not the effect body.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      setUnread(0);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [open, messages.length]);

  // Everyone taggable: project members + anyone who has spoken (covers the
  // owner, who isn't in the members RPC). Excludes me — you don't tag yourself.
  const mentionCandidates = useMemo(() => {
    const names = new Set<string>(memberNames);
    for (const m of messages) if (m.kind === "message" && m.authorName) names.add(m.authorName);
    names.delete(myName);
    return [...names].filter(Boolean).sort();
  }, [memberNames, messages, myName]);

  const mentionMatches = mention
    ? mentionCandidates
        .filter((n) => n.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

  /** Names highlighted inside bubbles — includes me (seeing your own tag matters). */
  const highlightNames = useMemo(
    () => (myName ? [...mentionCandidates, myName] : mentionCandidates),
    [mentionCandidates, myName]
  );

  /** Open/refresh the @-picker from the text before the caret. */
  const detectMention = (el: HTMLTextAreaElement) => {
    const upToCaret = el.value.slice(0, el.selectionStart ?? el.value.length);
    const m = /@([^\s@]*)$/.exec(upToCaret);
    setMention(m ? { query: m[1], index: 0 } : null);
  };

  /** Replace the "@query" being typed with the chosen "@Name ". */
  const applyMention = (name: string) => {
    const el = draftRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? draft.length;
    const before = draft.slice(0, caret).replace(/@[^\s@]*$/, `@${name} `);
    const rest = draft.slice(caret);
    setDraft(before + rest);
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const broadcastTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { id: meRef.current.id, name: meRef.current.name },
    });
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const att = await uploadAttachment(projectId, file);
        // Object URL = instant local preview before send (stripped on persist).
        const url = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        setPending((prev) => [...prev, { ...att, url }]);
      }
    } catch (e) {
      console.error("[team-chat] upload failed:", e);
      toast.error("อัปโหลดไฟล์ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : "ลองใหม่อีกครั้ง หรือเช็กขนาดไฟล์",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const { dragging, dropHandlers } = useFileDrop((files) => void onPickFiles(files));

  const send = async () => {
    const body = draft.trim();
    if ((!body && pending.length === 0) || sending) return;
    setSending(true);
    const reply = replyTarget;
    try {
      const msg = await sendMessage(projectId, body, pending, reply);
      setMessages((prev) => [...prev, msg]);
      setDraft("");
      setPending([]);
      setReplyTarget(null);
      channelRef.current?.send({ type: "broadcast", event: "message", payload: msg });
    } catch (e) {
      console.error("[team-chat] send failed:", e);
      toast.error("ส่งข้อความไม่สำเร็จ", {
        description: e instanceof Error ? e.message : "เช็กการเชื่อมต่อแล้วลองใหม่",
      });
    } finally {
      setSending(false);
    }
  };

  const react = async (messageId: string, emoji: string) => {
    const uid = meRef.current.id;
    if (!uid) return;
    const cur = messages.find((m) => m.id === messageId);
    const has = !!cur?.reactions.find((r) => r.emoji === emoji)?.userIds.includes(uid);
    const op: "add" | "remove" = has ? "remove" : "add";
    setMessages((prev) => prev.map((m) => (m.id === messageId ? applyReaction(m, emoji, uid, op) : m)));
    try {
      await toggleReaction(projectId, messageId, emoji);
      channelRef.current?.send({
        type: "broadcast",
        event: "reaction",
        payload: { messageId, emoji, userId: uid, op },
      });
    } catch (e) {
      console.error("[team-chat] reaction failed:", e);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? applyReaction(m, emoji, uid, has ? "add" : "remove") : m))
      );
      toast.error("กดรีแอกชันไม่สำเร็จ");
    }
  };

  const removeMessage = async (messageId: string) => {
    const snapshot = messages;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await deleteMessage(messageId);
      channelRef.current?.send({ type: "broadcast", event: "delete", payload: { messageId } });
    } catch (e) {
      console.error("[team-chat] delete failed:", e);
      setMessages(snapshot);
      toast.error("ลบข้อความไม่สำเร็จ");
    }
  };

  const peopleMsgCount = messages.filter((m) => m.kind === "message").length;
  const badge = unread > 0 ? unread : peopleMsgCount;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs transition ${
          open
            ? "border-shine text-chalk"
            : unread > 0
              ? "chat-attention border-shine bg-shine/10 text-chalk"
              : "border-night-edge text-chalk-dim hover:border-shine hover:text-chalk"
        }`}
        title="ห้องแชททีม"
      >
        {burst > 0 && <ChatBurst key={burst} />}
        <MessageSquare size={13} /> แชท
        {badge > 0 && (
          <span
            className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ${
              unread > 0 ? "bg-shine text-night" : "bg-chalk/15 text-chalk-dim"
            }`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />}

      <div
        {...dropHandlers}
        className={`absolute right-0 top-full z-50 mt-2 flex w-[min(94vw,460px)] origin-top-right flex-col overflow-hidden rounded-xl border border-night-edge bg-night-panel shadow-2xl transition-all duration-200 ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        }`}
        style={{ height: "min(82vh, 760px)" }}
        aria-hidden={!open}
      >
        {dragging && <DropOverlay />}
        {/* Header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-night-edge px-3.5">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-shine" />
            <span className="font-display text-[13px] font-semibold text-chalk">ห้องแชททีม</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-sm p-1 text-chalk-dim transition hover:text-chalk"
            title="ปิด"
          >
            <X size={15} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="scroll-thin min-h-[220px] flex-1 space-y-3 overflow-y-auto px-3.5 py-3"
        >
          {messages.length === 0 && (
            <p className="mt-10 text-center text-[13px] text-chalk-dim">
              ยังไม่มีข้อความ — เริ่มคุยกับทีมได้เลย
              <br />
              ส่งข้อความ รูปภาพ หรือไฟล์เอกสารให้กันได้
            </p>
          )}
          {messages.map((m) =>
            m.kind === "system" ? (
              <p
                key={m.id}
                className="mx-auto w-fit rounded-full border border-night-edge bg-night px-3 py-1 text-center font-mono text-[11px] text-chalk-dim"
              >
                {m.body}
              </p>
            ) : (
              <ChatBubble
                key={m.id}
                message={m}
                mine={m.userId === myId}
                myId={myId}
                mentionNames={highlightNames}
                onReply={() =>
                  setReplyTarget({
                    id: m.id,
                    author: m.authorName ?? "ผู้ใช้",
                    excerpt: replyExcerpt(m),
                  })
                }
                onReact={(emoji) => void react(m.id, emoji)}
                onDelete={() => void removeMessage(m.id)}
                onViewImage={(src, alt) => setLightbox({ src, alt })}
              />
            )
          )}
          {typers.length > 0 && (
            <p className="flex items-center gap-1.5 text-[12px] italic text-chalk-dim">
              <span className="flex gap-0.5">
                <Dot /> <Dot /> <Dot />
              </span>
              {typers.join(", ")} กำลังพิมพ์…
            </p>
          )}
        </div>

        {/* Composer */}
        <div className="relative shrink-0 border-t border-night-edge p-2.5">
          {mention && mentionMatches.length > 0 && (
            <div className="absolute bottom-full left-2.5 z-20 mb-1 w-64 overflow-hidden rounded-xl border border-night-edge bg-night-panel py-1 shadow-2xl">
              <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                แท็กสมาชิก
              </p>
              {mentionMatches.map((n, i) => (
                <button
                  key={n}
                  // mousedown (not click) so the textarea doesn't blur first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMention(n);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition ${
                    i === mention.index ? "bg-shine/10 text-chalk" : "text-chalk/80 hover:bg-chalk/5"
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-chalk/15 text-[10px] font-semibold text-chalk/80">
                    {n.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{n}</span>
                </button>
              ))}
            </div>
          )}
          {replyTarget && (
            <div className="mb-2 flex items-start gap-2 rounded-md border-l-2 border-l-shine border-night-edge bg-night px-2.5 py-1.5">
              <CornerUpLeft size={13} className="mt-0.5 shrink-0 text-shine" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-chalk">ตอบกลับ {replyTarget.author}</p>
                <p className="truncate text-[11px] text-chalk-dim">{replyTarget.excerpt}</p>
              </div>
              <button
                onClick={() => setReplyTarget(null)}
                className="shrink-0 text-chalk-dim transition hover:text-halt"
                title="ยกเลิกการตอบกลับ"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {(pending.length > 0 || uploading) && (
            <div className="mb-2 flex flex-wrap items-start gap-2">
              {uploading && <span className="skeleton h-16 w-16 rounded-md" />}
              {pending.map((a) => {
                const remove = () => {
                  if (a.url) URL.revokeObjectURL(a.url);
                  setPending((prev) => prev.filter((p) => p.path !== a.path));
                };
                return a.type.startsWith("image/") && a.url ? (
                  <div key={a.path} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.name}
                      title="คลิกเพื่อดูรูป"
                      onClick={() => setLightbox({ src: a.url!, alt: a.name })}
                      className="h-16 w-16 cursor-zoom-in rounded-md border border-night-edge object-cover"
                    />
                    <button
                      onClick={remove}
                      title="เอาออก"
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-night-edge bg-night text-chalk-dim shadow transition hover:text-halt"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <span
                    key={a.path}
                    className="inline-flex items-center gap-1 rounded-md border border-night-edge bg-night px-2 py-1 font-mono text-[10px] text-chalk-dim"
                  >
                    <Paperclip size={9} className="text-shine" />
                    <span className="max-w-[140px] truncate">{a.name}</span>
                    <button onClick={remove} className="transition hover:text-halt" title="เอาออก">
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-end gap-1.5 rounded-md border border-night-edge bg-night focus-within:border-shine">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="แนบรูปหรือไฟล์"
              className="shrink-0 p-2.5 text-chalk-dim transition hover:text-shine disabled:opacity-40"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void onPickFiles(e.target.files)}
            />
            <textarea
              ref={draftRef}
              value={draft}
              rows={1}
              onChange={(e) => {
                setDraft(e.target.value);
                broadcastTyping();
                detectMention(e.currentTarget);
              }}
              onKeyDown={(e) => {
                // @-picker steals navigation/confirm keys while it's open.
                if (mention && mentionMatches.length > 0) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const delta = e.key === "ArrowDown" ? 1 : -1;
                    setMention({
                      ...mention,
                      index:
                        (mention.index + delta + mentionMatches.length) % mentionMatches.length,
                    });
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    applyMention(mentionMatches[mention.index]);
                    return;
                  }
                  if (e.key === "Escape") {
                    setMention(null);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              onPaste={(e) => {
                const files = e.clipboardData?.files;
                if (files && files.length > 0) {
                  e.preventDefault();
                  void onPickFiles(files);
                }
              }}
              placeholder="พิมพ์ข้อความถึงทีม…"
              className="max-h-24 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[14px] text-chalk outline-none placeholder:text-chalk-dim/60"
            />
            <button
              onClick={() => void send()}
              disabled={(!draft.trim() && pending.length === 0) || sending}
              className="m-1.5 inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-shine px-3 py-1.5 font-display text-xs font-semibold text-night transition hover:bg-shine-soft disabled:opacity-40"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              ส่ง
            </button>
          </div>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

/** Render a message body with known "@Name" tokens highlighted. */
function renderBody(body: string, names: string[]): ReactNode {
  if (!body.includes("@") || names.length === 0) return body;
  const escaped = names
    .filter(Boolean)
    .sort((a, b) => b.length - a.length) // longest first so "อาร์ต ทีมA" wins over "อาร์ต"
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(?:${escaped.join("|")})`, "g");
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(body.slice(last, i));
    parts.push(
      <span key={i} className="rounded bg-shine/15 px-0.5 font-semibold text-shine">
        {m[0]}
      </span>
    );
    last = i + m[0].length;
  }
  if (parts.length === 0) return body;
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

function ChatBubble({
  message,
  mine,
  myId,
  mentionNames,
  onReply,
  onReact,
  onDelete,
  onViewImage,
}: {
  message: TeamChatMessage;
  mine: boolean;
  myId: string;
  mentionNames: string[];
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  onViewImage: (src: string, alt: string) => void;
}) {
  const initial = (message.authorName || "?").charAt(0).toUpperCase();
  return (
    <div className={`group flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      {message.authorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={message.authorAvatar}
          alt=""
          referrerPolicy="no-referrer"
          className="h-7 w-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-chalk/15 text-[11px] font-semibold text-chalk/80">
          {initial}
        </span>
      )}
      <div className={`flex min-w-0 max-w-[80%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-chalk-dim">{message.authorName ?? "ผู้ใช้"}</span>
          <span className="font-mono text-[9px] text-chalk-dim/60">{timeLabel(message.createdAt)}</span>
        </div>

        {message.replyTo && (
          <div
            className={`mb-1 max-w-full rounded-md border-l-2 border-l-shine bg-night/60 px-2 py-1 ${
              mine ? "text-right" : ""
            }`}
          >
            <p className="text-[10px] font-semibold text-chalk-dim">↪ {message.replyTo.author}</p>
            <p className="truncate text-[11px] text-chalk-dim/80">{message.replyTo.excerpt}</p>
          </div>
        )}

        {/* Bubble + hover toolbar */}
        <div className={`relative flex items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
          {(message.body || message.attachments.length === 0) && (
            <div
              className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[14px] text-chalk ${
                mine ? "border border-shine/30 bg-shine/10" : "border border-night-edge bg-night"
              }`}
            >
              {message.body ? (
                renderBody(message.body, mentionNames)
              ) : (
                <span className="text-chalk-dim">…</span>
              )}
            </div>
          )}
          <div
            className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-full border border-night-edge bg-night-panel px-1 py-0.5 opacity-0 shadow-lg transition group-hover:opacity-100 ${
              mine ? "right-full mr-1" : "left-full ml-1"
            }`}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="rounded-full px-1 text-[14px] leading-none transition hover:scale-125"
                title={`รีแอกชัน ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <span className="mx-0.5 h-3.5 w-px bg-night-edge" />
            <button
              onClick={onReply}
              className="rounded-full p-1 text-chalk-dim transition hover:text-chalk"
              title="ตอบกลับ"
            >
              <CornerUpLeft size={12} />
            </button>
            {mine && (
              <button
                onClick={onDelete}
                className="rounded-full p-1 text-chalk-dim transition hover:text-halt"
                title="ลบข้อความ"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {message.attachments.map((a) => (
          <Attachment key={a.path} att={a} onViewImage={onViewImage} />
        ))}

        {message.reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
            {message.reactions.map((r) => {
              const mineReacted = r.userIds.includes(myId);
              return (
                <button
                  key={r.emoji}
                  onClick={() => onReact(r.emoji)}
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition ${
                    mineReacted
                      ? "border-shine/50 bg-shine/15 text-chalk"
                      : "border-night-edge bg-night text-chalk-dim hover:text-chalk"
                  }`}
                  title={mineReacted ? "เอารีแอกชันออก" : "กดรีแอกชัน"}
                >
                  <span>{r.emoji}</span>
                  <span className="font-mono">{r.userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Attachment({
  att,
  onViewImage,
}: {
  att: TeamChatAttachment;
  onViewImage: (src: string, alt: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const isImage = att.type.startsWith("image/");
  if (isImage && att.url) {
    const url = att.url;
    return (
      <button onClick={() => onViewImage(url, att.name)} className="mt-1 block" title="คลิกเพื่อดูรูป">
        {!loaded && <span className="skeleton block h-40 w-56 rounded-lg" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={att.name}
          onLoad={() => setLoaded(true)}
          className={`max-h-56 cursor-zoom-in rounded-lg border border-night-edge object-cover ${loaded ? "block" : "hidden"}`}
        />
      </button>
    );
  }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-2 rounded-lg border border-night-edge bg-night px-3 py-2 text-[13px] text-chalk transition hover:border-shine/60"
    >
      <FileText size={15} className="shrink-0 text-shine" />
      <span className="max-w-[200px] truncate">{att.name}</span>
    </a>
  );
}

function Dot() {
  return <span className="h-1 w-1 animate-pulse rounded-full bg-chalk-dim" />;
}

/** Deterministic scatter for the arrival burst (shine · go · gold particles). */
const BURST_PARTICLES = [
  { dx: -26, dy: -20, color: "#64cefb", delay: 0 },
  { dx: 24, dy: -26, color: "#34d399", delay: 40 },
  { dx: -32, dy: 6, color: "#64cefb", delay: 20 },
  { dx: 30, dy: 10, color: "#f4d35e", delay: 60 },
  { dx: -14, dy: -32, color: "#f4d35e", delay: 80 },
  { dx: 12, dy: -34, color: "#64cefb", delay: 10 },
  { dx: 36, dy: -8, color: "#34d399", delay: 50 },
  { dx: -22, dy: 16, color: "#64cefb", delay: 70 },
];

/** One-shot celebration burst over the chat chip — remounted (via key) per
 *  arriving message so the CSS animation replays; ends invisible. */
function ChatBurst() {
  return (
    <span aria-hidden className="pointer-events-none absolute -top-1 left-1/2 z-10">
      {BURST_PARTICLES.map((p, i) => (
        <span
          key={i}
          className="chat-burst-particle absolute h-1.5 w-1.5 rounded-full"
          style={
            {
              background: p.color,
              animationDelay: `${p.delay}ms`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
