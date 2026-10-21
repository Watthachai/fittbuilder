import { beforeEach, expect, it, vi } from "vitest";

// Sending to Code Runner is the team's: the route answers a partner before it
// does anything else. The rate limiter stands in for "everything after".
const state = { admin: null as { id: string } | null };
const limiter = vi.fn(async () => ({ ok: false as const, retryAfter: 7 }));
vi.mock("@/lib/admin-server", () => ({ getAdminUser: async () => state.admin }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "1.2.3.4", rateLimit: limiter }));

const { POST } = await import("../../app/api/fittcore/route");
const send = () => POST(new Request("http://x/api/fittcore", { method: "POST", body: "{}" }));

beforeEach(() => {
  state.admin = null;
  limiter.mockClear();
});

it("answers 403 to anyone off the team, before rate limiting or reading the body", async () => {
  const r = await send();
  expect(r.status).toBe(403);
  expect(limiter).not.toHaveBeenCalled();
});

it("lets the team through to the rest of the route", async () => {
  state.admin = { id: "staff-1" };
  const r = await send();
  expect(r.status).toBe(429);
  expect(limiter).toHaveBeenCalledOnce();
});
