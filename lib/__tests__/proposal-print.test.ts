import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProposalPrint from "@/components/studio/ProposalPrint";
import { newProposal, parseProposal } from "@/lib/proposal";
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
