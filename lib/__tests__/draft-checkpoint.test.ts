import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DRAFT_STALE_MS, isDraftLive, type GenerationDraft } from "@/lib/storage";

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

/**
 * The generate() turn — where the stream is consumed. Bounded at the next
 * callback, or the slice would run to the end of the file and sweep in the
 * recovery dialog's own handlers.
 */
const turn = studio.slice(
  studio.indexOf("const generate = useCallback"),
  studio.indexOf("const handleUndo = useCallback")
);

describe("generation checkpoints", () => {
  it("parks streamed files while the turn is still running", () => {
    const fileEvent = turn.slice(turn.indexOf('event.type === "file"'));
    expect(fileEvent.slice(0, 1200)).toContain("saveDraft");
  });

  it("throttles by time, so one build does not write a draft per file", () => {
    expect(studio).toMatch(/DRAFT_INTERVAL_MS/);
    expect(turn).toMatch(/Date\.now\(\) - lastDraftAt >= DRAFT_INTERVAL_MS/);
  });

  /**
   * Found on the first live run: a 28-file build finished but left its 24-file
   * draft behind, so the next open would have offered stale work back as if it
   * were unfinished. The checkpoint is fired without awaiting (so it never slows
   * the stream), which means one can still be in flight when the turn ends — the
   * delete has to queue behind them, not race them.
   */
  it("clears only after every checkpoint has landed", () => {
    expect(turn).toContain("draftWrites");
    expect(turn).toMatch(/draftWrites\s*\.then\(\(\) => clearDraft/);
    // A bare clearDraft call is the race coming back.
    expect(turn).not.toMatch(/void clearDraft\(projectId\)/);
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

  /**
   * A draft looks the same whether the tab died a minute ago or another tab is
   * writing to it right now. Its `updated_at` is rewritten by every checkpoint,
   * so a timestamp that keeps moving is the difference — and offering back work
   * that is still being produced puts two writers on one project.
   */
  describe("live vs dead", () => {
    const at = (ms: number): GenerationDraft => ({
      files: {},
      prompt: "",
      updatedAt: new Date(ms).toISOString(),
      updatedBy: null,
    });

    it("counts a beating heartbeat as a turn still running", () => {
      const now = 1_000_000;
      expect(isDraftLive(at(now - 1_000), now)).toBe(true);
      expect(isDraftLive(at(now - (DRAFT_STALE_MS - 1)), now)).toBe(true);
    });

    it("counts a quiet one as dead, so its work can be offered back", () => {
      const now = 1_000_000;
      expect(isDraftLive(at(now - DRAFT_STALE_MS), now)).toBe(false);
      expect(isDraftLive(at(now - 60_000), now)).toBe(false);
    });

    it("waits out the window before deciding, never on the first look alone", () => {
      const mount = studio.slice(studio.indexOf("void loadDraft(projectId)"));
      expect(mount.slice(0, 700)).toContain("isDraftLive");
      expect(mount.slice(0, 700)).toContain("DRAFT_STALE_MS");
    });
  });

  it("offers a recovered draft rather than applying it on load", () => {
    // loadDraft must feed a decision, not a write.
    const mount = studio.slice(studio.indexOf("void loadDraft(projectId)"));
    expect(mount.slice(0, 700)).toContain("setDraft");
    expect(mount.slice(0, 700)).not.toContain("persist");
  });
});
