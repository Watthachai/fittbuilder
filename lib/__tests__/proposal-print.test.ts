import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProposalPrint from "@/components/studio/ProposalPrint";
import { newProposal, parseProposal } from "@/lib/proposal";
import { emptyRow, newDoc } from "@/lib/quote";
import type { Shot } from "@/lib/shots";

/**
 * Case #19: a proposal with 53 captured screens and a manual written for 44 of
 * them. The only switch turned the whole walk off, manual and all, so the
 * person who wanted a short paper had to choose between 53 pictures and none
 * of the work they wrote. The pictures are their own switch now.
 */
const shots: Shot[] = [
  { path: "a.png", name: "รายการสินค้า", parent: null, index: 0, url: "https://x/a.png", from: null, via: null },
  { path: "b.png", name: "ตะกร้า", parent: null, index: 1, url: "https://x/b.png", from: "รายการสินค้า", via: "หยิบใส่ตะกร้า" },
];

function paper(showShots: boolean): string {
  const doc = {
    ...newProposal("Pace", "2026-10-12"),
    showShots,
    screenDocs: { รายการสินค้า: { does: "ดูสต๊อกทุกสาขา", how: "", result: "" } },
  };
  return renderToStaticMarkup(createElement(ProposalPrint, { doc, quote: null, shots }));
}

describe("the proposal's walk without its pictures", () => {
  it("prints every step and its manual but no screenshot", () => {
    const html = paper(false);
    expect(html).not.toContain("https://x/a.png");
    expect(html).not.toContain("https://x/b.png");
    expect(html).toContain("ดูสต๊อกทุกสาขา");
    expect(html).toContain("ขั้นตอนที่ 2");
  });

  it("still prints the screenshots when the switch is on", () => {
    const html = paper(true);
    expect(html).toContain("https://x/a.png");
    expect(html).toContain("https://x/b.png");
  });

  it("keeps the pictures for a document saved before the switch existed", () => {
    expect(parseProposal({ points: [] }, "2026-01-01")!.showShots).toBe(true);
    expect(parseProposal({ points: [], showShots: false }, "2026-01-01")!.showShots).toBe(false);
  });
});

/**
 * Case #26: the proposal names the quotation twice — "อ้างถึงใบเสนอราคา" in the
 * header and "ตามใบเสนอราคาเลขที่ … ที่แนบมา" under the price — and a sender
 * who hands the proposal over on its own has no quotation to point at.
 */
describe("the proposal's reference to the quotation", () => {
  const quote = { ...newDoc([], "Mabuchi", "2026-10-13"), quoteNo: "SQP-0001" };
  const paper = (showQuoteRef: boolean) =>
    renderToStaticMarkup(
      createElement(ProposalPrint, { doc: { ...newProposal("Mabuchi", "2026-10-13"), showQuoteRef }, quote, shots: [] })
    );

  it("is left off when the switch is off — header and price section both", () => {
    const html = paper(false);
    expect(html).not.toContain("SQP-0001");
    expect(html).not.toContain("อ้างถึงใบเสนอราคา");
    expect(html).not.toContain("ราคาและเงื่อนไขการชำระเงิน");
  });

  it("prints when the switch is on", () => {
    const html = paper(true);
    expect(html).toContain("อ้างถึงใบเสนอราคา :");
    expect(html).toContain("ตามใบเสนอราคาเลขที่ SQP-0001");
  });

  it("stays on for a proposal saved before the switch existed", () => {
    const saved = JSON.parse(JSON.stringify(newProposal("Mabuchi", "2026-10-13")));
    delete saved.showQuoteRef;
    expect(parseProposal(saved, "2026-10-13")!.showQuoteRef).toBe(true);
    expect(parseProposal({ ...saved, showQuoteRef: false }, "2026-10-13")!.showQuoteRef).toBe(false);
  });
});

/**
 * Also case #26: a quotation priced entirely by the unit (case #23) has no
 * man-days, and the schedule printed "0 วันทำการ" as the build time.
 */
describe("the schedule when the quotation counts no man-days", () => {
  it("leaves the build-time box out and keeps the review window", () => {
    const quote = newDoc([], "Mabuchi", "2026-10-13");
    quote.rows = [{ ...emptyRow(), name: "ค่าพัฒนาระบบ", pricing: "unit", qty: 1, unitPrice: 450_000 }];
    const html = renderToStaticMarkup(
      createElement(ProposalPrint, { doc: newProposal("Mabuchi", "2026-10-13"), quote, shots: [] })
    );
    expect(html).not.toContain("วันทำการ");
    expect(html).toContain("ตรวจรับหลังส่งมอบ");
  });
});

/**
 * The short edition: the argument and the scope by module on two or three
 * pages — no walk, no pictures, and, like the full one, no money.
 */
describe("the short proposal on paper", () => {
  const modules = [
    {
      id: "m1",
      name: "ระบบขายหน้าร้าน",
      parts: [{ id: "p1", name: "ตะกร้าสินค้า", points: ["รวมสินค้าที่เลือก", "ตรวจสต๊อกก่อนจ่าย"], screens: ["ตะกร้า"] }],
    },
  ];
  const doc = {
    ...newProposal("Pace", "2026-10-19"),
    short: true,
    modules,
    screenDocs: { รายการสินค้า: { does: "ดูสต๊อกทุกสาขา", how: "", result: "" } },
  };

  it("states the scope by module and leaves the walk and its pictures out", () => {
    const html = renderToStaticMarkup(createElement(ProposalPrint, { doc, quote: null, shots }));
    expect(html).toContain("ขอบเขตงาน");
    expect(html).toContain("ระบบขายหน้าร้าน");
    expect(html).toContain("ตะกร้าสินค้า");
    expect(html).toContain("ตรวจสต๊อกก่อนจ่าย");
    expect(html).not.toContain("ขั้นตอนที่ 1");
    expect(html).not.toContain("https://x/a.png");
  });

  it("prints no price even beside a priced quotation", () => {
    const quote = { ...newDoc([], "Pace", "2026-10-19"), rows: [{ ...emptyRow(), name: "ตะกร้า", days: 5 }] };
    const html = renderToStaticMarkup(createElement(ProposalPrint, { doc, quote, shots }));
    expect(html).not.toContain("40,000");
    expect(html).not.toContain("฿");
  });

  it("opens a proposal saved before the short edition existed in full", () => {
    expect(parseProposal({ points: [] }, "2026-01-01")!.short).toBe(false);
    expect(parseProposal({ points: [], short: true }, "2026-01-01")!.short).toBe(true);
  });
});
