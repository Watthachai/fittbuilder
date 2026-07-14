"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Paperclip, Radar, Sparkles, Trash2, X } from "lucide-react";
import Markdown from "@/components/studio/Markdown";
import { fileToAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { toast } from "@/lib/toast";
import type { AdvisorResult } from "@/lib/org-advisor";
import type { ChatAttachmentInput } from "@/lib/types";

/**
 * Pain Point Radar — paste real feedback, get a readable executive briefing of
 * the workspace's ACTUAL pain points (grounded in Org DNA), plus decision
 * options the user approves (Human-in-the-Loop). The briefing renders as
 * markdown prose — never raw JSON.
 */
export default function PainPointRadar({ orgId }: { orgId: string }) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const [files, setFiles] = useState<ChatAttachmentInput[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const storeKey = `fitt:advisor:${orgId}`;

  function clearStore() {
    try {
      localStorage.removeItem(storeKey);
    } catch {
      /* storage unavailable — nothing to clear */
    }
  }

  // Recover the last analysis so a reload doesn't lose it. setState runs inside
  // the deferred callback (not synchronously in the effect body).
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(storeKey);
        if (!raw) return;
        const cached = JSON.parse(raw) as { feedback?: string; result?: AdvisorResult };
        if (cached?.result?.briefing) {
          setResult(cached.result);
          setFeedback(cached.feedback ?? "");
        }
      } catch {
        /* corrupt or unavailable storage — nothing to recover */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storeKey]);

  async function pickFiles(list: FileList | null) {
    if (!list?.length) return;
    for (const f of Array.from(list)) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.warning(`ไฟล์ใหญ่เกิน 4MB: ${f.name}`);
        continue;
      }
      const att = await fileToAttachment(f);
      setFiles((prev) => (prev.length >= 5 ? prev : [...prev, att]));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analyze() {
    const text = feedback.trim();
    if ((text.length < 20 && files.length === 0) || busy) return;
    setBusy(true);
    setResult(null);
    setApproved({});
    try {
      const res = await fetch("/api/org-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          feedback: text || undefined,
          attachments: files.length ? files : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { result?: AdvisorResult; error?: string }
        | null;
      if (!res.ok || !data?.result) throw new Error(data?.error ?? "วิเคราะห์ไม่สำเร็จ");
      setResult(data.result);
      try {
        localStorage.setItem(storeKey, JSON.stringify({ feedback: text, result: data.result }));
      } catch {
        /* storage full/unavailable — the result still shows this session */
      }
    } catch (e) {
      toast.error("วิเคราะห์ไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  function clearResult() {
    setResult(null);
    setApproved({});
    setFiles([]);
    clearStore();
  }

  const sentiment = result?.sentimentIndex ?? null;

  return (
    <section className="mt-7 rounded-xl border border-night-edge bg-night-panel p-4">
      <div className="flex items-center gap-2">
        <Radar size={15} className="text-shine" />
        <h2 className="font-display text-sm font-semibold">Pain Point Radar — เรดาร์ปัญหาองค์กร</h2>
      </div>
      <p className="mt-1 text-[13px] text-chalk-dim">
        วางข้อความ หรืออัปโหลดไฟล์ (PDF/รูป/เอกสาร) ที่มีเสียงจริง (คำบ่นลูกค้า/ฟีดแบ็กพนักงาน/รีวิว/
        export tickets) แล้ว AI จะสรุปเป็น pain point จริงขององค์กรคุณ — จัดกลุ่มปัญหา ขุดต้นตอ
        และเสนอทางเลือกให้ตัดสินใจ โดยผูกกับ Org DNA
      </p>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={5}
        placeholder="วางเสียงจริงที่นี่ เช่น: “แอปช้ามากตอนเย็น”, “ส่งของ 5 วันยังไม่ถึง”, “ขอคืนเงินแล้วเงียบ”, “แอดมินตอบช้า”…"
        className="mt-3 w-full resize-y rounded-lg border border-night-edge bg-night px-3 py-2.5 text-[14px] outline-none focus:border-shine"
      />
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1 rounded-md border border-night-edge bg-night px-2 py-1 font-mono text-[11px] text-chalk-dim"
            >
              <Paperclip size={10} className="text-shine" />
              <span className="max-w-[180px] truncate">{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="transition hover:text-halt"
                title="เอาออก"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,application/pdf,text/*,.md,.json,.csv"
        className="hidden"
        onChange={(e) => void pickFiles(e.target.files)}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy || files.length >= 5}
          className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-2 text-sm text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        >
          <Paperclip size={14} /> แนบไฟล์
        </button>
        <button
          onClick={() => void analyze()}
          disabled={(feedback.trim().length < 20 && files.length === 0) || busy}
          className="inline-flex items-center gap-2 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? "กำลังวิเคราะห์เสียง…" : "วิเคราะห์"}
        </button>
        {result && !busy && (
          <button
            onClick={clearResult}
            className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-2 text-[12px] text-chalk-dim transition hover:border-halt hover:text-halt"
          >
            <Trash2 size={13} /> ล้างผล
          </button>
        )}
      </div>

      {busy && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-chalk-dim">
          <Loader2 size={14} className="animate-spin text-shine" />
          กำลังอ่านอารมณ์ จัดกลุ่มปัญหา และขุดต้นตอ…
        </p>
      )}

      {result && !busy && (
        <div className="mt-4 space-y-4">
          {sentiment !== null && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                ดัชนีอารมณ์
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold ${
                  sentiment >= 66
                    ? "bg-go/15 text-go"
                    : sentiment >= 40
                      ? "bg-shine/15 text-shine"
                      : "bg-halt/15 text-halt"
                }`}
              >
                {sentiment}/100
              </span>
            </div>
          )}

          {/* Readable briefing (markdown prose — never raw JSON). */}
          <div className="rounded-lg border border-night-edge bg-night/50 px-4 py-3">
            <Markdown>{result.briefing}</Markdown>
          </div>

          {/* Decision options — Human-in-the-Loop: the user (CEO) approves. */}
          {result.options.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                <Radar size={11} className="text-shine" /> ทางเลือกตัดสินใจ — คุณเป็นคนเคาะ
              </p>
              <div className="space-y-2">
                {result.options.map((opt, i) => {
                  const isApproved = approved[i];
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 transition ${
                        opt.recommended ? "border-go/40 bg-go/[0.05]" : "border-night-edge bg-night/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-sm font-semibold text-chalk">
                            {opt.recommended && <span className="mr-1 text-go">★</span>}
                            {opt.title}
                          </p>
                          {opt.tradeoffs && (
                            <p className="mt-0.5 text-[12px] text-chalk-dim">{opt.tradeoffs}</p>
                          )}
                          {opt.rationale && (
                            <p className="mt-1 text-[13px] text-chalk-dim">{opt.rationale}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setApproved((p) => ({ ...p, [i]: !p[i] }))}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                            isApproved
                              ? "bg-go text-night"
                              : "border border-night-edge text-chalk-dim hover:border-go hover:text-go"
                          }`}
                        >
                          <Check size={13} /> {isApproved ? "CEO อนุมัติแล้ว" : "อนุมัติ"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-chalk-dim">
                <AlertTriangle size={11} />
                ตัวเลขทั้งหมดเป็นประมาณการ · การอนุมัติเป็นเพียงการบันทึกการเลือก ไม่มีการสั่งการภายนอก
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
