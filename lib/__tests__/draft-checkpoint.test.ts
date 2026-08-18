import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A generation must survive losing its tab.
 *
 * The model stream is held by the browser, so a reload ends it. Files used to
 * reach the database only when a turn ENDED — observed live on 18 Aug 2026, the
 * studio reported 12 files written while the row still said 2, and a reload cost
 * all twelve.
 *
 * The fix has two halves that only work together, and each has a way of being
 * quietly undone:
 *   - the stream checkpoints as it goes, and
 *   - the checkpoint goes to the DRAFT, never to `files` — a half-streamed set
 *     has no index.html, and making it the project's truth boots a white screen
 *     (the cancel path has always refused to do this for that reason).
 */
const studio = readFileSync("components/studio/Studio.tsx", "utf8");
const storage = readFileSync("lib/storage.ts", "utf8");

/** The body of the generate() turn — where the stream is consumed. */
const turn = studio.slice(studio.indexOf("const generate = useCallback"));

describe("generation checkpoints", () => {
  it("parks streamed files while the turn is still running", () => {
    const fileEvent = turn.slice(turn.indexOf('event.type === "file"'));
    expect(fileEvent.slice(0, 1200)).toContain("saveDraft");
  });

  it("throttles by time, so one build does not write a draft per file", () => {
    expect(studio).toMatch(/DRAFT_INTERVAL_MS/);
    expect(turn).toMatch(/Date\.now\(\) - lastDraftAt >= DRAFT_INTERVAL_MS/);
  });

  it("drops the draft once the turn resolves, either way", () => {
    // Success path and cancel path both — a draft that outlives its turn gets
    // offered back to someone who already has the finished work.
    expect(turn.match(/clearDraft\(projectId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("keeps the partial out of the project's own files", () => {
    const save = storage.slice(
      storage.indexOf("export async function saveDraft"),
      storage.indexOf("export interface GenerationDraft")
    );
    expect(save).toContain("fittbuilder_project_drafts");
    expect(save).not.toContain("fittbuilder_projects");
  });

  it("offers a recovered draft rather than applying it on load", () => {
    // loadDraft must feed a decision, not a write.
    const mount = studio.slice(studio.indexOf("void loadDraft(projectId)"));
    expect(mount.slice(0, 200)).toContain("setDraft");
    expect(mount.slice(0, 200)).not.toContain("persist");
  });
});
