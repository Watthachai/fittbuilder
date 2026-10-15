import { describe, expect, it } from "vitest";
import { quotationDocx } from "@/lib/quotation-word";
import { emptyRow, newDoc, type QuoteDoc } from "@/lib/quote";
import { PIXEL, readWord } from "./fixtures/word";

/**
 * Case #27: the quotation as a Word file someone can keep editing — the same
 * paper the print path produces, read off the same document.
 */
function quote(over: Partial<QuoteDoc> = {}): QuoteDoc {
  const doc = newDoc([], "Mabuchi WMS", "2026-10-14");
  return {
    ...doc,
    quoteNo: "SQP12605-0007",
    customerName: "บริษัท มาบูชิ จำกัด",
    customerAddress: "88 ถนนบางนา\nบางนา กรุงเทพฯ 10260",
    brand: { ...doc.brand, name: "บริษัท ฟิตต์ จำกัด" },
    rows: [
      { ...emptyRow(), name: "รับสินค้าเข้าคลัง", days: 4, note: "สแกนบาร์โค้ด\nพิมพ์ใบรับ" },
      { ...emptyRow(), name: "ค่าบริการรายปี", pricing: "unit", qty: 12, unit: "เดือน", unitPrice: 12_500 },
    ],
    ...over,
  };
}

const NO_ART = { logo: null, shots: new Map() };

describe("the quotation as a Word file", () => {
  it("carries the letterhead on every page and the priced rows in the body", async () => {
    const { header, body } = await readWord(quotationDocx(quote(), [], NO_ART));
    expect(header).toContain("ใบเสนอราคา");
    expect(header).toContain("SQP12605-0007");
    expect(header).toContain("บริษัท มาบูชิ จำกัด");
    expect(header).toContain("88 ถนนบางนา\nบางนา กรุงเทพฯ 10260");
    expect(header).toContain("บริษัท ฟิตต์ จำกัด");
    expect(body).toContain("รับสินค้าเข้าคลัง");
    expect(body).toContain("สแกนบาร์โค้ด\nพิมพ์ใบรับ");
    expect(body).toContain("12 เดือน × 12,500");
    expect(body).toContain("150,000");
  });
});

describe("the quotation's switches in the Word file", () => {
  it("leaves the price basis out when it is switched off", async () => {
    const on = await readWord(quotationDocx(quote(), [], NO_ART));
    const off = await readWord(quotationDocx(quote({ showBasis: false }), [], NO_ART));
    expect(on.body).toContain("12 เดือน × 12,500");
    expect(off.body).not.toContain("12 เดือน × 12,500");
    expect(off.body).toContain("150,000");
  });

  it("quotes a lump sum as one line whose scope is the rows, with no per-row price", async () => {
    const doc = quote({ lumpSum: { enabled: true, title: "ระบบคลังสินค้า", amount: 300_000 } });
    const { body } = await readWord(quotationDocx(doc, [], NO_ART));
    expect(body).toContain("ระบบคลังสินค้า");
    expect(body).toContain("รับสินค้าเข้าคลัง");
    expect(body).not.toContain("12 เดือน × 12,500");
  });

  it("splits each instalment into before-VAT, VAT and total", async () => {
    const { body } = await readWord(quotationDocx(quote(), [], NO_ART));
    expect(body).toContain("งวดการชำระเงิน / Payment Schedule");
    expect(body).toContain("VAT 7%");
    expect(body).toContain("ราคาสุทธิ / Net");
  });

  it("packs the screenshot appendix only when the switch is on", async () => {
    const shots = [{ path: "a.png", name: "รับสินค้า", parent: null, index: 0, url: "https://x/a.png" }];
    const art = { logo: null, shots: new Map([["https://x/a.png", { data: PIXEL, type: "png" as const, width: 4, height: 3 }]]) };
    const on = await readWord(quotationDocx(quote(), shots, art));
    const off = await readWord(quotationDocx(quote({ showShots: false }), shots, art));
    expect(on.body).toContain("ภาคผนวก — หน้าจอที่เสนอราคา (1)");
    expect(on.pictures.body).toBe(1);
    expect(off.body).not.toContain("ภาคผนวก");
    expect(off.pictures.body).toBe(0);
  });

  it("puts the logo in the letterhead", async () => {
    const art = { logo: { data: PIXEL, type: "png" as const, width: 400, height: 100 }, shots: new Map() };
    const { pictures } = await readWord(quotationDocx(quote(), [], art));
    expect(pictures.header).toBe(1);
  });
});

describe("a row priced at 0 in the Word file", () => {
  it("describes the line but prints no amount and no price basis", async () => {
    const doc = quote({
      rows: [
        { ...emptyRow(), name: "Module: Product Library", pricing: "unit", qty: 1, unitPrice: 240_000 },
        { ...emptyRow(), name: "Module: Sale", note: "ระบบ Dashboard สำหรับฝ่ายขาย", pricing: "unit", qty: 1, unitPrice: 0 },
      ],
    });
    const { body } = await readWord(quotationDocx(doc, [], NO_ART));
    expect(body).toContain("Module: Sale");
    expect(body).toContain("ระบบ Dashboard สำหรับฝ่ายขาย");
    expect(body).toContain("1 × 240,000");
    expect(body).not.toContain("1 × 0");
    expect(body.split("\n")).not.toContain("0");
  });
});

describe("the Word MA table", () => {
  it("carries the billing cycle when one is chosen", async () => {
    const doc = quote();
    const withCycle = await readWord(
      quotationDocx({ ...doc, ma: { ...doc.ma, enabled: true, billingCycle: "monthly" } }, [], NO_ART)
    );
    expect(withCycle.body).toContain("รอบการชำระ");
    expect(withCycle.body).toContain("รายเดือน");
    const without = await readWord(quotationDocx({ ...doc, ma: { ...doc.ma, enabled: true, billingCycle: null } }, [], NO_ART));
    expect(without.body).not.toContain("รอบการชำระ");
  });
});
