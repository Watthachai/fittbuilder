"use client";

import { useState } from "react";
import { DEFAULT_VAT, MA_MIN_MONTHLY, presetUat } from "@/lib/quote";

const LINES = [
  { label: "ระบบจัดการสต็อกกลาง", meta: "12 หน้าจอ · 4 modal", amount: 420_000 },
  { label: "รายงานผู้บริหาร", meta: "4 หน้าจอ", amount: 160_000 },
];

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

/**
 * The partner promise, as the document it is actually about.
 *
 * Everything else in this section is a sentence claiming the paper comes out in
 * your name. This is the paper — with a switch that takes our name off it and
 * strikes out the "Powered by" line while you watch. The difference between the
 * two states IS the product difference, and it is cheaper to show once than to
 * assert three times.
 *
 * Colours are literal, matching the .fitt-paper rule rather than the theme
 * tokens, for the same reason that rule gives: a document does not restyle
 * itself when the reader flips to dark mode. It also gives the section the one
 * bright surface on an otherwise dark page, which is the point at which a
 * reader's eye stops.
 *
 * The percentages and the maintenance floor are IMPORTED, not typed: they are
 * the same values the real quotation prints, so a change to the product cannot
 * leave a stale number on the marketing page.
 */
export default function PartnerLetterhead() {
  const [ownBrand, setOwnBrand] = useState(true);

  const net = LINES.reduce((sum, l) => sum + l.amount, 0);
  const grand = Math.round(net * (1 + DEFAULT_VAT / 100));
  const terms = presetUat();

  return (
    <figure className="mt-14">
      <figcaption className="mb-4 flex flex-wrap items-center justify-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-chalk/45">
          ออกใบเสนอราคา
        </span>
        <div
          role="group"
          aria-label="สลับชื่อบนหัวกระดาษ"
          className="inline-flex rounded-full border border-chalk/15 p-0.5"
        >
          {[
            { on: true, label: "ในนามบริษัทคุณ" },
            { on: false, label: "ในนามเรา" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setOwnBrand(opt.on)}
              aria-pressed={ownBrand === opt.on}
              className={`rounded-full px-4 py-1.5 text-[13px] transition ${
                ownBrand === opt.on
                  ? "bg-shine font-medium text-night"
                  : "text-chalk/60 hover:text-chalk"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </figcaption>

      <div
        // Always light: this is paper, and paper does not follow a theme.
        style={{ "--ink": "#1f2937", "--ink-dim": "#6b7280", "--rule": "#d1d5db" } as React.CSSProperties}
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-[color:var(--ink)] shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-9"
      >
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            {ownBrand ? (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-[color:var(--rule)] text-[9px] leading-tight text-[color:var(--ink-dim)]">
                โลโก้
                <br />
                คุณ
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo.png" alt="" className="h-11 w-11 shrink-0 rounded-lg" />
            )}
            <div className="min-w-0">
              <p className="text-[15px] leading-tight font-semibold">
                {ownBrand ? "บริษัทของคุณ จำกัด" : "FITT Builder"}
              </p>
              <p className="mt-0.5 text-[11px] text-[color:var(--ink-dim)]">
                {ownBrand ? "เลขประจำตัวผู้เสียภาษี 0-1055-XXXXX-XX-X" : "fittbuilder.com"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-semibold">ใบเสนอราคา</p>
            <p className="mt-0.5 font-mono text-[11px] text-[color:var(--ink-dim)]">QT-2026-014</p>
          </div>
        </header>

        <table className="mt-6 w-full text-[13px]">
          <caption className="sr-only">ตัวอย่างรายการในใบเสนอราคา</caption>
          <tbody>
            {LINES.map((line) => (
              <tr key={line.label} className="border-t border-[color:var(--rule)]">
                <td className="py-2.5">
                  {line.label}
                  <span className="block text-[11px] text-[color:var(--ink-dim)]">{line.meta}</span>
                </td>
                <td className="py-2.5 text-right font-mono tabular-nums">{baht(line.amount)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[color:var(--ink)]">
              <td className="py-2.5 font-semibold">รวมทั้งสิ้น (รวม VAT {DEFAULT_VAT}%)</td>
              <td className="py-2.5 text-right font-mono font-semibold tabular-nums">
                {baht(grand)}
              </td>
            </tr>
            {terms.map((term, i) => (
              <tr key={term.id} className="text-[color:var(--ink-dim)]">
                <td className="pt-2 text-[12px]">
                  งวดที่ {i + 1} · {term.when}
                </td>
                <td className="pt-2 text-right font-mono text-[12px] tabular-nums">
                  {term.percent}% · {baht(Math.round((grand * term.percent) / 100))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="mt-6 flex items-center justify-between border-t border-[color:var(--rule)] pt-3 text-[11px] text-[color:var(--ink-dim)]">
          <span>ค่าดูแลระบบหลังส่งมอบ ขั้นต่ำ {baht(MA_MIN_MONTHLY)}/module/เดือน</span>
          <span
            // Struck through rather than removed: watching the line go is the
            // whole demonstration; an element that simply vanishes shows nothing.
            className="transition-all duration-500"
            style={{
              opacity: ownBrand ? 0.35 : 1,
              textDecoration: ownBrand ? "line-through" : "none",
            }}
          >
            Powered by FITT Builder
          </span>
        </footer>
      </div>
      <p className="mt-3 text-center text-[11px] text-chalk/40">
        ตัวอย่างเอกสาร — ตัวเลขและเงื่อนไขคำนวณจากสูตรเดียวกับใบจริง
      </p>
    </figure>
  );
}
