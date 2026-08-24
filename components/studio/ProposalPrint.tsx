"use client";

import { safeAccent, thaiDate, thaiDateShort, type QuoteDoc } from "@/lib/quote";
import {
  proposalSteps,
  proposalTimeline,
  stepJourney,
  type ProposalDoc,
} from "@/lib/proposal";
import type { Shot } from "@/lib/shots";
import { Row } from "./QuotationPrint";

/**
 * The proposal on paper. Same construction as QuotationPrint and for the same
 * reasons — a portal onto document.body, hard-coded light palette, and one real
 * <table> so the letterhead repeats on every printed page (see the long comment
 * there; it is the load-bearing decision and it is not restated here).
 *
 * What is different is what the paper is allowed to say. This sheet argues —
 * problem, feature, outcome, the walk through the real system — and it names no
 * money. Where the reader would ask "so what does it cost", it points at the
 * quotation by number. Every figure it does carry (days, review window,
 * included maintenance) is read off the quotation through proposalTimeline,
 * never typed here, so the two sheets in the envelope cannot disagree.
 */
export default function ProposalPrint({
  doc,
  quote,
  shots,
}: {
  doc: ProposalDoc;
  /** The priced scope this proposal points at — null when none exists yet. */
  quote: QuoteDoc | null;
  shots: Shot[];
}) {
  const brand = doc.brand;
  const accent = safeAccent(brand.accent);
  const steps = proposalSteps(shots, quote);
  const time = proposalTimeline(quote);
  const points = doc.points.filter((p) => p.problem.trim() || p.feature.trim());
  const excluded = doc.excluded.filter((x) => x.trim());
  const quoteNo = doc.quoteNo.trim() || quote?.quoteNo?.trim() || "";
  const hasSender = Boolean(
    doc.presentedBy || brand.name || brand.address || brand.contact || brand.taxId
  );

  return (
    <div id="fitt-print-root" className="fitt-paper" style={{ ["--accent" as string]: accent }}>
      <table className="q-sheet">
        <thead>
          <tr>
            <td>
              <div className="q-top">
                <div className="q-mark">
                  {brand.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logoUrl} alt="" className="q-logo" />
                  )}
                </div>
                <div className="q-title">
                  <h1>ข้อเสนอโครงการ</h1>
                  <table className="q-meta">
                    <tbody>
                      <tr>
                        <th>เลขที่ :</th>
                        <td>{doc.proposalNo || "—"}</td>
                      </tr>
                      <tr>
                        <th>วันที่ :</th>
                        <td>{thaiDateShort(doc.issuedAt)}</td>
                      </tr>
                      {quoteNo && (
                        <tr>
                          <th>อ้างถึงใบเสนอราคา :</th>
                          <td>{quoteNo}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="q-parties">
                <table className="q-to">
                  <tbody>
                    <Row label="เรียน :" value={doc.customerAttn} />
                    <Row label="ชื่อ :" value={doc.customerName} strong />
                    <Row label="ที่อยู่ :" value={doc.customerAddress} />
                    <Row label="โทร. :" value={doc.customerPhone} />
                  </tbody>
                </table>
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

              {doc.context.trim() && (
                <section className="q-block p-context">
                  <h2>สภาพการทำงานในปัจจุบัน</h2>
                  <p>{doc.context}</p>
                </section>
              )}

              {points.length > 0 && (
                <section className="q-block">
                  <h2>ระบบนี้แก้ปัญหาอะไรให้บ้าง</h2>
                  <table className="p-points">
                    <thead>
                      <tr>
                        <th>ปัญหาที่พบวันนี้</th>
                        <th>สิ่งที่ระบบทำให้</th>
                        <th>ผลที่ได้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((p) => (
                        <tr key={p.id}>
                          <td>{p.problem || "—"}</td>
                          <td>{p.feature || "—"}</td>
                          <td>{p.outcome || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {doc.showSteps && steps.length > 0 && (
                <section className="q-block">
                  <h2>การใช้งานจริง — เดินให้ดูทีละหน้า ({steps.length})</h2>
                  <div className="p-grid">
                    {steps.map((s, i) => {
                      const route = stepJourney(s);
                      return (
                        <figure key={s.id} className="p-step">
                          <figcaption>
                            <span className="p-n">{String(i + 1).padStart(2, "0")}</span>{" "}
                            <strong>{s.name}</strong>
                            {s.parent && <span className="p-route"> · หน้าต่างย่อยของ {s.parent}</span>}
                            {route && <span className="p-route"> — {route}</span>}
                            {s.note && <span className="p-note">{s.note}</span>}
                          </figcaption>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.url} alt={s.name} />
                        </figure>
                      );
                    })}
                  </div>
                </section>
              )}

              {time.known && (
                <section className="q-block">
                  <h2>ขั้นตอนและระยะเวลา</h2>
                  <div className="p-time">
                    <div>
                      <strong>{time.buildDays}</strong> วันทำการ
                      <p>พัฒนาและติดตั้งตามขอบเขต</p>
                    </div>
                    <div>
                      <strong>{time.reviewDays}</strong> วัน
                      <p>ตรวจรับหลังส่งมอบ</p>
                    </div>
                    {time.includedMonths > 0 && (
                      <div>
                        <strong>{time.includedMonths}</strong> เดือนแรก
                        <p>ดูแลระบบรวมในราคาโครงการ</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {excluded.length > 0 && (
                <section className="q-block p-excl">
                  <h2>สิ่งที่ไม่รวมในเฟสนี้</h2>
                  <ul>
                    {excluded.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="q-block p-price">
                <h2>ราคาและเงื่อนไขการชำระเงิน</h2>
                <p>
                  {quoteNo
                    ? `ตามใบเสนอราคาเลขที่ ${quoteNo} ที่แนบมาพร้อมเอกสารฉบับนี้`
                    : "ตามใบเสนอราคาที่แนบมาพร้อมเอกสารฉบับนี้"}
                </p>
              </section>

              {doc.closing.trim() && <p className="p-close">{doc.closing}</p>}

              <section className="q-sign">
                <div>
                  <div className="q-line" />
                  <p>ลงนามผู้เสนอ</p>
                  <p className="q-sign-date">วันที่ {thaiDate(doc.issuedAt)}</p>
                </div>
                <div>
                  <div className="q-line" />
                  <p>ลงนามผู้รับข้อเสนอ</p>
                  <p className="q-sign-date">วันที่ ........./........./.........</p>
                </div>
              </section>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
