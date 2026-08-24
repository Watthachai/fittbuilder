import { describe, expect, it, vi } from "vitest";
import { awaitImages, type Decodable } from "@/lib/print-sheet";

/**
 * The bug these guard against: the quotation printed its screenshot appendix
 * after a two-frame (~32 ms) wait, so whether a picture appeared in the PDF
 * depended on whether the browser had it cached. The fix waits on decode() —
 * which means the failure modes of decode() are now what can break printing.
 */

/** An image the browser already holds — `decode()` must not be called at all. */
const cached = (): Decodable & { calls: number } => {
  const img = {
    complete: true,
    naturalWidth: 800,
    calls: 0,
    decode() {
      img.calls++;
      return Promise.resolve();
    },
  };
  return img;
};

/** An image that will load, once. */
const loads = (): Decodable => ({
  complete: false,
  naturalWidth: 0,
  decode: () => Promise.resolve(),
});

/** A 404 — `decode()` rejects. */
const broken = (): Decodable => ({
  complete: false,
  naturalWidth: 0,
  decode: () => Promise.reject(new Error("EncodingError")),
});

/** A request that never comes back. */
const hangs = (): Decodable => ({
  complete: false,
  naturalWidth: 0,
  decode: () => new Promise(() => {}),
});

describe("awaitImages", () => {
  it("resolves immediately when there is nothing to wait for", async () => {
    await expect(awaitImages([])).resolves.toBeUndefined();
  });

  it("does not re-decode an image the browser already has", async () => {
    const img = cached();
    await awaitImages([img]);
    expect(img.calls).toBe(0);
  });

  it("waits for every pending image before resolving", async () => {
    const order: string[] = [];
    const slow: Decodable = {
      complete: false,
      naturalWidth: 0,
      decode: () => new Promise((r) => setTimeout(() => (order.push("decoded"), r(null)), 50)),
    };
    await awaitImages([slow]);
    order.push("printed");
    expect(order).toEqual(["decoded", "printed"]);
  });

  it("treats a failed image as settled — one 404 must not block the document", async () => {
    await expect(awaitImages([broken(), loads()])).resolves.toBeUndefined();
  });

  it("gives up on a hung request so the print button always fires", async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      const waiting = awaitImages([hangs()], 8_000).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(7_999);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await waiting;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a fast page is not slowed to the timeout", async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      const waiting = awaitImages([loads(), loads()], 8_000).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(0);
      await waiting;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
