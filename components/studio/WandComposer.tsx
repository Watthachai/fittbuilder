"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Sparkles, Wand2, X, Zap } from "lucide-react";
import { ATTACHMENT_ACCEPT, fileToAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { shortLoc, type WandTarget } from "@/lib/wand";
import {
  bgAction,
  paddingAction,
  PADDINGS,
  QUICK_COLORS,
  RADII,
  radiusAction,
  textColorAction,
  textSizeAction,
  TEXT_SIZES,
  type ClassAction,
} from "@/lib/wand-patch";
import { toast } from "@/lib/toast";
import { useFileDrop } from "@/lib/useFileDrop";
import DropOverlay from "@/components/ui/DropOverlay";
import type { ChatAttachmentInput } from "@/lib/types";

interface WandComposerProps {
  target: WandTarget;
  /** Where the picked element sits on screen, in page pixels. */
  anchor: { x: number; y: number; w: number; h: number };
  /** This cast is running — the button wears the spell, not a dead grey. */
  busy: boolean;
  /**
   * A DIFFERENT turn is running (chat, fix-error, reorganize, add-index…).
   * Nothing here may commit until it finishes: a second turn would overwrite
   * the first's files and messages, and a quick patch would be thrown away.
   */
  locked: boolean;
  /** Deterministic patch — returns false when the source can't be patched safely. */
  onQuickClass: (action: ClassAction) => boolean;
  onQuickText: (text: string) => boolean;
  /** Hand the instruction to the model. */
  onCast: (instruction: string, attachments?: ChatAttachmentInput[]) => void;
  onClose: () => void;
}

const CARD_W = 340;
/** The card never grows past this; past it, its body scrolls. */
const CARD_MAX_H = 440;

/**
 * Keep the whole card on screen, not just its top edge.
 *
 * The first version assumed a fixed 300px height, so the quick tab — which is
 * closer to 440 — hung off the bottom of the window when the picked element sat
 * low on the page. Prefer below, fall back to above, then clamp both axes to
 * the viewport; the body scrolls if the window itself is shorter than the card.
 */
function place(anchor: { x: number; y: number; w: number; h: number }) {
  if (typeof window === "undefined") return { left: 0, top: 0, maxHeight: CARD_MAX_H };
  const room = window.innerHeight - 16;
  const maxHeight = Math.min(CARD_MAX_H, room);
  const below = anchor.y + anchor.h + 10;
  const fitsBelow = below + maxHeight <= window.innerHeight - 8;
  const preferred = fitsBelow ? below : anchor.y - maxHeight - 10;
  return {
    left: Math.min(Math.max(8, anchor.x), window.innerWidth - CARD_W - 8),
    top: Math.min(Math.max(8, preferred), Math.max(8, window.innerHeight - maxHeight - 8)),
    maxHeight,
  };
}

export default function WandComposer({
  target,
  anchor,
  busy,
  locked,
  onQuickClass,
  onQuickText,
  onCast,
  onClose,
}: WandComposerProps) {
  const [mode, setMode] = useState<"quick" | "cast">("quick");
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachmentInput[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const [draft, setDraft] = useState(target.text);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pos = place(anchor);

  // Editing text only makes sense when the element actually holds literal text.
  const canEditText = target.text.length > 0 && target.text.length <= 80;

  useEffect(() => {
    if (mode === "cast") inputRef.current?.focus();
  }, [mode]);

  // Esc is owned by PreviewPanel (it leaves wand mode entirely) — one key, one
  // outcome, whether the demo or this card has focus. ✕ closes just the card.

  const quick = (action: ClassAction) => {
    if (onQuickClass(action)) {
      flash(action.label);
    } else {
      toast.info("จุดนี้ปรับเร็วไม่ได้", {
        description: "คลาสของ element นี้ถูกคำนวณด้วยโค้ด — พิมพ์บอกในแท็บ “เสก” แทนได้ครับ",
      });
      setMode("cast");
      setText(`${action.label} ให้ element นี้`);
    }
  };

  const flash = (msg: string) => {
    setLabel(msg);
    setTimeout(() => setLabel(null), 1600);
  };

  /** Commit the text edit — from Enter or the ✓ button, same path. */
  const applyText = () => {
    const next = draft.trim();
    if (!next || next === target.text) return;
    if (onQuickText(next)) {
      flash(`แก้ข้อความเป็น “${next}”`);
      return;
    }
    // Be specific about WHY: the value is computed elsewhere (state, props, a
    // list), so rewriting the tag would not change what renders.
    toast.info("ค่านี้มาจากที่อื่นในโค้ด", {
      description: "ไม่ใช่ข้อความคงที่ (เช่นมาจากข้อมูลหรือตัวแปร) — บอกในแท็บ “เสก” ว่าอยากให้เป็นเท่าไหร่",
    });
    setMode("cast");
    setText(`เปลี่ยนค่าที่แสดงตรงนี้เป็น "${next}"`);
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("ไฟล์ใหญ่เกินไป", { description: "รับไม่เกิน 4MB" });
      return;
    }
    try {
      setAttachments([await fileToAttachment(file)]);
    } catch (e) {
      toast.error("แนบไฟล์ไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    }
  };

  // Dropping a reference image is how the chat has always worked; this card was
  // the one composer that never learned it, so a drop fell through to the
  // window and the browser navigated away to the file — taking the studio, and
  // the unsaved turn, with it.
  const { dragging, dropHandlers } = useFileDrop((files) => {
    if (busy || locked) return;
    setMode("cast");
    void attach(files);
  });

  const cast = () => {
    const instruction = text.trim();
    if (!instruction || busy || locked) return;
    onCast(instruction, attachments.length ? attachments : undefined);
    setText("");
    setAttachments([]);
  };

  return (
    <div
      {...dropHandlers}
      style={{ left: pos.left, top: pos.top, width: CARD_W, maxHeight: pos.maxHeight }}
      className="wand-pop fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-shine/30 bg-night-panel/95 shadow-[0_20px_60px_rgba(0,0,0,.55),0_0_40px_rgba(100,206,251,.15)] backdrop-blur-xl"
    >
      {dragging && <DropOverlay label="วางรูปอ้างอิงที่นี่" />}
      {/* Target */}
      <div className="flex shrink-0 items-center gap-2 border-b border-night-edge px-3 py-2">
        <Wand2 size={13} className="shrink-0 text-shine" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-chalk-dim">
          <span className="text-shine">&lt;{target.tag}&gt;</span> · {shortLoc(target.loc)}
        </span>
        <button
          onClick={onClose}
          aria-label="ปิด"
          className="shrink-0 rounded-md p-1 text-chalk-dim transition hover:text-chalk"
        >
          <X size={12} />
        </button>
      </div>

      {/* Mode switch */}
      <div className="flex shrink-0 gap-1 px-3 pt-2">
        {(
          [
            { id: "quick", label: "ปรับเร็ว", Icon: Zap, hint: "ไม่ใช้ AI · ทันที" },
            { id: "cast", label: "เสก", Icon: Sparkles, hint: "ใช้ AI" },
          ] as const
        ).map(({ id, label: l, Icon, hint }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            title={hint}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-display text-[12px] transition ${
              mode === id ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
            }`}
          >
            <Icon size={12} /> {l}
          </button>
        ))}
      </div>

      {locked && (
        <p className="mx-3 mt-2 shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200">
          กำลังแก้ไขรอบก่อนหน้าอยู่ — ทำได้ทีละรอบครับ เลือกไว้ก่อนได้ พอเสร็จแล้วกดต่อได้เลย
        </p>
      )}

      {mode === "quick" ? (
        /* Locked: a quick patch lands in files the running turn is about to
           overwrite, so the whole panel stops accepting input rather than
           accepting it and losing it. */
        <div
          className={`scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-3 ${
            busy || locked ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <Row label="สีพื้นหลัง">
            {QUICK_COLORS.map((c) => (
              <button
                key={`bg-${c.bg}`}
                onClick={() => quick(bgAction(c.bg, c.label))}
                title={c.label}
                style={{ background: c.swatch }}
                className="h-5 w-5 rounded-md border border-white/20 transition hover:scale-110"
              />
            ))}
          </Row>
          <Row label="สีตัวอักษร">
            {QUICK_COLORS.map((c) => (
              <button
                key={`tx-${c.text}`}
                onClick={() => quick(textColorAction(c.text, c.label))}
                title={c.label}
                className="grid h-5 w-5 place-items-center rounded-md border border-white/15 font-display text-[11px] font-bold transition hover:scale-110"
                style={{ color: c.swatch }}
              >
                A
              </button>
            ))}
          </Row>
          <Row label="ขนาดตัวอักษร">
            {TEXT_SIZES.map((s) => (
              <Chip key={s} onClick={() => quick(textSizeAction(s))}>
                {s.replace("text-", "")}
              </Chip>
            ))}
          </Row>
          <Row label="ระยะห่างใน">
            {PADDINGS.map((p) => (
              <Chip key={p} onClick={() => quick(paddingAction(p))}>
                {p.replace("p-", "")}
              </Chip>
            ))}
          </Row>
          <Row label="ความมน">
            {RADII.map((r) => (
              <Chip key={r} onClick={() => quick(radiusAction(r))}>
                {r.replace("rounded-", "") || "md"}
              </Chip>
            ))}
          </Row>
          {canEditText && (
            <div>
              <p className="mb-1 font-display text-[10px] uppercase tracking-widest text-chalk-dim">
                ข้อความ
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyText();
                  }}
                  placeholder="พิมพ์ข้อความใหม่"
                  className="min-w-0 flex-1 rounded-lg border border-night-edge bg-night px-2.5 py-1.5 text-[12px] text-chalk outline-none focus:border-shine/60"
                />
                <button
                  onClick={applyText}
                  disabled={!draft.trim() || draft.trim() === target.text}
                  title="ใช้ข้อความนี้"
                  className="shrink-0 rounded-lg bg-shine px-2.5 py-1.5 font-display text-[12px] font-semibold text-night transition hover:brightness-110 disabled:opacity-30"
                >
                  <Check size={13} />
                </button>
              </div>
            </div>
          )}
          <p className="text-[10px] leading-relaxed text-chalk-dim">
            ปรับเร็วแก้โค้ดตรงจุดทันที ไม่ใช้โควตา AI · ย้อนกลับได้ด้วยปุ่ม Undo
          </p>
        </div>
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                cast();
              }
            }}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                e.preventDefault();
                void attach(files);
              }
            }}
            rows={3}
            disabled={busy || locked}
            placeholder={`บอกสิ่งที่อยากให้ <${target.tag}> นี้เป็น เช่น “ใส่ไอคอนตะกร้าหน้าข้อความ”`}
            className="w-full resize-none rounded-lg border border-night-edge bg-night px-2.5 py-2 text-[12px] leading-relaxed text-chalk outline-none focus:border-shine/60 disabled:opacity-50"
          />
          {attachments.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-night px-2 py-1 font-mono text-[10px] text-chalk-dim">
              <ImagePlus size={10} className="text-shine" />
              <span className="min-w-0 flex-1 truncate">{attachments[0].name}</span>
              <button onClick={() => setAttachments([])} className="hover:text-chalk">
                ✕
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                void attach(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              title="แนบรูปอ้างอิง — ลากวางหรือวาง (⌘V) ก็ได้"
              className="rounded-lg border border-night-edge p-1.5 text-chalk-dim transition hover:text-shine"
            >
              <ImagePlus size={13} />
            </button>
            <button
              onClick={cast}
              disabled={busy || locked || !text.trim()}
              /* While casting the button IS the progress indicator — it wears the
                 same rainbow as the wave running over the element, instead of
                 greying out like a dead control. */
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-[12px] font-semibold transition ${
                busy
                  ? "wand-btn wand-btn-on"
                  : "bg-shine text-night hover:brightness-110 disabled:opacity-40"
              }`}
            >
              <Sparkles size={12} />
              {busy ? "กำลังเสก…" : locked ? "รอรอบที่กำลังทำอยู่" : "เสก (Enter)"}
            </button>
          </div>
        </div>
      )}

      {label && (
        <div className="shrink-0 border-t border-night-edge px-3 py-1.5 font-display text-[11px] text-go">
          ✓ {label}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-display text-[10px] uppercase tracking-widest text-chalk-dim">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-night-edge px-1.5 py-0.5 font-mono text-[10px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
    >
      {children}
    </button>
  );
}
