import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Case #17: "เพิ่มดัชนีหน้าจอ" on a 290-file project ran the full nine minutes,
 * was cut after 16 files, and stopped there — the reporter had to type "ต่อเลย".
 * A turn cut by the clock continues once by itself, but only in runTurn, and
 * eleven buttons (screen index, "แก้ด้วย AI", the wand, retry, reorganise,
 * missing files, Premium…) called generate directly and never got it.
 */
describe("every AI action the person starts continues once when it is cut", () => {
  const studio = readFileSync("components/studio/Studio.tsx", "utf8");

  it("starts through runTurn, never generate directly", () => {
    expect(studio).not.toMatch(/void generate\(/);
  });
});
