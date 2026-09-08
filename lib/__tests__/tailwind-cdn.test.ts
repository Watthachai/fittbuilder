import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeTailwindCdn, sanitizeFiles } from "../files";
import { SCAFFOLD_FILES, TAILWIND_BROWSER_CDN } from "../scaffold";

/**
 * The demo lost every last one of its styles, and nothing said why.
 *
 * The generator rewrote index.html and reached for https://cdn.tailwindcss.com —
 * the famous URL, not the one it was told to use. That host sends neither
 * Cross-Origin-Resource-Policy nor CORS, and the preview runs COEP require-corp,
 * so the browser dropped the script as net::ERR_FAILED. Tailwind never loaded,
 * the `tailwind.config = {…}` line under it threw "tailwind is not defined", and
 * a finished app rendered as bare HTML with default browser buttons. The console
 * blamed a ReferenceError; guarding that only silenced the messenger.
 */
describe("normalizeTailwindCdn", () => {
  it("rewrites the CDN that the preview's headers reject", () => {
    const html = '<script src="https://cdn.tailwindcss.com"></script>';
    expect(normalizeTailwindCdn(html)).toBe(`<script src="${TAILWIND_BROWSER_CDN}"></script>`);
  });

  it("takes the plugin-query and http forms with it", () => {
    const html = [
      '<script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>',
      '<script src="http://cdn.tailwindcss.com/"></script>',
    ].join("\n");
    const out = normalizeTailwindCdn(html);
    expect(out).not.toContain("cdn.tailwindcss.com");
    expect(out.match(/cdn\.jsdelivr\.net/g)).toHaveLength(2);
  });

  it("leaves the canonical tag exactly as it is", () => {
    const html = `<script src="${TAILWIND_BROWSER_CDN}"></script>`;
    expect(normalizeTailwindCdn(html)).toBe(html);
  });

  it("heals a project already saved with the broken URL, on mount", () => {
    // sanitizeFiles is what every boot path runs, so an old project does not
    // need regenerating — it comes back styled the next time it is opened.
    const out = sanitizeFiles({
      "index.html": '<script src="https://cdn.tailwindcss.com"></script>',
      "src/App.tsx": 'export default () => <div className="p-4" />;',
      "src/index.css": '@import "tailwindcss";\nbody { margin: 0; }',
    });
    expect(out["index.html"]).toContain(TAILWIND_BROWSER_CDN);
    expect(out["index.html"]).not.toContain("cdn.tailwindcss.com");
    // The CSS repair this sits beside still runs.
    expect(out["src/index.css"]).toBe("body { margin: 0; }");
    expect(out["src/App.tsx"]).toContain('className="p-4"');
  });
});

describe("one URL, named once", () => {
  it("is what the scaffold's index.html actually ships", () => {
    expect(SCAFFOLD_FILES["index.html"]).toContain(`<script src="${TAILWIND_BROWSER_CDN}"></script>`);
    expect(SCAFFOLD_FILES["index.html"]).not.toContain("${");
  });

  it("is what the generator is told to write, with the trap named", () => {
    const prompts = readFileSync("lib/prompts.ts", "utf8");
    expect(prompts).toContain("NEVER use https://cdn.tailwindcss.com");
    // The reason travels with the rule: a bare prohibition is the kind the
    // model already ignored once.
    expect(prompts).toContain("Cross-Origin-Resource-Policy");
  });
});
