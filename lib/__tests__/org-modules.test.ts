import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deliveredWork } from "../org-modules";

/**
 * What a workspace has had built, module by module: every project in it,
 * broken into the modules on its proposal, each priced from the quotation line
 * of the same name. One project often carries several modules — First Chapter
 * is one project and two modules — and the workspace page lists them all.
 */
const module = (name: string, parts: { screens: string[] }[]) => ({
  id: name,
  name,
  parts: parts.map((p, i) => ({ id: `${name}-${i}`, name: `ส่วน ${i}`, points: ["ทำบางอย่าง"], screens: p.screens })),
});

const SALES = module("Module: Sales Management (งานขาย)", [{ screens: ["a", "b"] }, { screens: ["c"] }]);
const PROC = module("Module: Procurement Management (งานจัดซื้อ)", [{ screens: ["d"] }]);

const projects = [
  { id: "p1", name: "First Chapter - ระบบจัดทำ BOQ", updated_at: "2026-10-16T02:00:00Z" },
  { id: "p2", name: "ยังไม่ได้แตก", updated_at: "2026-10-15T02:00:00Z" },
  { id: "p3", name: "มีแต่ Premium", updated_at: "2026-10-14T02:00:00Z" },
];

const proposals = [
  { project_id: "p1", version: "premium", modules: [PROC] },
  { project_id: "p1", version: "standard", modules: [SALES, PROC] },
  { project_id: "p2", version: "standard", modules: null },
  { project_id: "p3", version: "premium", modules: [PROC] },
];

const quotes = [
  {
    project_id: "p1",
    version: "standard",
    rate: 8000,
    rows: [
      { name: "Module: Sales Management (งานขาย)", pricing: "unit", qty: 1, unitPrice: 240_000 },
      { name: "Module: Procurement Management (งานจัดซื้อ)", pricing: "unit", qty: 1, unitPrice: 0 },
      { name: "ค่าบริการรายปี", pricing: "unit", qty: 1, unitPrice: 240_000 },
    ],
  },
];

describe("deliveredWork", () => {
  const work = deliveredWork(projects, proposals, quotes);

  it("lists every project in the order given", () => {
    expect(work.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("breaks a project into its modules, with how many parts and screens each covers", () => {
    expect(work[0].modules.map((m) => [m.name, m.parts, m.screens])).toEqual([
      ["Module: Sales Management (งานขาย)", 2, 3],
      ["Module: Procurement Management (งานจัดซื้อ)", 1, 1],
    ]);
  });

  it("prices a module from the quotation line of the same name — zero when it was given with the deal", () => {
    expect(work[0].modules.map((m) => m.price)).toEqual([240_000, 0]);
  });

  it("takes the standard version's modules over the premium's", () => {
    expect(work[0].modules).toHaveLength(2);
  });

  it("falls back to the only version that has modules, with no price where no quotation line names it", () => {
    expect(work[2].modules).toEqual([{ name: PROC.name, parts: 1, screens: 1, price: null }]);
  });

  it("has no modules for a project nobody has broken down yet", () => {
    expect(work[1].modules).toEqual([]);
  });
});

describe("the workspace page", () => {
  const section = readFileSync("components/org/OrgModules.tsx", "utf8");

  it("shows the section on the workspace page", () => {
    expect(readFileSync("components/org/OrgDnaEditor.tsx", "utf8")).toContain("<OrgModules orgId={orgId} />");
  });

  it("reads only the modules and the priced rows, not whole documents", () => {
    expect(section).toContain("modules:payload->modules");
    expect(section).toContain("rows:payload->rows, rate:payload->ratePerDay");
    expect(section).not.toMatch(/select\("[^"]*\bpayload\b(?!->)/);
  });
});
