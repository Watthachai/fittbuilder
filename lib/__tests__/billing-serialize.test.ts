import { describe, expect, it } from "vitest";
import { emptyRow, newDoc, quoteTotals, type QuoteDoc } from "@/lib/quote";
import { pageOf, parseListQuery, projectDetail, projectSummaries } from "@/lib/billing/serialize";
import type { BillingSnapshot, ProjectBundle } from "@/lib/billing/types";
import type { Json } from "@/lib/db/types";

const TODAY = "2026-10-14";

function quote(over: Partial<QuoteDoc> = {}): QuoteDoc {
  const doc = newDoc([], "คลังสินค้า", TODAY);
  return {
    ...doc,
    quoteNo: "SQPDV-0001",
    customerName: "บริษัท ตัวอย่าง จำกัด",
    customerAttn: "คุณสมชาย",
    rows: [{ ...emptyRow(), name: "หน้ารับสินค้า", days: 3 }],
    ...over,
  };
}

function bundle(over: Partial<ProjectBundle> = {}): ProjectBundle {
  return {
    project: {
      id: "p1",
      name: "คลังสินค้า",
      phase: "build",
      active_version: "standard",
      org_id: "org_1",
      owner_id: "u1",
      runner_last: null,
      created_at: "2026-09-01T03:00:00Z",
      updated_at: "2026-10-13T09:12:00Z",
      files: { "docs/BRD.md": "# BRD", "docs/PRD.md": "# PRD" },
    },
    org: { id: "org_1", name: "Digital Value" },
    owner: { id: "u1", name: "อั๋น", email: "a@example.com" },
    quotes: [{ project_id: "p1", version: "standard", payload: quote() as unknown as Json, updated_at: "2026-10-13T10:00:00Z" }],
    proposals: [],
    billing: null,
    ...over,
  };
}

describe("projectDetail", () => {
  it("carries the quotation with the totals the editor prints", () => {
    const d = projectDetail(bundle(), TODAY);
    expect(d.schemaVersion).toBe("fittbuilder.billing.project.v1");
    expect(d.project).toMatchObject({
      id: "p1",
      orgId: "org_1",
      orgName: "Digital Value",
      ownerId: "u1",
      ownerName: "อั๋น",
      ownerEmail: "a@example.com",
      activeVersion: "standard",
    });
    expect(d.quotes.standard?.totals).toEqual(quoteTotals(quote()));
    expect(d.quotes.standard?.quoteNo).toBe("SQPDV-0001");
    expect(d.quotes.premium).toBeNull();
    expect(d.customer).toEqual({ name: "บริษัท ตัวอย่าง จำกัด", attn: "คุณสมชาย", address: "", phone: "" });
    expect(d.documents).toEqual({ brd: "# BRD", prd: "# PRD" });
    expect(d.billing).toEqual({ status: "active", reason: "", changedAt: null, licenseKeyIssued: false });
  });

  it("names no workspace for a personal project, and still names its owner", () => {
    const b = bundle({ org: null });
    const d = projectDetail({ ...b, project: { ...b.project, org_id: null } }, TODAY);
    expect(d.project).toMatchObject({ orgId: null, orgName: null, ownerId: "u1", ownerName: "อั๋น", ownerEmail: "a@example.com" });
  });

  it("keeps the owner's id when their profile is gone", () => {
    const d = projectDetail(bundle({ owner: null }), TODAY);
    expect(d.project).toMatchObject({ ownerId: "u1", ownerName: null, ownerEmail: null });
  });

  it("says when the project was last sent to Code Runner to build, and null when never", () => {
    expect(projectDetail(bundle(), TODAY).build).toBeNull();
    const b = bundle();
    const sent = { jobId: "job-1", state: "QUEUED", tag: "alpha-test", sentAt: "2026-10-10T02:00:00Z" };
    expect(projectDetail({ ...b, project: { ...b.project, runner_last: sent } }, TODAY).build).toEqual({
      sentAt: "2026-10-10T02:00:00.000Z",
      jobId: "job-1",
      buildNo: null,
    });
    // Always sent as UTC ISO 8601, however it was stored.
    const local = { ...sent, sentAt: "2026-10-10T09:00:00+07:00" };
    expect(projectDetail({ ...b, project: { ...b.project, runner_last: local } }, TODAY).build?.sentAt).toBe("2026-10-10T02:00:00.000Z");
    // Rows saved before the Gateway migration carry a build number.
    expect(projectDetail({ ...b, project: { ...b.project, runner_last: { ...sent, buildNo: 12 } } }, TODAY).build?.buildNo).toBe(12);
  });

  it("treats an unreadable build hand-off as never sent", () => {
    const b = bundle();
    for (const bad of ["sent", [], { jobId: "job-1" }, { sentAt: "not a time", jobId: "job-1" }]) {
      expect(projectDetail({ ...b, project: { ...b.project, runner_last: bad } }, TODAY).build).toBeNull();
    }
  });

  it("sends the MA billing cycle", () => {
    const q = quote();
    const d = projectDetail(
      bundle({ quotes: [{ project_id: "p1", version: "standard", payload: { ...q, ma: { ...q.ma, enabled: true, billingCycle: "yearly" } } as unknown as Json, updated_at: "2026-10-13T10:00:00Z" }] }),
      TODAY
    );
    expect(d.quotes.standard?.maintenance).toMatchObject({ enabled: true, billingCycle: "yearly" });
  });

  it("answers a bare project with nulls, not an error", () => {
    const d = projectDetail(bundle({ quotes: [], proposals: [], project: { ...bundle().project, files: null } }), TODAY);
    expect(d.customer).toBeNull();
    expect(d.quotes).toEqual({ standard: null, premium: null });
    expect(d.proposals).toEqual({ standard: null, premium: null });
    expect(d.documents).toEqual({ brd: null, prd: null });
  });

  it("marks a lump sum so the rows are not added up again", () => {
    const q = quote({ lumpSum: { ...quote().lumpSum, enabled: true, amount: 50_000 } });
    const d = projectDetail(
      bundle({ quotes: [{ project_id: "p1", version: "standard", payload: q as unknown as Json, updated_at: "2026-10-13T10:00:00Z" }] }),
      TODAY
    );
    expect(d.quotes.standard?.lumpSum).toEqual({ enabled: true, amount: 50_000 });
    expect(d.quotes.standard?.totals.subtotal).toBe(50_000);
  });

  it("reports a suspension and whether a licence key exists", () => {
    const d = projectDetail(
      bundle({ billing: { project_id: "p1", status: "suspended", reason: "ค้างชำระ", changed_at: "2026-10-14T01:00:00Z", license_key_hash: "a".repeat(64) } }),
      TODAY
    );
    expect(d.billing).toEqual({ status: "suspended", reason: "ค้างชำระ", changedAt: "2026-10-14T01:00:00Z", licenseKeyIssued: true });
  });
});

describe("projectSummaries and paging", () => {
  const snapshot: BillingSnapshot = {
    projects: [
      { id: "a", name: "A", phase: "define", active_version: "standard", org_id: "org_1", owner_id: "u1", runner_last: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      // A personal project: no workspace.
      { id: "b", name: "B", phase: "build", active_version: "standard", org_id: null, owner_id: "u2", runner_last: { jobId: "job-b", state: "QUEUED", tag: "alpha-test", sentAt: "2026-10-01T12:00:00Z" }, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
    ],
    // A quotation edited later than its project moves the project's updatedAt.
    quotes: [{ project_id: "a", version: "standard", payload: quote() as unknown as Json, updated_at: "2026-10-05T00:00:00Z" }],
    proposals: [],
    billing: [],
    orgs: [{ id: "org_1", name: "Digital Value" }],
    owners: [
      { id: "u1", name: "อั๋น", email: "a@example.com" },
      { id: "u2", name: null, email: "b@example.com" },
    ],
  };

  it("says whose each project is: its workspace, or none for a personal one, and its owner", () => {
    const s = projectSummaries(snapshot, TODAY);
    expect(s.find((x) => x.id === "a")).toMatchObject({ orgId: "org_1", orgName: "Digital Value", ownerId: "u1", ownerName: "อั๋น" });
    expect(s.find((x) => x.id === "b")).toMatchObject({ orgId: null, orgName: null, ownerId: "u2", ownerName: null });
  });

  it("says when each project was last sent to build", () => {
    const s = projectSummaries(snapshot, TODAY);
    expect(s.find((x) => x.id === "a")?.buildSentAt).toBeNull();
    expect(s.find((x) => x.id === "b")?.buildSentAt).toBe("2026-10-01T12:00:00.000Z");
  });

  it("takes the latest change across the project and its documents, oldest first", () => {
    const s = projectSummaries(snapshot, TODAY);
    expect(s.map((x) => [x.id, x.updatedAt])).toEqual([
      ["b", "2026-10-02T00:00:00.000Z"],
      ["a", "2026-10-05T00:00:00.000Z"],
    ]);
    expect(s[1]).toMatchObject({ customerName: "บริษัท ตัวอย่าง จำกัด", quoteNo: "SQPDV-0001", billingStatus: "active" });
    expect(s[0]).toMatchObject({ customerName: null, quoteNo: null });
  });

  it("filters by updatedSince and pages with a cursor", () => {
    const all = projectSummaries(snapshot, TODAY);
    const first = pageOf(all, { updatedSince: null, limit: 1, cursor: null });
    expect(first.items.map((x) => x.id)).toEqual(["b"]);
    expect(first.nextCursor).not.toBeNull();
    const q = parseListQuery(new URLSearchParams({ cursor: first.nextCursor!, limit: "1" }));
    if (!q.ok) throw new Error(q.message);
    const second = pageOf(all, q);
    expect(second.items.map((x) => x.id)).toEqual(["a"]);
    expect(second.nextCursor).toBeNull();
    const since = parseListQuery(new URLSearchParams({ updatedSince: "2026-10-03T00:00:00Z" }));
    if (!since.ok) throw new Error(since.message);
    expect(pageOf(all, since).items.map((x) => x.id)).toEqual(["a"]);
  });

  it("includes a change stamped exactly at updatedSince, so a re-query from the last seen time misses nothing", () => {
    const all = projectSummaries(snapshot, TODAY);
    const q = parseListQuery(new URLSearchParams({ updatedSince: "2026-10-02T00:00:00Z" }));
    if (!q.ok) throw new Error(q.message);
    expect(pageOf(all, q).items.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("refuses malformed parameters", () => {
    const bads: Record<string, string>[] = [{ limit: "abc" }, { limit: "0" }, { limit: "500" }, { cursor: "garbage" }, { updatedSince: "yesterday" }];
    for (const bad of bads) {
      expect(parseListQuery(new URLSearchParams(bad)).ok).toBe(false);
    }
    expect(parseListQuery(new URLSearchParams())).toEqual({ ok: true, updatedSince: null, limit: 50, cursor: null });
  });
});
