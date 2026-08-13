import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCENT,
  DEFAULT_RATE,
  defaultMaintenance,
  emptyRow,
  formatTHB,
  lineTotal,
  MA_DEFAULT_ANNUAL,
  MA_INCLUDED_MONTHS,
  MA_MIN_MONTHLY,
  maintenanceTotals,
  marketComparison,
  missingRows,
  newDoc,
  parseDoc,
  paymentSchedule,
  PAY_NET_DAYS,
  presetEqual,
  presetSigning,
  presetUat,
  quoteTotals,
  REVIEW_DAYS,
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

  /**
   * Every quotation stored before the payment/MA/brand blocks existed has none
   * of them. Those documents are somebody's priced work — losing one to a schema
   * change is worse than any default we could show instead, so they open, they
   * keep their prices, and the new blocks arrive usable.
   */
  it("opens a document written before payment, MA and brand existed", () => {
    const old = round({
      rows: [{ name: "หน้าแรก", size: "L", days: 5 }],
      ratePerDay: 9_000,
      vatPercent: 7,
    })!;
    expect(old.rows[0]).toMatchObject({ size: "L", days: 5 });
    expect(old.ratePerDay).toBe(9_000);
    // The new blocks land on working defaults, not on zeroes.
    expect(old.payment.map((t) => t.percent)).toEqual([60, 40]);
    expect(paymentSchedule(old).balanced).toBe(true);
    expect(old.acceptance).toMatchObject({ enabled: true, reviewDays: REVIEW_DAYS });
    expect(old.ma.annualFromYear2).toBe(MA_DEFAULT_ANNUAL);
    expect(old.brand.logoUrl).toBe("");
    expect(old.brand.accent).toBe(DEFAULT_ACCENT);
  });

  /**
   * Both parties used to be one free-text blob each. Neither may be dropped by
   * the split into labelled fields: a quotation that silently forgot who it was
   * addressed to would be sent that way, because the sender never typed the name
   * in the first place — the AI or an earlier version did.
   */
  it("carries the old free-text parties into the labelled fields", () => {
    const old = round({
      rows: [],
      customer: "บริษัท ลูกค้าเก่า จำกัด",
      vendor: "บริษัท ผู้ขายเก่า จำกัด\n99 ถนนสาทร กรุงเทพฯ\nโทร 02-000-0000",
    })!;
    expect(old.customerName).toBe("บริษัท ลูกค้าเก่า จำกัด");
    expect(old.brand.name).toBe("บริษัท ผู้ขายเก่า จำกัด");
    expect(old.brand.address).toBe("99 ถนนสาทร กรุงเทพฯ\nโทร 02-000-0000");
  });

  it("lets a real letterhead win over the legacy blob", () => {
    const doc = round({
      rows: [],
      vendor: "ของเก่า",
      brand: { name: "ของใหม่", address: "ที่อยู่ใหม่" },
    })!;
    expect(doc.brand.name).toBe("ของใหม่");
    expect(doc.brand.address).toBe("ที่อยู่ใหม่");
  });

  // The accent is written into an inline style on the printed page.
  it("refuses an accent that is not a plain hex colour", () => {
    expect(round({ rows: [], brand: { accent: "red; content:'x'" } })!.brand.accent).toBe(
      DEFAULT_ACCENT
    );
    expect(round({ rows: [], brand: { accent: "#F7941D" } })!.brand.accent).toBe("#F7941D");
  });

  it("keeps a deleted schedule deleted instead of re-seeding it", () => {
    expect(round({ rows: [], payment: [] })!.payment).toEqual([]);
  });

  it("repairs an instalment row that lost its fields", () => {
    const doc = round({ rows: [], payment: [{ percent: 100 }, {}] })!;
    expect(doc.payment[0]).toMatchObject({ percent: 100, netDays: PAY_NET_DAYS });
    expect(doc.payment[1].percent).toBe(0);
    // Ids must stay distinct — React keys the editor rows on them.
    expect(new Set(doc.payment.map((t) => t.id)).size).toBe(2);
  });

  /**
   * A brand block that predates the partner flag must not print as white-label:
   * the mark comes off only when someone is actually a partner.
   */
  it("keeps our mark on a letterhead that never heard of partners", () => {
    expect(round({ rows: [], brand: { name: "บริษัท ก" } })!.brand.poweredBy).toBe(true);
    expect(round({ rows: [], brand: { poweredBy: false } })!.brand.poweredBy).toBe(false);
  });
});

describe("paymentSchedule", () => {
  // 6 days × 8,000 = 48,000 + 7% VAT = 51,360 grand.
  const base = (over: Partial<QuoteDoc> = {}): QuoteDoc => ({
    ...newDoc(INVENTORY, "d", "2026-08-05"),
    ...over,
  });
  const sum = (doc: QuoteDoc) =>
    Math.round(paymentSchedule(doc).rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

  it("splits the grand total 60/40 by default", () => {
    const plan = paymentSchedule(base());
    expect(plan.balanced).toBe(true);
    expect(plan.rows.map((r) => r.amount)).toEqual([30_816, 20_544]);
    expect(sum(base())).toBe(quoteTotals(base()).grand);
  });

  /**
   * The instalment column is checked by hand by whoever signs it. Rounding each
   * share and letting the last one absorb the remainder is what guarantees it
   * reaches the grand total — three thirds of an odd number otherwise land a
   * satang short.
   */
  it("puts the rounding remainder on the last instalment so the column adds up", () => {
    const doc = base({ payment: presetEqual(3), rows: [{ ...emptyRow(0), name: "x", days: 1 }] });
    const { grand } = quoteTotals(doc);
    expect(sum(doc)).toBe(grand);
    // Thirds of 8,560: two at 33.33% and a fatter last one carrying the rest.
    const amounts = paymentSchedule(doc).rows.map((r) => r.amount);
    expect(amounts[0]).toBe(amounts[1]);
    expect(amounts[2]).toBeGreaterThan(amounts[1]);
  });

  it("keeps twelve instalments adding up to the whole price", () => {
    const doc = base({ payment: presetEqual(12) });
    expect(paymentSchedule(doc).balanced).toBe(true);
    expect(sum(doc)).toBe(quoteTotals(doc).grand);
  });

  /**
   * An incomplete schedule is reported, never repaired. Folding a missing 5%
   * into the last row would print a document that bills less than the price
   * agreed three inches above it — and nobody would see it happen.
   */
  it("reports a schedule that does not reach 100% instead of hiding the gap", () => {
    const doc = base({
      payment: [
        { id: "a", when: "ลงนาม", percent: 55, netDays: 30 },
        { id: "b", when: "ส่งมอบ", percent: 40, netDays: 30 },
      ],
    });
    const plan = paymentSchedule(doc);
    expect(plan.percentSum).toBe(95);
    expect(plan.balanced).toBe(false);
    expect(sum(doc)).toBeLessThan(quoteTotals(doc).grand);
  });

  it("prints nothing at all when every instalment is deleted", () => {
    const plan = paymentSchedule(base({ payment: [] }));
    expect(plan.rows).toEqual([]);
    expect(plan.balanced).toBe(false);
  });

  it("survives a half-typed percentage without inventing money", () => {
    const doc = base({ payment: [{ id: "a", when: "x", percent: NaN, netDays: 30 }] });
    expect(paymentSchedule(doc).rows[0].amount).toBe(0);
  });

  it("offers both agreed shapes at 100%", () => {
    for (const preset of [presetUat(), presetSigning()]) {
      expect(preset.reduce((s, t) => s + t.percent, 0)).toBe(100);
    }
  });

  it("splits n ways to exactly 100%, remainder on the last share", () => {
    for (const n of [1, 2, 3, 7, 12, 24]) {
      const terms = presetEqual(n);
      expect(terms).toHaveLength(n);
      expect(Math.round(terms.reduce((s, t) => s + t.percent, 0) * 100) / 100).toBe(100);
    }
  });
});

describe("maintenanceTotals", () => {
  const ma = (over: Partial<ReturnType<typeof defaultMaintenance>> = {}) => ({
    ...defaultMaintenance(),
    ...over,
  });

  it("bills the entered rate per module, per month", () => {
    const t = maintenanceTotals(ma({ modules: 2, perModuleMonthly: 20_000 }));
    expect(t.perModule).toBe(20_000);
    expect(t.monthly).toBe(40_000);
    expect(t.clamped).toBe(false);
  });

  /**
   * The paper prints the month count beside the money it is worth, so a
   * fractional entry would put "12.7 เดือนแรก" next to twelve months' value —
   * an inconsistency a customer can spot on the page. Both come from here.
   */
  it("prints whole months only, matching the value it prices them at", () => {
    const t = maintenanceTotals(ma({ includedMonths: 12.7 }));
    expect(t.includedMonths).toBe(12);
    expect(t.includedValue).toBe(MA_MIN_MONTHLY * 12);
    expect(maintenanceTotals(ma({ includedMonths: -3 })).includedMonths).toBe(0);
  });

  /**
   * The floor is a commercial rule, so it is applied in the one function both
   * the panel and the paper read. Enforcing it only in the input would let a
   * stored document print a rate the business does not sell.
   */
  it("raises a rate below the floor and says that it did", () => {
    const t = maintenanceTotals(ma({ perModuleMonthly: 10_000 }));
    expect(t.monthly).toBe(MA_MIN_MONTHLY);
    expect(t.clamped).toBe(true);
  });

  it("prices the warranty year and the year-2 fee separately", () => {
    const t = maintenanceTotals(ma());
    expect(t.includedValue).toBe(MA_MIN_MONTHLY * MA_INCLUDED_MONTHS);
    expect(t.annual).toBe(MA_DEFAULT_ANNUAL);
  });

  it("never bills zero modules", () => {
    expect(maintenanceTotals(ma({ modules: 0 })).modules).toBe(1);
    expect(maintenanceTotals(ma({ modules: NaN })).monthly).toBe(MA_MIN_MONTHLY);
  });

  it("is off until someone turns it on", () => {
    expect(defaultMaintenance().enabled).toBe(false);
  });
});

describe("marketComparison", () => {
  const withMarket = (rate: number, over: Partial<QuoteDoc> = {}): QuoteDoc => ({
    ...newDoc(INVENTORY, "d", "2026-08-05"),
    marketRatePerDay: rate,
    ...over,
  });

  it("prices the same days at the market rate and shows the saving", () => {
    // 6 days: market 12,000/day = 72,000 vs quoted 48,000
    const c = marketComparison(withMarket(12_000))!;
    expect(c.market).toBe(72_000);
    expect(c.quoted).toBe(48_000);
    expect(c.saved).toBe(24_000);
    expect(c.percent).toBe(33);
  });

  it("compares against the price after discount, which is what is charged", () => {
    const c = marketComparison(withMarket(12_000, { discountPercent: 10 }))!;
    expect(c.quoted).toBe(43_200);
    expect(c.saved).toBe(28_800);
  });

  /**
   * Nothing is printed unless there is a real saving. A "market price" below
   * the quoted price would put "ประหยัด −฿8,000" on a document going to a
   * customer.
   */
  it("shows nothing when the quote is not actually cheaper", () => {
    expect(marketComparison(withMarket(8_000))).toBeNull();
    expect(marketComparison(withMarket(6_000))).toBeNull();
  });

  it("is off by default and off at zero", () => {
    expect(marketComparison(newDoc(INVENTORY, "d", "2026-08-05"))).toBeNull();
    expect(marketComparison(withMarket(0))).toBeNull();
  });

  // Derived, never stored: rows change after the advisor runs.
  it("follows the rows — deleting work lowers both sides", () => {
    const doc = withMarket(12_000);
    const one = { ...doc, rows: doc.rows.slice(0, 1) };
    const c = marketComparison(one)!;
    expect(c.market).toBe(2.5 * 12_000);
    expect(c.quoted).toBe(2.5 * 8_000);
  });
});
