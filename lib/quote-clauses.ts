import {
  formatTHB,
  maintenanceTotals,
  paymentSchedule,
  type PaymentLine,
  type QuoteDoc,
} from "./quote";

/**
 * The delivery, acceptance and payment clauses.
 *
 * These are GENERATED from the document's own numbers, never typed. Every
 * percentage, every baht figure and every day count below is read off
 * `doc.payment`, `doc.acceptance` and `doc.ma` — the same values printed in the
 * tables above them on the paper.
 *
 * That is the whole reason this file exists. The agreement it states is one the
 * customer is held to by silence ("no defect raised in 30 days means accepted"),
 * so the clause and the schedule disagreeing is not a formatting bug — it is a
 * dispute. Deriving both from one source makes the disagreement unrepresentable.
 *
 * Pure, like the rest of the quotation: the panel previews exactly what the
 * paper prints because they call this function.
 */

const baht = (n: number) => `฿${formatTHB(n)}`;

/** "งวดที่ 1 จำนวน 60% เป็นเงิน ฿30,000" — the phrase every clause needs. */
function money(index: number, line: PaymentLine): string {
  return `งวดที่ ${index + 1} จำนวน ${line.term.percent}% เป็นเงิน ${baht(line.amount)}`;
}

export function acceptanceClauses(doc: QuoteDoc): string[] {
  if (!doc.acceptance.enabled) return [];

  const { reviewDays, deemedAccepted, channel } = doc.acceptance;
  const { rows } = paymentSchedule(doc);
  const first = rows[0];
  const last = rows.length > 1 ? rows[rows.length - 1] : null;
  const out: string[] = [];

  out.push(
    `ผู้ให้บริการจะส่งมอบระบบขึ้น${channel} และแจ้งผู้ว่าจ้างเป็นลายลักษณ์อักษร ` +
      `ให้ถือวันที่แจ้งดังกล่าวเป็น “วันส่งมอบ”`
  );

  // Clauses cross-reference by their content ("นับจากวันส่งมอบ"), never by
  // number: an instalment-free or acceptance-only document drops a clause, and
  // a hard-coded "ตามข้อ 3" would then point at the wrong one.
  if (first) {
    out.push(
      `เมื่อส่งมอบแล้ว ผู้ว่าจ้างตกลงชำระ${money(0, first)} ` +
        `ภายใน ${first.term.netDays} วันนับจากวันส่งมอบ`
    );
  }

  out.push(
    `ผู้ว่าจ้างมีสิทธิ์ตรวจรับงานและแจ้งข้อบกพร่องเป็นลายลักษณ์อักษร ` +
      `ภายใน ${reviewDays} วันนับจากวันส่งมอบ`
  );

  // The clause the customer is bound by without doing anything. It is stated in
  // full, with the money named, precisely because it operates on their silence.
  if (deemedAccepted) {
    const balance = last
      ? `และ${money(rows.length - 1, last)} ถึงกำหนดชำระทันที`
      : "และค่าจ้างส่วนที่เหลือถึงกำหนดชำระทันที";
    out.push(
      `หากพ้นกำหนด ${reviewDays} วันนับจากวันส่งมอบแล้ว ผู้ว่าจ้างมิได้แจ้งข้อบกพร่องเป็นลายลักษณ์อักษร ` +
        `ให้ถือว่าผู้ว่าจ้างได้ตรวจรับงานโดยสมบูรณ์แล้ว ${balance}`
    );
  } else if (last) {
    out.push(
      `เมื่อผู้ว่าจ้างตรวจรับงานเรียบร้อยแล้ว ${money(rows.length - 1, last)} ` +
        `ถึงกำหนดชำระภายใน ${last.term.netDays} วัน`
    );
  }

  out.push(
    `ข้อบกพร่องที่แจ้งภายในกำหนดและอยู่ในขอบเขตงานตามเอกสารนี้ ` +
      `ผู้ให้บริการจะแก้ไขให้โดยไม่คิดค่าใช้จ่าย — งานที่อยู่นอกขอบเขตถือเป็นงานเพิ่ม ` +
      `และจะเสนอราคาเป็นรายกรณี`
  );

  if (doc.ma.enabled) {
    const t = maintenanceTotals(doc.ma);
    const included =
      t.includedValue > 0
        ? `ค่าบำรุงรักษาระบบ ${doc.ma.includedMonths} เดือนแรกนับจากวันตรวจรับ รวมอยู่ในราคาตามเอกสารนี้แล้ว `
        : "";
    out.push(
      `${included}หลังจากนั้นคิดค่าบำรุงรักษา ${baht(t.annual)} ต่อปี ` +
        `(อัตราขั้นต่ำ ${baht(t.monthly)} ต่อเดือน สำหรับ ${t.modules} module)`
    );
  }

  return out;
}
