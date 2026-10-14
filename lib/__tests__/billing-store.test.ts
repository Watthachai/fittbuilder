import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store's filters ARE the security boundary: the workspace a token may
 * read, and which credentials count as Billing's. Every other billing test
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

const { findBillingBinding, loadOrgSnapshot, loadProjectBundle } = await import("@/lib/billing/store");

const project = (id: string, org_id: string): Row => ({
  id,
  org_id,
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
      { id: "revoked", org_id: "o1", token_hash: "h_revoked", producer: "FITT_BILLING", revoked_at: "2026-10-01T00:00:00Z" },
      { id: "live", org_id: "o1", token_hash: "h_live", producer: "FITT_BILLING", revoked_at: null },
    ];
    expect(await findBillingBinding("h_voice")).toBeNull();
    expect(await findBillingBinding("h_revoked")).toBeNull();
    expect(await findBillingBinding("h_live")).toMatchObject({ id: "live", org_id: "o1" });
  });

  it("never returns another workspace's project", async () => {
    tables.fittbuilder_projects = [project("p_other", "o2")];
    expect(await loadProjectBundle("o1", "p_other")).toBeNull();
  });

  it("lists only the workspace's projects and their documents", async () => {
    tables.fittbuilder_projects = [project("p1", "o1"), project("p2", "o2")];
    tables.fittbuilder_project_quotes = [
      { project_id: "p1", version: "standard", payload: {}, updated_at: "2026-10-02T00:00:00Z" },
      { project_id: "p2", version: "standard", payload: {}, updated_at: "2026-10-02T00:00:00Z" },
    ];
    tables.fittbuilder_project_billing = [
      { project_id: "p2", status: "suspended", reason: "", changed_at: "2026-10-02T00:00:00Z", license_key_hash: null },
    ];
    const s = await loadOrgSnapshot("o1");
    expect(s.projects.map((p) => p.id)).toEqual(["p1"]);
    expect(s.quotes.map((q) => q.project_id)).toEqual(["p1"]);
    expect(s.billing).toEqual([]);
  });

  it("reads every project of a workspace larger than one page", async () => {
    tables.fittbuilder_projects = Array.from({ length: 1005 }, (_, i) => project(`p${String(i).padStart(4, "0")}`, "o1"));
    const s = await loadOrgSnapshot("o1");
    expect(s.projects).toHaveLength(1005);
  });
});
