import { describe, expect, it } from "vitest";
import { SCAFFOLD_REQUIRED, withRequiredScaffold } from "../scaffold";
import { hasRunnableApp } from "../define";

/**
 * The white screen of 2026-08-10. A build produced package.json and a full
 * src/ tree but no index.html — nothing in the codegen prompt mentions it, so
 * it can only come from the scaffold. hasRunnableApp() returns true on
 * package.json alone, so the studio booted the project's own files verbatim
 * and Vite answered 404 at "/" while the terminal reported "พร้อม".
 */
const REAL_BUILD = {
  "package.json": '{"name":"demo"}',
  "package-lock.json": "{}",
  "tsconfig.json": "{}",
  "vite.config.js": "export default {}",
  "src/main.tsx": "import App from './App'",
  "src/App.tsx": "export default () => null",
  "docs/PRD.md": "# PRD",
};

describe("withRequiredScaffold", () => {
  it("supplies the index.html that made the preview a blank 404", () => {
    const out = withRequiredScaffold(REAL_BUILD);
    expect(out["index.html"]).toBeTruthy();
    expect(out["index.html"]).toContain('<div id="root">');
    // …and the file it loads is the one the build actually wrote.
    expect(out["index.html"]).toContain("/src/main.tsx");
  });

  it("never overwrites what the project already has", () => {
    const mine = { ...REAL_BUILD, "index.html": "<h1>mine</h1>", "package.json": '{"name":"mine"}' };
    const out = withRequiredScaffold(mine);
    expect(out["index.html"]).toBe("<h1>mine</h1>");
    expect(out["package.json"]).toBe('{"name":"mine"}');
  });

  /**
   * Filling src/App.tsx from the scaffold would paint a placeholder over a real
   * project's missing file — a wrong app looks correct, a missing one does not.
   */
  it("supplies plumbing only, never the demo's own content", () => {
    for (const path of ["src/App.tsx", "src/main.tsx", "src/index.css"]) {
      expect(SCAFFOLD_REQUIRED).not.toHaveProperty(path);
    }
    const stripped = { "src/main.tsx": "x" };
    expect(withRequiredScaffold(stripped)["src/App.tsx"]).toBeUndefined();
  });

  /**
   * During Define/Plan the docs ARE the project. Stamping package.json onto it
   * would make hasRunnableApp() call an interview a runnable app and boot a
   * scaffold over it.
   */
  it("leaves a project with no source completely alone", () => {
    const docsOnly = { "docs/BRD.md": "# BRD", "docs/PRD.md": "# PRD" };
    expect(withRequiredScaffold(docsOnly)).toEqual(docsOnly);
    expect(hasRunnableApp(withRequiredScaffold(docsOnly))).toBe(false);
  });

  it("makes a source-bearing project runnable by the studio's own test", () => {
    const noPkg = { "src/main.tsx": "x", "src/App.tsx": "y" };
    expect(hasRunnableApp(noPkg)).toBe(false);
    expect(hasRunnableApp(withRequiredScaffold(noPkg))).toBe(true);
  });
});
