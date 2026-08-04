import { describe, expect, it } from "vitest";
import { buildMissingFilesPrompt, missingImports } from "../import-check";

describe("missingImports", () => {
  // The exact production failure: App.tsx imports components that never arrived.
  it("catches the import that produced the white screen", () => {
    const missing = missingImports({
      "src/App.tsx": `import Sidebar from "./components/Sidebar";\nimport Header from "./components/Header";\n`,
      "src/components/Header.tsx": "export default function Header() { return null; }",
    });
    expect(missing).toEqual([
      { from: "src/App.tsx", spec: "./components/Sidebar", expected: "src/components/Sidebar" },
    ]);
  });

  it("resolves every extension Vite would try, plus index files", () => {
    expect(
      missingImports({
        "src/App.tsx": `import a from "./a";\nimport b from "./b";\nimport c from "./c";\nimport "./styles.css";\n`,
        "src/a.ts": "export default 1;",
        "src/b.jsx": "export default 1;",
        "src/c/index.tsx": "export default 1;",
        "src/styles.css": "body{}",
      })
    ).toEqual([]);
  });

  it("walks .. out of a nested folder", () => {
    expect(
      missingImports({
        "src/components/orders/OrderTable.tsx": `import { fmt } from "../../lib/format";`,
        "src/lib/format.ts": "export const fmt = String;",
      })
    ).toEqual([]);
    expect(
      missingImports({
        "src/components/orders/OrderTable.tsx": `import { fmt } from "../../lib/format";`,
      })
    ).toHaveLength(1);
  });

  it("ignores packages, and side-effect / dynamic / re-export forms are all checked", () => {
    const missing = missingImports({
      "src/App.tsx": [
        `import { useState } from "react";`,
        `import "lucide-react";`,
        `import "./boot";`,
        `export { x } from "./x";`,
        `const L = () => import("./Lazy");`,
      ].join("\n"),
    });
    expect(missing.map((m) => m.spec).sort()).toEqual(["./Lazy", "./boot", "./x"]);
  });

  it("reports each missing specifier once", () => {
    const missing = missingImports({
      "src/App.tsx": `import A from "./A";\nimport B from "./A";\n`.repeat(2),
    });
    expect(missing).toHaveLength(1);
  });

  it("treats no files as healthy", () => {
    expect(missingImports(null)).toEqual([]);
  });
});

describe("buildMissingFilesPrompt", () => {
  it("names every file to create and forbids deleting the imports instead", () => {
    const p = buildMissingFilesPrompt([
      { from: "src/App.tsx", spec: "./components/Sidebar", expected: "src/components/Sidebar" },
    ]);
    expect(p).toContain("src/components/Sidebar");
    expect(p).toContain("src/App.tsx");
    expect(p).toContain("ห้ามลบ import");
  });
});
