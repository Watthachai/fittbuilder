import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuotationPrint from "@/components/studio/QuotationPrint";
import ProposalPrint from "@/components/studio/ProposalPrint";
import { newProposal } from "@/lib/proposal";
import { newDoc } from "@/lib/quote";

/**
 * Case #46: the preview is one long sheet, and where A4 pages break only the
 * print engine knows. A draft goes through the print dialog to show them — so
 * the "ตัวอย่าง" mark must be part of the paper (printing shows nothing else)
 * and must survive printing on every page.
 */
describe("the draft mark", () => {
  const quote = newDoc([], "SiamPools", "2026-11-04");
  const proposal = newProposal("SiamPools", "2026-11-04");
  const html = (draft: boolean) =>
    renderToStaticMarkup(createElement(QuotationPrint, { doc: quote, shots: [], modules: [], draft }));

  it("is drawn by the paper of a draft", () => {
    expect(html(true)).toContain("fitt-draft-mark");
  });

  it("is absent from an approved paper", () => {
    expect(html(false)).not.toContain("fitt-draft-mark");
  });

  // Case #50: only the quotation is approved. A proposal is never a draft awaiting it.
  it("is never on a proposal's paper", () => {
    expect(renderToStaticMarkup(createElement(ProposalPrint, { doc: proposal, quote, shots: [] }))).not.toContain(
      "fitt-draft-mark"
    );
  });

  const css = readFileSync("app/globals.css", "utf8");
  const printBlock = css.slice(css.indexOf("@media print {"));

  it("prints even with the dialog's background graphics off", () => {
    const rule = css.slice(css.indexOf(".fitt-paper .fitt-draft-mark {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("print-color-adjust: exact");
  });

  it("repeats on every printed page", () => {
    const rule = printBlock.slice(printBlock.indexOf(".fitt-paper .fitt-draft-mark {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("position: fixed");
  });
});
