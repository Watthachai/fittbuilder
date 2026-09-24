import { describe, expect, it } from "vitest";
import { bahtText, toCsv, totalsOf } from "../../demo/modules/kit";

/**
 * The figures on a printed tax invoice. An accountant moving off another
 * program checks these before anything else, so they are held to known answers
 * rather than to the code that produces them.
 */

describe("bahtText", () => {
  it.each([
    [0, "ศูนย์บาทถ้วน"],
    [1, "หนึ่งบาทถ้วน"],
    [10, "สิบบาทถ้วน"],
    [11, "สิบเอ็ดบาทถ้วน"],
    [20, "ยี่สิบบาทถ้วน"],
    [21, "ยี่สิบเอ็ดบาทถ้วน"],
    [100, "หนึ่งร้อยบาทถ้วน"],
    [101, "หนึ่งร้อยเอ็ดบาทถ้วน"],
    [469_334, "สี่แสนหกหมื่นเก้าพันสามร้อยสามสิบสี่บาทถ้วน"],
    [1_000_001, "หนึ่งล้านเอ็ดบาทถ้วน"],
    [21_000_000, "ยี่สิบเอ็ดล้านบาทถ้วน"],
    [12_345.5, "หนึ่งหมื่นสองพันสามร้อยสี่สิบห้าบาทห้าสิบสตางค์"],
    [0.25, "ยี่สิบห้าสตางค์"],
    [1_250_000.01, "หนึ่งล้านสองแสนห้าหมื่นบาทหนึ่งสตางค์"],
  ])("%s → %s", (amount, words) => {
    expect(bahtText(amount)).toBe(words);
  });
});

describe("totalsOf", () => {
  it("rounds VAT to the satang the way the invoice states it", () => {
    // 3 × 1,234.57 = 3,703.71; 7% = 259.2597 → 259.26
    expect(totalsOf([{ qty: 3, price: 1234.57 }])).toEqual({ subtotal: 3703.71, vat: 259.26, total: 3962.97 });
  });

  it("takes a different rate, and zero lines as zero", () => {
    expect(totalsOf([{ qty: 2, price: 100 }], 0)).toEqual({ subtotal: 200, vat: 0, total: 200 });
    expect(totalsOf([])).toEqual({ subtotal: 0, vat: 0, total: 0 });
  });
});

describe("toCsv", () => {
  it("opens as Thai in Excel and survives commas and quotes in a cell", () => {
    const csv = toCsv(["เลขที่", "ลูกค้า"], [["SO-2569-0412", 'หจก. "พาณิชย์", ภัณฑ์']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿เลขที่,ลูกค้า\r\nSO-2569-0412,"หจก. ""พาณิชย์"", ภัณฑ์"');
  });
});
