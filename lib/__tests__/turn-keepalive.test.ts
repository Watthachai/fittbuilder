import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A turn the browser loses must still be findable, and a quiet turn must not
 * look dead to the network (cases #8, #30, #35).
 *
 * Two things went wrong together. Connections dropped part-way through turns —
 * on a company network, at a point where nothing had been sent for a while —
 * and the studio, unable to see that the server was still working, started the
 * same turn again. The server half: say something while quiet, park the turn
 * under the studio's id from its first moment, park its answer when it ends,
 * and write down when the browser left.
 */
const route = readFileSync("app/api/generate/route.ts", "utf8");
const split = readFileSync("app/api/split-tasks/route.ts", "utf8");

describe("a build turn the browser can lose", () => {
  it("parks under the studio's id for the turn", () => {
    expect(route).toMatch(/turnId: z\.string\(\)\.uuid\(\)/);
    expect(route).toContain("turn_id: body.turnId");
  });

  it("parks as it starts, before the first file, so an early drop still finds it", () => {
    const start = route.slice(route.indexOf("async start(controller)"));
    const first = start.indexOf("await parkDraft()");
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(start.indexOf("await buildUser("));
  });

  it("says something every few seconds while quiet, and keeps the heartbeat moving", () => {
    expect(route).toMatch(/KEEPALIVE_MS = 10_000/);
    // An SSE comment: the studio's parser passes it by (lib/sse).
    expect(route).toContain('encode(": keepalive\\n\\n")');
    const beat = route.slice(route.indexOf("beat = setInterval"));
    expect(beat.slice(0, 600)).toContain("controller.enqueue(KEEPALIVE)");
    expect(beat.slice(0, 600)).toContain("parkDraft()");
  });

  it("stops beating before the final park, so no beat lands on top of the answer", () => {
    const finish = route.slice(route.indexOf("const finish = async"));
    const body = finish.slice(0, 700);
    expect(body.indexOf("clearInterval(beat)")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("clearInterval(beat)")).toBeLessThan(body.indexOf("await parkDraft(true, result)"));
    // Parks run one after another: a beat already on its way cannot land last.
    expect(route).toContain("parking = parking.then(");
  });

  it("parks the answer, then says it, on every turn that has one", () => {
    const finish = route.slice(route.indexOf("const finish = async"));
    const body = finish.slice(0, 700);
    expect(body.indexOf("await parkDraft(true, result)")).toBeLessThan(body.indexOf('type: "done"'));
    // Both answers — files written, or none — go through it, and nothing else says done.
    expect(route.match(/await finish\(/g)).toHaveLength(2);
    expect(route.match(/type: "done"/g)).toHaveLength(1);
  });

  it("takes back its draft when it failed with nothing to show", () => {
    const failed = route.slice(route.indexOf('turn = ended("failed"'));
    expect(failed.slice(0, 300)).toContain("if (Object.keys(produced).length === 0) await dropDraft()");
    expect(route).toMatch(/\.eq\("turn_id", body\.turnId\)/);
  });

  it("writes down when the browser stopped listening", () => {
    const cancel = route.slice(route.indexOf("cancel()"));
    expect(cancel.slice(0, 300)).toContain("clientLeft()");
    expect(route).toContain("clientLeftMs:");
  });

  it("records how every turn ended, the ones that wrote no file included", () => {
    const empty = route.slice(route.indexOf("if (fileCount === 0) {\n          const note"));
    expect(empty.slice(0, 900)).toContain("turn = ended(");
  });
});

describe("splitting a request the network might cut", () => {
  /**
   * Case #8: the split took about forty seconds with nothing sent back, and the
   * company network cut it — the server finished, the browser got "Failed to
   * fetch". JSON may start with whitespace, so a space every few seconds keeps
   * the line busy without changing what the browser parses.
   */
  it("sends a space while it works, and the answer at the end", () => {
    expect(split).toContain("setInterval");
    expect(split).toContain('encode(" ")');
    expect(split).toContain("no-transform");
  });
});

describe("the studio waits for a turn it lost", () => {
  const studio = readFileSync("components/studio/Studio.tsx", "utf8");
  const turn = studio.slice(
    studio.indexOf("const generate = useCallback"),
    studio.indexOf("const handleUndo = useCallback")
  );

  it("gives every turn its own id, and sends it", () => {
    expect(turn).toContain("const turnId = crypto.randomUUID()");
    const request = turn.slice(turn.indexOf("streamGenerate("));
    expect(request.slice(0, 400)).toContain("turnId,");
  });

  it("waits for that turn on a dropped connection instead of calling it failed", () => {
    const drop = turn.slice(turn.indexOf("if (!(error instanceof StreamDropped)) throw error"));
    expect(drop.slice(0, 1500)).toContain("awaitTurn({");
    expect(drop.slice(0, 1500)).toContain("load: () => fetchDraft(projectId)");
  });

  it("boots what landed through the draft — none of it reached the preview", () => {
    expect(turn).toMatch(/if \(depsAdded \|\| landedFromDraft\)/);
  });
});
