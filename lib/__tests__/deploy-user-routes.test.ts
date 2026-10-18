import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

// A minimal stand-in for the supabase-js query builder: every chain ends in a
// call to `handle`, which the test answers per table and operation.
type Call = { table: string; op: string; payload?: unknown; filters: unknown[][]; single: boolean; select?: string };
type Answer = { data: unknown; error: { code?: string; message: string } | null };
function client(handle: (c: Call) => Answer, extra: Record<string, unknown> = {}) {
  const from = (table: string) => {
    const c: Call = { table, op: "select", filters: [], single: false };
    const b: Record<string, unknown> = {};
    const chain = (fn: (...a: unknown[]) => void) => (...a: unknown[]) => (fn(...a), b);
    Object.assign(b, {
      select: chain((cols) => { if (c.op === "select") c.select = cols as string; else c.select = cols as string; }),
      upsert: chain((p) => { c.op = "upsert"; c.payload = p; }),
      update: chain((p) => { c.op = "update"; c.payload = p; }),
      eq: chain((col, v) => c.filters.push(["eq", col, v])),
      not: chain((col, o, v) => c.filters.push(["not", col, o, v])),
      order: chain(() => {}),
      limit: chain(() => {}),
      maybeSingle: () => { c.single = true; return Promise.resolve(handle(c)); },
      then: (res: (v: Answer) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(handle(c)).then(res, rej),
    });
    calls.push(c);
    return b;
  };
  return { from, ...extra };
}
let calls: Call[] = [];

const PID = "11111111-1111-4111-8111-111111111111";
const session = { user: { id: "user-1" } as { id: string } | null, canEdit: true };
const db = {
  project: { id: PID } as unknown,
  delivery: { project_id: PID, target: "cloud", admin_email: "admin@customer.test", updated_at: "2026-10-18T00:00:00Z" } as unknown,
  events: [] as unknown[],
  waiting: [{ env: "uat" }] as unknown[],
  sealed: null as string | null,
  upsertAnswer: null as Answer | null,
  updateRows: 1,
};
const userHandle = (c: Call): Answer => {
  if (c.table === "fittbuilder_projects") return { data: db.project, error: null };
  if (c.table === "fittbuilder_project_delivery" && c.op === "upsert") return db.upsertAnswer ?? { data: [{ project_id: PID }], error: null };
  if (c.table === "fittbuilder_project_delivery") return { data: db.delivery, error: null };
  if (c.table === "fittbuilder_project_deploy_events") return { data: db.events, error: null };
  return { data: null, error: { message: `unexpected ${c.table}` } };
};
const adminHandle = (c: Call): Answer => {
  if (c.table !== "fittbuilder_project_initial_passwords") return { data: null, error: { message: `unexpected admin ${c.table}` } };
  if (c.op === "update") return { data: Array.from({ length: db.updateRows }, () => ({ project_id: PID })), error: null };
  if (c.single) return { data: db.sealed ? { ciphertext: db.sealed } : null, error: null };
  return { data: db.waiting, error: null };
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () =>
    client(userHandle, {
      auth: { getUser: async () => ({ data: { user: session.user } }) },
      rpc: async (name: string) => ({ data: name === "fittbuilder_can_edit_project" ? session.canEdit : null, error: null }),
    }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client(adminHandle) }));

const { seal } = await import("@/lib/deploy/secret-box");
const cloudRoute = await import("../../app/api/projects/[id]/cloud/route");
const reveal = await import("../../app/api/projects/[id]/cloud/initial-password/route");
const ctx = (id = PID) => ({ params: Promise.resolve({ id }) });
const put = (body: unknown) => cloudRoute.PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(body) }), ctx());
const show = (env = "uat") => reveal.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ env }) }), ctx());
const ev = (env: string, stage: string, at: string, build_no = 3) => ({ project_id: PID, env, stage, build_no, digest: null, url: stage === "ready" ? "https://uat.a.run.app" : null, message: "", at });

beforeEach(() => {
  calls = [];
  session.user = { id: "user-1" };
  session.canEdit = true;
  db.project = { id: PID };
  db.events = [];
  db.waiting = [{ env: "uat" }];
  db.sealed = null;
  db.upsertAnswer = null;
  db.updateRows = 1;
  process.env.FITT_DEPLOY_SECRET_KEY = randomBytes(32).toString("base64");
});

describe("GET /api/projects/{id}/cloud", () => {
  it("needs a session, and a project the person can read", async () => {
    session.user = null;
    expect((await cloudRoute.GET(new Request("http://x"), ctx())).status).toBe(401);
    session.user = { id: "user-1" };
    db.project = null;
    expect((await cloudRoute.GET(new Request("http://x"), ctx())).status).toBe(404);
    expect((await cloudRoute.GET(new Request("http://x"), ctx("nope"))).status).toBe(404);
  });

  it("shows the choice, the newest event per environment and whether a password waits", async () => {
    db.events = [ev("uat", "ready", "2026-10-18T02:00:00Z"), ev("production", "deploying", "2026-10-18T01:30:00Z"), ev("uat", "deploying", "2026-10-18T01:00:00Z")];
    const r = await cloudRoute.GET(new Request("http://x"), ctx());
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ target: "cloud", admin_email: "admin@customer.test", needs_team: false, password_waiting: { uat: true, production: false } });
    expect(body.events.uat).toMatchObject({ stage: "ready", url: "https://uat.a.run.app" });
    expect(body.events.production).toMatchObject({ stage: "deploying" });
    expect(JSON.stringify(body)).not.toContain("ciphertext");
  });

  it("says when a person has to look", async () => {
    db.events = [ev("uat", "failed", "2026-10-18T03:00:00Z"), ev("uat", "failed", "2026-10-18T02:00:00Z"), ev("uat", "failed", "2026-10-18T01:00:00Z")];
    expect(await (await cloudRoute.GET(new Request("http://x"), ctx())).json()).toMatchObject({ needs_team: true });
  });
});

describe("PUT /api/projects/{id}/cloud", () => {
  it("refuses a cloud choice without a usable email", async () => {
    for (const bad of [{ target: "edge" }, { target: "cloud", admin_email: "" }, { target: "cloud", admin_email: "not-an-email" }, { target: "cloud", admin_email: `${"a".repeat(250)}@x.co` }]) {
      expect((await put(bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("saves through the person's own permissions", async () => {
    const r = await put({ target: "cloud", admin_email: "  Admin@Customer.test " });
    expect(r.status).toBe(200);
    const up = calls.find((c) => c.op === "upsert");
    expect(up?.payload).toMatchObject({ project_id: PID, target: "cloud", admin_email: "admin@customer.test" });
    expect((await put({ target: "local" })).status).toBe(200);
  });

  it("answers 403 when the database says the person may not edit", async () => {
    db.upsertAnswer = { data: null, error: { code: "42501", message: "row-level security" } };
    expect((await put({ target: "local" })).status).toBe(403);
    db.upsertAnswer = { data: [], error: null };
    expect((await put({ target: "local" })).status).toBe(403);
  });
});

describe("POST /api/projects/{id}/cloud/initial-password", () => {
  it("shows the password once, to someone who can edit the project", async () => {
    session.canEdit = false;
    expect((await show()).status).toBe(403);
    session.canEdit = true;
    expect((await show()).status).toBe(404);
    db.sealed = seal("Initial-Pw-qqqqqqqqqqqqqqqq");
    const r = await show();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ password: "Initial-Pw-qqqqqqqqqqqqqqqq" });
    const update = calls.find((c) => c.op === "update");
    expect(update?.payload).toMatchObject({ ciphertext: null, revealed_by: "user-1" });
    expect(update?.filters).toContainEqual(["eq", "ciphertext", db.sealed]);
  });

  it("a second reveal finds nothing, even when two clicks race", async () => {
    db.sealed = seal("Initial-Pw-qqqqqqqqqqqqqqqq");
    db.updateRows = 0; // the other click cleared it between our read and our update
    const r = await show();
    expect(r.status).toBe(404);
    expect(JSON.stringify(await r.json())).not.toContain("Initial-Pw");
  });

  it("refuses an environment that does not exist", async () => {
    expect((await show("staging")).status).toBe(400);
  });
});
