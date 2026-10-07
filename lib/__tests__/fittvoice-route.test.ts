import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The receiver route's own decisions: what it answers before the database is
 * asked, and how it wraps what the database decided. The database function's
 * rules (duplicate, stale, conflict, finalized, cross-workspace) are exercised
 * against Postgres separately; here its answers are given.
 */

const binding = { data: { id: "binding_1" } as { id: string } | null, error: null as { message: string } | null };
const apply = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => binding }) }) }) }),
    }),
    rpc: apply,
  }),
}));
const limit = { ok: true, retryAfter: 0 };
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => limit }));

const { POST } = await import("../../app/v1/integrations/fittvoice/deliveries/route");

const body = readFileSync(join(__dirname, "fixtures/fittvoice/batch-create.json"), "utf8");
const post = (opts: { auth?: string | null; key?: string; type?: string; raw?: string } = {}) => {
  const headers: Record<string, string> = { "content-type": opts.type ?? "application/json", "idempotency-key": opts.key ?? "del_synthetic_batch_1" };
  if (opts.auth !== null) headers.authorization = opts.auth ?? "Bearer fvb_test";
  return POST(new Request("http://builder.test/v1/integrations/fittvoice/deliveries", { method: "POST", headers, body: opts.raw ?? body }));
};

beforeEach(() => {
  binding.data = { id: "binding_1" };
  binding.error = null;
  limit.ok = true;
  apply.mockReset();
});

describe("POST /v1/integrations/fittvoice/deliveries", () => {
  it("refuses a missing or unknown credential before reading the body", async () => {
    expect((await post({ auth: null })).status).toBe(401);
    binding.data = null;
    const res = await post();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.error.v1", code: "UNAUTHORIZED", retryable: false });
    expect(apply).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After when the credential is over its rate", async () => {
    limit.ok = false;
    limit.retryAfter = 17;
    const res = await post();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("17");
    expect(await res.json()).toMatchObject({ code: "RATE_LIMITED", retryable: true });
  });

  it("refuses more than 1 MiB without cutting anything", async () => {
    const res = await post({ raw: JSON.stringify({ ...JSON.parse(body), pad: "x".repeat(1024 * 1024) }) });
    expect(res.status).toBe(413);
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON, and a payload that fails its checks, before writing", async () => {
    expect((await post({ type: "text/plain" })).status).toBe(422);
    expect((await post({ key: "del_other" })).status).toBe(422);
    expect(apply).not.toHaveBeenCalled();
  });

  it("returns the database's receipt with its status, for the bound credential", async () => {
    const receipt = { schemaVersion: "fittbuilder.receipt.v1", outcome: "APPLIED", builderProjectId: "p1" };
    apply.mockResolvedValue({ data: { status: 201, body: receipt }, error: null });
    const res = await post();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(receipt);
    expect(apply).toHaveBeenCalledWith("fittbuilder_fittvoice_apply", expect.objectContaining({ p_binding: "binding_1" }));
  });

  it("wraps the database's refusal in the error envelope", async () => {
    apply.mockResolvedValue({ data: { status: 409, body: { code: "STALE_REVISION", message: "มีฉบับใหม่กว่าแล้ว", latestSnapshotRevision: 3 } }, error: null });
    const res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "STALE_REVISION", retryable: false, latestSnapshotRevision: 3 });
  });

  it("answers 503, retryable, when the database cannot be reached", async () => {
    apply.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const res = await post();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "TEMPORARILY_UNAVAILABLE", retryable: true });
  });
});
