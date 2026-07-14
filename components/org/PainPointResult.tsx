"use client";

import { AlertTriangle, Check, Radar } from "lucide-react";
import Markdown from "@/components/studio/Markdown";
import type { AdvisorResult } from "@/lib/org-advisor";

/**
 * Presentational render of a Pain Point Radar analysis: a glanceable sentiment
 * badge, the readable markdown briefing (never raw JSON), and the decision
 * options as Human-in-the-Loop approve cards. Input + fetching live in the
 * parent (the single "ให้ AI ร่างจากข้อมูลที่มี" data hub).
 */
export default function PainPointResult({
  result,
  approved,
  onToggleApprove,
}: {
  result: AdvisorResult;
  approved: Record<number, boolean>;
  onToggleApprove: (index: number) => void;
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
