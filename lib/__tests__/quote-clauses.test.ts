import { describe, expect, it } from "vitest";
import { acceptanceClauses, generatedClauses, overriddenIndexes } from "../quote-clauses";
import {
  defaultMaintenance,
  emptyRow,
  formatTHB,
  newDoc,
  parseDoc,
  paymentSchedule,
  presetEqual,
  presetUat,
  quoteTotals,
  type QuoteDoc,
} from "../quote";
import type { Shot } from "../shots";

const INVENTORY: Shot[] = [
  { path: "p/0.png", parent: null, url: "", index: 0, name: "เข้าสู่ระบบ" },
  { path: "p/1.png", parent: null, url: "", index: 1, name: "เอกสารทั้งหมด" },
];

const doc = (over: Partial<QuoteDoc> = {}): QuoteDoc => ({
  ...newDoc(INVENTORY, "ระบบ", "2026-08-13"),
  ...over,
});

describe("acceptanceClauses", () => {
  it("names the delivery channel the sender set", () => {
    const [first] = acceptanceClauses(doc());
    expect(first).toContain("FITT Code Runner");
  });

  /**
   * The whole point of generating these: the percentage a customer is held to
   * cannot be a number somebody retyped under the table. Change the schedule and
   * the clause moves with it — or this test fails and the feature is worthless.
   */
  it("states the same percentages and amounts as the payment table", () => {
    const d = doc();
    const { rows } = paymentSchedule(d);
    const text = acceptanceClauses(d).join("\n");
    expect(text).toContain(`${rows[0].term.percent}%`);
    expect(text).toContain(formatTHB(rows[0].amount));
    expect(text).toContain(`${rows[1].term.percent}%`);
    expect(text).toContain(formatTHB(rows[1].amount));
  });

  it("follows the schedule when it changes", () => {
    const d = doc({
      payment: [
        { id: "a", when: "ลงนาม", percent: 70, netDays: 15 },
        { id: "b", when: "ตรวจรับ", percent: 30, netDays: 45 },
      ],
    });
    const text = acceptanceClauses(d).join("\n");
    expect(text).toContain("70%");
    expect(text).toContain("30%");
    expect(text).toContain("ภายใน 15 วัน");
    expect(text).not.toContain("60%");
  });

  it("counts the review window from the document's own number", () => {
    const text = acceptanceClauses(doc({
      acceptance: { ...doc().acceptance, reviewDays: 14 },
    })).join("\n");
    expect(text).toContain("14 วัน");
    expect(text).not.toContain("30 วันนับจากวันส่งมอบแล้ว");
  });

  it("spells out that silence past the window is acceptance", () => {
    const text = acceptanceClauses(doc()).join("\n");
    expect(text).toContain("มิได้แจ้งข้อบกพร่อง");
    expect(text).toContain("ตรวจรับงานโดยสมบูรณ์");
  });

  /**
   * Turning the deemed-acceptance rule off must remove the rule, not just soften
   * it — the balance then falls due on an actual sign-off.
   */
  it("drops the deemed-acceptance rule when it is turned off", () => {
    const text = acceptanceClauses(doc({
      acceptance: { ...doc().acceptance, deemedAccepted: false },
    })).join("\n");
    expect(text).not.toContain("ตรวจรับงานโดยสมบูรณ์");
    expect(text).toContain("เมื่อผู้ว่าจ้างตรวจรับงานเรียบร้อยแล้ว");
  });

  it("prints nothing when acceptance terms are off", () => {
    expect(acceptanceClauses(doc({ acceptance: { ...doc().acceptance, enabled: false } }))).toEqual(
      []
    );
  });

  it("adds the maintenance clause only when maintenance is quoted", () => {
    expect(acceptanceClauses(doc()).join("\n")).not.toContain("ค่าบำรุงรักษา");
    const withMa = acceptanceClauses(
      doc({ ma: { ...defaultMaintenance(), enabled: true } })
    ).join("\n");
    expect(withMa).toContain("12 เดือนแรก");
    expect(withMa).toContain("90,000 ต่อปี");
  });

  /**
   * Clauses reference each other by content, never by number, so a document that
   * drops one still reads correctly — the bug this guards is a clause pointing
   * at the wrong neighbour after a renumber.
   */
  it("never points at a clause number", () => {
    for (const payment of [[], presetEqual(4), doc().payment]) {
      for (const line of acceptanceClauses(doc({ payment }))) {
        expect(line).not.toMatch(/ข้อ \d/);
      }
    }
  });

  it("still states the balance when there is only one instalment", () => {
    const text = acceptanceClauses(
      doc({ payment: [{ id: "a", when: "ครั้งเดียว", percent: 100, netDays: 30 }] })
    ).join("\n");
    expect(text).toContain("ค่าจ้างส่วนที่เหลือ");
  });

  it("says nothing about money when every instalment is deleted", () => {
    const d = doc({ payment: [] });
    const text = acceptanceClauses(d).join("\n");
    expect(text).toContain("วันส่งมอบ");
    expect(text).not.toContain("งวดที่ 1");
  });

  // A half-typed line item must not put "NaN" in a document going to a customer.
  it("never prints NaN", () => {
    const d = doc({ rows: [{ ...emptyRow(0), name: "x", days: NaN }] });
    expect(quoteTotals(d).grand).toBe(0);
    expect(acceptanceClauses(d).join("\n")).not.toContain("NaN");
  });
});

describe("hand-edited clauses", () => {
  const base = (): QuoteDoc => doc({ payment: presetUat() });

  it("prints the sender's wording in place of the generated one", () => {
    const doc = base();
    doc.acceptance.overrides = { "0": "ส่งมอบที่หน้างานลูกค้า และให้คุณสมชายเป็นผู้ตรวจรับ" };
    const out = acceptanceClauses(doc);
    expect(out[0]).toBe("ส่งมอบที่หน้างานลูกค้า และให้คุณสมชายเป็นผู้ตรวจรับ");
    // The clause that was NOT touched still carries the computed figure.
    expect(out[1]).toContain("60%");
  });

  it("keeps untouched clauses tracking the numbers after an edit", () => {
    const doc = base();
    doc.acceptance.overrides = { "0": "แก้ข้อแรก" };
    doc.payment = [
      { id: "a", when: "ลงนาม", percent: 30, netDays: 15 },
      { id: "b", when: "ส่งมอบ", percent: 70, netDays: 15 },
    ];
    // Editing clause 0 must not freeze clause 1 at the old split.
    expect(acceptanceClauses(doc)[1]).toContain("30%");
  });

  it("appends extra clauses after the generated ones", () => {
    const doc = base();
    doc.acceptance.extra = ["ราคานี้ไม่รวมค่าเดินทางต่างจังหวัด", "  "];
    const out = acceptanceClauses(doc);
    expect(out[out.length - 1]).toBe("ราคานี้ไม่รวมค่าเดินทางต่างจังหวัด");
    // A blank one the user has not filled in yet never reaches the paper.
    expect(out.filter((c) => !c.trim())).toHaveLength(0);
  });

  it("drops a removed clause from the printed set", () => {
    const doc = base();
    const auto = generatedClauses(doc);
    const before = acceptanceClauses(doc).length;
    doc.acceptance.excluded = [2];
    const out = acceptanceClauses(doc);
    // One fewer clause, and the removed sentence is gone.
    expect(out).toHaveLength(before - 1);
    expect(out).not.toContain(auto[2]);
    // Its neighbours still print, and still track the numbers.
    expect(out).toContain(auto[1]);
    expect(out).toContain(auto[3]);
  });

  it("keeps extra clauses after removing a generated one", () => {
    const doc = base();
    doc.acceptance.excluded = [0];
    doc.acceptance.extra = ["ราคานี้ไม่รวมค่าเดินทางต่างจังหวัด"];
    const out = acceptanceClauses(doc);
    expect(out[out.length - 1]).toBe("ราคานี้ไม่รวมค่าเดินทางต่างจังหวัด");
  });

  it("round-trips the excluded set and drops garbage indexes", () => {
    const doc = base();
    const stored = JSON.parse(JSON.stringify(doc));
    stored.acceptance.excluded = [1, "x", -3, 2];
    const reopened = parseDoc(JSON.parse(JSON.stringify(stored)), "2026-08-26");
    expect(reopened!.acceptance.excluded).toEqual([1, 2]);
  });

  it("reports which clauses stopped following the numbers", () => {
    const doc = base();
    doc.acceptance.overrides = { "2": "ตรวจรับภายใน 7 วัน" };
    expect(overriddenIndexes(doc)).toEqual([2]);
  });

  it("treats an override equal to the generated text as no override", () => {
    const doc = base();
    const auto = generatedClauses(doc);
    doc.acceptance.overrides = { "0": auto[0] };
    expect(overriddenIndexes(doc)).toEqual([]);
  });

  it("opens a document written before overrides existed", () => {
    // Round-trip a real document with the two new fields removed — exactly the
    // shape every quotation already stored in jsonb has.
    const stored = JSON.parse(JSON.stringify(base()));
    delete stored.acceptance.overrides;
    delete stored.acceptance.extra;
    const reopened = parseDoc(JSON.parse(JSON.stringify(stored)), "2026-08-21");
    expect(reopened).not.toBeNull();
    expect(reopened!.acceptance.overrides).toBeUndefined();
    expect(acceptanceClauses(reopened!).length).toBeGreaterThan(0);
  });
});
