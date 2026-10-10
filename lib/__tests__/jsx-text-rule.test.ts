import { describe, expect, it } from "vitest";
import { buildGenerationSystemPrompt, buildIterationSystemPrompt } from "@/lib/prompts";

/**
 * Case #12: a delivery report page quoted a line of code as text —
 * `if (parsed.length > 0)` between JSX tags. esbuild, which compiles the
 * preview, rejects a bare ">" in JSX text ("The character ">" is not valid
 * inside a JSX element") and the whole app stopped. The "แก้ด้วย AI" turn
 * moved the text to a new file and kept the ">", because nothing in its prompt
 * said what was wrong with it. Backticks look like protection and are not.
 */
describe("JSX text rule · holds on every turn, fixes included", () => {
  for (const [name, prompt] of [
    ["generation", buildGenerationSystemPrompt()],
    ["iteration", buildIterationSystemPrompt()],
  ] as const) {
    it(`tells the ${name} turn that > and } cannot sit in JSX text, and how to write them`, () => {
      expect(prompt).toContain('The character ">" is not valid inside a JSX element');
      expect(prompt).toContain("{'if (parsed.length > 0)'}");
      expect(prompt).toContain("Backticks");
    });
  }
});
