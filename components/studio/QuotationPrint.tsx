"use client";

import {
  formatTHB,
  maintenanceTotals,
  marketComparison,
  paymentSchedule,
  quoteTotals,
  lineTotal,
  safeAccent,
  SIZE_LABEL,
  thaiDate,
  thaiDateShort,
  validUntil,
  type QuoteDoc,
  lumpSumScope,
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
 * change must not silently alter a document a customer has already signed. The
 * single exception is the accent, which is a brand field: the whole point of the
 * partner programme is that this is not our document.
 *
 * ---- why the outer <table> ----
 *
 * A quotation that runs to two pages must carry its letterhead and its footer
 * on BOTH, or page two is an anonymous sheet of numbers. `position: fixed`
 * repeats unreliably across browsers; `display: table-header-group` on a real
 * <thead> is the one mechanism that has worked since print stylesheets existed.
 * So the whole document is one table: <thead> is the page furniture, <tfoot> is
 * the mark, and every section lives in a single <tbody> cell.
 */
export default function QuotationPrint({ doc, shots }: { doc: QuoteDoc; shots: Shot[] }) {
  const t = quoteTotals(doc);
  const market = marketComparison(doc);
  const plan = paymentSchedule(doc);
  const ma = maintenanceTotals(doc.ma);
  const clauses = acceptanceClauses(doc);
  const brand = doc.brand;
  const accent = safeAccent(brand.accent);
  const hasSender = Boolean(
    doc.presentedBy || brand.name || brand.address || brand.contact || brand.taxId
  );
  // Thumbnails are the point of the inventory: the customer sees what they are
  // buying, not just a list of names.
  const gallery = shots.filter((s) => s.url);

  return (
    <div id="fitt-print-root" className="fitt-paper" style={{ ["--accent" as string]: accent }}>
      <table className="q-sheet">
        {/* Page furniture — repeats on every printed page. */}
        <thead>
          <tr>
            <td>
              <div className="q-top">
                <div className="q-mark">
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logoUrl} alt="" className="q-logo" />
                  ) : (
                    brand.name && <p className="q-mark-name">{brand.name}</p>
                  )}
                </div>
                <div className="q-title">
                  <h1>ใบเสนอราคา</h1>
                  <table className="q-meta">
                    <tbody>
                      <tr>
                        <th>เลขที่ :</th>
                        <td>{doc.quoteNo || "—"}</td>
                      </tr>
                      <tr>
                        <th>วันที่ :</th>
                        <td>{thaiDateShort(doc.issuedAt)}</td>
                      </tr>
                      <tr>
                        <th>ยืนราคาถึง :</th>
                        <td>{thaiDateShort(validUntil(doc))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="q-parties">
                {/* Recipient — labelled lines, read as a form by whoever checks
                    the legal entity against the tax address. */}
                <table className="q-to">
                  <tbody>
                    <Row label="เรียน :" value={doc.customerAttn} />
                    <Row label="ชื่อ :" value={doc.customerName} strong />
                    <Row label="ที่อยู่ :" value={doc.customerAddress} />
                    <Row label="โทร. :" value={doc.customerPhone} />
                  </tbody>
                </table>

                {/* The label is only worth printing when something follows it —
                    a lone "นำเสนอโดย" over white space reads as a broken
                    template, not as a field someone forgot. */}
                <div className="q-from">
                  {hasSender && <p className="q-from-label">นำเสนอโดย</p>}
                  {doc.presentedBy && <p className="q-from-person">{doc.presentedBy}</p>}
                  {brand.name && <p className="q-from-name">{brand.name}</p>}
                  {brand.address && <p className="q-from-line">{brand.address}</p>}
                  {brand.contact && <p className="q-from-line">{brand.contact}</p>}
                  {brand.taxId && (
                    <p className="q-from-line">เลขประจำตัวผู้เสียภาษี : {brand.taxId}</p>
                  )}
                </div>
              </div>
            </td>
          </tr>
        </thead>

        <tfoot>
          <tr>
            <td>
              <div className="q-foot">
                <div>
                  {brand.name && <p className="q-foot-name">{brand.name}</p>}
                  {brand.tagline && <p className="q-foot-tag">{brand.tagline}</p>}
                </div>
                {brand.poweredBy && <p className="q-powered">Powered by FITT Builder</p>}
              </div>
            </td>
          </tr>
        </tfoot>

        <tbody>
          <tr>
            <td>
              {doc.subject && <p className="q-subject">เรื่อง : {doc.subject}</p>}

              <table className="q-items">
                <thead>
                  <tr>
                    <th className="q-n" />
                    <th>รายละเอียด / Description</th>
                    <th className="q-r">ราคา / Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {/* One agreed figure: the scope still prints in full, but as
                      the description of a single line rather than as prices to
                      be argued with one by one. */}
                  {doc.lumpSum.enabled && (
                    <tr>
                      <td className="q-n">1</td>
                      <td>
                        <div>
                          <span className="q-name">
                            {doc.lumpSum.title || doc.subject || "—"}
                          </span>
                          <span className="q-note">{lumpSumScope(doc)}</span>
                        </div>
                      </td>
                      <td className="q-r">{formatTHB(t.subtotal)}</td>
                    </tr>
                  )}
                  {!doc.lumpSum.enabled && doc.rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="q-n">{i + 1}</td>
                      <td>
                        <div className={r.sub ? "q-sub-item" : ""}>
                          {r.sub && r.parent && (
                            <span className="q-of">modal ของ {r.parent}</span>
                          )}
                          <span className="q-name">{r.name || "—"}</span>
                          {/* What the price is made of. Small and grey — it
                              justifies the number without competing with it. */}
                          <span className="q-basis">
                            {SIZE_LABEL[r.size]} · {r.days} วัน × {formatTHB(doc.ratePerDay)}
                          </span>
                          {r.note && <span className="q-note">{r.note}</span>}
                        </div>
                      </td>
                      <td className="q-r">{formatTHB(lineTotal(r, doc.ratePerDay))}</td>
                    </tr>
                  ))}
                  {!doc.lumpSum.enabled && doc.rows.length === 0 && (
                    <tr>
                      <td className="q-n" />
                      <td className="q-empty">—</td>
                      <td className="q-r">0</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <table className="q-sum">
                <tbody>
                  <tr>
                    <th>ราคารวม / Total</th>
                    <td>{formatTHB(t.subtotal)}</td>
                  </tr>
                  {t.discount > 0 && (
                    <tr>
                      <th>ส่วนลด / Discount {doc.discountPercent}%</th>
                      <td>−{formatTHB(t.discount)}</td>
                    </tr>
                  )}
                  {doc.vatPercent > 0 && (
                    <tr>
                      <th>ภาษีมูลค่าเพิ่ม / Vat {doc.vatPercent}%</th>
                      <td>{formatTHB(t.vat)}</td>
                    </tr>
                  )}
                  <tr className="q-net">
                    <th>ราคาสุทธิ / Net</th>
                    <td>{formatTHB(t.grand)}</td>
                  </tr>
                </tbody>
              </table>

              {/* The saving, stated as an estimate and attributed to nobody but
                  the sender — it is their claim about their market, made
                  editable in the panel for exactly that reason. */}
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
                <section className="q-block q-pay">
                  <h2>งวดการชำระเงิน / Payment Schedule</h2>
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
                              <span className="q-of">
                                ชำระภายใน {line.term.netDays} วันนับจากวันที่ถึงกำหนด
                              </span>
                            )}
                          </td>
                          <td className="q-c">{line.term.percent}%</td>
                          <td className="q-r">{formatTHB(line.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} />
                        <td className="q-c">{plan.percentSum}%</td>
                        <td className="q-r">
                          {formatTHB(plan.rows.reduce((s, r) => s + r.amount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </section>
              )}

              {/* Priced beside the project, never inside its total: this is a
                  recurring service that starts after go-live, and folding it in
                  would misstate what is due on signature. */}
              {doc.ma.enabled && (
                <section className="q-block q-ma">
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
                        <td className="q-r">{formatTHB(ma.monthly)}</td>
                      </tr>
                      {ma.includedMonths > 0 && (
                        <tr>
                          <th>{ma.includedMonths} เดือนแรกนับจากวันตรวจรับ</th>
                          <td className="q-r">รวมอยู่ในราคาโครงการแล้ว</td>
                        </tr>
                      )}
                      <tr className="q-ma-year2">
                        <th>ปีที่ 2 เป็นต้นไป</th>
                        <td className="q-r">{formatTHB(ma.annual)} / ปี</td>
                      </tr>
                    </tbody>
                  </table>
                  {doc.ma.note && <p className="q-pitch">{doc.ma.note}</p>}
                </section>
              )}

              {/* Generated from the numbers above, not typed beside them — see
                  lib/quote-clauses.ts. This is the part the customer is held to. */}
              {clauses.length > 0 && (
                <section className="q-block q-clauses">
                  <h2>เงื่อนไขการส่งมอบ ตรวจรับ และชำระเงิน</h2>
                  <ol>
                    {clauses.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ol>
                </section>
              )}

              {doc.terms.trim() && (
                <section className="q-block q-terms">
                  <h2>หมายเหตุ</h2>
                  <pre>{doc.terms}</pre>
                </section>
              )}

              <p className="q-thanks">ทางบริษัทขอขอบพระคุณสำหรับการสั่งซื้อของท่าน</p>

              <section className="q-sign">
                <div>
                  <div className="q-line" />
                  <p>ลงนามผู้เสนอราคา</p>
                  <p className="q-sign-date">วันที่ {thaiDate(doc.issuedAt)}</p>
                </div>
                <div>
                  <div className="q-line" />
                  <p>ลงนามผู้อนุมัติสั่งซื้อ</p>
                  <p className="q-sign-date">วันที่ ........./........./.........</p>
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
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** One labelled line of the recipient block. Blank fields print as a rule, not
 *  as nothing — a missing address should look unfilled, not unasked. */
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <th>{label}</th>
      <td className={strong ? "q-strong" : undefined}>{value || "—"}</td>
    </tr>
  );
}
