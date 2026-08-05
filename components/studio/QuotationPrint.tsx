"use client";

import {
  formatTHB,
  quoteTotals,
  lineTotal,
  SIZE_LABEL,
  thaiDate,
  validUntil,
  type QuoteDoc,
} from "@/lib/quote";
import type { Shot } from "@/lib/shots";

/**
 * The paper. Rendered into a portal on document.body so the print stylesheet
 * can hide every sibling and leave exactly this on the page.
 *
 * Always light, never the studio's midnight theme: this is printed, and a black
 * page is both unreadable on paper and a quarter of a toner cartridge. The
 * colours are hard-coded rather than tokenised for the same reason — a theme
 * change must not silently alter a document a customer has already signed.
 */
export default function QuotationPrint({ doc, shots }: { doc: QuoteDoc; shots: Shot[] }) {
  const t = quoteTotals(doc);
  // Thumbnails are the point of the inventory: the customer sees what they are
  // buying, not just a list of names.
  const gallery = shots.filter((s) => s.url);

  return (
    <div id="fitt-print-root" className="fitt-paper">
      <header className="q-head">
        <div>
          <h1>ใบเสนอราคา</h1>
          <p className="q-sub">{doc.subject}</p>
        </div>
        <table className="q-meta">
          <tbody>
            <tr>
              <th>เลขที่</th>
              <td>{doc.quoteNo || "—"}</td>
            </tr>
            <tr>
              <th>วันที่</th>
              <td>{thaiDate(doc.issuedAt)}</td>
            </tr>
            <tr>
              <th>ยืนราคาถึง</th>
              <td>{thaiDate(validUntil(doc))}</td>
            </tr>
          </tbody>
        </table>
      </header>

      <section className="q-parties">
        <div>
          <p className="q-label">ผู้เสนอราคา</p>
          <p className="q-party">{doc.vendor || "—"}</p>
        </div>
        <div>
          <p className="q-label">เรียน</p>
          <p className="q-party">{doc.customer || "—"}</p>
        </div>
      </section>

      <table className="q-items">
        <thead>
          <tr>
            <th className="q-n">#</th>
            <th>รายการ</th>
            <th className="q-c">ขนาด</th>
            <th className="q-r">แรงงาน (วัน)</th>
            <th className="q-r">ราคา/วัน</th>
            <th className="q-r">รวม</th>
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((r, i) => (
            <tr key={r.id}>
              <td className="q-n">{i + 1}</td>
              <td>
                <div className={r.sub ? "q-sub-item" : ""}>
                  {r.sub && r.parent && <span className="q-of">modal ของ {r.parent}</span>}
                  <span className="q-name">{r.name || "—"}</span>
                  {r.note && <span className="q-note">{r.note}</span>}
                </div>
              </td>
              <td className="q-c">{SIZE_LABEL[r.size]}</td>
              <td className="q-r">{r.days}</td>
              <td className="q-r">{formatTHB(doc.ratePerDay)}</td>
              <td className="q-r">{formatTHB(lineTotal(r, doc.ratePerDay))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} />
            <td className="q-r">{t.days}</td>
            <td className="q-r">รวม</td>
            <td className="q-r">{formatTHB(t.subtotal)}</td>
          </tr>
          {t.discount > 0 && (
            <tr>
              <td colSpan={5} className="q-r">
                ส่วนลด {doc.discountPercent}%
              </td>
              <td className="q-r">−{formatTHB(t.discount)}</td>
            </tr>
          )}
          {doc.vatPercent > 0 && (
            <>
              <tr>
                <td colSpan={5} className="q-r">
                  ราคาก่อนภาษี
                </td>
                <td className="q-r">{formatTHB(t.net)}</td>
              </tr>
              <tr>
                <td colSpan={5} className="q-r">
                  ภาษีมูลค่าเพิ่ม {doc.vatPercent}%
                </td>
                <td className="q-r">{formatTHB(t.vat)}</td>
              </tr>
            </>
          )}
          <tr className="q-grand">
            <td colSpan={5} className="q-r">
              รวมทั้งสิ้น
            </td>
            <td className="q-r">฿{formatTHB(t.grand)}</td>
          </tr>
        </tfoot>
      </table>

      {doc.terms.trim() && (
        <section className="q-terms">
          <p className="q-label">เงื่อนไข</p>
          <pre>{doc.terms}</pre>
        </section>
      )}

      <section className="q-sign">
        <div>
          <div className="q-line" />
          <p>ผู้เสนอราคา</p>
        </div>
        <div>
          <div className="q-line" />
          <p>ผู้อนุมัติสั่งซื้อ</p>
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="q-shots">
          <h2>ภาคผนวก — หน้าจอที่เสนอราคา ({gallery.length})</h2>
          <div className="q-grid">
            {gallery.map((s, i) => (
              <figure key={s.path}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={s.name} />
                <figcaption>
                  {String(i + 1).padStart(2, "0")} · {s.parent ? `${s.parent} — ` : ""}
                  {s.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
