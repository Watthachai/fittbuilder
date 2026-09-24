import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as Lucide from "lucide-react";
import { composeModules } from "../modules/compose";
import { MODULE_ICONS } from "../modules/icons";
import { MODULES } from "../modules/registry";

/**
 * A built project drew the same grid icon beside all ten modules.
 *
 * The icons were chosen in the product's own shell, keyed by module id, and the
 * composer that writes a built project's App.tsx never saw them. The choice now
 * sits on the module, and both shells read it from there.
 */

describe("module icons", () => {
  it("names a real lucide-react icon on every module", () => {
    for (const m of MODULES) {
      expect(MODULE_ICONS[m.icon], m.id).toBe(Lucide[m.icon]);
    }
  });

  it("gives no two modules the same icon", () => {
    // A sidebar where two modules look alike is read by label only — which is
    // the grid-icon problem again, one pair at a time.
    expect(new Set(MODULES.map((m) => m.icon)).size).toBe(MODULES.length);
  });

  it("reaches a built project: imported from lucide-react and drawn per module", () => {
    const shell = composeModules(MODULES).files["src/App.tsx"];
    const imported = shell.match(/import \{([^}]*)\} from "lucide-react";/)![1].split(",").map((s) => s.trim());
    for (const m of MODULES) {
      expect(imported, m.id).toContain(m.icon);
      expect(shell, m.id).toContain(`id: "${m.id}"`);
      expect(shell, m.id).toMatch(new RegExp(`id: "${m.id}"[^\\n]*Icon: ${m.icon},`));
    }
    expect(shell).toContain("<m.Icon size={16}");
    expect(shell).not.toContain("LayoutGrid");
  });

  it("imports only what a smaller selection draws", () => {
    const pa = MODULES.find((m) => m.id === "pa")!;
    const shell = composeModules([pa]).files["src/App.tsx"];
    expect(shell).toContain(`import { ArrowRightToLine, ChevronsLeft, Moon, Search, Sun, ${pa.icon} } from "lucide-react";`);
  });
});

describe("the code editor", () => {
  it("opens every file under its own path, so a .tsx file is read as TypeScript", () => {
    // Without a path the model is extensionless, and Monaco's TypeScript worker
    // treats an extensionless file as JavaScript whenever allowJs is on — every
    // `import type` in the project was underlined as an error.
    const panel = readFileSync("components/studio/CodePanel.tsx", "utf8");
    const editor = panel.slice(panel.indexOf("<MonacoEditor"), panel.indexOf("/>", panel.indexOf("<MonacoEditor")));
    expect(editor).toContain("path={activeFile}");
  });
});
