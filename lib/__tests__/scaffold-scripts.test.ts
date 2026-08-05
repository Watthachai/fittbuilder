import { describe, expect, it } from "vitest";
import { SHOT_BRIDGE_VERSION, VITE_CONFIG } from "../scaffold";

/**
 * The injected bridge scripts are written as JavaScript inside a TypeScript
 * template literal, so the template's own syntax is live inside them: a
 * backtick in a comment ends the string, and a "${" silently interpolates and
 * ships broken JS to the container. The first is caught by the compiler; the
 * second is not, and would only show up as a preview that never answers.
 */
function injectedScripts(): string[] {
  const out: string[] = [];
  // Each script rides in as a JSON string literal: children: "…"
  for (const m of VITE_CONFIG.matchAll(/children:\s*("(?:[^"\\]|\\.)*")/g)) {
    out.push(JSON.parse(m[1]) as string);
  }
  return out;
}

describe("injected preview scripts", () => {
  it("ships live cursors, the error reporter, the wand and the capture bridge", () => {
    expect(injectedScripts()).toHaveLength(4);
  });

  it("are valid JavaScript", () => {
    for (const src of injectedScripts()) {
      expect(() => new Function(src)).not.toThrow();
    }
  });

  // A leftover "${" would have been swallowed by the template at build time,
  // leaving a script that reads nothing like what is written here.
  it("carry no unresolved template interpolation", () => {
    for (const src of injectedScripts()) expect(src).not.toContain("${");
  });

  it("stamps the bridge version the studio compares against", () => {
    const bridge = injectedScripts().find((s) => s.includes("__fittShotPong"));
    expect(bridge).toContain(`var VERSION = ${SHOT_BRIDGE_VERSION};`);
  });
});
