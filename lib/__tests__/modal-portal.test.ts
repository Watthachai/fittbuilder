import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A modal that covers its panel instead of the screen.
 *
 * Staff reported it as "ทุกครั้ง" — every demo. The dim stopped at the edge of
 * <main>, the sidebar and header stayed bright, and the dialog sat centred
 * inside the content column. Nothing was wrong with the modal code: `position:
 * fixed` anchors to the viewport only while NO ancestor creates a containing
 * block, and transform / filter / backdrop-filter / perspective / will-change /
 * contain each create one. Our own design guidance asks for backdrop-blur navs
 * and sliding sidebars, so the trap was being laid by the house style itself —
 * which is why writing the modal correctly never helped.
 *
 * A portal to document.body removes every such ancestor at once. It cannot be
 * repaired at mount the way a bad CDN URL can, because it is JSX structure and
 * not a string, so the rule has to hold in the prompt.
 */
const prompts = readFileSync("lib/prompts.ts", "utf8");

describe("modal rules · the overlay has to reach the window", () => {
  it("requires the portal, and names where it goes", () => {
    expect(prompts).toContain("createPortal");
    expect(prompts).toContain("document.body");
  });

  it("carries the reason, not just the instruction", () => {
    // The bare rule is the kind a model drops the moment it conflicts with the
    // component tree it is building; the mechanism is what makes it stick.
    expect(prompts).toContain("containing block");
    for (const prop of ["transform", "backdrop-filter", "will-change", "contain"]) {
      expect(prompts).toContain(prop);
    }
  });

  it("names the look-alike that produces the identical bug", () => {
    expect(prompts).toContain("absolute inset-0");
    expect(prompts).toContain("overflow-hidden");
  });

  it("keeps the four ways out that came before it", () => {
    expect(prompts).toContain('role="dialog" aria-modal="true"');
    expect(prompts).toContain("onClick={(e)=>e.stopPropagation()}");
    expect(prompts).toContain("the Escape key");
  });
});
