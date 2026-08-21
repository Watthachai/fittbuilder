"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, Plus, Trash2, Wrench } from "lucide-react";
import {
  emptyTerm,
  formatTHB,
  MA_MIN_MONTHLY,
  maintenanceTotals,
  paymentSchedule,
  presetEqual,
  presetSigning,
  presetUat,
  quoteTotals,
  type PaymentTerm,
  type QuoteDoc,
} from "@/lib/quote";
import { acceptanceClauses, generatedClauses, overriddenIndexes } from "@/lib/quote-clauses";
import { Field, inputCls, SectionToggle } from "./QuoteFields";

/**
 * Everything on the quotation that is a promise rather than a price: when the
 * money arrives, what counts as acceptance, and what happens after go-live.
 *
 * The three blocks sit together because they are one argument — you cannot state
 * "60% on UAT delivery" without saying what UAT delivery is, or quote year-two
 * maintenance without saying when year one starts. Editing them in one place is
 * the only way the person sending it can read the deal back in order.
 */
export default function QuoteTerms({
  doc,
  readOnly,
  onEdit,
}: {
  doc: QuoteDoc;
  readOnly: boolean;
  onEdit: (patch: (d: QuoteDoc) => QuoteDoc) => void;
}) {
  const [splitCount, setSplitCount] = useState(12);
  const plan = paymentSchedule(doc);
  const ma = maintenanceTotals(doc.ma);
  const generated = generatedClauses(doc);
  const clauses = acceptanceClauses(doc);
  const overridden = overriddenIndexes(doc);

  /**
   * Store an edit only when it differs from what the numbers produce.
   *
   * Typing a sentence back to its generated wording drops the override, so the
   * clause resumes tracking the payment table instead of freezing at a value
   * that merely looks the same today.
   */
  const setClause = (i: number, text: string, auto: string) =>
    onEdit((d) => {
      const next = { ...(d.acceptance.overrides ?? {}) };
      if (text.trim() === auto.trim() || !text.trim()) delete next[String(i)];
      else next[String(i)] = text;
      return {
        ...d,
        acceptance: {
          ...d.acceptance,
          overrides: Object.keys(next).length ? next : undefined,
        },
      };
    });

  const setExtra = (i: number, text: string) =>
    onEdit((d) => ({
      ...d,
      acceptance: {
        ...d.acceptance,
        extra: (d.acceptance.extra ?? []).map((x, j) => (j === i ? text : x)),
      },
    }));
  const addExtra = () =>
    onEdit((d) => ({
      ...d,
      acceptance: { ...d.acceptance, extra: [...(d.acceptance.extra ?? []), ""] },
    }));
  const removeExtra = (i: number) =>
    onEdit((d) => ({
      ...d,
      acceptance: {
        ...d.acceptance,
        extra: (d.acceptance.extra ?? []).filter((_, j) => j !== i),
      },
    }));
  const { grand } = quoteTotals(doc);
  const scheduled = Math.round(plan.rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const baht = (n: number) => `฿${formatTHB(n)}`;

  const setTerm = (id: string, patch: Partial<PaymentTerm>) =>
    onEdit((d) => ({
      ...d,
      payment: d.payment.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  const setPayment = (payment: PaymentTerm[]) => onEdit((d) => ({ ...d, payment }));

  return (
    <div className="mt-5 space-y-4">
      {/* ---------- Payment schedule ---------- */}
      <section className="rounded-xl border border-night-edge p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarClock size={13} className="text-shine" />
          <h3 className="font-display text-[14px] text-chalk">งวดชำระ</h3>
          <span className="rounded-full bg-night px-2 py-0.5 font-mono text-[12.5px] text-chalk-dim">
            {plan.rows.length} งวด · รวม {plan.percentSum}%
          </span>
          {!readOnly && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Preset label="UAT 60/40" onClick={() => setPayment(presetUat())} />
              <Preset label="ลงนาม 60/40" onClick={() => setPayment(presetSigning())} />
              <div className="flex items-center gap-1 rounded-lg border border-night-edge px-1.5 py-0.5">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={splitCount}
                  onChange={(e) => setSplitCount(Number(e.target.value))}
                  className="w-9 bg-transparent text-right font-mono text-[12.5px] text-chalk outline-none"
                />
                <button
                  onClick={() => setPayment(presetEqual(splitCount))}
                  className="font-display text-[12.5px] text-chalk-dim transition hover:text-shine"
                >
                  งวดเท่ากัน
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 overflow-hidden rounded-lg border border-night-edge">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-night-edge bg-night/60 text-left text-chalk-dim">
                <th className="w-8 px-2 py-1.5 text-right font-display font-medium">งวด</th>
                <th className="px-2 py-1.5 font-display font-medium">เงื่อนไขการชำระ</th>
                <th className="w-16 px-2 py-1.5 text-right font-display font-medium">%</th>
                <th className="w-20 px-2 py-1.5 text-right font-display font-medium">ภายใน (วัน)</th>
                <th className="w-28 px-2 py-1.5 text-right font-display font-medium">จำนวนเงิน</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((line, i) => (
                <tr key={line.term.id} className="group border-b border-night-edge/60 last:border-0">
                  <td className="px-2 py-1 text-right font-mono text-[12.5px] text-chalk-dim">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={line.term.when}
                      onChange={(e) => setTerm(line.term.id, { when: e.target.value })}
                      placeholder="เช่น เมื่อส่งมอบระบบขึ้น UAT"
                      disabled={readOnly}
                      className="w-full rounded-md bg-transparent px-1.5 py-1 text-chalk outline-none focus:bg-night"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={line.term.percent}
                      onChange={(e) => setTerm(line.term.id, { percent: Number(e.target.value) })}
                      disabled={readOnly}
                      className="w-full rounded-md bg-transparent px-1.5 py-1 text-right font-mono text-chalk outline-none focus:bg-night"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      value={line.term.netDays}
                      onChange={(e) => setTerm(line.term.id, { netDays: Number(e.target.value) })}
                      disabled={readOnly}
                      className="w-full rounded-md bg-transparent px-1.5 py-1 text-right font-mono text-chalk outline-none focus:bg-night"
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-chalk">
                    {formatTHB(line.amount)}
                  </td>
                  <td className="px-1">
                    {!readOnly && (
                      <button
                        onClick={() =>
                          setPayment(doc.payment.filter((t) => t.id !== line.term.id))
                        }
                        aria-label="ลบงวดนี้"
                        className="text-chalk-dim opacity-0 transition hover:text-halt group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {plan.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-chalk-dim">
                    ไม่มีงวดชำระ — ใบเสนอราคาจะไม่พิมพ์ตารางงวด
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/*
          An unbalanced schedule is reported, never corrected. Silently topping
          up the last instalment would print a document that collects a different
          number from the total agreed above it — and nobody would ever see it.
        */}
        {!plan.balanced && plan.rows.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-halt/40 bg-halt/10 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-halt">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              งวดชำระรวมได้ {plan.percentSum}% — ต้องเป็น 100% ตอนนี้ตารางงวดเก็บเงินรวม{" "}
              {baht(scheduled)} จากราคารวมทั้งสิ้น {baht(grand)}
            </span>
          </p>
        )}

        {!readOnly && (
          <button
            onClick={() => setPayment([...doc.payment, emptyTerm(doc.payment.length)])}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1.5 font-display text-[14px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
          >
            <Plus size={12} /> เพิ่มงวด
          </button>
        )}
      </section>

      {/* ---------- Acceptance ---------- */}
      <section className="rounded-xl border border-night-edge p-3.5">
        <SectionToggle
          title="เงื่อนไขการส่งมอบและตรวจรับ"
          hint="ข้อสัญญาด้านล่างถูกสร้างจากตัวเลขในใบนี้ ไม่ใช่ข้อความที่พิมพ์ซ้ำ — แก้งวดชำระแล้วข้อสัญญาจะตามไปเอง"
          on={doc.acceptance.enabled}
          disabled={readOnly}
          onChange={(enabled) =>
            onEdit((d) => ({ ...d, acceptance: { ...d.acceptance, enabled } }))
          }
        />

        {doc.acceptance.enabled && (
          <>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_140px]">
              <Field label="ส่งมอบขึ้นที่ไหน (ระบุในสัญญา)">
                <input
                  value={doc.acceptance.channel}
                  onChange={(e) =>
                    onEdit((d) => ({
                      ...d,
                      acceptance: { ...d.acceptance, channel: e.target.value },
                    }))
                  }
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
              <Field label="ระยะเวลาตรวจรับ (วัน)">
                <input
                  type="number"
                  min={0}
                  value={doc.acceptance.reviewDays}
                  onChange={(e) =>
                    onEdit((d) => ({
                      ...d,
                      acceptance: { ...d.acceptance, reviewDays: Number(e.target.value) },
                    }))
                  }
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
            </div>

            <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[12.5px] leading-relaxed text-chalk-dim">
              <input
                type="checkbox"
                checked={doc.acceptance.deemedAccepted}
                disabled={readOnly}
                onChange={(e) =>
                  onEdit((d) => ({
                    ...d,
                    acceptance: { ...d.acceptance, deemedAccepted: e.target.checked },
                  }))
                }
                className="mt-0.5 accent-[var(--color-shine)]"
              />
              <span>
                ครบกำหนดตรวจรับแล้วลูกค้าไม่แจ้งข้อบกพร่อง ให้ถือว่าตรวจรับแล้ว และงวดที่เหลือถึงกำหนดชำระ
                <span className="block text-chalk-dim/70">
                  ปิดข้อนี้ = ต้องมีการตรวจรับจริงก่อน งวดสุดท้ายจึงจะถึงกำหนด
                </span>
              </span>
            </label>

            {/* Editable, but each line still says whether it follows the numbers. */}
            {clauses.length > 0 && (
              <div className="mt-3 rounded-lg border border-night-edge bg-night p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-[11.5px] uppercase tracking-widest text-chalk-dim">
                    ข้อความที่จะพิมพ์ในใบเสนอราคา
                  </p>
                  <span className="font-mono text-[11px] text-chalk-dim">
                    แก้ข้อไหนก็ได้ · ข้อที่ไม่แก้จะอัปเดตตามตารางเอง
                  </span>
                </div>
                <ol className="mt-2 space-y-2 text-[12.5px] leading-relaxed">
                  {generated.map((auto, i) => {
                    const edited = overridden.includes(i);
                    return (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 shrink-0 font-mono text-[11.5px] text-chalk-dim">
                          {i + 1}.
                        </span>
                        <div className="flex-1">
                          <textarea
                            value={clauses[i]}
                            readOnly={readOnly}
                            rows={2}
                            onChange={(e) => setClause(i, e.target.value, auto)}
                            className={`${inputCls} min-h-[46px] resize-y leading-relaxed ${
                              edited ? "border-shine/40" : ""
                            }`}
                          />
                          {edited && (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="font-mono text-[11.5px] text-shine">
                                แก้เอง — ตัวเลขในข้อนี้จะไม่ตามตารางแล้ว
                              </span>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => setClause(i, auto, auto)}
                                  className="font-mono text-[11.5px] text-chalk-dim underline transition hover:text-chalk"
                                >
                                  คืนค่าอัตโนมัติ
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {(doc.acceptance.extra ?? []).map((text, i) => (
                    <li key={`extra-${i}`} className="flex gap-2">
                      <span className="mt-1.5 shrink-0 font-mono text-[11.5px] text-chalk-dim">
                        {generated.length + i + 1}.
                      </span>
                      <div className="flex-1">
                        <textarea
                          value={text}
                          readOnly={readOnly}
                          rows={2}
                          onChange={(e) => setExtra(i, e.target.value)}
                          placeholder="เงื่อนไขเพิ่มเติม เช่น ราคานี้ไม่รวมค่าเดินทางต่างจังหวัด"
                          className={`${inputCls} min-h-[46px] resize-y leading-relaxed`}
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => removeExtra(i)}
                            className="mt-1 font-mono text-[11.5px] text-chalk-dim underline transition hover:text-halt"
                          >
                            ลบข้อนี้
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={addExtra}
                    className="mt-2 font-mono text-[11.5px] text-shine transition hover:brightness-110"
                  >
                    + เพิ่มข้อสัญญา
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------- Maintenance ---------- */}
      <section className="rounded-xl border border-night-edge p-3.5">
        <SectionToggle
          title="ค่าบำรุงรักษาระบบ (MA)"
          hint="คิดแยกจากราคาพัฒนา ไม่รวมในยอดรวมทั้งสิ้น — พิมพ์เป็นตารางของตัวเองท้ายใบเสนอราคา"
          on={doc.ma.enabled}
          disabled={readOnly}
          onChange={(enabled) => onEdit((d) => ({ ...d, ma: { ...d.ma, enabled } }))}
        />

        {doc.ma.enabled && (
          <>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-4">
              <Field label="จำนวน module">
                <input
                  type="number"
                  min={1}
                  value={doc.ma.modules}
                  onChange={(e) =>
                    onEdit((d) => ({ ...d, ma: { ...d.ma, modules: Number(e.target.value) } }))
                  }
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
              <Field label={`฿/module/เดือน (ขั้นต่ำ ${formatTHB(MA_MIN_MONTHLY)})`}>
                <input
                  type="number"
                  min={0}
                  step={1_000}
                  value={doc.ma.perModuleMonthly}
                  onChange={(e) =>
                    onEdit((d) => ({
                      ...d,
                      ma: { ...d.ma, perModuleMonthly: Number(e.target.value) },
                    }))
                  }
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
              <Field label="รวมให้ฟรี (เดือน)">
                <input
                  type="number"
                  min={0}
                  value={doc.ma.includedMonths}
                  onChange={(e) =>
                    onEdit((d) => ({
                      ...d,
                      ma: { ...d.ma, includedMonths: Number(e.target.value) },
                    }))
                  }
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
              <Field label="ปีที่ 2 เป็นต้นไป (฿/ปี)">
                <input
                  type="number"
                  min={0}
                  step={5_000}
                  value={doc.ma.annualFromYear2}
                  onChange={(e) =>
                    onEdit((d) => ({
                      ...d,
                      ma: { ...d.ma, annualFromYear2: Number(e.target.value) },
                    }))
                  }
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
            </div>

            {ma.clamped && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-shine/40 bg-shine/[0.08] px-2.5 py-1.5 text-[12.5px] leading-relaxed text-chalk">
                <Wrench size={12} className="mt-0.5 shrink-0 text-shine" />
                ต่ำกว่าขั้นต่ำ — ใบเสนอราคาจะพิมพ์ที่ {baht(MA_MIN_MONTHLY)}/module/เดือน
              </p>
            )}

            <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
              <MaStat
                label="ต่อเดือน"
                value={baht(ma.monthly)}
                sub={`${baht(ma.perModule)} × ${ma.modules} module`}
              />
              <MaStat
                label={`รวมให้ ${ma.includedMonths} เดือนแรก`}
                value={baht(ma.includedValue)}
                sub="อยู่ในราคาโครงการแล้ว"
              />
              <MaStat label="ปีที่ 2 เป็นต้นไป" value={baht(ma.annual)} sub="ต่อปี" accent />
            </div>

            <div className="mt-2.5">
              <Field label="หมายเหตุ MA (พิมพ์ใต้ตาราง)">
                <input
                  value={doc.ma.note}
                  onChange={(e) => onEdit((d) => ({ ...d, ma: { ...d.ma, note: e.target.value } }))}
                  placeholder="เช่น ครอบคลุมการแก้บั๊กและดูแลระบบในเวลาทำการ"
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-night-edge px-2 py-1 font-display text-[12.5px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
    >
      {label}
    </button>
  );
}

function MaStat({
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
    <div
      className={`rounded-lg border p-2 ${
        accent ? "border-shine/50 bg-shine/10" : "border-night-edge bg-night"
      }`}
    >
      <p className="font-display text-[11.5px] uppercase tracking-widest text-chalk-dim">{label}</p>
      <p className={`font-display text-[15px] font-semibold ${accent ? "text-shine" : "text-chalk"}`}>
        {value}
      </p>
      <p className="font-mono text-[11.5px] text-chalk-dim">{sub}</p>
    </div>
  );
}
