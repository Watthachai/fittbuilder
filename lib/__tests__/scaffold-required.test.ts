import { readFileSync } from "node:fs";
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

/**
 * The same shape of failure, one file along.
 *
 * `withRequiredScaffold` supplies the plumbing a build never writes — index.html,
 * package.json — but it deliberately does NOT supply src/App.tsx, because the
 * app's own shell is the build's job. Seen live on 22 Sep 2026: a first build
 * wrote twenty pages and components, no src/App.tsx, and reported
 * "สร้างระบบเรียบร้อยแล้ว". The container still had the scaffold's App.tsx on
 * disk, so Vite served the placeholder and nothing anywhere disagreed.
 *
 * The structure rule is what exposes it: App.tsx is asked for LAST, so that the
 * preview keeps compiling while the rest streams — which makes the one file
 * without which nothing renders the one a truncated turn drops.
 */
describe("a build that wrote no shell", () => {
  const route = readFileSync("app/api/generate/route.ts", "utf8");
  const prompts = readFileSync("lib/prompts.ts", "utf8");

  it("is not reported to the user as a finished build", () => {
    expect(route).toContain("shellMissing");
    // Screens without a shell is the exact condition — not "no files at all",
    // which the route already handles separately.
    expect(route).toContain('!produced["src/App.tsx"]');
  });

  it("does not fire on an iteration, which may touch one page and nothing else", () => {
    expect(route).toMatch(/shellMissing = !iteration/);
  });

  it("tells the model the shell outranks the scope", () => {
    expect(prompts).toContain("src/App.tsx AND src/main.tsx ARE NOT OPTIONAL");
    // The instruction has to say what to give up instead, or it is just a wish.
    expect(prompts).toContain("CUT SCOPE");
  });
});
