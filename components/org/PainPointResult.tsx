"use client";

import { AlertTriangle, Check, Quote, Radar } from "lucide-react";
import Markdown from "@/components/studio/Markdown";
import type { AdvisorResult, AdvisorSeverity } from "@/lib/org-advisor";

/** Severity → Thai label + token-based color (arbitrary amber for "high"). */
const SEVERITY_META: Record<AdvisorSeverity, { label: string; cls: string }> = {
  critical: { label: "วิกฤต", cls: "bg-halt/15 text-halt" },
  high: { label: "สูง", cls: "bg-[#f59e0b]/15 text-[#f59e0b]" },
  medium: { label: "กลาง", cls: "bg-shine/15 text-shine" },
  low: { label: "ต่ำ", cls: "bg-chalk/10 text-chalk-dim" },
};

/**
 * Presentational render of a Pain Point Radar analysis: a glanceable sentiment
 * badge, the readable markdown briefing (never raw JSON), the pain points as
 * CITED issues (each quotes the source verbatim; click opens the source), and
 * the decision options as Human-in-the-Loop approve cards. Input + fetching
 * live in the parent (the single "ให้ AI ร่างจากข้อมูลที่มี" data hub).
 */
export default function PainPointResult({
  result,
  approved,
  onToggleApprove,
  onCite,
}: {
  result: AdvisorResult;
  approved: Record<number, boolean>;
  onToggleApprove: (index: number) => void;
  /** Open the source viewer highlighting this verbatim quote. */
  onCite: (cite: string) => void;
}) {
  const sentiment = result.sentimentIndex;

  return (
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

      {/* Pain points — each cites the source verbatim (click to see where it came from). */}
      {result.issues.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
            <Radar size={11} className="text-shine" /> Pain Point (คลิกโควตเพื่อดูที่มาในข้อมูลของคุณ)
          </p>
          <div className="space-y-2">
            {result.issues.map((issue, i) => {
              const sev = SEVERITY_META[issue.severity];
              return (
                <div key={i} className="rounded-lg border border-night-edge bg-night/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sev.cls}`}>
                      {sev.label}
                    </span>
                    <span className="font-display text-sm font-semibold text-chalk">{issue.title}</span>
                  </div>
                  {issue.detail && <p className="mt-1 text-[13px] text-chalk-dim">{issue.detail}</p>}
                  {issue.cite && (
                    <button
                      onClick={() => onCite(issue.cite)}
                      title="คลิกดูที่มาในข้อมูลของคุณ"
                      className="mt-1.5 flex w-full items-start gap-1.5 rounded-md border border-night-edge bg-night/50 px-2 py-1.5 text-left text-[11px] text-chalk-dim transition hover:border-shine/50 hover:text-chalk"
                    >
                      <Quote size={11} className="mt-0.5 shrink-0 text-shine" />
                      <span className="line-clamp-2 italic">“{issue.cite}”</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                      onClick={() => onToggleApprove(i)}
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
  );
}
