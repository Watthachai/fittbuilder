import { describe, expect, it } from "vitest";
import { newDoc, quoteTotals, type QuoteDoc } from "@/lib/quote";
import {
  DEFAULT_CLOSING,
  hasJourney,
  newProposal,
  parseProposal,
  proposalSteps,
  proposalTimeline,
  stepJourney,
} from "@/lib/proposal";
import type { Shot } from "@/lib/shots";

const shot = (p: Partial<Shot> & { name: string; index: number }): Shot => ({
  path: `p/${p.index}`,
  name: p.name,
  parent: p.parent ?? null,
  index: p.index,
  url: p.url ?? `https://example.test/${p.index}.png`,
  from: p.from ?? null,
  via: p.via ?? null,
});

const quote = (patch: Partial<QuoteDoc> = {}): QuoteDoc => ({
  ...newDoc([], "ทดสอบ", "2026-08-24"),
  ...patch,
});

describe("proposalSteps", () => {
  it("reads in the order the app was actually walked, not the order stored", () => {
    const steps = proposalSteps(
      [shot({ name: "ค", index: 3 }), shot({ name: "ก", index: 1 }), shot({ name: "ข", index: 2 })],
      null
    );
    expect(steps.map((s) => s.name)).toEqual(["ก", "ข", "ค"]);
  });

  it("borrows what a screen does from the quotation instead of describing it twice", () => {
    const q = quote({
      rows: [
        { id: "r1", name: "รายการสินค้า", size: "M", days: 3, note: "ดูสต๊อกคงเหลือทุกสาขา", sub: false, parent: "" },
      ],
    });
    const [step] = proposalSteps([shot({ name: "รายการสินค้า", index: 1 })], q);
    expect(step.note).toBe("ดูสต๊อกคงเหลือทุกสาขา");
  });

  it("leaves the description empty rather than guessing when the quotation has none", () => {
    const [step] = proposalSteps([shot({ name: "หน้าที่ไม่มีในใบเสนอราคา", index: 1 })], quote());
    expect(step.note).toBe("");
  });

  /** A signed URL that failed to mint prints as a broken box — drop it instead. */
  it("drops a shot with no usable URL", () => {
    const steps = proposalSteps(
      [shot({ name: "ดี", index: 1 }), shot({ name: "เสีย", index: 2, url: "" })],
      null
    );
    expect(steps.map((s) => s.name)).toEqual(["ดี"]);
  });

  it("carries the flow edge and the modal nesting through untouched", () => {
    const [step] = proposalSteps(
      [shot({ name: "ฟอร์มเพิ่มสินค้า", index: 4, from: "รายการสินค้า", via: "เพิ่มสินค้า", parent: "รายการสินค้า" })],
      null
    );
    expect(step).toMatchObject({
      from: "รายการสินค้า",
      via: "เพิ่มสินค้า",
      parent: "รายการสินค้า",
    });
  });
});

describe("stepJourney", () => {
  const step = (from: string | null, via: string | null) =>
    proposalSteps([shot({ name: "ปลายทาง", index: 1, from, via })], null)[0];

  it("says where it came from and what was pressed", () => {
    expect(stepJourney(step("รายการสินค้า", "เพิ่มสินค้า"))).toBe(
      "จากหน้า “รายการสินค้า” กด “เพิ่มสินค้า” → ปลายทาง"
    );
  });

  it("omits the origin when the walk never recorded one", () => {
    expect(stepJourney(step(null, "เพิ่มสินค้า"))).toBe("กด “เพิ่มสินค้า” → ปลายทาง");
  });

  /**
   * The screen the app opens on was never navigated to. Printing "กด … →" for
   * it would put a click in front of a customer that nobody performed.
   */
  it("returns nothing when no control was pressed", () => {
    expect(stepJourney(step("หน้าแรก", null))).toBeNull();
  });

  /**
   * The index walk labels a modal's edge with the modal's own name — the full
   * sentence would say that name three times in one caption. All it really
   * knows is the origin, so that is all it may say.
   */
  it("says only the origin when the control label is the destination's own name", () => {
    expect(stepJourney(step("หน้ารายการ", "ปลายทาง"))).toBe("เปิดจากหน้า “หน้ารายการ”");
    expect(stepJourney(step(null, "ปลายทาง"))).toBeNull();
  });
});

describe("hasJourney", () => {
  it("is false for a gallery captured without navigation", () => {
    expect(hasJourney(proposalSteps([shot({ name: "ก", index: 1 })], null))).toBe(false);
  });

  it("is true once any step recorded a control", () => {
    const steps = proposalSteps(
      [shot({ name: "ก", index: 1 }), shot({ name: "ข", index: 2, via: "เมนู" })],
      null
    );
    expect(hasJourney(steps)).toBe(true);
  });
});

describe("proposalTimeline", () => {
  it("reports nothing known when there is no quotation to read", () => {
    expect(proposalTimeline(null)).toEqual({
      buildDays: 0,
      reviewDays: 0,
      includedMonths: 0,
      known: false,
    });
  });

  it("takes the working days from the priced scope, never from its own field", () => {
    const q = quote({
      rows: [
        { id: "a", name: "ก", size: "M", days: 4, note: "", sub: false, parent: "" },
        { id: "b", name: "ข", size: "M", days: 6, note: "", sub: false, parent: "" },
      ],
    });
    expect(proposalTimeline(q).buildDays).toBe(quoteTotals(q).days);
    expect(proposalTimeline(q).buildDays).toBe(10);
  });

  it("takes the inspection window from the acceptance terms", () => {
    const q = quote({ acceptance: { ...quote().acceptance, reviewDays: 45 } });
    expect(proposalTimeline(q).reviewDays).toBe(45);
  });

  it("claims no included maintenance when maintenance is not being offered", () => {
    const q = quote({ ma: { ...quote().ma, enabled: false, includedMonths: 12 } });
    expect(proposalTimeline(q).includedMonths).toBe(0);
  });
});

describe("parseProposal", () => {
  const round = (patch: Record<string, unknown>) =>
    parseProposal({ points: [], ...patch }, "2026-01-01");

  it("refuses anything that is not a document", () => {
    for (const bad of [null, undefined, 7, "x", [], {}]) {
      expect(parseProposal(bad, "2026-01-01")).toBeNull();
    }
  });

  it("survives a payload with nothing but the points array", () => {
    const doc = round({})!;
    expect(doc.issuedAt).toBe("2026-01-01");
    expect(doc.closing).toBe(DEFAULT_CLOSING);
    expect(doc.showSteps).toBe(true);
    expect(doc.excluded).toEqual([]);
  });

  it("drops junk out of the string lists instead of rendering it", () => {
    expect(round({ excluded: ["จริง", 5, null, { a: 1 }] })!.excluded).toEqual(["จริง"]);
  });

  it("gives every point an id so React keys stay stable", () => {
    const doc = round({ points: [{ problem: "ก" }, { feature: "ข" }] })!;
    expect(doc.points.map((p) => p.id).filter(Boolean)).toHaveLength(2);
    expect(new Set(doc.points.map((p) => p.id)).size).toBe(2);
  });

  /**
   * A missing flag must fall back to carrying our mark. The opposite default
   * would hand white-label away to any document whose field went missing.
   */
  it("keeps the mark when the brand flag is absent", () => {
    expect(round({ brand: {} })!.brand.poweredBy).toBe(true);
    expect(round({ brand: { poweredBy: false } })!.brand.poweredBy).toBe(false);
  });

  it("round-trips a document written by newProposal", () => {
    const doc = newProposal("Pace", "2026-08-24");
    expect(parseProposal(JSON.parse(JSON.stringify(doc)), "2026-01-01")).toEqual(doc);
  });
});
