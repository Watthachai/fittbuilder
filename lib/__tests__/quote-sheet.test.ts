import { describe, expect, it } from "vitest";
import { bahtText } from "../baht-text";
import { newDoc, parseDoc, type QuoteDoc, type QuoteRow } from "../quote";
import { rowsFromModules } from "../quote-modules";
import { quoteSheet } from "../quote-sheet";
import type { ProposalModule } from "../proposal-modules";

const row = (over: Partial<QuoteRow>): QuoteRow => ({
  id: over.name ?? "r",
  name: "",
  pricing: "days",
  size: "M",
  days: 2,
  qty: 1,
  unit: "",
  unitPrice: 0,
  note: "",
  sub: false,
  parent: "",
  ...over,
});

const doc = (rows: QuoteRow[], over: Partial<QuoteDoc> = {}): QuoteDoc => ({
  ...newDoc([], "Seishin", "2026-10-19"),
  ratePerDay: 8_000,
  rows,
  ...over,
});

const PLANNING: ProposalModule = {
  id: "m1",
  name: "ระบบวางแผนการผลิต",
  parts: [{ id: "p1", name: "วางแผนความต้องการวัสดุ", points: ["กางสูตรหักสต็อก", "เสนอซื้อ"], screens: ["หน้า MRP", "หน้าแผนผลิต"] }],
};
const BUYING: ProposalModule = {
  id: "m2",
  name: "ระบบจัดซื้อ",
  parts: [{ id: "p2", name: "ใบขอซื้อ", points: ["อนุมัติหลายใบ"], screens: ["หน้าใบขอซื้อ"] }],
};

describe("quoteSheet without modules", () => {
  const d = doc([
    row({ name: "หน้า MRP", days: 5 }),
    row({ name: "ยืนยันรัน MRP", days: 1, sub: true, parent: "หน้า MRP" }),
    row({ name: "หน้าใบขอซื้อ", days: 2.5 }),
  ]);
  const sheet = quoteSheet(d, []);

  it("is one section named after the subject, closing on its subtotal", () => {
    expect(sheet.sections).toHaveLength(1);
    expect(sheet.sections[0]).toMatchObject({ no: "1", name: "พัฒนาระบบ Seishin", subtotal: 68_000 });
    expect(sheet.total).toBe(68_000);
  });

  it("numbers screens 1.1, 1.2 and prints a modal unnumbered under its screen", () => {
    expect(sheet.sections[0].lines.map((l) => [l.no, l.name, l.sub])).toEqual([
      ["1.1", "หน้า MRP", false],
      ["", "ยืนยันรัน MRP", true],
      ["1.2", "หน้าใบขอซื้อ", false],
    ]);
  });

  it("prices a man-day line as days × the rate", () => {
    expect(sheet.sections[0].lines[0]).toMatchObject({ qty: 5, unit: "Man-day", unitPrice: 8_000, amount: 40_000 });
  });

  it("totals the cover as one job per section", () => {
    expect(sheet.cover).toEqual([
      { no: "1", name: "พัฒนาระบบ Seishin", note: "", qty: 1, unit: "งาน", unitPrice: 68_000, amount: 68_000, sub: false },
    ]);
  });
});

describe("quoteSheet with modules", () => {
  const d = doc([
    row({ name: "หน้าใบขอซื้อ", days: 2 }),
    row({ name: "หน้า MRP", days: 5 }),
    row({ name: "ยืนยันรัน MRP", days: 1, sub: true, parent: "หน้า MRP" }),
    row({ name: "ค่าเซิร์ฟเวอร์รายปี", pricing: "unit", qty: 12, unit: "เดือน", unitPrice: 2_500 }),
  ]);
  const sheet = quoteSheet(d, [PLANNING, BUYING]);

  it("puts each line under the module that covers its screen, in module order", () => {
    expect(sheet.sections.map((s) => [s.no, s.name, s.lines.map((l) => l.name)])).toEqual([
      ["1", "ระบบวางแผนการผลิต", ["หน้า MRP", "ยืนยันรัน MRP"]],
      ["2", "ระบบจัดซื้อ", ["หน้าใบขอซื้อ"]],
      ["3", "รายการอื่น ๆ", ["ค่าเซิร์ฟเวอร์รายปี"]],
    ]);
  });

  it("prints a unit-priced line as its own quantity, unit and price", () => {
    expect(sheet.sections[2].lines[0]).toMatchObject({ no: "3.1", qty: 12, unit: "เดือน", unitPrice: 2_500, amount: 30_000 });
  });

  it("subtotals each module, and the cover adds up to the quotation's subtotal", () => {
    expect(sheet.sections.map((s) => s.subtotal)).toEqual([48_000, 16_000, 30_000]);
    expect(sheet.cover.reduce((s, l) => s + (l.amount ?? 0), 0)).toBe(sheet.total);
    expect(sheet.total).toBe(94_000);
  });
});

describe("quoteSheet after the module cut", () => {
  const before = doc([row({ name: "หน้า MRP", days: 5 }), row({ name: "หน้าใบขอซื้อ", days: 2 })]);
  const cut = { ...before, rows: rowsFromModules(before, [PLANNING, BUYING]).rows };
  const sheet = quoteSheet(cut, [PLANNING, BUYING]);

  it("lists a module's parts beneath it, unpriced, with its points as the note", () => {
    expect(sheet.sections[0].lines).toEqual([
      { no: "1.1", name: "วางแผนความต้องการวัสดุ", note: "- กางสูตรหักสต็อก\n- เสนอซื้อ", qty: null, unit: "", unitPrice: null, amount: null, sub: false },
    ]);
  });

  it("carries the module's price on the subtotal", () => {
    expect(sheet.sections.map((s) => s.subtotal)).toEqual([40_000, 16_000]);
  });
});

describe("quoteSheet pricing rules", () => {
  it("keeps the day rate off the paper when the basis is hidden", () => {
    const sheet = quoteSheet(doc([row({ name: "หน้า MRP", days: 5 })], { showBasis: false }), []);
    expect(sheet.sections[0].lines[0]).toMatchObject({ qty: 1, unit: "งาน", unitPrice: 40_000, amount: 40_000 });
  });

  it("prints no line prices for a lump sum, only its one figure", () => {
    const lump = doc([row({ name: "หน้า MRP", days: 5 })], { lumpSum: { enabled: true, amount: 300_000, title: "ระบบผลิต" } });
    const sheet = quoteSheet(lump, []);
    expect(sheet.sections[0]).toMatchObject({ name: "ระบบผลิต", subtotal: null });
    expect(sheet.sections[0].lines[0]).toMatchObject({ qty: 5, amount: null, unitPrice: null });
    expect(sheet.cover[0].amount).toBeNull();
    expect(sheet.total).toBe(300_000);
  });

  it("prints a line given with the deal without a price", () => {
    const sheet = quoteSheet(doc([row({ name: "หน้าตั้งค่า", days: 0 })]), []);
    expect(sheet.sections[0].lines[0]).toMatchObject({ qty: 0, amount: null, unitPrice: null });
  });

  it("is empty for a quotation with no lines", () => {
    expect(quoteSheet(doc([]), [])).toEqual({ sections: [], cover: [], total: 0 });
  });
});

describe("layout", () => {
  it("opens a quotation saved before layouts existed as the list it always printed", () => {
    const stored = JSON.parse(JSON.stringify(doc([row({ name: "หน้า MRP" })])));
    delete stored.layout;
    expect(parseDoc(stored, "2026-10-19")?.layout).toBe("list");
  });

  it("keeps the cover layout once chosen", () => {
    expect(parseDoc({ ...doc([]), layout: "cover" }, "2026-10-19")?.layout).toBe("cover");
  });
});

describe("bahtText", () => {
  it.each([
    [0, "ศูนย์บาทถ้วน"],
    [21, "ยี่สิบเอ็ดบาทถ้วน"],
    [101, "หนึ่งร้อยเอ็ดบาทถ้วน"],
    [5_885_000, "ห้าล้านแปดแสนแปดหมื่นห้าพันบาทถ้วน"],
    [1_000_001, "หนึ่งล้านเอ็ดบาทถ้วน"],
    [12_345.5, "หนึ่งหมื่นสองพันสามร้อยสี่สิบห้าบาทห้าสิบสตางค์"],
    [0.25, "ยี่สิบห้าสตางค์"],
  ])("%s → %s", (amount, words) => {
    expect(bahtText(amount)).toBe(words);
  });
});
