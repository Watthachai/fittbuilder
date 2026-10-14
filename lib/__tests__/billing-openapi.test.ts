import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { billingOpenApi } from "@/lib/billing/openapi";
import { billingError } from "@/lib/billing/errors";
import { pageOf, projectDetail, projectSummaries } from "@/lib/billing/serialize";
import { emptyRow, newDoc, type QuoteDoc } from "@/lib/quote";
import { newProposal } from "@/lib/proposal";
import type { BillingSnapshot, ProjectBundle } from "@/lib/billing/types";
import type { Json } from "@/lib/db/types";

/**
 * The OpenAPI file is what FITT Billing builds its client from, so it must say
 * exactly what the routes send: every response here is produced by the real
 * serializer and checked against the published schema, and the schemas refuse
 * fields they don't name — a field added to the serializer but not to the
 * spec fails here, not in Billing.
 */

const TODAY = "2026-10-14";
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema({ $id: "billing", components: billingOpenApi.components });
const schema = (name: string) => ajv.compile({ $ref: `billing#/components/schemas/${name}` });

function check(name: string, value: unknown) {
  const validate = schema(name);
  const ok = validate(JSON.parse(JSON.stringify(value)));
  expect(validate.errors ?? [], name).toEqual([]);
  expect(ok).toBe(true);
}

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function quote(over: Partial<QuoteDoc> = {}): QuoteDoc {
  const doc = newDoc([], "คลังสินค้า", TODAY);
  return {
    ...doc,
    quoteNo: "SQPDV-0001",
    customerName: "บริษัท ตัวอย่าง จำกัด",
    rows: [{ ...emptyRow(), name: "หน้ารับสินค้า", days: 3 }, { ...emptyRow(), name: "ใบอนุญาต", pricing: "unit", qty: 2, unitPrice: 500 }],
    ma: { ...doc.ma, enabled: true, billingCycle: "monthly" },
    ...over,
  };
}

function bundle(over: Partial<ProjectBundle> = {}): ProjectBundle {
  return {
    project: {
      id: P1,
      name: "คลังสินค้า",
      phase: "build",
      active_version: "standard",
      org_id: "33333333-3333-4333-8333-333333333333",
      owner_id: "44444444-4444-4444-8444-444444444444",
      runner_last: { jobId: "job-1", state: "QUEUED", tag: "alpha-test", sentAt: "2026-10-10T02:00:00.000Z" },
      created_at: "2026-09-01T03:00:00+00:00",
      updated_at: "2026-10-13T09:12:00+00:00",
      files: { "docs/BRD.md": "# BRD", "docs/PRD.md": "# PRD" },
    },
    org: { id: "33333333-3333-4333-8333-333333333333", name: "Digital Value" },
    owner: { id: "44444444-4444-4444-8444-444444444444", name: "อั๋น", email: "a@example.com" },
    quotes: [
      { project_id: P1, version: "standard", payload: quote() as unknown as Json, updated_at: "2026-10-13T10:00:00+00:00" },
      { project_id: P1, version: "premium", payload: quote({ lumpSum: { enabled: true, amount: 90000, title: "ระบบคลังสินค้า" } }) as unknown as Json, updated_at: "2026-10-13T10:00:00+00:00" },
    ],
    proposals: [{ project_id: P1, version: "standard", payload: newProposal("คลังสินค้า", TODAY) as unknown as Json, updated_at: "2026-10-13T10:00:00+00:00" }],
    billing: { project_id: P1, status: "suspended", reason: "ค้างชำระ", changed_at: "2026-10-14T01:00:00+00:00", license_key_hash: "a".repeat(64) },
    ...over,
  };
}

/** Each route file under app/v1/integrations/billing, as the path it serves. */
function routePaths(): string[] {
  const root = join(__dirname, "../../app/v1/integrations/billing");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "route.ts") out.push("/" + relative(root, dir).split(sep).join("/").replace(/\[(\w+)\]/g, "{$1}"));
    }
  };
  walk(root);
  return out;
}

describe("FITT Billing OpenAPI", () => {
  it("is OpenAPI 3.1 and describes every billing route it serves, behind a bearer token", () => {
    expect(billingOpenApi.openapi).toBe("3.1.0");
    const documented = Object.keys(billingOpenApi.paths).sort();
    expect(routePaths().filter((p) => p !== "/openapi.json").sort()).toEqual(documented);
    expect(billingOpenApi.security).toEqual([{ bearerAuth: [] }]);
    expect(billingOpenApi.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer" });
  });

  it("matches a full project detail: two packages, lump sum, MA, proposal, build, suspended", () => {
    check("ProjectDetail", projectDetail(bundle(), TODAY));
  });

  it("matches a bare personal project: no workspace, no owner profile, no documents, never built", () => {
    const b = bundle({ org: null, owner: null, quotes: [], proposals: [], billing: null });
    check("ProjectDetail", projectDetail({ ...b, project: { ...b.project, org_id: null, runner_last: null, files: null } }, TODAY));
  });

  it("matches a list page", () => {
    const snapshot: BillingSnapshot = {
      projects: [bundle().project, { ...bundle().project, id: P2, org_id: null, runner_last: null }],
      quotes: bundle().quotes,
      proposals: [],
      billing: [],
      orgs: [bundle().org!],
      owners: [],
    };
    const page = pageOf(projectSummaries(snapshot, TODAY), { updatedSince: null, limit: 1, cursor: null });
    expect(page.nextCursor).not.toBeNull();
    check("ProjectPage", page);
  });

  it("matches every error the routes answer", async () => {
    for (const code of ["unauthorized", "not_found", "invalid_request", "rate_limited", "internal"] as const) {
      check("Error", await billingError(code, "ข้อความ", "55555555-5555-4555-8555-555555555555", 9).json());
    }
  });

  it("refuses a field it doesn't name, so the serializer can't drift from it unnoticed", () => {
    const d = projectDetail(bundle(), TODAY);
    expect(schema("ProjectDetail")({ ...JSON.parse(JSON.stringify(d)), extra: 1 })).toBe(false);
    expect(schema("ProjectDetail")({ ...JSON.parse(JSON.stringify(d)), project: { ...d.project, extra: 1 } })).toBe(false);
  });
});

describe("GET /v1/integrations/billing/openapi.json", () => {
  it("serves the document without a token, readable from another origin", async () => {
    const { GET } = await import("../../app/v1/integrations/billing/openapi.json/route");
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(billingOpenApi)));
  });
});
