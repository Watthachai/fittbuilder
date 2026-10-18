import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { DeliveryRow, DeployEventRow } from "@/lib/deploy/types";

const auth = { result: { ok: true, binding: { id: "bind_1" } } as unknown };
vi.mock("@/lib/deploy/authenticate", () => ({ authenticateDeploy: async () => auth.result }));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const data = {
  project: null as { id: string; name: string; delivery: DeliveryRow | null } | null,
  deliveries: [] as DeliveryRow[],
  events: [] as DeployEventRow[],
  inserted: [] as unknown[],
  passwords: [] as unknown[][],
  fail: false,
};
const maybeFail = () => {
  if (data.fail) throw new Error("db down");
};
vi.mock("@/lib/deploy/store", () => ({
  loadDeployProject: async () => (maybeFail(), data.project),
  loadCloudDeliveries: async () => (maybeFail(), data.deliveries),
  loadUatEvents: async () => (maybeFail(), data.events),
  insertDeployEvent: async (e: unknown) => (maybeFail(), data.inserted.push(e)),
  storeInitialPassword: async (...args: unknown[]) => (maybeFail(), data.passwords.push(args)),
}));
const limit = { ok: true, retryAfter: 0 };
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => limit }));

const { open } = await import("@/lib/deploy/secret-box");
const project = await import("../../app/v1/integrations/deploy/projects/[id]/route");
const events = await import("../../app/v1/integrations/deploy/projects/[id]/events/route");
const pending = await import("../../app/v1/integrations/deploy/pending/route");

const req = (path: string, init: RequestInit = {}) =>
  new Request(`http://builder.test/v1/integrations/deploy${path}`, { ...init, headers: { authorization: "Bearer fbd_x", "content-type": "application/json", ...(init.headers ?? {}) } });
const getProject = (id: string) => project.GET(req(`/projects/${id}`), { params: Promise.resolve({ id }) });
const postEvent = (body: unknown, id = PROJECT_ID) =>
  events.POST(req(`/projects/${id}/events`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const cloud: DeliveryRow = { project_id: PROJECT_ID, target: "cloud", admin_email: "admin@customer.test", updated_at: "2026-10-18T00:00:00Z" };
const PASSWORD = "Initial-Pw-" + "q".repeat(16);
const DIGEST = "sha256:" + "a".repeat(64);

beforeEach(() => {
  auth.result = { ok: true, binding: { id: "bind_1" } };
  data.project = { id: PROJECT_ID, name: "Shop", delivery: cloud };
  data.deliveries = [cloud];
  data.events = [];
  data.inserted = [];
  data.passwords = [];
  data.fail = false;
  limit.ok = true;
  limit.retryAfter = 0;
  process.env.FITT_DEPLOY_SECRET_KEY = randomBytes(32).toString("base64");
});

describe("GET /v1/integrations/deploy/projects/{id}", () => {
  it("tells the deploy side what the project wants", async () => {
    const r = await getProject(PROJECT_ID);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ project_id: PROJECT_ID, name: "Shop", target: "cloud", admin_email: "admin@customer.test" });
  });

  it("answers local for a project nobody chose for", async () => {
    data.project = { id: PROJECT_ID, name: "Shop", delivery: null };
    expect(await (await getProject(PROJECT_ID)).json()).toMatchObject({ target: "local", admin_email: "" });
  });

  it("speaks the shared error envelope", async () => {
    data.project = null;
    expect((await getProject(PROJECT_ID)).status).toBe(404);
    expect((await getProject("not-a-uuid")).status).toBe(404);
    auth.result = { ok: false, code: "unauthorized", message: "no" };
    const unauth = await getProject(PROJECT_ID);
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({ schemaVersion: "fittbuilder.error.v1", code: "unauthorized", retryable: false });
    auth.result = { ok: true, binding: { id: "bind_1" } };
    limit.ok = false;
    limit.retryAfter = 7;
    const limited = await getProject(PROJECT_ID);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("7");
    limit.ok = true;
    data.fail = true;
    const down = await getProject(PROJECT_ID);
    expect(down.status).toBe(500);
    expect(await down.json()).toMatchObject({ retryable: true });
  });
});

describe("GET /v1/integrations/deploy/pending", () => {
  it("lists the cloud projects still waiting", async () => {
    const r = await pending.GET(req("/pending"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ projects: [{ project_id: PROJECT_ID }] });
    data.events = [{ project_id: PROJECT_ID, env: "uat", stage: "ready", build_no: 3, digest: null, url: null, message: "", at: "2026-10-18T01:00:00Z" }];
    expect(await (await pending.GET(req("/pending"))).json()).toEqual({ projects: [] });
  });
});

describe("POST /v1/integrations/deploy/projects/{id}/events", () => {
  it("keeps an event, and the password apart from it, sealed", async () => {
    const r = await postEvent({ env: "uat", stage: "ready", build_no: 3, digest: DIGEST, url: "https://uat-shop.a.run.app", message: "", initial_admin_password: PASSWORD });
    expect(r.status).toBe(202);
    expect(data.inserted).toEqual([{ project_id: PROJECT_ID, env: "uat", stage: "ready", build_no: 3, digest: DIGEST, url: "https://uat-shop.a.run.app", message: "", binding_id: "bind_1" }]);
    expect(JSON.stringify(data.inserted)).not.toContain(PASSWORD);
    const [[id, env, sealed]] = data.passwords as [string, string, string][];
    expect([id, env]).toEqual([PROJECT_ID, "uat"]);
    expect(sealed).not.toContain(PASSWORD);
    expect(open(sealed)).toBe(PASSWORD);
  });

  it("refuses what the deploy side should never send", async () => {
    for (const bad of [
      { env: "staging", stage: "ready" },
      { env: "uat", stage: "done" },
      { env: "uat", stage: "failed", initial_admin_password: PASSWORD },
      { env: "uat", stage: "ready", initial_admin_password: "short" },
      { env: "uat", stage: "ready", digest: "latest" },
      { env: "uat", stage: "ready", url: "http://plain.example" },
      { env: "uat", stage: "ready", build_no: -1 },
      { env: "uat", stage: "failed", message: "x".repeat(2001) },
    ]) {
      const r = await postEvent(bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "invalid_request" });
    }
    expect((await postEvent("{not json")).status).toBe(400);
    expect(data.inserted).toEqual([]);
  });

  it("stores nothing when it cannot seal, so the deploy side tries again", async () => {
    delete process.env.FITT_DEPLOY_SECRET_KEY;
    const r = await postEvent({ env: "uat", stage: "ready", initial_admin_password: PASSWORD });
    expect(r.status).toBe(500);
    expect(await r.json()).toMatchObject({ retryable: true });
    expect(data.inserted).toEqual([]);
    expect(data.passwords).toEqual([]);
  });

  it("answers 404 for a project that does not exist", async () => {
    data.project = null;
    expect((await postEvent({ env: "uat", stage: "deploying" })).status).toBe(404);
    expect(data.inserted).toEqual([]);
  });
});
