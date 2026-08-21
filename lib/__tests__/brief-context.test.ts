import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildSpecContext, truncateBrief } from "../context-builder";

/**
 * The brief has to survive the trip to the build turn.
 *
 * A user pasted a pixel-exact spec for an email-style landing page — hex values,
 * aspect ratios, CloudFront video URLs, English copy — and got back a Thai
 * full-width SaaS page with CSS gradients where the videos should be. Nothing
 * was wrong with the model or the URLs (CloudFront serves them with
 * access-control-allow-origin: *). The build turn simply never saw the brief:
 * it was handed "สร้าง web demo ตามเอกสาร BRD/PRD ที่แนบมา" plus two agent-written
 * summaries, and a business document has no reason to record #DCFF00.
 *
 * These are the values from that brief. If they stop making it through, the same
 * bug is back.
 */
const BRIEF = `Build a single-page React + TypeScript + Vite + Tailwind email-style page.
Hero wrapper: relative w-full overflow-hidden with inline style={{ aspectRatio: '640 / 820' }}
Background video: https://d8j0ntlcm91z4.cloudfront.net/user_38x/hf_20260419_064822.mp4
Email container: max-w-[640px] mx-auto shadow-2xl overflow-hidden ring-1 ring-white/5
Headline: Learn to lead AI and unlock new value
Lime primary #DCFF00, lime variant #D8F90A, dark text on lime #0A0A0A`;

describe("buildSpecContext · the brief reaches the builder", () => {
  const ctx = buildSpecContext({
    brief: BRIEF,
    brd: "# BRD\n- ระบบคอร์สออนไลน์สำหรับผู้บริหาร\n- กลุ่มเป้าหมาย: หัวหน้าทีม",
    prd: "# PRD\n- หน้า Landing\n- ปุ่มสมัครเรียน",
  })!;

  it("carries the exact values a summary would have dropped", () => {
    expect(ctx).toContain("#DCFF00");
    expect(ctx).toContain("#D8F90A");
    expect(ctx).toContain("aspectRatio: '640 / 820'");
    expect(ctx).toContain("max-w-[640px]");
    // The whole URL, not a truncated one — a half URL is a broken video.
    expect(ctx).toContain(
      "https://d8j0ntlcm91z4.cloudfront.net/user_38x/hf_20260419_064822.mp4"
    );
    // Copy stays in the language it was written in.
    expect(ctx).toContain("Learn to lead AI and unlock new value");
  });

  it("puts the brief ahead of the documents that summarise it", () => {
    expect(ctx.indexOf("[0] ORIGINAL BRIEF")).toBeGreaterThanOrEqual(0);
    expect(ctx.indexOf("[0] ORIGINAL BRIEF")).toBeLessThan(ctx.indexOf("[1] BUSINESS REQUIREMENTS"));
  });

  it("says which one governs when they disagree", () => {
    expect(ctx).toContain("the brief governs");
    // The three substitutions that actually happened, named so they cannot recur.
    expect(ctx).toMatch(/do not translate the copy/);
    expect(ctx).toMatch(/do not substitute a\s*\n?gradient for a video/);
  });

  it("is enough on its own — a brief with no documents still builds a context", () => {
    const only = buildSpecContext({ brief: BRIEF });
    expect(only).toContain("#DCFF00");
  });

  it("leaves projects that have no brief exactly as they were", () => {
    const before = buildSpecContext({ brd: "# BRD\n- ก", prd: "# PRD\n- ข" });
    expect(before).not.toContain("[0] ORIGINAL BRIEF");
    expect(before!.startsWith("PROJECT SPECIFICATION CONTEXT")).toBe(true);
    // Blank and whitespace-only briefs are the same case, not an empty block.
    expect(buildSpecContext({ brief: "   ", brd: "# BRD\n- ก", prd: "# PRD\n- ข" })).toBe(before);
  });
});

describe("truncateBrief", () => {
  it("does not touch a brief that fits", () => {
    expect(truncateBrief(BRIEF)).toBe(BRIEF.trim());
  });

  it("keeps the tail, where a spec keeps its palette and fonts", () => {
    const long = `${"HEAD ".repeat(400)}\nColor palette: #DCFF00\nFonts: Instrument Serif`;
    const cut = truncateBrief(long, 600);
    expect(cut.length).toBeLessThan(long.length);
    expect(cut).toContain("HEAD");
    expect(cut).toContain("#DCFF00");
    expect(cut).toContain("Instrument Serif");
    expect(cut).toContain("ตัดเนื้อหาช่วงกลางออก");
  });
});

describe("wiring", () => {
  const studio = readFileSync("components/studio/Studio.tsx", "utf8");

  it("build-from-docs sends the brief alongside the documents", () => {
    expect(studio).toContain("brief: originalBrief(proj)");
    // Alongside, not instead of — the documents still carry the scope.
    expect(studio).toMatch(/brief: originalBrief\(proj\),\s*\n\s*brd: docs\.brd/);
  });

  it("the pasted-spec entry point sends it too", () => {
    expect(studio).toContain("brief: spec.prompt");
  });

  it("the API accepts it", () => {
    const route = readFileSync("app/api/generate/route.ts", "utf8");
    expect(route).toMatch(/brief: z\.string\(\)\.max\(20_000\)\.optional\(\)/);
    expect(route).toContain("brief: body.brief");
  });
});

describe("build prompt · the brief outranks our defaults", () => {
  const prompts = readFileSync("lib/prompts.ts", "utf8");

  it("takes the output language from the brief, not the always-Thai documents", () => {
    expect(prompts).toContain("LANGUAGE follows the ORIGINAL BRIEF");
    expect(prompts).toMatch(/English brief → every\s*\n?\s*visible string in English/);
  });

  it("lets an explicit layout override the house design rules", () => {
    expect(prompts).toMatch(/where the brief states a layout, a measurement, a palette or a motion behaviour, that wins/);
  });

  it("still uses a given media URL exactly, with the header the preview needs", () => {
    expect(prompts).toContain("USE THAT EXACT URL as provided");
    expect(prompts).toContain('crossOrigin="anonymous"');
  });
});
