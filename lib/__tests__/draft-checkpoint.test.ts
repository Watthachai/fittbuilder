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
const route = readFileSync("app/api/generate/route.ts", "utf8");

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
  it("parks streamed files server-side while the turn is still running", () => {
    // The server is the writer: it keeps generating after the tab is gone, so
    // it is the only party that still knows what the finished turn contains.
    expect(route).toContain("parkDraft");
    expect(route).toContain("fittbuilder_project_drafts");
  });

  it("records produced files before the disconnect guard, not after", () => {
    // Recording behind `if (closed) return` would park nothing in exactly the
    // case the parking exists for — a client that has already gone away.
    const send = route.slice(route.indexOf("const send = (event: GenerateEvent)"));
    const guard = send.indexOf("if (closed) return");
    const record = send.indexOf("produced[event.path] = event.content");
    expect(record).toBeGreaterThanOrEqual(0);
    expect(record).toBeLessThan(guard);
  });

  /**
   * createClient() reads cookies(), and Next forbids that once the response has
   * been handed off — "used cookies() inside after()". Building the client
   * inside the stream made every server-side checkpoint throw, silently, and a
   * turn whose tab closed left a partial draft and nothing else. Found only by
   * closing a real tab mid-generation and reading the server log.
   */
  it("builds its database client before the response is handed off", () => {
    const park = route.slice(route.indexOf("const parkDraft"));
    expect(park.slice(0, 400)).not.toContain("await createClient()");
    // Created once, up where the request context is still alive.
    expect(route).toMatch(/db = await createClient\(\)/);
  });

  it("throttles by time, so one build does not write a draft per file", () => {
    expect(route).toMatch(/DRAFT_INTERVAL_MS/);
    expect(route).toMatch(/Date\.now\(\) - lastPark >= DRAFT_INTERVAL_MS/);
  });

  it("lands the final park BEFORE telling the client the turn is done", () => {
    // The browser clears the draft once it has saved the real files. If the
    // server's last write landed after that clear, a finished turn would be
    // offered back as unfinished work.
    const tail = route.slice(route.lastIndexOf("await parkDraft()"));
    expect(tail.slice(0, 400)).toContain('type: "done"');
  });

  it("has only one writer during a turn — the client no longer checkpoints", () => {
    expect(turn).not.toContain("saveDraft");
  });

  /**
   * Found on the first live run: a 28-file build finished but left its 24-file
   * draft behind, so the next open would have offered stale work back as if it
   * were unfinished. Two writers racing over one row is what caused it, which is
   * why the server now owns every write during a turn and the browser only
   * clears — after the server has awaited its last one.
   */
  it("clears only what the server has finished writing", () => {
    // Ordering is held by the server awaiting its final park before `done`,
    // which is what makes a plain clear here safe again.
    expect(turn).toMatch(/void clearDraft\(projectId\)/);
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
