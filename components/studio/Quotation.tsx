"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CornerDownRight,
  Handshake,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  brandFromOrg,
  emptyRow,
  formatTHB,
  lineTotal,
  missingRows,
  newDoc,
  marketComparison,
  lumpSumSystemCount,
  quoteTotals,
  rowCounts,
  SIZE_DAYS,
  SIZE_HINT,
  SIZE_LABEL,
  type QuoteDoc,
  type QuoteRow,
  type Size,
} from "@/lib/quote";
import { loadQuote, saveQuote } from "@/lib/quote-store";
import { marketMidpoint, type QuoteAdvice } from "@/lib/quote-advice";
import { getOrg } from "@/lib/orgs";
import { loadUserBrand } from "@/lib/user-brand";
import { listShots, type Shot } from "@/lib/shots";
import type { VersionKey } from "@/lib/versions";
import type { ProjectFiles } from "@/lib/types";
import { toast } from "@/lib/toast";
import { printSheet } from "@/lib/print-sheet";
import QuotationPrint from "./QuotationPrint";
import QuoteBrandBar from "./QuoteBrandBar";
import QuoteTerms from "./QuoteTerms";
import { Field, inputCls, Total } from "./QuoteFields";

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
  orgId,
  version,
  shots,
  files,
  readOnly,
}: {
  projectId: string;
  projectName: string;
  /** The workspace whose company identity heads the paper — null if unbound. */
  orgId: string | null;
  /** Which version's inventory to price — its shots, re-read scoped on print. */
  version: VersionKey;
  shots: Shot[];
  /** Source of truth for what each screen does — read by the AI pass. */
  files: ProjectFiles | null;
  readOnly: boolean;
}) {
  const [doc, setDoc] = useState<QuoteDoc | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * The shots the printed sheet is currently rendering — null when not
   * printing. One piece of state rather than a `printing` flag beside a shot
   * array, so the two cannot disagree about what is on the paper.
   */
  const [sheet, setSheet] = useState<Shot[] | null>(null);
  /**
   * The print ACTION is running — which starts before the paper exists, because
   * the URLs are re-signed first. Separate from `sheet` on purpose: one answers
   * "what is on the paper", this one answers "is the button working".
   */
  const [printing, setPrinting] = useState(false);
  const [writing, setWriting] = useState(false);
  const [pricing, setPricing] = useState(false);
  // The advisor's proposal, held OUTSIDE the document until it is accepted:
  // the sender signs their name to the price, so nothing here edits it for them.
  const [advice, setAdvice] = useState<QuoteAdvice | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Today is read once, on mount: a document's issue date must not change
  // under the user because they left the tab open past midnight.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let alive = true;
    /**
     * A FRESH document takes the workspace's letterhead; a stored one keeps its
     * own. That asymmetry is the point: the brand is copied into the document at
     * birth, so reopening a quotation sent months ago shows the header it was
     * sent with, not whatever the company logo is today.
     */
    const seed = async () => {
      const saved = await loadQuote(projectId, today).catch(() => null);
      if (saved) return saved;
      const fresh = newDoc(shots, projectName, today);
      if (orgId) {
        const org = await getOrg(orgId).catch(() => null);
        return org ? { ...fresh, brand: brandFromOrg(org.brand, org.isPartner) } : fresh;
      }
      // No workspace → the personal default letterhead, if one was ever saved.
      const mine = await loadUserBrand().catch(() => null);
      return mine ? { ...fresh, brand: { ...fresh.brand, ...mine } } : fresh;
    };
    void seed().then((d) => {
      if (!alive) return;
      setDoc(d);
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
   * Fill in what each screen does, read off the source.
   *
   * Only rows that have no description yet: a human sentence outranks a
   * generated one, and silently replacing someone's wording is the same
   * mistake as re-seeding prices from a fresh capture.
   */
  const describe = async () => {
    if (!doc || !files || readOnly) return;
    const blank = doc.rows.filter((r) => r.name.trim() && !r.note.trim());
    if (blank.length === 0) {
      toast.info("ทุกรายการมีคำอธิบายแล้ว", {
        description: "ถ้าอยากให้เขียนใหม่ ลบข้อความในช่องรายละเอียดก่อนแล้วกดอีกครั้ง",
      });
      return;
    }
    setWriting(true);
    try {
      const res = await fetch("/api/screen-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, names: blank.map((r) => r.name) }),
      });
      const data = (await res.json()) as { specs?: Record<string, string>; error?: string };
      if (!res.ok || !data.specs) {
        toast.error("เขียนรายละเอียดไม่สำเร็จ", { description: data.error });
        return;
      }
      const specs = data.specs;
      const filled = blank.filter((r) => specs[r.name]).length;
      edit((d) => ({
        ...d,
        rows: d.rows.map((r) =>
          !r.note.trim() && specs[r.name] ? { ...r, note: specs[r.name] } : r
        ),
      }));
      toast.success(`เขียนรายละเอียดให้ ${filled} รายการ`, {
        description: "อ่านทวนแล้วแก้ได้เลย — ข้อความนี้จะไปอยู่ในใบเสนอราคา",
      });
    } catch (e) {
      toast.error("เขียนรายละเอียดไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setWriting(false);
    }
  };

  /**
   * Ask what this scope goes for, and what to charge.
   *
   * The answer is a proposal card, not an edit: market range, a recommended
   * rate, a second opinion on every line's days, and a sentence to say to the
   * customer. Accepting it is a separate, explicit click.
   */
  const askPrice = async () => {
    if (!doc || readOnly) return;
    if (doc.rows.length === 0) {
      toast.info("ยังไม่มีรายการให้ตั้งราคา");
      return;
    }
    setPricing(true);
    try {
      const res = await fetch("/api/quote-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc }),
      });
      const data = (await res.json()) as { advice?: QuoteAdvice; error?: string };
      if (!res.ok || !data.advice) {
        toast.error("ตั้งราคาให้ไม่สำเร็จ", { description: data.error });
        return;
      }
      setAdvice(data.advice);
    } catch (e) {
      toast.error("ตั้งราคาให้ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPricing(false);
    }
  };

  /** Take the rate (and the market line the paper compares against). */
  const applyRate = (a: QuoteAdvice) => {
    edit((d) => ({
      ...d,
      ratePerDay: a.suggestedRate,
      marketRatePerDay: marketMidpoint(a),
      marketNote: a.pitch,
    }));
    setAdvice(null);
    toast.success(`ใช้เรต ฿${a.suggestedRate.toLocaleString("th-TH")}/วัน แล้ว`);
  };

  /** Take the rate AND the per-line day counts, matched by name + parent. */
  const applyAll = (a: QuoteAdvice) => {
    const byKey = new Map(a.rows.map((r) => [`${r.parent}\u0000${r.name}`, r]));
    let changed = 0;
    edit((d) => ({
      ...d,
      ratePerDay: a.suggestedRate,
      marketRatePerDay: marketMidpoint(a),
      marketNote: a.pitch,
      rows: d.rows.map((r) => {
        const hit = byKey.get(`${r.parent}\u0000${r.name}`);
        if (!hit) return r;
        if (hit.days !== r.days || hit.size !== r.size) changed++;
        return { ...r, size: hit.size, days: hit.days };
      }),
    }));
    setAdvice(null);
    toast.success(`ใช้ราคาที่แนะนำแล้ว · ปรับ ${changed} รายการ`);
  };

  /**
   * Print through the browser: a portal onto document.body plus a print
   * stylesheet that hides every sibling. No PDF library, no server render —
   * ⌘P → "Save as PDF" is a route every OS already has, and it prints exactly
   * what the preview shows.
   */
  const print = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      // Shot URLs are signed for 8 hours (lib/shots.ts). A studio tab left open
      // overnight holds a doc full of expired links, and the appendix prints as
      // a grid of broken boxes — so re-sign right before mounting the sheet.
      // Falling back to the props on failure keeps a network blip from turning
      // "picture might be stale" into "cannot print at all".
      const fresh = await listShots(projectId, version).catch(() => [] as Shot[]);
      const printable = fresh.length > 0 ? fresh : shots;
      await printSheet(
        () => setSheet(printable),
        () => setSheet(null)
      );
    } finally {
      setPrinting(false);
    }
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
  const counts = rowCounts(doc);
  const market = marketComparison(doc);
  const baht = (n: number) => `฿${formatTHB(n)}`;
  const setRow = (id: string, patch: Partial<QuoteRow>) =>
    edit((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
      {/* Letterhead — whose paper this is */}
      <div className="mb-3">
        <QuoteBrandBar
          brand={doc.brand}
          orgId={orgId}
          readOnly={readOnly}
          onChange={(patch) => edit((d) => ({ ...d, brand: { ...d.brand, ...patch } }))}
        />
      </div>

      {/* Recipient — the four labelled lines the paper prints as a form.
          There is no "ผู้เสนอราคา" field here on purpose: the letterhead above
          already IS the sender, and asking for the same company twice is how a
          document ends up disagreeing with its own header. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="เรียน (ตำแหน่ง / ผู้รับ)">
          <input
            value={doc.customerAttn}
            onChange={(e) => edit((d) => ({ ...d, customerAttn: e.target.value }))}
            placeholder="เช่น ผู้จัดการฝ่ายไอที"
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
        <Field label="ชื่อ (บริษัทลูกค้า)">
          <input
            value={doc.customerName}
            onChange={(e) => edit((d) => ({ ...d, customerName: e.target.value }))}
            placeholder="บริษัท ตัวอย่าง จำกัด"
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
        <Field label="ที่อยู่ลูกค้า">
          <textarea
            value={doc.customerAddress}
            onChange={(e) => edit((d) => ({ ...d, customerAddress: e.target.value }))}
            rows={2}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
        <div className="grid gap-3">
          <Field label="โทร. ลูกค้า">
            <input
              value={doc.customerPhone}
              onChange={(e) => edit((d) => ({ ...d, customerPhone: e.target.value }))}
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <Field label="นำเสนอโดย">
            <input
              value={doc.presentedBy}
              onChange={(e) => edit((d) => ({ ...d, presentedBy: e.target.value }))}
              placeholder="ชื่อผู้ติดต่อฝั่งเรา"
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
        </div>
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
      <div className="mt-5 flex items-center gap-2">
        <h3 className="font-display text-[14px] text-chalk">รายการ</h3>
        <span className="rounded-full bg-night px-2 py-0.5 font-mono text-[12.5px] text-chalk-dim">
          {counts.screens} หน้าจอ · {counts.modals} modal
        </span>
        {!readOnly && files && (
          <button
            onClick={() => void describe()}
            disabled={writing}
            title="ให้ AI อ่านโค้ดแล้วเขียนว่าแต่ละหน้าทำอะไรได้บ้าง — เติมเฉพาะช่องที่ยังว่าง"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-shine/50 px-2.5 py-1 font-display text-[14px] text-shine transition hover:bg-shine/10 disabled:opacity-40"
          >
            {writing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {writing ? "กำลังเขียน…" : "เขียนรายละเอียดด้วย AI"}
          </button>
        )}
        {!readOnly && (
          <button
            onClick={() => void askPrice()}
            disabled={pricing}
            title="ให้ AI ดูขอบเขตงานจริงแล้วเสนอเรตต่อวัน เทียบกับราคาตลาด — เสนอเฉยๆ ยังไม่แก้ใบเสนอราคา"
            className={`inline-flex items-center gap-1.5 rounded-lg border border-shine/50 px-2.5 py-1 font-display text-[14px] text-shine transition hover:bg-shine/10 disabled:opacity-40 ${
              files ? "" : "ml-auto"
            }`}
          >
            {pricing ? <Loader2 size={12} className="animate-spin" /> : <Handshake size={12} />}
            {pricing ? "กำลังคิดราคา…" : "ให้ AI ช่วยตั้งราคา"}
          </button>
        )}
      </div>

      {advice && <AdviceCard advice={advice} doc={doc} onClose={() => setAdvice(null)} onRate={applyRate} onAll={applyAll} />}
      <div className="mt-1.5 overflow-hidden rounded-xl border border-night-edge">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-night-edge bg-night/60 text-left text-chalk-dim">
              <th className="w-8 px-2 py-2 text-right font-display font-medium">#</th>
              <th className="px-2 py-2 font-display font-medium">รายการ / รายละเอียดการทำงาน</th>
              <th className="w-[150px] px-2 py-2 text-center font-display font-medium">ขนาดงาน</th>
              <th className="w-24 px-2 py-2 text-right font-display font-medium">วัน</th>
              <th className="w-28 px-2 py-2 text-right font-display font-medium">รวม</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((r, i) => (
              <tr key={r.id} className="group border-b border-night-edge/60 last:border-0">
                <td className="px-2 py-1.5 text-right font-mono text-[12.5px] text-chalk-dim">
                  {i + 1}
                </td>
                <td className="px-2 py-1.5">
                  {/* A modal is indented under the screen it opens from, and
                      says so — "did it take the subs?" has to be answerable by
                      looking, not by counting. */}
                  <div className={r.sub ? "border-l-2 border-shine/40 pl-2" : ""}>
                    {r.sub && r.parent && (
                      <span className="mb-0.5 inline-flex items-center gap-1 font-mono text-[11.5px] text-shine/80">
                        <CornerDownRight size={9} /> modal ของ {r.parent}
                      </span>
                    )}
                    <input
                      value={r.name}
                      onChange={(e) => setRow(r.id, { name: e.target.value })}
                      placeholder="ชื่อหน้าจอ / งาน"
                      disabled={readOnly}
                      className="w-full rounded-md bg-transparent px-1.5 py-1 text-chalk outline-none focus:bg-night"
                    />
                    <textarea
                      value={r.note}
                      onChange={(e) => setRow(r.id, { note: e.target.value })}
                      rows={4}
                      placeholder="หน้านี้ทำอะไรได้บ้าง — กด “เขียนรายละเอียดด้วย AI” ให้อ่านโค้ดเขียนให้ได้"
                      disabled={readOnly}
                      className="w-full resize-y rounded-md bg-transparent px-1.5 py-0.5 text-[13.5px] leading-relaxed text-chalk-dim outline-none placeholder:text-chalk-dim/40 focus:bg-night"
                    />
                  </div>
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
                        className={`flex-1 rounded-md px-1.5 py-0.5 font-display text-[12.5px] transition ${
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1.5 font-display text-[14px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
          >
            <Plus size={12} /> เพิ่มรายการ
          </button>
          {missing.length > 0 && (
            <button
              onClick={() => edit((d) => ({ ...d, rows: [...d.rows, ...missing] }))}
              title="เพิ่มเฉพาะหน้าที่ยังไม่มีในใบเสนอราคา — ราคาที่แก้ไว้แล้วไม่ถูกเขียนทับ"
              className="inline-flex items-center gap-1.5 rounded-lg border border-shine/50 px-2.5 py-1.5 font-display text-[14px] text-shine transition hover:bg-shine/10"
            >
              <RefreshCw size={12} /> ซิงค์จากคลังหน้าจอ (+{missing.length})
            </button>
          )}
        </div>
      )}

      {/* One agreed figure instead of a priced breakdown. The rows above stay —
          they are what the scope paragraph is built from — only the arithmetic
          is replaced. */}
      <div className="mt-5 rounded-xl border border-night-edge p-3">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={doc.lumpSum.enabled}
            onChange={(e) =>
              edit((d) => ({
                ...d,
                lumpSum: {
                  ...d.lumpSum,
                  enabled: e.target.checked,
                  // Seed from what the breakdown already says, rounded to the
                  // nearest ten thousand — the figure people actually quote.
                  amount:
                    d.lumpSum.amount ||
                    Math.round(quoteTotals(d).subtotal / 10_000) * 10_000,
                  title: d.lumpSum.title || d.subject,
                },
              }))
            }
            disabled={readOnly}
            className="mt-0.5 h-4 w-4 accent-shine"
          />
          <span>
            <span className="block font-display text-[14px] text-chalk">
              เสนอเป็นราคาเดียว ไม่แจกแจงราคาต่อรายการ
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-chalk-dim">
              กระดาษจะพิมพ์บรรทัดเดียว ชื่องานหนึ่งบรรทัดแล้วขอบเขตทั้งหมดอยู่ใต้มัน
              พร้อมราคาเดียวด้านขวา · VAT คิดต่อจากตัวเลขนี้ตามปกติ
            </span>
          </span>
        </label>
        {doc.lumpSum.enabled && (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px]">
            <Field label="ชื่องานที่จะขึ้นบรรทัดเดียว">
              <input
                value={doc.lumpSum.title}
                onChange={(e) =>
                  edit((d) => ({ ...d, lumpSum: { ...d.lumpSum, title: e.target.value } }))
                }
                placeholder={doc.subject}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
            <Field label={`ราคา (บาท, ก่อน VAT) · ${lumpSumSystemCount(doc)} ระบบ`}>
              <input
                type="number"
                min={0}
                step={10_000}
                value={doc.lumpSum.amount}
                onChange={(e) =>
                  edit((d) => ({
                    ...d,
                    lumpSum: { ...d.lumpSum, amount: Number(e.target.value) },
                  }))
                }
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
          </div>
        )}
      </div>

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
          <Field label="ราคาตลาด/วัน — 0 = ไม่เทียบ">
            <input
              type="number"
              min={0}
              step={500}
              value={doc.marketRatePerDay}
              onChange={(e) => edit((d) => ({ ...d, marketRatePerDay: Number(e.target.value) }))}
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="ประโยคเทียบราคา (พิมพ์ในใบเสนอราคา)">
              <input
                value={doc.marketNote}
                onChange={(e) => edit((d) => ({ ...d, marketNote: e.target.value }))}
                placeholder="เช่น งานขนาดนี้ในตลาดอยู่ที่ประมาณ … เราเสนอราคาพิเศษให้"
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
          </div>
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
            <span className="font-display text-[14px] text-chalk">รวมทั้งสิ้น</span>
            <span className="font-display text-lg font-semibold text-shine">
              ฿{formatTHB(t.grand)}
            </span>
          </div>
          {market && (
            <div className="mt-2.5 rounded-lg border border-go/40 bg-go/10 p-2.5">
              <div className="flex items-baseline justify-between text-[14px]">
                <span className="text-chalk-dim">ราคาตลาดโดยประมาณ</span>
                <span className="font-mono text-chalk-dim line-through">{baht(market.market)}</span>
              </div>
              <div className="flex items-baseline justify-between text-[14px]">
                <span className="text-go">ลูกค้าประหยัด</span>
                <span className="font-mono font-semibold text-go">
                  {baht(market.saved)} ({market.percent}%)
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-chalk-dim">
                เทียบที่ {baht(doc.marketRatePerDay)}/วัน — เป็นการประมาณการ แก้ตัวเลขได้ในช่อง
                “ราคาตลาด/วัน” และจะพิมพ์ลงใบเสนอราคาด้วย
              </p>
            </div>
          )}
          <button
            onClick={() => void print()}
            disabled={printing}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-shine px-3 py-2 font-display text-[14px] font-semibold text-night transition hover:brightness-110 disabled:opacity-60"
          >
            {printing ? (
              <>
                <Loader2 size={13} className="animate-spin" /> กำลังเตรียมภาพ…
              </>
            ) : (
              <>
                <Printer size={13} /> พิมพ์ / บันทึกเป็น PDF
              </>
            )}
          </button>
          <p className="mt-1.5 text-center text-[11.5px] leading-relaxed text-chalk-dim">
            ในหน้าต่างพิมพ์ เลือกปลายทางเป็น “Save as PDF” · ภาพหน้าจอทั้งหมดจะไปเป็นภาคผนวกท้ายเอกสาร
          </p>
        </div>
      </div>

      {/* The promises: when the money arrives, what counts as acceptance, MA. */}
      <QuoteTerms doc={doc} readOnly={readOnly} onEdit={edit} />

      {sheet &&
        typeof document !== "undefined" &&
        createPortal(<QuotationPrint doc={doc} shots={sheet} />, document.body)}
    </div>
  );
}

/**
 * The advisor's proposal.
 *
 * Shown as a card the sender reads and decides on — market range, recommended
 * rate, the reasoning, and every line the model would re-estimate. Two ways to
 * take it and one to dismiss it; there is no path where it edits the document
 * on its own, because the person sending the quotation is the one who has to
 * defend the number.
 */
function AdviceCard({
  advice,
  doc,
  onClose,
  onRate,
  onAll,
}: {
  advice: QuoteAdvice;
  doc: QuoteDoc;
  onClose: () => void;
  onRate: (a: QuoteAdvice) => void;
  onAll: (a: QuoteAdvice) => void;
}) {
  const baht = (n: number) => `฿${formatTHB(n)}`;
  // Only the lines the model would actually change — a wall of "same as yours"
  // buries the two rows worth arguing about.
  const changed = advice.rows.filter((a) => {
    const mine = doc.rows.find((r) => r.name === a.name && r.parent === a.parent);
    return mine && (mine.days !== a.days || mine.size !== a.size);
  });

  return (
    <div className="mt-2 rounded-xl border border-shine/40 bg-shine/[0.06] p-3.5">
      <div className="flex items-start gap-2">
        <Handshake size={14} className="mt-0.5 shrink-0 text-shine" />
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-[15px] font-semibold text-chalk">ข้อเสนอราคาจาก AI</h4>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-chalk-dim">{advice.rationale}</p>
        </div>
        <button onClick={onClose} aria-label="ปิด" className="shrink-0 text-chalk-dim hover:text-chalk">
          <X size={13} />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Stat label="ราคาตลาด" value={`${baht(advice.marketLow)}–${baht(advice.marketHigh)}`} sub="ต่อวัน" />
        <Stat label="แนะนำให้เสนอ" value={baht(advice.suggestedRate)} sub="ต่อวัน" accent />
        <Stat label="ของคุณตอนนี้" value={baht(doc.ratePerDay)} sub="ต่อวัน" />
      </div>

      {advice.pitch && (
        <p className="mt-3 rounded-lg border border-night-edge bg-night px-2.5 py-2 text-[12.5px] leading-relaxed text-chalk">
          💬 {advice.pitch}
        </p>
      )}

      {changed.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer font-display text-[12.5px] text-chalk-dim hover:text-chalk">
            เสนอปรับจำนวนวัน {changed.length} รายการ
          </summary>
          <div className="scroll-thin mt-1.5 max-h-40 space-y-1 overflow-y-auto">
            {changed.map((a) => {
              const mine = doc.rows.find((r) => r.name === a.name && r.parent === a.parent)!;
              return (
                <div key={`${a.parent}/${a.name}`} className="text-[12.5px] leading-relaxed">
                  <span className="text-chalk">{a.name}</span>{" "}
                  <span className="font-mono text-chalk-dim">
                    {mine.days} → <b className="text-shine">{a.days}</b> วัน
                  </span>
                  {a.why && <span className="block text-chalk-dim/70">— {a.why}</span>}
                </div>
              );
            })}
          </div>
        </details>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onAll(advice)}
          className="rounded-lg bg-shine px-3 py-1.5 font-display text-[14px] font-semibold text-night transition hover:brightness-110"
        >
          ใช้ทั้งหมด (เรต + จำนวนวัน)
        </button>
        <button
          onClick={() => onRate(advice)}
          className="rounded-lg border border-shine/50 px-3 py-1.5 font-display text-[14px] text-shine transition hover:bg-shine/10"
        >
          ใช้เฉพาะเรตต่อวัน
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-night-edge px-3 py-1.5 font-display text-[14px] text-chalk-dim transition hover:text-chalk"
        >
          ไม่ใช้ — กรอกเอง
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-2 ${accent ? "border-shine/50 bg-shine/10" : "border-night-edge bg-night"}`}>
      <p className="font-display text-[11.5px] uppercase tracking-widest text-chalk-dim">{label}</p>
      <p className={`font-display text-[15px] font-semibold ${accent ? "text-shine" : "text-chalk"}`}>
        {value}
      </p>
      <p className="font-mono text-[11.5px] text-chalk-dim">{sub}</p>
    </div>
  );
}
