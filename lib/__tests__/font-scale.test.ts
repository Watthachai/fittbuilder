import { describe, expect, it } from "vitest";
import { parseFontScale, stepFontScale } from "../useFontScale";

describe("text size", () => {
  it("reads a saved step, and the default for anything else", () => {
    expect(parseFontScale("120")).toBe(120);
    expect(parseFontScale("90")).toBe(90);
    expect(parseFontScale(null)).toBe(100);
    expect(parseFontScale("")).toBe(100);
    expect(parseFontScale("115")).toBe(100);
    expect(parseFontScale("200")).toBe(100);
    expect(parseFontScale("80")).toBe(100);
    expect(parseFontScale("big")).toBe(100);
  });

  it("steps by ten and stops at either end", () => {
    expect(stepFontScale(100, 1)).toBe(110);
    expect(stepFontScale(100, -1)).toBe(90);
    expect(stepFontScale(90, -1)).toBe(90);
    expect(stepFontScale(140, 1)).toBe(140);
  });
});
