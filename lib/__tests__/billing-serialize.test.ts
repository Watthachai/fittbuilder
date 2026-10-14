import { describe, expect, it } from "vitest";
import { emptyRow, newDoc, quoteTotals, type QuoteDoc } from "@/lib/quote";
import { pageOf, parseListQuery, projectDetail, projectSummaries } from "@/lib/billing/serialize";
import type { ProjectBundle, OrgSnapshot } from "@/lib/billing/types";
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
      created_at: "2026-09-01T03:00:00Z",
      updated_at: "2026-10-13T09:12:00Z",
      files: { "docs/BRD.md": "# BRD", "docs/PRD.md": "# PRD" },
    },
    orgId: "org_1",
    orgName: "Digital Value",
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
    expect(d.project).toMatchObject({ id: "p1", orgId: "org_1", orgName: "Digital Value", activeVersion: "standard" });
    expect(d.quotes.standard?.totals).toEqual(quoteTotals(quote()));
    expect(d.quotes.standard?.quoteNo).toBe("SQPDV-0001");
    expect(d.quotes.premium).toBeNull();
    expect(d.customer).toEqual({ name: "บริษัท ตัวอย่าง จำกัด", attn: "คุณสมชาย", address: "", phone: "" });
    expect(d.documents).toEqual({ brd: "# BRD", prd: "# PRD" });
    expect(d.billing).toEqual({ status: "active", reason: "", changedAt: null, licenseKeyIssued: false });
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
  const snapshot: OrgSnapshot = {
    projects: [
      { id: "a", name: "A", phase: "define", active_version: "standard", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: "b", name: "B", phase: "build", active_version: "standard", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
    ],
    // A quotation edited later than its project moves the project's updatedAt.
    quotes: [{ project_id: "a", version: "standard", payload: quote() as unknown as Json, updated_at: "2026-10-05T00:00:00Z" }],
    proposals: [],
    billing: [],
  };

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
