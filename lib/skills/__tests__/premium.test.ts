import { describe, expect, it } from "vitest";
import { CROSS_DOMAIN_PREMIUM, buildPremiumContext, premiumOptionsFor } from "../premium";
import { SKILLS } from "../registry";
import { ECOMMERCE } from "../ecommerce";
import { ERP } from "../erp";

describe("premium catalogue", () => {
  it("every built-in skill has something to sell", () => {
    for (const skill of SKILLS) {
      expect(skill.premiumOptions.length, `${skill.id} has no premium options`).toBeGreaterThan(0);
    }
  });

  it("every option is priceable and buildable", () => {
    const all = [...SKILLS.flatMap((s) => s.premiumOptions), ...CROSS_DOMAIN_PREMIUM];
    for (const o of all) {
      // effortDays feeds a quotation line item; 0 would print a free upgrade.
      expect(o.effortDays, `${o.id} has no effort`).toBeGreaterThan(0);
      expect(o.build.length, `${o.id} has no build brief`).toBeGreaterThan(20);
      expect(o.pitch.length, `${o.id} has no pitch`).toBeGreaterThan(20);
    }
  });

  it("ids are unique across a skill and the cross-domain set", () => {
    for (const skill of SKILLS) {
      const ids = [...skill.premiumOptions, ...CROSS_DOMAIN_PREMIUM].map((o) => o.id);
      expect(new Set(ids).size, `${skill.id} has a duplicate option id`).toBe(ids.length);
    }
  });

  /**
   * The whole point of `requires`: a warehouse upgrade must not be offered for a
   * demo that never tracks stock, because that is a promise the build cannot keep.
   */
  it("hides options the demo has nothing to build on", () => {
    const offered = premiumOptionsFor(ERP, ["Landing page", "src/App.tsx"]).map((o) => o.id);
    expect(offered).not.toContain("reorder");
    expect(offered).not.toContain("pickpath");
  });

  it("offers them once the demo has the thing they need", () => {
    const offered = premiumOptionsFor(ERP, ["Stock levels", "src/pages/Warehouse.tsx"]).map(
      (o) => o.id
    );
    expect(offered).toContain("reorder");
    expect(offered).toContain("pickpath");
  });

  it("always offers the cross-domain options, even with no skill at all", () => {
    const offered = premiumOptionsFor(undefined, []).map((o) => o.id);
    expect(offered).toEqual(expect.arrayContaining(CROSS_DOMAIN_PREMIUM.map((o) => o.id)));
  });

  it("puts the substantial work first", () => {
    const days = premiumOptionsFor(ECOMMERCE, ["product detail", "cart"]).map((o) => o.effortDays);
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });

  it("briefs the generator with what to build, and says nothing when nothing is chosen", () => {
    expect(buildPremiumContext([])).toBe("");
    const ctx = buildPremiumContext([ECOMMERCE.premiumOptions[0]]);
    expect(ctx).toContain(ECOMMERCE.premiumOptions[0].name);
    expect(ctx).toContain(ECOMMERCE.premiumOptions[0].build);
  });
});
