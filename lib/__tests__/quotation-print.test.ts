import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuotationPrint from "@/components/studio/QuotationPrint";
import { emptyRow, newDoc, parseDoc } from "@/lib/quote";
import type { Shot } from "@/lib/shots";

/**
 * Case #19, second round: the switch went into the proposal, but the paper
 * that needed it is the quotation — every captured screen printed as an
 * appendix behind the signatures, with no way to leave it off.
 */
const shots: Shot[] = [
  { path: "a.png", name: "รายการสินค้า", parent: null, index: 0, url: "https://x/a.png" },
  { path: "b.png", name: "ตะกร้า", parent: null, index: 1, url: "https://x/b.png" },
];

function paper(showShots: boolean): string {
  const doc = { ...newDoc(shots, "Pace", "2026-10-12"), showShots };
  return renderToStaticMarkup(createElement(QuotationPrint, { doc, shots }));
}

describe("the quotation's screenshot appendix", () => {
  it("is left off when the switch is off, and the priced rows stay", () => {
    const html = paper(false);
    expect(html).not.toContain("ภาคผนวก");
    expect(html).not.toContain("https://x/a.png");
    expect(html).toContain("ตะกร้า");
  });

  it("prints when the switch is on", () => {
    const html = paper(true);
    expect(html).toContain("ภาคผนวก");
    expect(html).toContain("https://x/b.png");
  });

  it("stays on for a quotation saved before the switch existed", () => {
    const saved = JSON.parse(JSON.stringify(newDoc(shots, "Pace", "2026-10-12")));
    delete saved.showShots;
    expect(parseDoc(saved, "2026-10-12")!.showShots).toBe(true);
    expect(parseDoc({ ...saved, showShots: false }, "2026-10-12")!.showShots).toBe(false);
  });
});

/**
 * Case #23: a line that is not labour prints what it is made of — quantity,
 * unit and unit price — not a size and a day count it never had.
 */
describe("a row priced by the unit on the paper", () => {
  it("prints quantity × unit price and its own total", () => {
    const doc = newDoc([], "Mabuchi", "2026-10-13");
    doc.rows = [
      { ...emptyRow(), name: "ค่าบริการรายปี", pricing: "unit", qty: 12, unit: "เดือน", unitPrice: 12_500 },
    ];
    const html = renderToStaticMarkup(createElement(QuotationPrint, { doc, shots: [] }));
    expect(html).toContain("12 เดือน × 12,500");
    expect(html).toContain("150,000");
    expect(html).not.toContain(" วัน × ");
  });
});

/**
 * Case #25: the sender wants the customer to see each line's price, not the
 * arithmetic behind it — "ใหญ่ · 4.5 วัน × 100,000" tells the customer the day
 * rate, and "1 × 450,000" says nothing. Off, the paper prints the line total
 * alone; the arithmetic stays in the panel.
 */
describe("what each line's price is made of, on the paper", () => {
  const rows = [
    { ...emptyRow(), name: "ค่าพัฒนาระบบ", size: "L" as const, days: 4.5 },
    { ...emptyRow(), name: "ค่าบริการรายปี", pricing: "unit" as const, qty: 12, unit: "เดือน", unitPrice: 12_500 },
  ];
  const paper = (showBasis: boolean) => {
    const doc = { ...newDoc([], "Mabuchi", "2026-10-13"), ratePerDay: 100_000, rows, showBasis };
    return renderToStaticMarkup(createElement(QuotationPrint, { doc, shots: [] }));
  };

  it("is left off when the switch is off, and each line keeps its total", () => {
    const html = paper(false);
    expect(html).not.toContain("q-basis");
    expect(html).not.toContain("4.5 วัน");
    expect(html).toContain("450,000");
    expect(html).toContain("150,000");
  });

  it("prints when the switch is on", () => {
    const html = paper(true);
    expect(html).toContain("ใหญ่ · 4.5 วัน × 100,000");
    expect(html).toContain("12 เดือน × 12,500");
  });

  it("stays on for a quotation saved before the switch existed", () => {
    const saved = JSON.parse(JSON.stringify(newDoc([], "Mabuchi", "2026-10-13")));
    delete saved.showBasis;
    expect(parseDoc(saved, "2026-10-13")!.showBasis).toBe(true);
    expect(parseDoc({ ...saved, showBasis: false }, "2026-10-13")!.showBasis).toBe(false);
  });
});

describe("the printed MA table", () => {
  it("prints the billing cycle row only when one is chosen", () => {
    const base = newDoc([], "Pace", "2026-10-12");
    const render = (billingCycle: "monthly" | "yearly" | null) =>
      renderToStaticMarkup(
        createElement(QuotationPrint, { doc: { ...base, ma: { ...base.ma, enabled: true, billingCycle } }, shots: [] })
      );
    expect(render("yearly")).toContain("รอบการชำระ");
    expect(render("yearly")).toContain("รายปี");
    expect(render(null)).not.toContain("รอบการชำระ");
  });
});

/**
 * A line priced at 0 is scope given with the deal — a module included at no
 * charge — so the paper describes it and prints no figure, not a "0".
 */
describe("a row priced at 0 on the paper", () => {
  it("prints its name and detail but no amount and no price basis", () => {
    const doc = newDoc([], "Smart Product Library", "2026-10-15");
    doc.rows = [
      { ...emptyRow(), name: "Module: Product Library", pricing: "unit", qty: 1, unitPrice: 240_000 },
      { ...emptyRow(), name: "Module: Sale", note: "ระบบ Dashboard สำหรับฝ่ายขาย", pricing: "unit", qty: 1, unitPrice: 0 },
    ];
    const html = renderToStaticMarkup(createElement(QuotationPrint, { doc, shots: [] }));
    expect(html).toContain("Module: Sale");
    expect(html).toContain("ระบบ Dashboard สำหรับฝ่ายขาย");
    expect(html).not.toContain(`<td class="q-r">0</td>`);
    expect(html).not.toContain("1 × 0");
    expect(html).toContain("1 × 240,000");
  });
});

describe("the payment share on the paper (case #36)", () => {
  const render = (showPercent: boolean) =>
    renderToStaticMarkup(createElement(QuotationPrint, { doc: { ...newDoc(shots, "Pace", "2026-10-16"), showPercent }, shots }));

  it("prints the share column and its 100% while it is switched on", () => {
    const html = render(true);
    expect(html).toContain("สัดส่วน");
    expect(html).toContain("100%");
  });

  it("leaves the column out when it is switched off, the amounts kept", () => {
    const html = render(false);
    expect(html).not.toContain("สัดส่วน");
    expect(html).not.toContain("100%");
    expect(html).toContain("งวดการชำระเงิน / Payment Schedule");
  });
});
