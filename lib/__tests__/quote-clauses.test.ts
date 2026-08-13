import { describe, expect, it } from "vitest";
import { acceptanceClauses } from "../quote-clauses";
import {
  defaultMaintenance,
  emptyRow,
  formatTHB,
  newDoc,
  paymentSchedule,
  presetEqual,
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
