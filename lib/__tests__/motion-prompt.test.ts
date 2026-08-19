import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * What separates a shipped product from a generated one, encoded where it
 * reaches every build.
 *
 * The design rule already covered palette, chrome and hover states, and output
 * still read as generated. The two tells it never named: controls whose label is
 * jammed against the border, and a first screen where everything appears at
 * once. Both are cheap to get right and neither happens by default.
 */
const prompts = readFileSync("lib/prompts.ts", "utf8");

describe("build prompt · craft rules", () => {
  it("asks for a designed entrance order, with numbers", () => {
    expect(prompts).toContain("CHOREOGRAPH THE FIRST SECOND");
    // A ladder the model can follow beats "add some animation".
    expect(prompts).toMatch(/0 · 100 · 200 · 300 · 500 · 700 · 900ms/);
  });

  it("names CSS keyframes as the mechanism, not a library", () => {
    expect(prompts).toContain("animation-fill-mode: forwards");
    expect(prompts).toContain("cubic-bezier(0.16, 1, 0.3, 1)");
    // Scroll triggers are wrong for content already on screen.
    expect(prompts).toMatch(/Do NOT use IntersectionObserver or a scroll trigger for the first screen/);
  });

  it("keeps framer-motion available for what it is actually for", () => {
    // Banning it outright would cost layout transitions and gestures; the rule
    // is about not installing a library to do a fade-up.
    expect(prompts).toContain("framer-motion earns its weight on layout transitions and gestures");
  });

  it("spells out the padding tell", () => {
    expect(prompts).toContain("MEASURED SPACING, NOT EYEBALLED");
    expect(prompts).toMatch(/text must never touch a rounded edge/);
  });

  it("asks for reduced-motion to be honoured", () => {
    expect(prompts).toContain("prefers-reduced-motion");
  });

  it("tells an edit to join the existing timeline instead of ignoring it", () => {
    // Otherwise the first turn choreographs the page and every later turn drops
    // an element into it that simply appears.
    const iteration = prompts.slice(prompts.indexOf("Preserve the existing design language"));
    expect(iteration.slice(0, 400)).toContain("joins that ladder");
  });
});
