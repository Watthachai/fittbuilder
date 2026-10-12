import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuotationPrint from "@/components/studio/QuotationPrint";
import { newDoc, parseDoc } from "@/lib/quote";
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
