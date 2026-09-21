import { describe, expect, it } from "vitest";
import { projectFilesFor } from "../modules/project";
import { modulesOf } from "../modules/registry";
import { hasRunnableApp } from "../define";

/**
 * A module selection has to arrive in the studio as a project that is already
 * running. The studio boots the preview on open when — and only when — the files
 * contain a package.json; anything short of that drops the user into the live
 * scaffold and an interview they did not ask for.
 */
describe("projectFilesFor", () => {
  const files = projectFilesFor(modulesOf("hr"));

  it("is a project the studio will boot straight into a preview", () => {
    expect(hasRunnableApp(files)).toBe(true);
  });

  it("carries the plumbing a module never writes", () => {
    for (const path of ["index.html", "src/main.tsx", "vite.config.js", "tsconfig.json"]) {
      expect(files[path]).toBeTruthy();
    }
  });

  it("keeps the composed shell, not the scaffold's placeholder app", () => {
    expect(files["src/App.tsx"]).toContain("ทะเบียนพนักงาน");
  });

  it("writes the scope down where the production build will read it", () => {
    // CRN rebuilds from the documents, so a project born from modules still has
    // to say what it is in the PRD or the scope never leaves the demo.
    expect(files["docs/PRD.md"]).toContain("ทะเบียนพนักงาน");
    expect(files["docs/PRD.md"]).toContain("เงินเดือน");
  });

  it("ships every module's own source", () => {
    expect(files["src/modules/pa/screen.tsx"]).toBeTruthy();
    expect(files["src/modules/py/data.ts"]).toBeTruthy();
  });
});
