"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadMessages, sendMessage, sendSystemMessage, uploadAttachment } from "@/lib/team-chat";
import { onSystemLog } from "@/lib/team-chat-bus";
import { toast } from "@/lib/toast";
import type { TeamChatAttachment, TeamChatMessage } from "@/lib/types";

const TYPING_TTL = 2500;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
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
        if (!cancelled) setMyId(user.id);
      }
      try {
        const initial = await loadMessages(projectId);
        if (!cancelled) setMessages(initial);
      } catch (e) {
        console.error("[team-chat] load failed:", e);
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
        if (!openRef.current) setUnread((u) => u + 1);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { id, name } = payload as { id: string; name: string };
        if (id && id !== meRef.current.id) markTyper(id, name);
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
        setPending((prev) => [...prev, att]);
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

  const send = async () => {
    const body = draft.trim();
    if ((!body && pending.length === 0) || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(projectId, body, pending);
      setMessages((prev) => [...prev, msg]);
      setDraft("");
      setPending([]);
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

  const peopleMsgCount = messages.filter((m) => m.kind === "message").length;
  const badge = unread > 0 ? unread : peopleMsgCount;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs transition ${
          open
            ? "border-shine text-chalk"
            : "border-night-edge text-chalk-dim hover:border-shine hover:text-chalk"
        }`}
        title="ห้องแชททีม"
      >
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
        className={`absolute right-0 top-full z-50 mt-2 flex w-[min(94vw,460px)] origin-top-right flex-col overflow-hidden rounded-xl border border-night-edge bg-night-panel shadow-2xl transition-all duration-200 ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        }`}
        style={{ height: "min(82vh, 760px)" }}
        aria-hidden={!open}
      >
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
              <ChatBubble key={m.id} message={m} mine={m.userId === myId} />
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
        <div className="shrink-0 border-t border-night-edge p-2.5">
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pending.map((a) => (
                <span
                  key={a.path}
                  className="inline-flex items-center gap-1 rounded-md border border-night-edge bg-night px-2 py-0.5 font-mono text-[10px] text-chalk-dim"
                >
                  <Paperclip size={9} className="text-shine" />
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <button
                    onClick={() => setPending((prev) => prev.filter((p) => p.path !== a.path))}
                    className="transition hover:text-halt"
                    title="เอาออก"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
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
              value={draft}
              rows={1}
              onChange={(e) => {
                setDraft(e.target.value);
                broadcastTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
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
    </div>
  );
}

function ChatBubble({ message, mine }: { message: TeamChatMessage; mine: boolean }) {
  const initial = (message.authorName || "?").charAt(0).toUpperCase();
  return (
    <div className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
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
      <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-chalk-dim">{message.authorName ?? "ผู้ใช้"}</span>
          <span className="font-mono text-[9px] text-chalk-dim/60">{timeLabel(message.createdAt)}</span>
        </div>
        {message.body && (
          <div
            className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[14px] text-chalk ${
              mine ? "border border-shine/30 bg-shine/10" : "border border-night-edge bg-night"
            }`}
          >
            {message.body}
          </div>
        )}
        {message.attachments.map((a) => (
          <Attachment key={a.path} att={a} />
        ))}
      </div>
    </div>
  );
}

function Attachment({ att }: { att: TeamChatAttachment }) {
  const isImage = att.type.startsWith("image/");
  if (isImage && att.url) {
    return (
      <a href={att.url} target="_blank" rel="noreferrer" className="mt-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.url}
          alt={att.name}
          className="max-h-56 rounded-lg border border-night-edge object-cover"
        />
      </a>
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
