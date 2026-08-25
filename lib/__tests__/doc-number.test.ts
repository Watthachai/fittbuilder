import { describe, expect, it } from "vitest";
import { docFileName, DOC_PREFIX, formatDocNo } from "@/lib/doc-number";

describe("formatDocNo", () => {
  it("builds the number the customer quotes back: prefix + code + running", () => {
    expect(formatDocNo("quotation", "12605", 2)).toBe("SQP12605-0002");
    expect(formatDocNo("proposal", "12605", 2)).toBe("PRP12605-0002");
  });

  it("zero-pads the running part to four digits", () => {
    expect(formatDocNo("quotation", "12605", 1)).toBe("SQP12605-0001");
    expect(formatDocNo("quotation", "12605", 42)).toBe("SQP12605-0042");
  });

  it("keeps growing past four digits rather than truncating", () => {
    expect(formatDocNo("quotation", "12605", 12345)).toBe("SQP12605-12345");
  });

  it("works with no workspace code — the running number still carries", () => {
    expect(formatDocNo("quotation", "", 3)).toBe("SQP-0003");
    expect(formatDocNo("quotation", "  ", 3)).toBe("SQP-0003");
  });

  it("uses distinct prefixes so a quotation and a proposal never share a number", () => {
    expect(DOC_PREFIX.quotation).not.toBe(DOC_PREFIX.proposal);
  });
});

describe("docFileName", () => {
  it("names the file number-first, customer-after", () => {
    expect(docFileName("SQP12605-0002", "บริษัท พิธานไลฟ์ จำกัด")).toBe(
      "SQP12605-0002-บริษัท พิธานไลฟ์ จำกัด"
    );
  });

  it("keeps Thai and spaces, strips only characters that break a filename", () => {
    expect(docFileName("SQP12605-0002", 'A/B:C*D?"<>|E')).toBe("SQP12605-0002-ABCDE");
  });

  it("falls back to the number alone when there is no customer", () => {
    expect(docFileName("SQP12605-0002", "")).toBe("SQP12605-0002");
    expect(docFileName("SQP12605-0002", "   ")).toBe("SQP12605-0002");
  });
});
