"use client";

import {
  formatTHB,
  maintenanceTotals,
  marketComparison,
  paymentSchedule,
  quoteTotals,
  lineTotal,
  SIZE_LABEL,
  thaiDate,
  validUntil,
  type QuoteDoc,
} from "@/lib/quote";
import { acceptanceClauses } from "@/lib/quote-clauses";
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
  const market = marketComparison(doc);
  const plan = paymentSchedule(doc);
  const ma = maintenanceTotals(doc.ma);
  const clauses = acceptanceClauses(doc);
  const brand = doc.brand;
  const hasBrand = Boolean(brand.logoUrl || brand.name || brand.taxId || brand.address);
  // Thumbnails are the point of the inventory: the customer sees what they are
  // buying, not just a list of names.
  const gallery = shots.filter((s) => s.url);

  return (
    <div id="fitt-print-root" className="fitt-paper">
      {/* The sender's own letterhead, above the document title — a partner sends
          this on their paper, and their name reads before ours does. */}
      {hasBrand && (
        <section className="q-brand">
          {brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="q-logo" />
          )}
          <div>
            {brand.name && <p className="q-brand-name">{brand.name}</p>}
            {brand.address && <p className="q-brand-line">{brand.address}</p>}
            {brand.taxId && <p className="q-brand-line">เลขประจำตัวผู้เสียภาษี {brand.taxId}</p>}
            {brand.contact && <p className="q-brand-line">{brand.contact}</p>}
          </div>
        </section>
      )}

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

      {/* The saving, stated as an estimate and attributed to nobody but the
          sender — it is their claim about their market, made editable in the
          panel for exactly that reason. */}
      {market && (
        <section className="q-market">
          <table>
            <tbody>
              <tr>
                <th>ราคาตลาดโดยประมาณสำหรับขอบเขตงานนี้</th>
                <td className="q-strike">{formatTHB(market.market)}</td>
              </tr>
              <tr>
                <th>ราคาที่เสนอ</th>
                <td>{formatTHB(market.quoted)}</td>
              </tr>
              <tr className="q-save">
                <th>ประหยัด</th>
                <td>
                  {formatTHB(market.saved)} ({market.percent}%)
                </td>
              </tr>
            </tbody>
          </table>
          {doc.marketNote && <p className="q-pitch">{doc.marketNote}</p>}
        </section>
      )}

      {plan.rows.length > 0 && (
        <section className="q-pay">
          <h2>งวดการชำระเงิน</h2>
          <table>
            <thead>
              <tr>
                <th className="q-n">งวด</th>
                <th>เงื่อนไขการชำระ</th>
                <th className="q-c">สัดส่วน</th>
                <th className="q-r">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((line, i) => (
                <tr key={line.term.id}>
                  <td className="q-n">{i + 1}</td>
                  <td>
                    {line.term.when || "—"}
                    {line.term.netDays > 0 && (
                      <span className="q-of">ชำระภายใน {line.term.netDays} วันนับจากวันที่ถึงกำหนด</span>
                    )}
                  </td>
                  <td className="q-c">{line.term.percent}%</td>
                  <td className="q-r">{formatTHB(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="q-pay-total">
                <td colSpan={2} />
                <td className="q-c">{plan.percentSum}%</td>
                <td className="q-r">
                  ฿{formatTHB(plan.rows.reduce((s, r) => s + r.amount, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {/* Priced beside the project, never inside its total: this is a recurring
          service that starts after go-live, and folding it into the grand total
          would misstate what is due on signature. */}
      {doc.ma.enabled && (
        <section className="q-ma">
          <h2>ค่าบำรุงรักษาระบบ (MA) — ไม่รวมในราคาข้างต้น</h2>
          <table>
            <tbody>
              <tr>
                <th>อัตราค่าบำรุงรักษา</th>
                <td className="q-r">
                  {formatTHB(ma.perModule)} / module / เดือน × {ma.modules} module
                </td>
              </tr>
              <tr>
                <th>รวมต่อเดือน</th>
                <td className="q-r">฿{formatTHB(ma.monthly)}</td>
              </tr>
              {ma.includedMonths > 0 && (
                <tr>
                  <th>{ma.includedMonths} เดือนแรกนับจากวันตรวจรับ</th>
                  <td className="q-r">รวมอยู่ในราคาโครงการแล้ว</td>
                </tr>
              )}
              <tr className="q-ma-year2">
                <th>ปีที่ 2 เป็นต้นไป</th>
                <td className="q-r">฿{formatTHB(ma.annual)} / ปี</td>
              </tr>
            </tbody>
          </table>
          {doc.ma.note && <p className="q-pitch">{doc.ma.note}</p>}
        </section>
      )}

      {/* Generated from the numbers above, not typed beside them — see
          lib/quote-clauses.ts. This is the part the customer is held to. */}
      {clauses.length > 0 && (
        <section className="q-clauses">
          <h2>เงื่อนไขการส่งมอบ ตรวจรับ และชำระเงิน</h2>
          <ol>
            {clauses.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </section>
      )}

      {doc.terms.trim() && (
        <section className="q-terms">
          <p className="q-label">เงื่อนไขอื่น</p>
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

      {brand.poweredBy && <p className="q-powered">Powered by FITT Builder</p>}
    </div>
  );
}
