"use client";

import { Quote, Stethoscope } from "lucide-react";
import Markdown from "@/components/studio/Markdown";
import type { HealthResult, HealthStatus } from "@/lib/advisor-health";

const STATUS_META: Record<HealthStatus, { label: string; cls: string }> = {
  strong: { label: "แข็งแรง", cls: "bg-go/15 text-go" },
  watch: { label: "เฝ้าระวัง", cls: "bg-[#f59e0b]/15 text-[#f59e0b]" },
  critical: { label: "วิกฤต", cls: "bg-halt/15 text-halt" },
};

function scoreTone(score: number | null): string {
  if (score === null) return "bg-chalk/10 text-chalk-dim";
  if (score >= 66) return "bg-go/15 text-go";
  if (score >= 40) return "bg-[#f59e0b]/15 text-[#f59e0b]";
  return "bg-halt/15 text-halt";
}

/**
 * Presentational render of a Business Health Check: overall score, the
 * readable markdown briefing (never raw JSON), and the five standard areas as
 * scorecard rows — status pill, findings with verbatim citations (click opens
 * the source), and proposed actions (HITL — proposals only).
 */
export default function HealthCheckResult({
  result,
  onCite,
}: {
  result: HealthResult;
  /** Open the source viewer highlighting this verbatim quote. */
  onCite: (cite: string) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-2">
        <Stethoscope size={14} className="text-shine" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
          สุขภาพธุรกิจโดยรวม
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold ${scoreTone(result.overallScore)}`}
        >
          {result.overallScore === null ? "ประเมินไม่ได้" : `${result.overallScore}/100`}
        </span>
      </div>

      {/* Readable briefing (markdown prose — never raw JSON). */}
      <div className="rounded-lg border border-night-edge bg-night/50 px-4 py-3">
        <Markdown>{result.briefing}</Markdown>
      </div>

      <div className="space-y-2">
        {result.factors.map((f) => (
          <div key={f.key} className="rounded-lg border border-night-edge bg-night/40 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[14px] font-semibold text-chalk">{f.name}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${STATUS_META[f.status].cls}`}
              >
                {STATUS_META[f.status].label}
              </span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${scoreTone(f.score)}`}
              >
                {f.score === null ? "ไม่มีข้อมูล" : `${f.score}/100`}
              </span>
            </div>
            {f.summary && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">{f.summary}</p>
            )}
            {f.findings.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {f.findings.map((fd, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-chalk/85">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-shine" />
                    <span className="min-w-0 flex-1">
                      {fd.detail}
                      {fd.cite && (
                        <button
                          onClick={() => onCite(fd.cite)}
                          title="ดูข้อความต้นฉบับที่อ้างอิง"
                          className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-night-edge px-1.5 py-0.5 align-middle font-mono text-[10px] text-chalk-dim transition hover:border-shine/60 hover:text-shine"
                        >
                          <Quote size={9} /> ที่มา
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {f.actions.length > 0 && (
              <div className="mt-2.5 border-t border-dashed border-night-edge pt-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                  ข้อเสนอถัดไป (คุณเป็นคนตัดสินใจ)
                </p>
                <ul className="mt-1 space-y-1">
                  {f.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-chalk/85">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-go" />
                      <span className="min-w-0 flex-1">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
