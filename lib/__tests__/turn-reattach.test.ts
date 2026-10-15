import { describe, expect, it } from "vitest";
import { DRAFT_STALE_MS, type GenerationDraft } from "@/lib/storage";
import { awaitTurn, reattachState, REATTACH_GRACE_MS, REATTACH_MAX_MS } from "@/lib/turn-reattach";
import { parseTurnResult, type TurnResult } from "@/lib/turn-result";

/**
 * After the connection drops, the studio waits for the turn it started rather
 * than start it again. The server parks each turn under the id the studio gave
 * it, beats a heartbeat while it runs, and parks the answer when it ends — so
 * the parked draft says which of three things happened: still running, finished
 * (here is the answer), or gone (the server stopped, or never got the request).
 */

const NOW = 1_000_000;
const TURN = "7b4f2c1e-0000-4000-8000-000000000001";
const answer: TurnResult = { note: "แก้ไขเรียบร้อยแล้ว", cut: null, deleted: ["src/old.tsx"] };

const draft = (over: Partial<GenerationDraft> = {}): GenerationDraft => ({
  files: { "src/App.tsx": "x" },
  prompt: "",
  updatedAt: new Date(NOW - 1_000).toISOString(),
  updatedBy: null,
  complete: false,
  turnId: TURN,
  result: null,
  ...over,
});

describe("reattachState", () => {
  it("is finished when this turn's draft carries its answer", () => {
    expect(reattachState(draft({ complete: true, result: answer }), TURN, NOW - 60_000, NOW)).toEqual({
      state: "finished",
      files: { "src/App.tsx": "x" },
      result: answer,
    });
  });

  it("waits while this turn's heartbeat is still beating", () => {
    expect(reattachState(draft(), TURN, NOW - 60_000, NOW)).toEqual({ state: "waiting" });
  });

  it("is lost when this turn's heartbeat went quiet without an answer", () => {
    const quiet = draft({ updatedAt: new Date(NOW - DRAFT_STALE_MS).toISOString() });
    expect(reattachState(quiet, TURN, NOW - 60_000, NOW)).toEqual({ state: "lost" });
  });

  it("waits a moment for a turn not parked yet, then counts it lost", () => {
    expect(reattachState(null, TURN, NOW - (REATTACH_GRACE_MS - 1), NOW)).toEqual({ state: "waiting" });
    expect(reattachState(null, TURN, NOW - REATTACH_GRACE_MS, NOW)).toEqual({ state: "lost" });
  });

  it("never takes another turn's draft for this one", () => {
    const other = draft({ turnId: "7b4f2c1e-0000-4000-8000-000000000002", complete: true, result: answer });
    expect(reattachState(other, TURN, NOW - 1_000, NOW)).toEqual({ state: "waiting" });
    expect(reattachState(other, TURN, NOW - REATTACH_GRACE_MS, NOW)).toEqual({ state: "lost" });
  });
});

describe("awaitTurn", () => {
  /** Each state is what one look finds; an Error is a look that could not read. */
  const run = (states: (GenerationDraft | null | Error)[], signal = new AbortController().signal) => {
    let clock = NOW;
    let i = 0;
    const loads: number[] = [];
    return awaitTurn({
      turnId: TURN,
      droppedAt: NOW,
      signal,
      load: async () => {
        loads.push(clock);
        const state = states[Math.min(i++, states.length - 1)];
        if (state instanceof Error) throw state;
        return state;
      },
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    }).then((landed) => ({ landed, loads: loads.length }));
  };

  it("keeps looking while the turn runs, and hands back its answer", async () => {
    const { landed, loads } = await run([draft(), draft(), draft({ complete: true, result: answer })]);
    expect(landed).toEqual({ files: { "src/App.tsx": "x" }, result: answer });
    expect(loads).toBe(3);
  });

  it("looks again after a read that failed, rather than give the turn up", async () => {
    const { landed } = await run([new Error("fetch failed"), draft({ complete: true, result: answer })]);
    expect(landed).toEqual({ files: { "src/App.tsx": "x" }, result: answer });
  });

  it("gives up once the server's own limit has passed", async () => {
    const { landed, loads } = await run([new Error("fetch failed")]);
    expect(landed).toBeNull();
    expect(loads).toBeGreaterThan(REATTACH_MAX_MS / 10_000);
  });

  it("gives up when the turn is lost", async () => {
    const quiet = draft({ updatedAt: new Date(NOW - DRAFT_STALE_MS - 1).toISOString() });
    expect((await run([quiet])).landed).toBeNull();
  });

  it("stops when the person cancels", async () => {
    const controller = new AbortController();
    controller.abort();
    expect((await run([draft()], controller.signal)).landed).toBeNull();
  });
});

describe("parseTurnResult", () => {
  it("reads the answer the server parked", () => {
    expect(parseTurnResult({ note: "ok", cut: "time", deleted: [] })).toEqual({ note: "ok", cut: "time", deleted: [] });
  });

  it("has no answer while the turn runs", () => {
    expect(parseTurnResult(null)).toBeNull();
  });

  it("refuses an answer it cannot read rather than guess one", () => {
    expect(() => parseTurnResult({ note: 1 })).toThrow();
  });
});
