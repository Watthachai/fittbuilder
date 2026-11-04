"use client";

import { useEffect, useState } from "react";
import { Mic, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DRAFT_LABEL, itemMarkdown, itemTitle, when } from "@/lib/fittvoice/source-doc";
import type { VoiceSourceItem } from "@/lib/fittvoice/types";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import Markdown from "./Markdown";

const isDraft = (item: VoiceSourceItem) =>
  item.kind === "session" && item.payload.schemaVersion === "fittbuilder.delivery.v1" && item.payload.stage === "DRAFT";

/** The line under an entry's title in the list: what kind of meeting, and when. */
function itemMeta(item: VoiceSourceItem): string {
  if (item.kind === "meeting") {
    const m = item.payload.meeting;
    return `${m.profile.label} · ${when(m.recordedAt)}${item.sender ? ` · ${item.sender}` : ""}`;
  }
  return `ข้อมูลตั้งต้นของโปรเจกต์ · ${when(item.receivedAt)}${isDraft(item) ? ` · ${DRAFT_LABEL}` : ""}`;
}

/**
 * What FITT Voice sent into the project — nothing for any other project: the
 * interview a v1 project was created from, and every meeting sent into it
 * since (contract v2), oldest first, each at its newest revision.
 *
 * Read through fittbuilder_fittvoice_sources, which answers only for people who
 * may read the project. Shown, never acted on: the BRD and the prototype start
 * when someone asks for them in the chat.
 */
export default function VoiceSource({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<VoiceSourceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void createClient()
      .rpc("fittbuilder_fittvoice_sources", { pid: projectId })
      .then(({ data }) => {
        if (alive) setItems((data as VoiceSourceItem[] | null) ?? []);
      });
    return () => {
      alive = false;
    };
    // Re-read on open too: FITT Voice may have sent a meeting or a newer revision since.
  }, [projectId, open]);

  if (items.length === 0) return null;
  const draft = items.some(isDraft);
  const only = items.length === 1 ? items[0] : null;
  // The newest unless one was picked; an index past a shorter re-read list falls back to it.
  const shown = items[picked ?? items.length - 1] ?? items[items.length - 1];
  const count = `${items.length} การประชุม`;
  const label = only?.kind === "session" ? (draft ? "ร่าง" : "ตรวจแล้ว") : count;
  const close = () => {
    setOpen(false);
    setPicked(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="ข้อมูลจากการประชุมที่ FITT Voice ส่งเข้ามา"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
          draft ? "border-amber-400/50 text-amber-200 hover:border-amber-300" : "border-shine/40 bg-shine/[0.06] text-chalk hover:border-shine"
        }`}
      >
        <Mic size={13} className="shrink-0" />
        <span className="whitespace-nowrap">FITT Voice · {label}</span>
      </button>
      {open && (
        <Overlay open onClose={close} placement="center">
          <GlassSurface strong className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-night-edge px-5 py-3">
              <p className="font-display text-sm font-semibold text-chalk">
                ข้อมูลจาก FITT Voice ·{" "}
                {only?.kind === "session" ? `ฉบับที่ ${only.payload.snapshotRevision}` : count}
                {only && isDraft(only) && <span className="ml-2 text-amber-200">{DRAFT_LABEL}</span>}
              </p>
              <button onClick={close} aria-label="ปิด" className="text-chalk-dim transition hover:text-chalk">
                <X size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {!only && (
                <ol className="scroll-thin flex max-h-48 shrink-0 flex-col gap-1 overflow-y-auto border-b border-night-edge p-3 md:max-h-none md:w-72 md:border-b-0 md:border-r">
                  {items.map((item, index) => {
                    const active = item === shown;
                    return (
                      <li key={item.kind === "meeting" ? item.id : "session"}>
                        <button
                          onClick={() => setPicked(index)}
                          aria-current={active ? "true" : undefined}
                          className={`w-full rounded-lg px-3 py-2 text-left transition ${
                            active ? "bg-shine/[0.1] text-chalk" : "text-chalk-dim hover:bg-night-panel hover:text-chalk"
                          }`}
                        >
                          <span className="block text-sm font-medium leading-snug">{itemTitle(item)}</span>
                          <span className="mt-0.5 block text-[0.75rem] leading-snug text-chalk-dim">{itemMeta(item)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <Markdown>{itemMarkdown(shown)}</Markdown>
              </div>
            </div>
            <p className="shrink-0 border-t border-night-edge bg-night px-5 py-3 text-[0.75rem] text-chalk-dim">
              ข้อมูลนี้คัดลอกมาจาก FITT Voice — การลบใน FITT Voice ไม่ลบที่นี่อัตโนมัติ · BRD และ Prototype เริ่มเมื่อคุณสั่งในแชทเท่านั้น
            </p>
          </GlassSurface>
        </Overlay>
      )}
    </>
  );
}
