import { describe, expect, it } from "vitest";
import { buildQuoteAdviceUser, marketMidpoint, parseQuoteAdvice } from "../quote-advice";
import { emptyRow, newDoc, type QuoteDoc } from "../quote";

const DOC: QuoteDoc = {
  ...newDoc([], "Pace", "2026-08-05"),
  subject: "พัฒนาระบบวิ่ง",
  ratePerDay: 8_000,
  rows: [
    { ...emptyRow(), id: "1", name: "หน้าหลัก", size: "M", days: 2.5, note: "สรุปสถิติการวิ่ง", sub: false, parent: "" },
    { ...emptyRow(), id: "2", name: "บันทึกการวิ่ง", size: "S", days: 1, note: "", sub: true, parent: "หน้าหลัก" },
  ],
};

describe("buildQuoteAdviceUser", () => {
  it("sends the scope as quoted — names, sizes, days and what each screen does", () => {
    const user = buildQuoteAdviceUser(DOC);
    expect(user).toContain("พัฒนาระบบวิ่ง");
    expect(user).toContain("8000");
    expect(user).toContain("หน้าหลัก");
    expect(user).toContain("สรุปสถิติการวิ่ง");
    // A modal has to be recognisable as one, or it gets estimated as a screen.
    expect(user).toContain('modal ของ “หน้าหลัก”');
  });

  // Case #23: a yearly service has no man-days to review, and its price was
  // typed on purpose — the advisor must not hand back days for it.
  it("leaves out rows priced by the unit", () => {
    const service = { ...emptyRow(), name: "ค่าบริการรายปี", pricing: "unit" as const, qty: 12, unitPrice: 12_500 };
    const user = buildQuoteAdviceUser({ ...DOC, rows: [...DOC.rows, service] });
    expect(user).not.toContain("ค่าบริการรายปี");
    expect(user).toContain("รายการทั้งหมด 2 รายการ");
  });
});

describe("parseQuoteAdvice", () => {
  const RAW = `{"marketLow":10000,"marketHigh":15000,"suggestedRate":9500,
    "rationale":"งาน 2 หน้าจอ ไม่ซับซ้อน","pitch":"ราคาตลาดประมาณ 12,000 เราเสนอ 9,500",
    "rows":[{"name":"หน้าหลัก","parent":"","size":"M","days":3,"why":"มีกราฟและสรุป"}]}`;

  it("reads the range, the recommendation and the per-line second opinion", () => {
    const a = parseQuoteAdvice(RAW)!;
    expect(a.marketLow).toBe(10_000);
    expect(a.suggestedRate).toBe(9_500);
    expect(a.rows[0]).toMatchObject({ name: "หน้าหลัก", days: 3, size: "M" });
  });

  // "฿12,000–฿8,000" reads as a bug on screen; the range is normalised instead.
  it("puts a reversed range the right way round", () => {
    const a = parseQuoteAdvice(`{"marketLow":15000,"marketHigh":9000,"suggestedRate":9000}`)!;
    expect([a.marketLow, a.marketHigh]).toEqual([9_000, 15_000]);
  });

  /**
   * Without a recommended rate there is no proposal to show — better to say
   * "ลองอีกครั้ง" than to render a card built around a missing number.
   */
  it("refuses an answer with no usable rate", () => {
    expect(parseQuoteAdvice(`{"marketLow":1,"marketHigh":2}`)).toBeNull();
    expect(parseQuoteAdvice(`{"suggestedRate":0}`)).toBeNull();
    expect(parseQuoteAdvice(`{"suggestedRate":"แพง"}`)).toBeNull();
    expect(parseQuoteAdvice("ขอโทษครับ")).toBeNull();
  });

  it("drops a line with no name or no day count rather than pricing a blank", () => {
    const a = parseQuoteAdvice(
      `{"suggestedRate":9000,"rows":[{"name":"","days":2},{"name":"ก","days":0},{"name":"ข","days":2}]}`
    )!;
    expect(a.rows.map((r) => r.name)).toEqual(["ข"]);
  });

  it("tolerates prose or fences around the JSON", () => {
    expect(parseQuoteAdvice('ได้ครับ:\n```json\n{"suggestedRate":7000}\n```')!.suggestedRate).toBe(
      7_000
    );
  });
});

describe("marketMidpoint", () => {
  // The middle of the range, not its top: the comparison printed to a customer
  // should not be the most flattering number available.
  it("takes the middle of the range", () => {
    expect(marketMidpoint(parseQuoteAdvice(`{"marketLow":10000,"marketHigh":15000,"suggestedRate":9000}`)!)).toBe(
      12_500
    );
  });

  it("falls back to whichever end exists", () => {
    expect(marketMidpoint(parseQuoteAdvice(`{"marketHigh":12000,"suggestedRate":9000}`)!)).toBe(
      12_000
    );
  });
});
