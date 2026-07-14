"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import SkillIcon from "@/components/studio/SkillIcon";
import Markdown from "@/components/studio/Markdown";
import { streamOrgSkill } from "@/lib/sse";
import { getOrgSkill, saveOrgSkill, deleteOrgSkill } from "@/lib/org-skills";
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import type { GeneratedSkill } from "@/lib/types";
import type { SkillTemplate } from "@/lib/skills/types";

export default function DomainSkillStudio({ orgId }: { orgId: string }) {
  const [existing, setExisting] = useState<SkillTemplate | null>(null);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(""); // streamed research text (the "reveal")
  const [draft, setDraft] = useState<GeneratedSkill | null>(null); // parsed result to save
  const abortRef = useRef<AbortController | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the reveal panel to the bottom as new tokens arrive.
  useEffect(() => {
    revealRef.current?.scrollTo({ top: revealRef.current.scrollHeight, behavior: "auto" });
  }, [report]);

  useEffect(() => {
    let cancelled = false;
    void getOrgSkill(orgId)
      .then((s) => {
        if (!cancelled) setExisting(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Abort any in-flight stream when the card unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setReport("");
    setDraft(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      for await (const ev of streamOrgSkill({ orgId, brief: brief.trim() || undefined }, ac.signal)) {
        if (ev.type === "text") setReport((r) => r + ev.content);
        else if (ev.type === "done") setDraft(ev.template ?? null);
        else if (ev.type === "error") throw new Error(ev.message);
        // ev.type === "thought": research chatter — not surfaced in this card.
      }
    } catch (e) {
      if (!ac.signal.aborted) {
        toast.error("สร้างผู้เชี่ยวชาญไม่สำเร็จ", {
          description: e instanceof Error ? e.message : undefined,
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function save() {
    if (!draft) return;
    try {
      const saved = await saveOrgSkill(orgId, draft);
      setExisting(saved);
      setDraft(null);
      setReport("");
      toast.success(`บันทึกผู้เชี่ยวชาญ "${saved.name}" แล้ว`);
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "ลบผู้เชี่ยวชาญนี้?",
      message: "เดโมใน workspace จะกลับไปใช้การเดาโดเมนอัตโนมัติ",
      confirmLabel: "ลบ",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteOrgSkill(orgId);
      setExisting(null);
      toast.success("ลบผู้เชี่ยวชาญแล้ว");
    } catch (e) {
      toast.error("ลบไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <section className="mt-7 rounded-xl border border-night-edge bg-night-panel p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-shine" />
        <h2 className="font-display text-sm font-semibold">ปั้นผู้เชี่ยวชาญประจำองค์กร</h2>
      </div>
      <p className="mt-1 text-[13px] text-chalk-dim">
        ให้ AI สร้าง “ผู้เชี่ยวชาญ” ประจำ workspace จาก Org DNA ที่กรอกไว้ —
        เพื่อให้การถาม-ตอบและการสร้างเดโมเข้าใจโดเมนของคุณโดยเฉพาะ (ใส่บรีฟด้านล่างเพื่อเจาะจงเพิ่มได้)
      </p>

      {/* Active specialist */}
      {existing && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-shine/30 bg-shine/[0.05] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-night-edge bg-night/40 text-shine">
            <SkillIcon name={existing.icon} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-display text-sm font-semibold text-chalk">{existing.name}</p>
              <span className="shrink-0 rounded-full bg-shine/15 px-2 py-0.5 font-mono text-[10px] text-shine">
                ใช้งานอยู่
              </span>
            </div>
            {existing.tagline && (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-chalk-dim">{existing.tagline}</p>
            )}
            <p className="mt-1 font-mono text-[10px] text-chalk-dim">
              คำถามเชิงลึก {existing.questionBank.length} ข้อ
            </p>
          </div>
          <button
            onClick={() => void remove()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1.5 text-[12px] text-chalk-dim transition hover:border-halt hover:text-halt"
            title="ลบผู้เชี่ยวชาญนี้"
          >
            <Trash2 size={13} /> ลบ
          </button>
        </div>
      )}

      {/* Brief + generate */}
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={3}
        placeholder={
          existing
            ? "อยากปรับผู้เชี่ยวชาญให้เจาะจงขึ้น? ใส่บรีฟแล้วสร้างใหม่ทับได้ (ไม่บังคับ)"
            : "บรีฟเพิ่มเติม เช่น เน้นคลินิกทันตกรรม มีระบบนัดหมายและสต็อกยา (ไม่บังคับ — เว้นว่างได้ AI จะใช้ Org DNA)"
        }
        className="mt-3 w-full resize-y rounded-lg border border-night-edge bg-night px-3 py-2.5 text-[14px] outline-none focus:border-shine"
      />
      <div className="mt-2">
        <button
          onClick={() => void generate()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? "กำลังสร้าง…" : existing ? "สร้างใหม่ทับ" : "สร้างผู้เชี่ยวชาญ"}
        </button>
      </div>

      {/* Reveal: streamed research text */}
      {(busy || report) && (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
            <Sparkles size={11} className="text-shine" /> กำลังค้นคว้าและร่างผู้เชี่ยวชาญ
          </p>
          <span className="sr-only" aria-live="polite">
            {busy ? "กำลังค้นคว้าและร่างผู้เชี่ยวชาญ…" : draft ? "ร่างเสร็จแล้ว" : ""}
          </span>
          <div
            ref={revealRef}
            className="scroll-thin max-h-72 overflow-y-auto rounded-lg border border-night-edge bg-night/50 px-3 py-2"
            aria-live="off"
            aria-busy={busy}
          >
            {report ? (
              <Markdown>{report}</Markdown>
            ) : (
              <span className="text-sm text-chalk-dim">กำลังอ่าน Org DNA และค้นคว้าโดเมน…</span>
            )}
          </div>
        </div>
      )}

      {/* Save the parsed draft */}
      {draft && !busy && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-go/30 bg-go/[0.06] p-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-chalk">
              ร่างเสร็จแล้ว{draft.name ? `: ${draft.name}` : ""}
            </p>
            <p className="mt-0.5 text-[12px] text-chalk-dim">
              {draft.tagline || "ตรวจรายละเอียดด้านบน แล้วกดบันทึกเพื่อเปิดใช้งานใน workspace"}
              {draft.questionBank?.length ? ` · คำถามเชิงลึก ${draft.questionBank.length} ข้อ` : ""}
            </p>
          </div>
          <button
            onClick={() => void save()}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110"
          >
            <Save size={15} /> บันทึก
          </button>
        </div>
      )}
    </section>
  );
}
