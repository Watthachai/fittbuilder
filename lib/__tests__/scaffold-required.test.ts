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
    // Screens without an ENTRY PAIR is the exact condition — not "no files at
    // all", which the route already handles separately. Both files matter and
    // they fail differently: a missing App.tsx leaves a stale page, a missing
    // main.tsx 404s the script index.html asks for.
    expect(route).toContain('["src/App.tsx", "src/main.tsx"]');
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

describe("the preview says so too", () => {
  const preview = readFileSync("components/studio/PreviewPanel.tsx", "utf8");
  const studio = readFileSync("components/studio/Studio.tsx", "utf8");

  it("names the missing shell in the problem bar", () => {
    // The sweep only runs DURING a build. When one ends without a shell there
    // was nothing left saying the preview is not what was just built.
    expect(preview).toContain("ยังไม่มีไฟล์หลักของแอป");
    expect(preview).toContain("missingShell");
    // Named, because "โหลดสคริปต์ไม่สำเร็จ" is the symptom of exactly one of them.
    expect(preview).toContain('missingShell.includes("src/main.tsx")');
  });

  it("outranks the compile error it causes", () => {
    // Same reason missing imports outrank theirs: the cause is what can be
    // acted on, and stacking bars pushes the demo off screen.
    const chain = preview.slice(preview.indexOf("} | null = "));
    expect(chain.indexOf("missingShell.length")).toBeLessThan(chain.indexOf("missingFiles.length"));
  });

  it("asks only for the shell, not for another full pass", () => {
    // Twenty screens already exist; regenerating them is what ran out of output
    // budget the first time.
    const fn = studio.slice(studio.indexOf("const rebuildShell = useCallback"));
    expect(fn.slice(0, 900)).toContain("src/pages/");
    expect(fn.slice(0, 900)).toContain("ห้ามเขียนไฟล์หน้าจอใหม่");
  });
});

/**
 * Detection was the first half. A user who is told their build is missing two
 * files, and handed a button to ask for them, is being charged for our own
 * truncation — the structure rule is what put those files last.
 */
describe("the server finishes the job itself", () => {
  const route = readFileSync("app/api/generate/route.ts", "utf8");
  const prompts = readFileSync("lib/prompts.ts", "utf8");

  it("retries for the entry files before reporting the turn", () => {
    expect(route).toContain("buildShellPrompt");
    const retry = route.slice(route.lastIndexOf("buildShellPrompt"));
    // The report is what the retry runs ahead of.
    expect(retry).toContain("shellMissing");
  });

  it("budgets the retry against the route's own deadline", () => {
    // maxDuration is the hard stop; a retry started without checking the clock
    // is cut off mid-write and leaves a half-written shell behind.
    expect(route).toContain("DEADLINE_MS");
    expect(route).toMatch(/left > 20_000/);
  });

  it("marks the draft complete only after the retry has run", () => {
    // Parking `complete` on a set about to gain two files hands a returning
    // browser a truncated project labelled as finished.
    const marks = route.match(/await parkDraft\(true\)/g) ?? [];
    expect(marks).toHaveLength(1);
    expect(route.lastIndexOf("buildShellPrompt")).toBeLessThan(route.lastIndexOf("await parkDraft(true)"));
  });

  it("accepts only the two files it asked for", () => {
    // A second pass that starts rewriting pages is the failure it exists to avoid.
    const retry = route.slice(route.lastIndexOf("buildShellPrompt"));
    expect(retry.slice(0, 900)).toContain("!shellGap.includes(path)");
  });

  it("asks against the tree that already exists, not for the app again", () => {
    const fn = prompts.slice(prompts.indexOf("export function buildShellPrompt"));
    expect(fn.slice(0, 1200)).toContain("ห้ามเขียนทับ ห้ามสร้างใหม่");
    expect(fn.slice(0, 1200)).toContain("src/pages/");
  });
});
