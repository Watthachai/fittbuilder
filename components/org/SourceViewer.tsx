"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";

interface Range {
  start: number;
  end: number;
}

/** Collapse whitespace + lowercase, keeping a map from each normalized-char
 *  index back to its original index, so a match found in the normalized text can
 *  be highlighted at the right place in the original. */
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      norm += " ";
      map.push(i);
      prevSpace = true;
    } else {
      norm += ch.toLowerCase();
      map.push(i);
      prevSpace = false;
    }
  }
  return { norm, map };
}

const normFragment = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Locate the cited passage(s) inside the raw source. The AI's verbatim "quote"
 * is often a *reconstruction* of several source lines/bullets (it adds `*`, `:`,
 * reorders, collapses newlines), so an exact `indexOf` usually fails. Strategy:
 *   1. try the whole quote, whitespace/case-insensitive (clean single highlight);
 *   2. else split the quote into phrases and highlight each that's found —
 *      NotebookLM-style multi-span highlighting.
 */
function findHighlightRanges(sources: string, highlight?: string): Range[] {
  if (!highlight || !sources) return [];
  const { norm, map } = normalizeWithMap(sources);
  if (!norm) return [];
  const toRange = (nStart: number, nLen: number): Range => ({
    start: map[nStart],
    end: map[nStart + nLen - 1] + 1,
  });

  const whole = normFragment(highlight);
  if (whole.length >= 4) {
    const idx = norm.indexOf(whole);
    if (idx >= 0) return [toRange(idx, whole.length)];
  }

  // Split on the separators the model tends to inject between source fragments.
  const frags = highlight
    .split(/[\n•*;:,"“”|.()[\]]+|\s[-–—]\s/)
    .map(normFragment)
    .filter((f) => f.length >= 6)
    .slice(0, 16);
  const ranges: Range[] = [];
  const seen = new Set<string>();
  for (const f of frags) {
    if (seen.has(f)) continue;
    seen.add(f);
    const idx = norm.indexOf(f);
    if (idx >= 0) ranges.push(toRange(idx, f.length));
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/** Shows the workspace's raw source data, highlighting the cited passage(s) so the
 *  user can see exactly where a piece of Org DNA came from (NotebookLM-style).
 *  Auto-scrolls to the first highlight on open. Matching is fuzzy (whitespace/case
 *  + per-phrase) so reconstructed quotes still land on the right text. */
export default function SourceViewer({
  sources,
  highlight,
  onClose,
}: {
  sources: string;
  highlight?: string;
  onClose: () => void;
}) {
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  useEffect(() => {
    // Bring the first cited passage into view when the viewer opens.
    markRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const ranges = useMemo(() => findHighlightRanges(sources, highlight), [sources, highlight]);

  if (typeof document === "undefined") return null;

  const has = ranges.length > 0;
  const body: React.ReactNode = has
    ? (() => {
        const nodes: React.ReactNode[] = [];
        let cursor = 0;
        ranges.forEach((r, i) => {
          if (r.start > cursor) nodes.push(sources.slice(cursor, r.start));
          nodes.push(
            <mark
              key={i}
              ref={i === 0 ? markRef : undefined}
              className="rounded bg-shine/30 px-0.5 text-chalk"
            >
              {sources.slice(r.start, r.end)}
            </mark>
          );
          cursor = r.end;
        });
        if (cursor < sources.length) nodes.push(sources.slice(cursor));
        return nodes;
      })()
    : sources || "ยังไม่มีแหล่งข้อมูล";

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong flex h-[90vh] w-[min(96vw,72rem)] flex-col rounded-2xl border border-night-edge p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-chalk">
            <FileText size={18} className="text-shine" /> แหล่งข้อมูลของคุณ
          </h2>
          <button onClick={onClose} className="rounded-sm p-1 text-chalk-dim transition hover:text-chalk">
            <X size={20} />
          </button>
        </div>
        {has && (
          <p className="mt-1.5 text-[13px] text-chalk-dim">
            ส่วนที่ไฮไลต์ = ข้อความที่ AI ใช้อ้างอิงสำหรับฐานรากนี้
          </p>
        )}
        <div className="scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-night-edge bg-night p-5 text-[16px] leading-8 text-chalk/90">
          {body}
        </div>
      </div>
    </div>,
    document.body
  );
}
