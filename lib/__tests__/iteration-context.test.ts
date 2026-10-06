import { describe, expect, it } from "vitest";
import { contextFor, namedIn, neighboursOf } from "../iteration-context";

/**
 * An edit turn sends the model the project's files. A project past the budget
 * cannot send all of them — the largest one reached 937k tokens and every edit
 * on it failed — so it sends the files this request needs and lists the rest.
 */

const files: Record<string, string> = {
  "package.json": `{ "name": "siam-yoko" }`,
  "src/main.tsx": `import App from "./App";`,
  "src/App.tsx": `import { Sidebar } from "./components/layout/Sidebar";\nimport ReportsPage from "./pages/ReportsPage";`,
  "src/components/layout/Sidebar.tsx": `import { NavBadge } from "./NavBadge";\nexport const Sidebar = () => null;`,
  "src/components/layout/NavBadge.tsx": `export const NavBadge = () => null;`,
  "src/pages/ReportsPage.tsx": `import { rows } from "../data/reports";\nexport default function ReportsPage() {}`,
  "src/data/reports.ts": `export const rows = [${"1,".repeat(400)}];`,
  "src/pages/OrdersPage.tsx": `export default function OrdersPage() {}`,
};

describe("namedIn", () => {
  it("finds the files a request names by path or by file name", () => {
    const wand = "ผู้ใช้ชี้ element นี้ — ไฟล์: src/components/layout/Sidebar.tsx (บรรทัด 167) ชื่อเมนูเห็นไม่ครบ";
    expect(namedIn(wand, Object.keys(files))).toEqual(["src/components/layout/Sidebar.tsx"]);
    const error = "The requested module '/src/pages/ReportsPage.tsx' does not provide an export named 'default'";
    expect(namedIn(error, Object.keys(files))).toEqual(["src/pages/ReportsPage.tsx"]);
    expect(namedIn("แก้ OrdersPage.tsx ให้มีปุ่มส่งออก", Object.keys(files))).toEqual(["src/pages/OrdersPage.tsx"]);
    expect(namedIn("hi", Object.keys(files))).toEqual([]);
  });
});

describe("neighboursOf", () => {
  it("adds what a file imports and what imports it", () => {
    expect(neighboursOf(files, ["src/components/layout/Sidebar.tsx"]).sort()).toEqual([
      "src/App.tsx",
      "src/components/layout/NavBadge.tsx",
    ]);
  });
});

describe("contextFor", () => {
  it("sends every file while the project fits the budget", () => {
    const { shown, omitted } = contextFor(files, ["src/components/layout/Sidebar.tsx"], 1_000_000);
    expect(Object.keys(shown)).toEqual(Object.keys(files));
    expect(omitted).toEqual([]);
  });

  it("past the budget, sends the named files, the core and their neighbours, and lists the rest", () => {
    const { shown, omitted } = contextFor(files, ["src/components/layout/Sidebar.tsx"], 900);
    expect(Object.keys(shown)).toEqual([
      "src/components/layout/Sidebar.tsx",
      "package.json",
      "src/main.tsx",
      "src/App.tsx",
      "src/components/layout/NavBadge.tsx",
    ]);
    expect(omitted.sort()).toEqual(["src/data/reports.ts", "src/pages/OrdersPage.tsx", "src/pages/ReportsPage.tsx"]);
  });

  it("stops adding files once the budget is spent", () => {
    const { shown } = contextFor(files, ["src/pages/ReportsPage.tsx", "src/data/reports.ts"], 900);
    expect(Object.keys(shown)).toContain("src/pages/ReportsPage.tsx");
    expect(Object.keys(shown)).not.toContain("src/data/reports.ts");
  });
});
