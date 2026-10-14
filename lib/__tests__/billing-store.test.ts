import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store's filters ARE the security boundary: which credentials count as
 * Billing's. A Billing credential reads every project — every workspace's and
 * everyone's personal ones — so what it may NOT do is be a FITT Voice token or a
 * revoked one. Every other billing test
 * mocks the store away, so these run it against an in-memory stand-in for the
 * Supabase query builder that applies eq / is / in / range like PostgREST —
 * including its 1000-row cap when no range is asked for.
 */

type Row = Record<string, unknown>;
const MAX_ROWS = 1000;
const tables: Record<string, Row[]> = {};

function query(table: string) {
  let rows = [...(tables[table] ?? [])];
  let window: [number, number] | null = null;
  let single = false;
  const q = {
    select: () => q,
    update: () => q,
    order: () => q,
    eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), q),
    is: (col: string, v: unknown) => ((rows = rows.filter((r) => (r[col] ?? null) === v)), q),
    in: (col: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[col]))), q),
    range: (from: number, to: number) => ((window = [from, to]), q),
    maybeSingle: () => ((single = true), q),
    then: (resolve: (v: { data: unknown; error: null }) => void) => {
      const [from, to] = window ?? [0, MAX_ROWS - 1];
      const page = rows.slice(from, Math.min(to + 1, from + MAX_ROWS));
      resolve({ data: single ? (page[0] ?? null) : page, error: null });
    },
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => query(t) }) }));

const { findBillingBinding, loadSnapshot, loadProjectBundle } = await import("@/lib/billing/store");

const project = (id: string, org_id: string | null, owner_id = "u1"): Row => ({
  id,
  org_id,
  owner_id,
  name: id,
  phase: "build",
  active_version: "standard",
  files: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
});

describe("billing store boundaries", () => {
  it("accepts only live FITT_BILLING credentials", async () => {
    tables.fittbuilder_integration_bindings = [
      { id: "voice", org_id: "o1", token_hash: "h_voice", producer: "FITT_VOICE", revoked_at: null },
      { id: "revoked", org_id: null, token_hash: "h_revoked", producer: "FITT_BILLING", revoked_at: "2026-10-01T00:00:00Z" },
      { id: "live", org_id: null, token_hash: "h_live", producer: "FITT_BILLING", revoked_at: null },
    ];
    expect(await findBillingBinding("h_voice")).toBeNull();
    expect(await findBillingBinding("h_revoked")).toBeNull();
    expect(await findBillingBinding("h_live")).toMatchObject({ id: "live" });
  });

  it("lists every workspace's projects and personal ones, with whose they are", async () => {
    tables.fittbuilder_projects = [project("p1", "o1", "u1"), project("p2", "o2", "u2"), project("p3", null, "u2")];
    tables.fittbuilder_orgs = [
      { id: "o1", name: "Digital Value" },
      { id: "o2", name: "FITT" },
    ];
    tables.fittbuilder_profiles = [
      { id: "u1", name: "อั๋น", email: "a@example.com" },
      { id: "u2", name: null, email: "b@example.com" },
    ];
    tables.fittbuilder_project_quotes = [
      { project_id: "p2", version: "standard", payload: {}, updated_at: "2026-10-02T00:00:00Z" },
      { project_id: "p3", version: "standard", payload: {}, updated_at: "2026-10-02T00:00:00Z" },
    ];
    tables.fittbuilder_project_billing = [
      { project_id: "p3", status: "suspended", reason: "", changed_at: "2026-10-02T00:00:00Z", license_key_hash: null },
    ];
    const s = await loadSnapshot();
    expect(s.projects.map((p) => [p.id, p.org_id, p.owner_id])).toEqual([
      ["p1", "o1", "u1"],
      ["p2", "o2", "u2"],
      ["p3", null, "u2"],
    ]);
    expect(s.quotes.map((q) => q.project_id)).toEqual(["p2", "p3"]);
    expect(s.billing.map((b) => b.project_id)).toEqual(["p3"]);
    expect(s.orgs).toEqual([
      { id: "o1", name: "Digital Value" },
      { id: "o2", name: "FITT" },
    ]);
    expect(s.owners).toEqual([
      { id: "u1", name: "อั๋น", email: "a@example.com" },
      { id: "u2", name: null, email: "b@example.com" },
    ]);
  });

  it("reads every project when there are more than one page of them", async () => {
    tables.fittbuilder_projects = Array.from({ length: 1005 }, (_, i) => project(`p${String(i).padStart(4, "0")}`, i % 2 ? "o1" : null));
    const s = await loadSnapshot();
    expect(s.projects).toHaveLength(1005);
  });

  it("finds a personal project by id, with its owner and no workspace", async () => {
    tables.fittbuilder_projects = [project("p_personal", null, "u1")];
    tables.fittbuilder_profiles = [{ id: "u1", name: "อั๋น", email: "a@example.com" }];
    const b = await loadProjectBundle("p_personal");
    expect(b).toMatchObject({
      project: { id: "p_personal" },
      org: null,
      owner: { id: "u1", name: "อั๋น", email: "a@example.com" },
    });
  });

  it("names the workspace of a workspace project", async () => {
    tables.fittbuilder_projects = [project("p1", "o1", "u1")];
    tables.fittbuilder_orgs = [{ id: "o1", name: "Digital Value" }];
    expect(await loadProjectBundle("p1")).toMatchObject({ org: { id: "o1", name: "Digital Value" } });
  });

  it("answers null for a project that does not exist", async () => {
    tables.fittbuilder_projects = [project("p1", "o1")];
    expect(await loadProjectBundle("p_missing")).toBeNull();
  });
});
