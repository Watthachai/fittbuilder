import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A task list is worked by the studio tab itself, one turn per task. Whatever
 * ends the tab ends the list: the server finishes the turn in flight, and
 * nothing starts the next task. Case #10 — a list of 8 stopped after one task
 * twice, each time when the page was reloaded onto a new deploy.
 */
describe("a running task list", () => {
  const studio = readFileSync("components/studio/Studio.tsx", "utf8");

  it("keeps the studio busy for the whole list, not only during each turn", () => {
    expect(studio).toMatch(/const busy = wcBusy \|\| chatStreaming \|\| taskRun !== null;/);
  });

  it("asks before the tab is closed or reloaded while the list runs", () => {
    const guard = studio.slice(studio.indexOf('addEventListener("beforeunload"') - 400);
    expect(studio).toContain('addEventListener("beforeunload"');
    expect(guard.slice(0, 600)).toMatch(/if \(taskRun === null\) return;/);
  });
});
