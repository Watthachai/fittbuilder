import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  blockedAssetsNote,
  externalAssetUrls,
  isAssetContentType,
  isPublicUrl,
  respondsToIsolation,
  routeBlockedThroughProxy,
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

describe("isAssetContentType · what counts as an asset at all", () => {
  it("accepts the media a preview actually loads", () => {
    for (const t of ["image/png", "image/svg+xml", "font/woff2", "video/mp4", "audio/mpeg",
                     "application/font-woff2", "application/octet-stream", "IMAGE/PNG; charset=x"]) {
      expect(isAssetContentType(t), t).toBe(true);
    }
  });

  it("rejects what a link or a namespace answers with", () => {
    // Found in real output: xmlns="http://www.w3.org/2000/svg" is a NAME that is
    // never fetched, and w3.org answers it with a web page. Treating it as a
    // blocked asset rewrote it through the relay and stopped the SVG being an
    // SVG. A footer <a href> to any site fails the same way.
    for (const t of ["text/html", "text/html; charset=utf-8", "application/json", "text/plain", ""]) {
      expect(isAssetContentType(t), t).toBe(false);
    }
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

describe("routeBlockedThroughProxy", () => {
  const SITE = "https://fitt.example";
  const blocked = [{ url: FIGMA, reason: "x" }];

  it("rewrites only the files that mention a blocked asset", () => {
    const { files, changed } = routeBlockedThroughProxy(
      { "a.tsx": `<img src="${FIGMA}" />`, "b.tsx": `<img src="${CF}" />` },
      blocked,
      SITE
    );
    expect(changed).toEqual(["a.tsx"]);
    expect(files["a.tsx"]).toContain(`${SITE}/api/asset?url=${encodeURIComponent(FIGMA)}`);
    // A host that already serves us keeps its direct URL — no relay in the path.
    expect(files["b.tsx"]).toBe(`<img src="${CF}" />`);
  });

  it("rewrites every occurrence, not just the first", () => {
    const { files } = routeBlockedThroughProxy(
      { "a.tsx": `${FIGMA} and again ${FIGMA}` },
      blocked,
      SITE
    );
    expect(files["a.tsx"].split("/api/asset?url=")).toHaveLength(3);
    // Relayed, so the original no longer appears as a bare URL anywhere.
    expect(files["a.tsx"]).not.toContain(`"${FIGMA}"`);
  });

  it("does not strand the tail of a URL that starts with another one", () => {
    const short = FIGMA;
    const long = `${FIGMA}?v=2`;
    const { files } = routeBlockedThroughProxy(
      { "a.tsx": `<img src="${long}" />` },
      [{ url: short, reason: "x" }, { url: long, reason: "x" }],
      SITE
    );
    expect(files["a.tsx"]).toBe(
      `<img src="${SITE}/api/asset?url=${encodeURIComponent(long)}" />`
    );
  });

  it("changes nothing when nothing is blocked", () => {
    const files = { "a.tsx": `<img src="${FIGMA}" />` };
    const result = routeBlockedThroughProxy(files, [], SITE);
    expect(result.changed).toEqual([]);
    expect(result.files).toBe(files);
  });
});

describe("publicSiteUrl · what gets written into a customer's code", () => {
  const forged = new Request("http://0.0.0.0:3000/api/generate", {
    headers: { "x-forwarded-host": "evil.example" },
  });

  it("prefers the configured origin over anything a header claims", async () => {
    const { publicSiteUrl } = await import("@/lib/origin");
    const prev = process.env.PUBLIC_SITE_URL;
    process.env.PUBLIC_SITE_URL = "https://fitt.example/";
    expect(publicSiteUrl(forged)).toBe("https://fitt.example");
    process.env.PUBLIC_SITE_URL = prev;
  });

  it("in production, returns null rather than trusting the header", async () => {
    const { publicSiteUrl } = await import("@/lib/origin");
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(publicSiteUrl(forged)).toBeNull();
    vi.unstubAllEnvs();
  });
});
