import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATE,
  emptyRow,
  formatTHB,
  lineTotal,
  missingRows,
  newDoc,
  parseDoc,
  quoteTotals,
  rowsFromShots,
  SIZE_DAYS,
  thaiDate,
  validUntil,
  type QuoteDoc,
} from "../quote";
import type { Shot } from "../shots";

const shot = (over: Partial<Shot> & { name: string; index: number }): Shot => ({
  path: `p/${over.index}.png`,
  parent: null,
  url: "",
  ...over,
});

const INVENTORY: Shot[] = [
  shot({ index: 0, name: "เข้าสู่ระบบ" }),
  shot({ index: 1, name: "เอกสารทั้งหมด" }),
  shot({ index: 2, name: "สร้าง Report", parent: "เอกสารทั้งหมด" }),
];

describe("rowsFromShots", () => {
  it("prices every modal as its own line, marked under its screen", () => {
    const rows = rowsFromShots(INVENTORY);
    expect(rows).toHaveLength(3);
    // The bare name plus a parent column — not a "A — B" breadcrumb glued into
    // the name, which the table cannot group on and the paper cannot indent.
    expect(rows[2]).toMatchObject({
      name: "สร้าง Report",
      parent: "เอกสารทั้งหมด",
      sub: true,
      size: "S",
      days: SIZE_DAYS.S,
    });
  });

  it("defaults a screen to medium and a modal to small", () => {
    const rows = rowsFromShots(INVENTORY);
    expect(rows[1]).toMatchObject({ size: "M", days: SIZE_DAYS.M, sub: false });
  });

  it("keeps the walk order, whatever order storage returned", () => {
    const shuffled = [INVENTORY[2], INVENTORY[0], INVENTORY[1]];
    expect(rowsFromShots(shuffled).map((r) => r.name)).toEqual([
      "เข้าสู่ระบบ",
      "เอกสารทั้งหมด",
      "สร้าง Report",
    ]);
  });

  it("gives every row a distinct id", () => {
    const ids = rowsFromShots(INVENTORY).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("missingRows", () => {
  // Re-capturing must never wipe hand-edited prices, so syncing is additive.
  it("finds only what the quotation does not price yet", () => {
    const doc = newDoc([INVENTORY[0]], "d", "2026-08-05");
    expect(missingRows(doc, INVENTORY).map((r) => r.name)).toEqual([
      "เอกสารทั้งหมด",
      "สร้าง Report",
    ]);
  });

  it("is empty when everything is already priced", () => {
    expect(missingRows(newDoc(INVENTORY, "d", "2026-08-05"), INVENTORY)).toEqual([]);
  });

  /**
   * A modal's name is only unique under its screen: two screens can each own a
   * "ยืนยันการลบ". Matching on the name alone dropped the second one, and the
   * quotation quietly billed for one of the two.
   */
  it("tells apart two modals that share a name under different screens", () => {
    const both: Shot[] = [
      shot({ index: 0, name: "ผู้ใช้งาน" }),
      shot({ index: 1, name: "ยืนยันการลบ", parent: "ผู้ใช้งาน" }),
      shot({ index: 2, name: "เอกสาร" }),
      shot({ index: 3, name: "ยืนยันการลบ", parent: "เอกสาร" }),
    ];
    const doc = newDoc(both.slice(0, 2), "d", "2026-08-05");
    expect(missingRows(doc, both).map((r) => `${r.parent}/${r.name}`)).toEqual([
      "/เอกสาร",
      "เอกสาร/ยืนยันการลบ",
    ]);
  });
});

describe("quoteTotals", () => {
  const base = (over: Partial<QuoteDoc> = {}): QuoteDoc => ({
    ...newDoc(INVENTORY, "d", "2026-08-05"),
    ...over,
  });

  it("adds days, bills them at the rate, and applies VAT", () => {
    // 2.5 + 2.5 + 1 = 6 days × 8,000 = 48,000; VAT 7% = 3,360
    const t = quoteTotals(base());
    expect(t.days).toBe(6);
    expect(t.subtotal).toBe(48_000);
    expect(t.vat).toBe(3_360);
    expect(t.grand).toBe(51_360);
  });

  it("takes the discount off before VAT — the order tax is actually charged in", () => {
    const t = quoteTotals(base({ discountPercent: 10 }));
    expect(t.discount).toBe(4_800);
    expect(t.net).toBe(43_200);
    expect(t.vat).toBe(3_024);
    expect(t.grand).toBe(46_224);
  });

  it("drops the VAT line entirely at 0%", () => {
    const t = quoteTotals(base({ vatPercent: 0 }));
    expect(t.vat).toBe(0);
    expect(t.grand).toBe(t.subtotal);
  });

  // A row someone half-typed must not turn the whole total into NaN.
  it("treats an unparseable day count as zero", () => {
    const doc = base({ rows: [{ ...emptyRow(0), name: "x", days: NaN }] });
    expect(quoteTotals(doc).grand).toBe(0);
  });

  it("ignores a nonsense percentage instead of inventing money", () => {
    expect(quoteTotals(base({ vatPercent: NaN })).vat).toBe(0);
    expect(quoteTotals(base({ discountPercent: 900 })).discount).toBe(48_000);
  });

  /**
   * The printed lines must add up to the printed total. Rounding each line the
   * way it is shown, then summing, is what guarantees that — summing at full
   * precision and rounding once at the end can land a satang off, and a
   * customer checking the column by hand is right to ask why.
   */
  it("sums the rounded lines, so the column adds up on paper", () => {
    const doc = base({
      ratePerDay: 3_333.33,
      rows: [0.33, 0.33, 0.34].map((days, i) => ({ ...emptyRow(i), name: `r${i}`, days })),
    });
    const t = quoteTotals(doc);
    const printed = doc.rows.reduce(
      (sum, r) => sum + Math.round(lineTotal(r, doc.ratePerDay) * 100) / 100,
      0
    );
    expect(t.subtotal).toBe(Math.round(printed * 100) / 100);
  });
});

describe("formatting", () => {
  it("shows satang only when there are any", () => {
    expect(formatTHB(48_000)).toBe("48,000");
    expect(formatTHB(1_234.5)).toBe("1,234.50");
  });

  it("dates in Thai with the Buddhist year", () => {
    expect(thaiDate("2026-08-05")).toBe("5 สิงหาคม 2569");
  });

  it("leaves an unparseable date alone rather than printing NaN", () => {
    expect(thaiDate("")).toBe("");
  });

  it("counts the validity window forward from the issue date", () => {
    const doc = newDoc([], "d", "2026-08-05");
    expect(validUntil({ ...doc, validDays: 30 })).toBe("2026-09-04");
  });
});

describe("newDoc", () => {
  it("starts from the inventory with the agreed defaults", () => {
    const doc = newDoc(INVENTORY, "Pace", "2026-08-05");
    expect(doc.rows).toHaveLength(3);
    expect(doc.ratePerDay).toBe(DEFAULT_RATE);
    expect(doc.vatPercent).toBe(7);
    expect(doc.quoteNo).toBe("Q-20260805");
  });
});

describe("parseDoc", () => {
  const round = (d: unknown) => parseDoc(d, "2026-08-05");

  it("round-trips a document it wrote", () => {
    const doc = newDoc(INVENTORY, "Pace", "2026-08-05");
    expect(round(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  // jsonb is untrusted input: the row shape already changed once while this
  // feature was being built, and a doc saved then must not crash the panel.
  it("fills in fields an older document never had", () => {
    const doc = round({ rows: [{ name: "หน้าแรก" }] })!;
    expect(doc.rows[0]).toMatchObject({ name: "หน้าแรก", size: "M", days: SIZE_DAYS.M, sub: false });
    expect(doc.ratePerDay).toBe(DEFAULT_RATE);
    expect(doc.vatPercent).toBe(7);
    expect(doc.issuedAt).toBe("2026-08-05");
  });

  it("keeps a stored size and its edited day count", () => {
    const doc = round({ rows: [{ name: "x", size: "L", days: 8 }] })!;
    expect(doc.rows[0]).toMatchObject({ size: "L", days: 8 });
  });

  it("refuses anything that is not a document, so the caller seeds a fresh one", () => {
    expect(round(null)).toBeNull();
    expect(round([])).toBeNull();
    expect(round("{}")).toBeNull();
    expect(round({ vendor: "a" })).toBeNull(); // no rows array
  });

  /**
   * A corrupt day count falls back to the size's default, not to zero: a
   * quotation that silently drops a line to ฿0 is worse than one that shows a
   * default someone can correct.
   */
  it("replaces an unusable number with its default, never NaN and never zero", () => {
    const doc = round({ rows: [{ name: "x", days: "สอง" }], ratePerDay: null })!;
    expect(doc.rows[0].days).toBe(SIZE_DAYS.M);
    expect(doc.ratePerDay).toBe(DEFAULT_RATE);
    expect(quoteTotals(doc).grand).toBe(SIZE_DAYS.M * DEFAULT_RATE * 1.07);
  });
});
