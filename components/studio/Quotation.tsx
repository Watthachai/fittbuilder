"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import {
  emptyRow,
  formatTHB,
  lineTotal,
  missingRows,
  newDoc,
  quoteTotals,
  SIZE_DAYS,
  SIZE_HINT,
  SIZE_LABEL,
  type QuoteDoc,
  type QuoteRow,
  type Size,
} from "@/lib/quote";
import { loadQuote, saveQuote } from "@/lib/quote-store";
import type { Shot } from "@/lib/shots";
import { toast } from "@/lib/toast";
import QuotationPrint from "./QuotationPrint";

/**
 * Phase 2 of the inventory: turn captured screens into a priced quotation.
 *
 * Rows are SEEDED from the inventory and then owned by the person quoting —
 * re-capturing adds what is missing and never overwrites a price someone set,
 * because the estimate is the human judgement in this feature and the capture
 * is only its raw material. Custom rows exist for the work that is not a screen
 * (API, data migration, deployment), which is most of why a screen-count
 * quotation would otherwise be wrong.
 */

const SIZES: Size[] = ["S", "M", "L"];

export default function Quotation({
  projectId,
  projectName,
  shots,
  readOnly,
}: {
  projectId: string;
  projectName: string;
  shots: Shot[];
  readOnly: boolean;
}) {
  const [doc, setDoc] = useState<QuoteDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Today is read once, on mount: a document's issue date must not change
  // under the user because they left the tab open past midnight.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let alive = true;
    void loadQuote(projectId, today)
      .then((saved) => {
        if (!alive) return;
        setDoc(saved ?? newDoc(shots, projectName, today));
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setDoc(newDoc(shots, projectName, today));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // Seeded once per project — later shots arrive through "ซิงค์จากคลังหน้าจอ",
    // which is additive; re-seeding here would throw away edited prices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /** Debounced autosave — the panel is a form, not a document with a Save button. */
  const edit = useCallback(
    (patch: (d: QuoteDoc) => QuoteDoc) => {
      if (readOnly) return;
      setDoc((prev) => {
        if (!prev) return prev;
        const next = patch(prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void saveQuote(projectId, next).catch((e) =>
            toast.error("บันทึกใบเสนอราคาไม่สำเร็จ", {
              description: e instanceof Error ? e.message : undefined,
            })
          );
        }, 600);
        return next;
      });
    },
    [projectId, readOnly]
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  /**
   * Print through the browser: a portal onto document.body plus a print
   * stylesheet that hides every sibling. No PDF library, no server render —
   * ⌘P → "Save as PDF" is a route every OS already has, and it prints exactly
   * what the preview shows.
   */
  const print = () => {
    setPrinting(true);
    // Two frames: one for the portal to mount, one for images and layout to
    // settle before the print dialog freezes the page.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.print();
        setPrinting(false);
      })
    );
  };

  if (loading || !doc) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-chalk-dim">
        <Loader2 size={14} className="animate-spin text-shine" /> กำลังเปิดใบเสนอราคา…
      </div>
    );
  }

  const t = quoteTotals(doc);
  const missing = missingRows(doc, shots);
  const setRow = (id: string, patch: Partial<QuoteRow>) =>
    edit((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
      {/* Header — who is quoting whom */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้เสนอราคา (บริษัทเรา)">
          <textarea
            value={doc.vendor}
            onChange={(e) => edit((d) => ({ ...d, vendor: e.target.value }))}
            rows={2}
            placeholder="ชื่อบริษัท / ที่อยู่ / เลขผู้เสียภาษี"
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
        <Field label="เรียน (ลูกค้า)">
          <textarea
            value={doc.customer}
            onChange={(e) => edit((d) => ({ ...d, customer: e.target.value }))}
            rows={2}
            placeholder="ชื่อลูกค้า / ผู้ติดต่อ"
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Field label="เรื่อง">
          <input
            value={doc.subject}
            onChange={(e) => edit((d) => ({ ...d, subject: e.target.value }))}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
        <Field label="เลขที่">
          <input
            value={doc.quoteNo}
            onChange={(e) => edit((d) => ({ ...d, quoteNo: e.target.value }))}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
        <Field label="วันที่">
          <input
            type="date"
            value={doc.issuedAt}
            onChange={(e) => edit((d) => ({ ...d, issuedAt: e.target.value }))}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
        <Field label="ยืนราคา (วัน)">
          <input
            type="number"
            min={0}
            value={doc.validDays}
            onChange={(e) => edit((d) => ({ ...d, validDays: Number(e.target.value) }))}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      </div>

      {/* Line items */}
      <div className="mt-5 overflow-hidden rounded-xl border border-night-edge">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-night-edge bg-night/60 text-left text-chalk-dim">
              <th className="w-8 px-2 py-2 text-right font-display font-medium">#</th>
              <th className="px-2 py-2 font-display font-medium">รายการ</th>
              <th className="w-[150px] px-2 py-2 text-center font-display font-medium">ขนาดงาน</th>
              <th className="w-24 px-2 py-2 text-right font-display font-medium">วัน</th>
              <th className="w-28 px-2 py-2 text-right font-display font-medium">รวม</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((r, i) => (
              <tr key={r.id} className="group border-b border-night-edge/60 last:border-0">
                <td className="px-2 py-1.5 text-right font-mono text-[11px] text-chalk-dim">
                  {i + 1}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={r.name}
                    onChange={(e) => setRow(r.id, { name: e.target.value })}
                    placeholder="ชื่อหน้าจอ / งาน"
                    disabled={readOnly}
                    className={`w-full rounded-md bg-transparent px-1.5 py-1 text-chalk outline-none focus:bg-night ${
                      r.sub ? "ml-3 border-l border-night-edge pl-2" : ""
                    }`}
                  />
                  <input
                    value={r.note}
                    onChange={(e) => setRow(r.id, { note: e.target.value })}
                    placeholder="หมายเหตุ (ไม่บังคับ)"
                    disabled={readOnly}
                    className="w-full rounded-md bg-transparent px-1.5 py-0.5 text-[11px] text-chalk-dim outline-none placeholder:text-chalk-dim/40 focus:bg-night"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex justify-center rounded-lg border border-night-edge p-0.5">
                    {SIZES.map((s) => (
                      <button
                        key={s}
                        disabled={readOnly}
                        // Changing the size resets the day count to that size's
                        // default: picking a size IS the estimate, and leaving a
                        // stale number under a new label is the quiet way to
                        // send a wrong price.
                        onClick={() => setRow(r.id, { size: s, days: SIZE_DAYS[s] })}
                        title={SIZE_HINT[s]}
                        className={`flex-1 rounded-md px-1.5 py-0.5 font-display text-[11px] transition ${
                          r.size === s ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
                        }`}
                      >
                        {SIZE_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={r.days}
                    onChange={(e) => setRow(r.id, { days: Number(e.target.value) })}
                    disabled={readOnly}
                    className="w-full rounded-md bg-transparent px-1.5 py-1 text-right font-mono text-chalk outline-none focus:bg-night"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-chalk">
                  {formatTHB(lineTotal(r, doc.ratePerDay))}
                </td>
                <td className="px-1">
                  {!readOnly && (
                    <button
                      onClick={() => edit((d) => ({ ...d, rows: d.rows.filter((x) => x.id !== r.id) }))}
                      aria-label="ลบรายการนี้"
                      className="text-chalk-dim opacity-0 transition hover:text-halt group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {doc.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-chalk-dim">
                  ยังไม่มีรายการ — แคปหน้าจอในแท็บแกลเลอรีก่อน แล้วกด “ซิงค์จากคลังหน้าจอ”
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => edit((d) => ({ ...d, rows: [...d.rows, emptyRow(d.rows.length)] }))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1.5 font-display text-[12px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
          >
            <Plus size={12} /> เพิ่มรายการ
          </button>
          {missing.length > 0 && (
            <button
              onClick={() => edit((d) => ({ ...d, rows: [...d.rows, ...missing] }))}
              title="เพิ่มเฉพาะหน้าที่ยังไม่มีในใบเสนอราคา — ราคาที่แก้ไว้แล้วไม่ถูกเขียนทับ"
              className="inline-flex items-center gap-1.5 rounded-lg border border-shine/50 px-2.5 py-1.5 font-display text-[12px] text-shine transition hover:bg-shine/10"
            >
              <RefreshCw size={12} /> ซิงค์จากคลังหน้าจอ (+{missing.length})
            </button>
          )}
        </div>
      )}

      {/* Pricing + totals */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="ราคาต่อวัน (บาท)">
            <input
              type="number"
              min={0}
              step={500}
              value={doc.ratePerDay}
              onChange={(e) => edit((d) => ({ ...d, ratePerDay: Number(e.target.value) }))}
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <Field label="ส่วนลด (%)">
            <input
              type="number"
              min={0}
              max={100}
              value={doc.discountPercent}
              onChange={(e) => edit((d) => ({ ...d, discountPercent: Number(e.target.value) }))}
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <Field label="VAT (%) — ใส่ 0 ถ้าไม่คิด">
            <input
              type="number"
              min={0}
              max={100}
              value={doc.vatPercent}
              onChange={(e) => edit((d) => ({ ...d, vatPercent: Number(e.target.value) }))}
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <div className="sm:col-span-3">
            <Field label="เงื่อนไข">
              <textarea
                value={doc.terms}
                onChange={(e) => edit((d) => ({ ...d, terms: e.target.value }))}
                rows={4}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
          </div>
        </div>

        <div className="h-fit rounded-xl border border-night-edge bg-night p-4">
          <Total label={`แรงงานรวม ${t.days} วัน`} value={formatTHB(t.subtotal)} />
          {t.discount > 0 && (
            <Total label={`ส่วนลด ${doc.discountPercent}%`} value={`−${formatTHB(t.discount)}`} />
          )}
          {doc.vatPercent > 0 && (
            <>
              <Total label="ราคาก่อนภาษี" value={formatTHB(t.net)} />
              <Total label={`VAT ${doc.vatPercent}%`} value={formatTHB(t.vat)} />
            </>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-night-edge pt-2.5">
            <span className="font-display text-[12px] text-chalk">รวมทั้งสิ้น</span>
            <span className="font-display text-lg font-semibold text-shine">
              ฿{formatTHB(t.grand)}
            </span>
          </div>
          <button
            onClick={print}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-shine px-3 py-2 font-display text-[12px] font-semibold text-night transition hover:brightness-110"
          >
            <Printer size={13} /> พิมพ์ / บันทึกเป็น PDF
          </button>
          <p className="mt-1.5 text-center text-[10px] leading-relaxed text-chalk-dim">
            ในหน้าต่างพิมพ์ เลือกปลายทางเป็น “Save as PDF” · ภาพหน้าจอทั้งหมดจะไปเป็นภาคผนวกท้ายเอกสาร
          </p>
        </div>
      </div>

      {printing &&
        typeof document !== "undefined" &&
        createPortal(<QuotationPrint doc={doc} shots={shots} />, document.body)}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-night-edge bg-night px-2.5 py-1.5 text-[12px] text-chalk outline-none focus:border-shine/60 disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-[10px] uppercase tracking-widest text-chalk-dim">
        {label}
      </span>
      {children}
    </label>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5 text-[12px]">
      <span className="text-chalk-dim">{label}</span>
      <span className="font-mono text-chalk">{value}</span>
    </div>
  );
}
