"use client";

import { bahtText } from "@/lib/baht-text";
import { discountRate, formatTHB, quoteTotals, type QuoteDoc } from "@/lib/quote";
import type { QuoteSheet, SheetLine } from "@/lib/quote-sheet";

/**
 * The two halves of the "cover" layout (QuoteLayout), printed inside
 * QuotationPrint's page furniture: the cover's one-line-per-module summary with
 * the totals and the amount in words, and — on a page of its own — the detail.
 * Numbers come from lib/quote-sheet; the Word file reads the same sheet.
 */

/** 2.5 man-days prints as 2.5; a blank cell stays blank. */
const qtyText = (n: number | null) => (n === null ? "" : n.toLocaleString("th-TH", { maximumFractionDigits: 2 }));
const moneyText = (n: number | null) => (n === null ? "" : formatTHB(n));

export function CoverSummary({ doc, sheet }: { doc: QuoteDoc; sheet: QuoteSheet }) {
  const t = quoteTotals(doc);
  return (
    <>
      <table className="q-boq q-cover">
        <thead>
          <tr>
            <th className="q-boq-n">ลำดับที่</th>
            <th>รายการ</th>
            <th className="q-boq-qty">จำนวน</th>
            <th className="q-boq-unit">หน่วย</th>
            <th className="q-boq-money">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {sheet.cover.map((l) => (
            <tr key={l.no}>
              <td className="q-c">{l.no}</td>
              <td>
                <span className="q-boq-name">{l.name}</span>
              </td>
              <td className="q-c">{qtyText(l.qty)}</td>
              <td className="q-c">{l.unit}</td>
              <td className="q-r">{moneyText(l.amount)}</td>
            </tr>
          ))}
          {sheet.cover.length === 0 && (
            <tr>
              <td />
              <td className="q-empty">—</td>
              <td colSpan={3} />
            </tr>
          )}
          <tr className="q-boq-total">
            <td />
            <td colSpan={3}>{doc.lumpSum.enabled ? "รวมทุกรายการ (ราคาเหมารวม)" : "รวมทุกรายการ"}</td>
            <td className="q-r">{formatTHB(sheet.total)}</td>
          </tr>
        </tbody>
      </table>

      <table className="q-sum">
        <tbody>
          <tr>
            <th>ราคารวม / Sub Total</th>
            <td>{formatTHB(t.subtotal)}</td>
          </tr>
          {t.discount > 0 && (
            <>
              <tr>
                <th>ส่วนลด / Discount {discountRate(doc.discount)}</th>
                <td>−{formatTHB(t.discount)}</td>
              </tr>
              <tr>
                <th>ราคาหลังหักส่วนลด / Total</th>
                <td>{formatTHB(t.net)}</td>
              </tr>
            </>
          )}
          {doc.vatPercent > 0 && (
            <tr>
              <th>ภาษีมูลค่าเพิ่ม / VAT {doc.vatPercent}%</th>
              <td>{formatTHB(t.vat)}</td>
            </tr>
          )}
          <tr className="q-net">
            <th>ราคาสุทธิ / Grand Total</th>
            <td>{formatTHB(t.grand)}</td>
          </tr>
        </tbody>
      </table>
      <p className="q-words">({bahtText(t.grand)})</p>
    </>
  );
}

export function CoverDetail({ doc, sheet }: { doc: QuoteDoc; sheet: QuoteSheet }) {
  if (sheet.sections.length === 0) return null;
  return (
    <section className="q-detail">
      <h2>รายละเอียดใบเสนอราคา / Details{doc.quoteNo ? ` · ${doc.quoteNo}` : ""}</h2>
      <table className="q-boq">
        {/* A real <thead>: the column names repeat on every page the detail runs onto. */}
        <thead>
          <tr>
            <th className="q-boq-n">ลำดับที่</th>
            <th>รายการ</th>
            <th className="q-boq-qty">จำนวน</th>
            <th className="q-boq-unit">หน่วย</th>
            <th className="q-boq-money">ราคา/หน่วย</th>
            <th className="q-boq-money">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {sheet.sections.map((s) => (
            <SectionRows key={s.no} no={s.no} name={s.name} lines={s.lines} subtotal={s.subtotal} />
          ))}
          {/* In the body, not a <tfoot>: a footer group would repeat the TOTAL at the foot of every page. */}
          <tr className="q-boq-total">
            <td />
            <td colSpan={4}>{doc.lumpSum.enabled ? "TOTAL (ราคาเหมารวม)" : "TOTAL"}</td>
            <td className="q-r">{formatTHB(sheet.total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function SectionRows({ no, name, lines, subtotal }: { no: string; name: string; lines: SheetLine[]; subtotal: number | null }) {
  return (
    <>
      <tr className="q-boq-sec">
        <td className="q-c">{no}</td>
        <td colSpan={5}>{name}</td>
      </tr>
      {lines.map((l, i) => (
        <tr key={`${l.no}-${i}`}>
          <td className="q-c q-boq-no">{l.no}</td>
          <td>
            <div className={l.sub ? "q-sub-item" : undefined}>
              <span className="q-boq-name">{l.name}</span>
              {l.note && <span className="q-note">{l.note}</span>}
            </div>
          </td>
          <td className="q-c">{qtyText(l.qty)}</td>
          <td className="q-c">{l.unit}</td>
          <td className="q-r">{moneyText(l.unitPrice)}</td>
          <td className="q-r">{moneyText(l.amount)}</td>
        </tr>
      ))}
      {subtotal !== null && (
        <tr className="q-boq-subtotal">
          <td />
          <td colSpan={4}>รวม {name}</td>
          <td className="q-r">{formatTHB(subtotal)}</td>
        </tr>
      )}
    </>
  );
}
