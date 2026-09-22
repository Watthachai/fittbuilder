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

  /**
   * This rule used to say "CSS keyframes, never a library", and that was right
   * while an animation library meant an install: adding one rewrites
   * package.json, which invalidates the WebContainer cache and reboots the
   * container. The scaffold now ships `motion` in its base dependencies, so the
   * cost is gone — and shared-layout transitions, the clearest sign a screen was
   * designed, cannot be written in CSS at all.
   */
  it("points at the animation library the scaffold actually ships", () => {
    expect(prompts).toContain('from "motion/react"');
    expect(prompts).toContain("layoutId");
    // One easing curve for the whole app, in both notations.
    expect(prompts).toContain("[0.16, 1, 0.3, 1]");
    expect(prompts).toContain("cubic-bezier(0.16, 1, 0.3, 1)");
    // Scroll triggers are wrong for content already on screen.
    expect(prompts).toMatch(/Do NOT use IntersectionObserver or a scroll trigger for the first screen/);
  });

  it("warns off the package that is NOT installed", () => {
    // Declaring framer-motion installs a second animation library beside the one
    // already there, and costs a full reinstall to do it.
    expect(prompts).toContain('NOT from "framer-motion"');
    expect(prompts).toContain("ALREADY INSTALLED, never declare");
  });

  it("asks for an entrance that cannot hide the content it reveals", () => {
    // An element parked at opacity 0 whose animation never runs — background
    // tab, screenshot bridge, reduced motion — is simply invisible.
    expect(prompts).toContain("MOTION MUST NOT HIDE CONTENT");
    expect(prompts).toContain("document.visibilityState");
  });

  it("spells out the padding tell", () => {
    expect(prompts).toContain("MEASURED SPACING, NOT EYEBALLED");
    expect(prompts).toMatch(/text must never touch a rounded edge/);
  });

  it("asks for reduced-motion to be honoured", () => {
    expect(prompts).toContain("prefers-reduced-motion");
  });

  it("asks for one component kit and one colour key across the app", () => {
    // Five slightly different cards is what makes a multi-screen app read as
    // assembled; a colour picked at the point of use is why charts need legends.
    expect(prompts).toContain("ONE KIT, USED EVERYWHERE");
    expect(prompts).toContain("ONE COLOUR KEY FOR THE WHOLE APP");
    expect(prompts).toMatch(/Never pick a colour at the point of use/);
  });

  it("tells an edit to join the existing timeline instead of ignoring it", () => {
    // Otherwise the first turn choreographs the page and every later turn drops
    // an element into it that simply appears.
    const iteration = prompts.slice(prompts.indexOf("Preserve the existing design language"));
    expect(iteration.slice(0, 400)).toContain("joins that ladder");
  });
});
