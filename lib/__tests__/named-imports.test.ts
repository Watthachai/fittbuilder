import { describe, expect, it } from "vitest";
import { brokenNamedImports, restoreExportsPrompt } from "@/lib/named-imports";

describe("brokenNamedImports", () => {
  it("finds a name the module dropped while another file still imports it (case #2)", () => {
    const broken = brokenNamedImports({
      "src/components/ui/kit.tsx": 'import { Button, FIELD, Overlay, SURFACE, Skeleton, enter } from "./ui";\n',
      "src/components/ui/ui.tsx":
        "export const SURFACE = '';\nexport const FIELD = '';\nexport function Button() {}\nexport function Overlay() {}\nexport function enter() {}\n",
    });
    expect(broken).toEqual([{ from: "src/components/ui/kit.tsx", target: "src/components/ui/ui.tsx", name: "Skeleton" }]);
  });

  it("counts names exported from a list, renamed exports and types", () => {
    expect(
      brokenNamedImports({
        "src/App.tsx": 'import Main, { a, b as bee, type T, I } from "./lib";\n',
        "src/lib.ts": "const x = 1;\nexport { x as a, b };\nexport interface I {}\nexport default 1;\n",
      })
    ).toEqual([]);
  });

  it("ignores type-only imports, packages and modules that re-export everything", () => {
    expect(
      brokenNamedImports({
        "src/App.tsx":
          'import type { Gone } from "./types";\nimport { useState } from "react";\nimport { Any } from "./barrel";\n',
        "src/types.ts": "export type Here = 1;\n",
        "src/barrel.ts": 'export * from "./types";\n',
      })
    ).toEqual([]);
  });
});

describe("restoreExportsPrompt", () => {
  it("names each module, the names it lost and who still uses them", () => {
    const prompt = restoreExportsPrompt([
      { from: "src/components/ui/kit.tsx", target: "src/components/ui/ui.tsx", name: "Skeleton" },
      { from: "src/pages/A.tsx", target: "src/components/ui/ui.tsx", name: "Skeleton" },
    ]);
    expect(prompt).toContain("src/components/ui/ui.tsx ไม่มี export Skeleton แล้ว แต่ src/components/ui/kit.tsx, src/pages/A.tsx ยังใช้อยู่");
  });
});
