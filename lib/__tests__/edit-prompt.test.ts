import { describe, expect, it } from "vitest";
import { buildGenerationSystemPrompt, buildIterationSystemPrompt } from "../prompts";

/**
 * An edit turn names the lines it changes instead of writing the file again
 * (lib/apply-edit). Three quarters of what edit turns wrote was code they only
 * copied, and turn time follows what the model writes.
 */
describe("the edit turn's instructions", () => {
  const edit = buildIterationSystemPrompt();

  it("changes an existing file through an <edit> block of find/replace pairs", () => {
    expect(edit).toContain('<edit path="');
    expect(edit).toContain("<find>");
    expect(edit).toContain("<replace>");
  });

  it("asks for find text copied character for character, matching one place only", () => {
    expect(edit).toMatch(/CHARACTER FOR CHARACTER/);
    expect(edit).toMatch(/exactly ONE place/);
  });

  it("says what happens to a find that does not match: nothing changes", () => {
    expect(edit).toMatch(/does not match changes nothing/);
  });

  it("keeps <file> for a new file, or one the user asked to rebuild", () => {
    expect(edit).toMatch(/<file> is for a NEW file only/);
    expect(edit).not.toMatch(/Emit a <file> block ONLY for files whose contents change \(full new contents\)/);
  });

  it("asks clarifying questions with no blocks of either kind", () => {
    expect(edit).toMatch(/no <file> or <edit> blocks/);
  });
});

describe("the first build's instructions", () => {
  const build = buildGenerationSystemPrompt();

  it("still writes every file whole — there is nothing to edit yet", () => {
    expect(build).toMatch(/COMPLETE file/);
    expect(build).not.toContain("<find>");
  });
});
