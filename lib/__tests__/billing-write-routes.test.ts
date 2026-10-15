import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { billingOpenApi } from "@/lib/billing/openapi";

/**
 * Phase 2: FITT Billing suspends or reactivates a project's app and issues the
 * app's license key; the app asks its status with that key. The store is mocked
 * here — billing-store.test.ts and migration 0055 pin what it writes.
 */

const auth = { result: { ok: true, binding: { id: "bind_1" } } as unknown };
vi.mock("@/lib/billing/authenticate", () => ({ authenticateBilling: async () => auth.result }));

const store = {
  fail: false,
  statusResult: null as { status: string; reason: string; changed_at: string } | null,
  statusCalls: [] as unknown[][],
  licenseExists: true,
  licenseCalls: [] as [string, string][],
  licenseStatus: null as { status: string } | null,
  lookups: [] as string[],
};
vi.mock("@/lib/billing/store", () => ({
  setBillingStatus: async (...args: unknown[]) => {
    store.statusCalls.push(args);
    if (store.fail) throw new Error("db down");
    return store.statusResult;
  },
  setLicenseKeyHash: async (projectId: string, hash: string) => {
    store.licenseCalls.push([projectId, hash]);
    if (store.fail) throw new Error("db down");
    return store.licenseExists;
  },
  findLicenseStatus: async (hash: string) => {
    store.lookups.push(hash);
    if (store.fail) throw new Error("db down");
    return store.licenseStatus;
  },
}));
const limit = { ok: true, retryAfter: 0, keys: [] as string[] };
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async (key: string) => {
    limit.keys.push(key);
    return { ok: limit.ok, retryAfter: limit.retryAfter };
  },
}));

const status = await import("../../app/v1/integrations/billing/projects/[id]/status/route");
const license = await import("../../app/v1/integrations/billing/projects/[id]/license-key/route");
const serviceStatus = await import("../../app/v1/service-status/route");

const ID = "11111111-1111-4111-8111-111111111111";
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema({ $id: "billing", components: billingOpenApi.components });
/** The response matches what the OpenAPI document promises Billing and the apps. */
function matches(name: string, value: unknown) {
  const validate = ajv.getSchema(`billing#/components/schemas/${name}`) ?? ajv.compile({ $ref: `billing#/components/schemas/${name}` });
  validate(value);
  expect(validate.errors ?? [], name).toEqual([]);
}
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const put = (id: string, body: unknown) =>
  status.PUT(
    new Request(`http://builder.test/v1/integrations/billing/projects/${id}/status`, {
      method: "PUT",
      headers: { authorization: "Bearer fbb_x", "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
const post = (id: string) =>
  license.POST(new Request(`http://builder.test/v1/integrations/billing/projects/${id}/license-key`, { method: "POST", headers: { authorization: "Bearer fbb_x" } }), {
    params: Promise.resolve({ id }),
  });
const ask = (authorization?: string) =>
  serviceStatus.GET(new Request("http://builder.test/v1/service-status", { headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  auth.result = { ok: true, binding: { id: "bind_1" } };
  Object.assign(store, { fail: false, statusResult: null, statusCalls: [], licenseExists: true, licenseCalls: [], licenseStatus: null, lookups: [] });
  Object.assign(limit, { ok: true, retryAfter: 0, keys: [] });
});

describe("PUT /v1/integrations/billing/projects/{id}/status", () => {
  it("suspends with a reason, naming the credential that asked, and answers the state now", async () => {
    store.statusResult = { status: "suspended", reason: "ค้างชำระ", changed_at: "2026-10-15T10:00:00+07:00" };
    const res = await put(ID, { status: "suspended", reason: "  ค้างชำระ  " });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "suspended", reason: "ค้างชำระ", changedAt: "2026-10-15T03:00:00.000Z" });
    matches("BillingState", body);
    matches("StatusRequest", { status: "suspended", reason: "ค้างชำระ" });
    expect(store.statusCalls).toEqual([[ID, "suspended", "ค้างชำระ", "bind_1"]]);
  });

  it("reactivates without a reason", async () => {
    store.statusResult = { status: "active", reason: "", changed_at: "2026-10-15T03:00:00+00:00" };
    expect((await put(ID, { status: "active" })).status).toBe(200);
    expect(store.statusCalls).toEqual([[ID, "active", "", "bind_1"]]);
  });

  it("answers 400 for a body it can't act on, before touching the database", async () => {
    const bads: unknown[] = ["not json", [], { status: "paused" }, { status: "active", reason: 5 }, { status: "suspended", reason: "x".repeat(501) }];
    for (const bad of bads) {
      const res = await put(ID, bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.error.v1", code: "invalid_request" });
    }
    expect(store.statusCalls).toEqual([]);
  });

  it("answers 404 for a project that doesn't exist, or an id that isn't one", async () => {
    expect((await put(ID, { status: "active" })).status).toBe(404);
    expect((await put("nope", { status: "active" })).status).toBe(404);
    expect(store.statusCalls).toHaveLength(1);
  });

  it("refuses a bad token, rate-limits per credential, and answers 500 retryable when the database fails", async () => {
    auth.result = { ok: false, code: "unauthorized", message: "token ไม่ถูกต้องหรือถูกยกเลิกแล้ว" };
    expect((await put(ID, { status: "active" })).status).toBe(401);
    auth.result = { ok: true, binding: { id: "bind_1" } };
    limit.ok = false;
    limit.retryAfter = 7;
    const limited = await put(ID, { status: "active" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("7");
    expect(limit.keys).toEqual(["billing:bind_1"]);
    limit.ok = true;
    store.fail = true;
    const failed = await put(ID, { status: "active" });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ code: "internal", retryable: true });
  });
});

describe("POST /v1/integrations/billing/projects/{id}/license-key", () => {
  it("issues a key once, keeps only its SHA-256, and answers 201 uncached", async () => {
    const res = await post(ID);
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const issued = await res.json();
    matches("LicenseKey", issued);
    const { licenseKey } = issued;
    expect(licenseKey).toMatch(/^fbl_[A-Za-z0-9_-]{43}$/);
    expect(store.licenseCalls).toEqual([[ID, sha256(licenseKey)]]);
  });

  it("issues a different key every time", async () => {
    const a = (await (await post(ID)).json()).licenseKey;
    const b = (await (await post(ID)).json()).licenseKey;
    expect(a).not.toBe(b);
  });

  it("answers 404 for a project that doesn't exist", async () => {
    store.licenseExists = false;
    expect((await post(ID)).status).toBe(404);
    expect((await post("nope")).status).toBe(404);
  });
});

describe("GET /v1/service-status", () => {
  it("tells a suspended app what to show, and nothing else about the project", async () => {
    store.licenseStatus = { status: "suspended" };
    const res = await ask("Bearer fbl_key");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["checkedAt", "message", "status"]);
    expect(body).toMatchObject({ status: "suspended", message: "บริการถูกระงับชั่วคราว กรุณาติดต่อผู้ให้บริการ" });
    matches("ServiceStatus", body);
    expect(store.lookups).toEqual([sha256("fbl_key")]);
  });

  it("tells an active app it is active", async () => {
    store.licenseStatus = { status: "active" };
    expect(await (await ask("Bearer fbl_key")).json()).toMatchObject({ status: "active", message: "" });
  });

  it("answers 401 without a key, or for a key no project holds", async () => {
    expect((await ask()).status).toBe(401);
    expect((await ask("Bearer fbl_unknown")).status).toBe(401);
  });

  it("rate-limits per key without naming the key, and answers 500 retryable when the database fails", async () => {
    limit.ok = false;
    expect((await ask("Bearer fbl_key")).status).toBe(429);
    expect(limit.keys).toHaveLength(1);
    expect(limit.keys[0]).not.toContain("fbl_key");
    limit.ok = true;
    store.fail = true;
    const failed = await ask("Bearer fbl_key");
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ code: "internal", retryable: true });
  });
});
