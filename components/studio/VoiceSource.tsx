"use client";

import { useEffect, useState } from "react";
import { Mic, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DRAFT_LABEL, sourceMarkdown } from "@/lib/fittvoice/source-doc";
import type { VoiceDelivery } from "@/lib/fittvoice/types";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import Markdown from "./Markdown";

/**
 * The interview summary a project was created from, when it came from FITT
 * Voice — nothing for any other project.
 *
 * Read through fittbuilder_fittvoice_source, which answers only for people who
 * may read the project. Shown, never acted on: the BRD and the prototype start
 * when someone asks for them in the chat.
 */
export default function VoiceSource({ projectId }: { projectId: string }) {
  const [source, setSource] = useState<{ payload: VoiceDelivery; receivedAt: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void createClient()
      .rpc("fittbuilder_fittvoice_source", { pid: projectId })
      .then(({ data }) => {
        if (alive) setSource((data as { payload: VoiceDelivery; receivedAt: string } | null) ?? null);
      });
    return () => {
      alive = false;
    };
    // Re-read on open too: FITT Voice may have sent a newer revision since.
  }, [projectId, open]);

  if (!source) return null;
  const draft = source.payload.stage === "DRAFT";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="ข้อมูลจากการสัมภาษณ์ลูกค้าที่ FITT Voice ส่งเข้ามา"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
          draft ? "border-amber-400/50 text-amber-200 hover:border-amber-300" : "border-shine/40 bg-shine/[0.06] text-chalk hover:border-shine"
        }`}
      >
        <Mic size={13} className="shrink-0" />
        <span className="whitespace-nowrap">FITT Voice · {draft ? "ร่าง" : "ตรวจแล้ว"}</span>
      </button>
      {open && (
        <Overlay open onClose={() => setOpen(false)} placement="center">
          <GlassSurface strong className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-night-edge px-5 py-3">
              <p className="font-display text-sm font-semibold text-chalk">
                ข้อมูลจาก FITT Voice · ฉบับที่ {source.payload.snapshotRevision}
                {draft && <span className="ml-2 text-amber-200">{DRAFT_LABEL}</span>}
              </p>
              <button onClick={() => setOpen(false)} aria-label="ปิด" className="text-chalk-dim transition hover:text-chalk">
                <X size={18} />
              </button>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <Markdown>{sourceMarkdown(source.payload)}</Markdown>
            </div>
            <p className="shrink-0 border-t border-night-edge bg-night px-5 py-3 text-[12px] text-chalk-dim">
              ข้อมูลนี้คัดลอกมาจาก FITT Voice — การลบใน FITT Voice ไม่ลบที่นี่อัตโนมัติ · BRD และ Prototype เริ่มเมื่อคุณสั่งในแชทเท่านั้น
            </p>
          </GlassSurface>
        </Overlay>
      )}
    </>
  );
}
