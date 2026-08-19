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
    const tail = route.slice(route.lastIndexOf("await parkDraft(true)"));
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
      complete: false,
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

  /**
   * The draft is what the interrupted TURN wrote, not a copy of the project: on
   * an iteration the model re-sends only what it changed. Caught by opening a
   * real recovery dialog — the parked set had 12 files for a 32-file project, so
   * replacing would have deleted the 20 the turn never touched.
   */
  /**
   * The server finishes the turn on its own now, so most parked drafts are
   * completed work, not wreckage. Asking "do you want to recover these files?"
   * is the wrong question for a background job that succeeded — someone who sent
   * a prompt and closed the tab should come back to the answer.
   *
   * The two cases are distinguishable at exactly one point: the final park,
   * which is the only call that sets `complete`.
   */
  describe("finished work vs wreckage", () => {
    it("marks completeness only on the final park", () => {
      const parks = route.match(/parkDraft\((true)?\)/g) ?? [];
      expect(parks.length).toBeGreaterThanOrEqual(2);
      expect(parks.filter((p) => p === "parkDraft(true)")).toHaveLength(1);
      // …and that one is the awaited call that runs just before `done`.
      const tail = route.slice(route.lastIndexOf("await parkDraft(true)"));
      expect(tail.slice(0, 400)).toContain('type: "done"');
    });

    /**
     * A turn that lands this way skipped everything the client normally does at
     * the end of one. Reported from a real session: the build arrived, but the
     * chat had no reply under the prompt and the version history never gained a
     * checkpoint — so there was nothing to roll back to and no sign it happened.
     */
    it("leaves behind what any other turn leaves behind", () => {
      const apply = studio.slice(studio.indexOf("const applyDraft = useCallback"));
      const body = apply.slice(0, 2000);
      expect(body).toContain("commitRevision");
      expect(body).toContain("appendMessage");
      expect(body).toContain("computeChanges");
    });

    it("shows progress for a turn running somewhere else", () => {
      // The registry lives on globalThis and cannot see another tab's turn; the
      // heartbeat can. Without this the studio said "busy" and showed nothing.
      expect(studio).toContain("remoteProgress");
      const poll = studio.slice(studio.indexOf("const tick = async ()"));
      expect(poll.slice(0, 600)).toContain("isDraftLive");
    });

    it("takes a completed turn without asking", () => {
      const effect = studio.slice(studio.indexOf("if (!draft?.complete"));
      expect(effect.slice(0, 500)).toContain("applyDraft");
    });

    it("still asks about a turn the server never finished", () => {
      // DraftRecovery must never see a completed draft — that dialog exists for
      // the half-streamed case only.
      expect(studio).toContain("draft={draft?.complete ? null : draft}");
    });
  });

  it("merges a recovered draft over the current files, never replaces them", () => {
    // One place does the merge now, used by both the automatic path and the
    // dialog — two copies of this rule is two answers to it.
    const apply = studio.slice(studio.indexOf("const applyDraft = useCallback"));
    expect(apply.slice(0, 900)).toMatch(/\.\.\.\(current\.files \?\? \{\}\),\s*\.\.\.d\.files/);
  });

  it("offers a recovered draft rather than applying it on load", () => {
    // loadDraft must feed a decision, not a write.
    const mount = studio.slice(studio.indexOf("void loadDraft(projectId)"));
    expect(mount.slice(0, 700)).toContain("setDraft");
    expect(mount.slice(0, 700)).not.toContain("persist");
  });
});

/**
 * The projects list answers "is anyone working on this?" from the database, not
 * from the in-memory registry — which lives on globalThis and therefore knows
 * only about turns the current page started. A reload, a second tab and a
 * teammate all see nothing there.
 */
describe("projects list shows unfinished turns", () => {
  const storageSrc = readFileSync("lib/storage.ts", "utf8");
  const list = storageSrc.slice(
    storageSrc.indexOf("export async function listProjects"),
    storageSrc.indexOf("export async function getAccess")
  );

  it("reads the drafts table alongside the list", () => {
    expect(list).toContain("fittbuilder_project_drafts");
    expect(list).toContain("isDraftLive");
  });

  it("never pulls `files` into a list render", () => {
    // The drafts table holds whole file maps. Selecting one per row here is the
    // shape of the 2026-08-06 outage; file_count (0036) exists to avoid it.
    const select = list.slice(list.indexOf("fittbuilder_project_drafts"));
    const columns = select.slice(select.indexOf(".select("), select.indexOf(")", select.indexOf(".select(")));
    expect(columns).toContain("file_count");
    expect(columns).not.toMatch(/\bfiles\b/);
  });

  it("keeps the project list itself off `files` too", () => {
    const projectSelect = list.slice(list.indexOf(".select("), list.indexOf("\n", list.indexOf(".select(")));
    expect(projectSelect).not.toMatch(/\bfiles\b/);
  });
});
