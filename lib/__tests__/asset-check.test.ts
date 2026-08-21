import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  blockedAssetsNote,
  externalAssetUrls,
  isPublicUrl,
  respondsToIsolation,
} from "@/lib/asset-check";

/**
 * A user pasted a spec listing seven scene layers on figma.site and a font on a
 * CloudFront distribution, and the preview showed alt text where the pictures
 * should be. Two turns went into markup attributes before anyone asked the
 * hosts. These are those hosts.
 */
const FIGMA = "https://raft-blast-61784561.figma.site/_assets/v11/16b5007d.png";
const CF = "https://d8j0ntlcm91z4.cloudfront.net/user_38x/hf_20260730_230438.png";

describe("externalAssetUrls", () => {
  it("finds assets however they were written", () => {
    const urls = externalAssetUrls({
      "src/App.tsx": `<img src="${FIGMA}" crossOrigin="anonymous" />`,
      "src/index.css": `@font-face { src: url(https://cdn.example.com/Ogg.woff2) format("woff2"); }`,
      "src/data/sights.ts": `export const ICON = "${CF}";`,
    });
    expect(urls).toContain(FIGMA);
    expect(urls).toContain(CF);
    expect(urls).toContain("https://cdn.example.com/Ogg.woff2");
  });

  it("ignores what the scaffold itself loads", () => {
    const urls = externalAssetUrls({
      "index.html": `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />`,
    });
    expect(urls).toEqual([]);
  });

  it("counts one asset once, however many files point at it", () => {
    expect(
      externalAssetUrls({ "a.tsx": `src="${FIGMA}"`, "b.tsx": `src="${FIGMA}"` })
    ).toHaveLength(1);
  });

  it("does not swallow a trailing full stop into the URL", () => {
    expect(externalAssetUrls({ "a.md": `ใช้ ${FIGMA}.` })).toEqual([FIGMA]);
  });
});

describe("respondsToIsolation", () => {
  it("accepts either opt-in header", () => {
    expect(respondsToIsolation(new Headers({ "access-control-allow-origin": "*" }))).toBe(true);
    expect(respondsToIsolation(new Headers({ "cross-origin-resource-policy": "cross-origin" }))).toBe(
      true
    );
  });

  it("rejects a response that opts into neither", () => {
    expect(respondsToIsolation(new Headers({ "content-type": "image/png" }))).toBe(false);
    // same-origin CORP is an opt-OUT for a page on another origin.
    expect(respondsToIsolation(new Headers({ "cross-origin-resource-policy": "same-origin" }))).toBe(
      false
    );
  });
});

describe("isPublicUrl · the SSRF gate", () => {
  it("refuses anything that is not http(s)", async () => {
    for (const url of ["file:///etc/passwd", "ftp://example.com/a.png", "not a url"]) {
      expect(await isPublicUrl(url)).toBe(false);
    }
  });

  it("refuses the ranges nothing public lives in", async () => {
    for (const host of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1",
      "0.0.0.0",
      "[::1]",
      "[fd00::1]",
      "[::ffff:169.254.169.254]", // v4 hidden inside a v6 literal
    ]) {
      expect(await isPublicUrl(`http://${host}/a.png`), host).toBe(false);
    }
  });

  it("refuses a hostname that does not resolve", async () => {
    expect(await isPublicUrl("https://this-host-does-not-exist.invalid/a.png")).toBe(false);
  });

  it("allows an ordinary public address", async () => {
    expect(await isPublicUrl("https://1.1.1.1/a.png")).toBe(true);
  });
});

describe("blockedAssetsNote", () => {
  it("says nothing when nothing is blocked", () => {
    expect(blockedAssetsNote([])).toBe("");
  });

  it("names the host and says the fix is not in the code", () => {
    const note = blockedAssetsNote([
      { url: FIGMA, reason: "x" },
      { url: `${FIGMA}?2`, reason: "x" },
    ]);
    expect(note).toContain("raft-blast-61784561.figma.site");
    expect(note).toContain("มี 2 ไฟล์");
    // The lesson that cost two turns.
    expect(note).toContain("แก้ที่โค้ดไม่ได้ ต้องแก้ที่ต้นทาง");
  });
});

describe("iteration turns know the runtime rules", () => {
  const prompts = readFileSync("lib/prompts.ts", "utf8");
  const iteration = prompts.slice(prompts.indexOf("export function buildIterationSystemPrompt"));

  it("carries them, which is how crossOrigin got stripped", () => {
    expect(iteration).toContain("${RUNTIME_RULES}");
  });

  it("keeps every rule that holds on both kinds of turn", () => {
    const shared = prompts.slice(
      prompts.indexOf("const RUNTIME_RULES"),
      prompts.indexOf("const PROJECT_RULES")
    );
    expect(shared).toContain('crossOrigin="anonymous"');
    expect(shared).toContain("LANGUAGE follows the ORIGINAL BRIEF");
    expect(shared).toContain("WILL CRASH the dev server");
    expect(shared).toContain("NEVER build a paid-tier switch");
  });

  it("does not hand an edit turn the rules that would make it rewrite everything", () => {
    // "always include these files" against "emit only what changed".
    expect(iteration).not.toContain("${PROJECT_RULES}");
  });
});
