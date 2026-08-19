import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * "ล่าสุด" has to name where the project actually is.
 *
 * The panel used to decide it by position — row 0 — which assumes every change
 * to the files also writes a checkpoint. It does not: work that landed in the
 * background wrote files without one, and a real session ended up showing
 * "ล่าสุด" on a 32-file snapshot of a 41-file project.
 *
 * That is worse than an unlabelled list. The row wearing the badge is the one
 * row that hides its rollback button (you are already there) — so the state the
 * project was really in became the one state unreachable from the panel, while
 * every other row offered to "go back" to something newer than it.
 */
const panel = readFileSync("components/studio/HistoryPanel.tsx", "utf8");

describe("version history", () => {
  it("decides the current checkpoint by content, not by list position", () => {
    expect(panel).toContain("shaOf");
    expect(panel).toMatch(/const latest = currentSha !== null && rev\.sha === currentSha/);
    expect(panel).not.toMatch(/const latest = i === 0/);
  });

  it("says so when the files match no checkpoint at all", () => {
    // Silence here reads as "you are on the newest row", which is the mistake.
    expect(panel).toMatch(/!rows\.some\(\(r\) => r\.sha === currentSha\)/);
  });

  it("hides rollback only on the checkpoint the project is actually on", () => {
    expect(panel).toContain("onRollback && !latest");
  });
});
