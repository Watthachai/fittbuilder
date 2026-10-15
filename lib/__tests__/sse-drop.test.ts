import { afterEach, describe, expect, it, vi } from "vitest";
import { StreamDropped, streamGenerate } from "@/lib/sse";
import type { GenerateEvent } from "@/lib/types";

/**
 * A build turn the browser stops hearing from is not a failed turn.
 *
 * The server runs every turn to the end whether or not anyone is listening, so
 * when the connection breaks the turn is usually still going. The studio used to
 * call that a failure: a task list sent the same task again at once, and people
 * pressed retry, so two full turns ran side by side on one project (48 pairs on
 * 14 Oct, case #35). The stream has to say "the connection went" apart from
 * "the server said it failed", so the studio can wait for the turn instead.
 */

const enc = new TextEncoder();
const frame = (event: GenerateEvent) => `data: ${JSON.stringify(event)}\n\n`;
const done: GenerateEvent = { type: "done", note: "เสร็จ", deleted: [], cut: null };

/** A response whose body yields these chunks, then errors when `fail` is given. */
function respond(chunks: string[], fail?: Error): Response {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else if (fail) controller.error(fail);
      else controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

async function collect(signal = new AbortController().signal): Promise<GenerateEvent[]> {
  const events: GenerateEvent[] = [];
  for await (const e of streamGenerate({ prompt: "x" }, signal)) events.push(e);
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamGenerate", () => {
  it("passes keepalive comments by and ends quietly on done", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond([": keepalive\n\n", frame({ type: "status", message: "a" }), ": keepalive\n\n", frame(done)])
      )
    );
    expect(await collect()).toEqual([{ type: "status", message: "a" }, done]);
  });

  it("says the connection dropped when the body breaks mid-turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond([frame({ type: "status", message: "a" })], new TypeError("network error")))
    );
    await expect(collect()).rejects.toBeInstanceOf(StreamDropped);
  });

  it("says the connection dropped when the body ends without done", async () => {
    // A proxy closing the connection cleanly looks like a normal end — and was
    // taken for a finished turn with whatever files had arrived.
    vi.stubGlobal("fetch", vi.fn(async () => respond([frame({ type: "status", message: "a" })])));
    await expect(collect()).rejects.toBeInstanceOf(StreamDropped);
  });

  it("says the connection dropped when the request never gets an answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    await expect(collect()).rejects.toBeInstanceOf(StreamDropped);
  });

  it("leaves the server's own error event to the caller, not as a drop", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond([frame({ type: "error", message: "สร้างไม่สำเร็จ" })])));
    const events = await collect();
    expect(events).toEqual([{ type: "error", message: "สร้างไม่สำเร็จ" }]);
  });

  it("does not call a cancel a drop", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        controller.abort();
        throw new DOMException("The user aborted a request.", "AbortError");
      })
    );
    const error = await collect(controller.signal).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(StreamDropped);
  });
});
