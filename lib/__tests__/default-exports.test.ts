import { describe, expect, it } from "vitest";
import { missingDefaultExports } from "@/lib/default-exports";

const APP = `import { useState } from "react";
import DashboardPage from "./pages/DashboardPage";
import ApprovalsPage from "./pages/ApprovalsPage";
export default function App() { return <ApprovalsPage />; }
`;

describe("missingDefaultExports", () => {
  it("adds the default a page's importer expects when the page exports that name (case #1)", () => {
    const fixed = missingDefaultExports({
      "src/App.tsx": APP,
      "src/pages/DashboardPage.tsx": "export default function DashboardPage() { return null; }\n",
      "src/pages/ApprovalsPage.tsx": "export function ApprovalsPage() {\n  return null;\n}\n",
    });
    expect(Object.keys(fixed)).toEqual(["src/pages/ApprovalsPage.tsx"]);
    expect(fixed["src/pages/ApprovalsPage.tsx"]).toBe(
      "export function ApprovalsPage() {\n  return null;\n}\n\nexport default ApprovalsPage;\n"
    );
  });

  it("recognises a name exported from a list", () => {
    const fixed = missingDefaultExports({
      "src/App.tsx": 'import Report from "./Report";\n',
      "src/Report.tsx": "const Report = () => null;\nexport { Report };\n",
    });
    expect(fixed["src/Report.tsx"]).toContain("export default Report;");
  });

  it("leaves a module that already has a default", () => {
    expect(
      missingDefaultExports({
        "src/App.tsx": 'import Page from "./Page";\n',
        "src/Page.tsx": "function Page() { return null; }\nexport { Page as default };\n",
      })
    ).toEqual({});
  });

  it("does not guess when the module has no export by that name", () => {
    expect(
      missingDefaultExports({
        "src/App.tsx": 'import Approvals from "./pages/ApprovalsPage";\n',
        "src/pages/ApprovalsPage.tsx": "export function ApprovalsPage() { return null; }\n",
      })
    ).toEqual({});
  });

  it("ignores type imports and packages", () => {
    expect(
      missingDefaultExports({
        "src/App.tsx": 'import type Props from "./types";\nimport React from "react";\n',
        "src/types.ts": "export interface Props {}\n",
      })
    ).toEqual({});
  });
});
