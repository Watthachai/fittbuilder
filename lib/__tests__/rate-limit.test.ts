import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

// With no UPSTASH_REDIS_REST_* env vars, rateLimit uses the in-memory sliding
// window. Each test uses a unique key to avoid the module-level Map bleeding
// between cases.
describe("rateLimit (in-memory fallback)", () => {
  it("allows up to max, then blocks", async () => {
    const key = `test-block-${Math.random()}`;
    const r1 = await rateLimit(key, 3, 60_000);
    const r2 = await rateLimit(key, 3, 60_000);
    const r3 = await rateLimit(key, 3, 60_000);
    const r4 = await rateLimit(key, 3, 60_000);
    expect([r1.ok, r2.ok, r3.ok]).toEqual([true, true, true]);
    expect(r4.ok).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
  });

  it("keys are independent", async () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    await rateLimit(a, 1, 60_000);
    const blockedA = await rateLimit(a, 1, 60_000);
    const freshB = await rateLimit(b, 1, 60_000);
    expect(blockedA.ok).toBe(false);
    expect(freshB.ok).toBe(true);
  });
});
