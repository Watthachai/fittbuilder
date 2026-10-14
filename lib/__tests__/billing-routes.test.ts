import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgSnapshot, ProjectBundle } from "@/lib/billing/types";

const auth = { result: { ok: true, binding: { id: "bind_1", org_id: "org_1" } } as unknown };
vi.mock("@/lib/billing/authenticate", () => ({ authenticateBilling: async () => auth.result }));

const data = {
  snapshot: { projects: [], quotes: [], proposals: [], billing: [] } as OrgSnapshot,
  bundle: null as ProjectBundle | null,
  fail: false,
  bundleArgs: [] as [string, string][],
};
vi.mock("@/lib/billing/store", () => ({
  loadOrgSnapshot: async () => {
    if (data.fail) throw new Error("db down");
    return data.snapshot;
  },
  loadProjectBundle: async (orgId: string, projectId: string) => {
    data.bundleArgs.push([orgId, projectId]);
    if (data.fail) throw new Error("db down");
    return data.bundle;
  },
}));
const limit = { ok: true, retryAfter: 0 };
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => limit }));

const list = await import("../../app/v1/integrations/billing/projects/route");
const detail = await import("../../app/v1/integrations/billing/projects/[id]/route");

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const get = (path: string) => new Request(`http://builder.test/v1/integrations/billing${path}`, { headers: { authorization: "Bearer fbb_x" } });
const getDetail = (id: string) => detail.GET(get(`/projects/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  auth.result = { ok: true, binding: { id: "bind_1", org_id: "org_1" } };
  data.snapshot = {
    projects: [{ id: PROJECT_ID, name: "A", phase: "build", active_version: "standard", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }],
    quotes: [],
    proposals: [],
    billing: [],
  };
  data.bundle = null;
  data.fail = false;
  data.bundleArgs = [];
  limit.ok = true;
});

describe("GET /v1/integrations/billing/projects", () => {
  it("lists the workspace's projects", async () => {
    const res = await list.GET(get("/projects"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ items: [{ id: PROJECT_ID, name: "A", billingStatus: "active" }], nextCursor: null });
  });

  it("refuses a bad token with the error envelope", async () => {
    auth.result = { ok: false, code: "unauthorized", message: "token ไม่ถูกต้องหรือถูกยกเลิกแล้ว" };
    const res = await list.GET(get("/projects"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.error.v1", code: "unauthorized", retryable: false });
  });

  it("answers 400 for malformed parameters, not 500", async () => {
    for (const q of ["?limit=abc", "?limit=0", "?limit=500", "?cursor=garbage", "?updatedSince=yesterday"]) {
      const res = await list.GET(get(`/projects${q}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "invalid_request" });
    }
  });

  it("answers 429 with Retry-After when over the rate", async () => {
    limit.ok = false;
    limit.retryAfter = 9;
    const res = await list.GET(get("/projects"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("9");
  });

  it("answers 500 internal, retryable, when the database fails", async () => {
    data.fail = true;
    const res = await list.GET(get("/projects"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "internal", retryable: true });
  });
});

describe("GET /v1/integrations/billing/projects/{id}", () => {
  it("reads only within the token's workspace and answers 404 outside it", async () => {
    const res = await getDetail(PROJECT_ID);
    expect(res.status).toBe(404);
    expect(data.bundleArgs).toEqual([["org_1", PROJECT_ID]]);
  });

  it("answers 404 for an id that is not a UUID, without asking the database", async () => {
    const res = await getDetail("not-a-uuid");
    expect(res.status).toBe(404);
    expect(data.bundleArgs).toEqual([]);
  });

  it("returns the project detail", async () => {
    data.bundle = {
      project: { id: PROJECT_ID, name: "A", phase: "build", active_version: "standard", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", files: null },
      orgId: "org_1",
      orgName: "Digital Value",
      quotes: [],
      proposals: [],
      billing: null,
    };
    const res = await getDetail(PROJECT_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.billing.project.v1", project: { id: PROJECT_ID, orgName: "Digital Value" } });
  });
});
