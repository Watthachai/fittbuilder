import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANGELOG } from "@/lib/changelog";
import { GUIDE, GUIDE_ROLES, guideSection, type GuideFigure } from "@/lib/guide";

const figures: GuideFigure[] = GUIDE.flatMap((section) =>
  section.blocks.flatMap((block) => (block.kind === "figure" ? [block.figure] : []))
);

/** Width × height read from a JPEG's SOF marker. */
function jpegSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  let i = 2;
  while (i < bytes.length) {
    const marker = bytes[i + 1];
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  throw new Error(`no size in ${path}`);
}

describe("the guide", () => {
  it("gives every section its own anchor and a role that exists", () => {
    const ids = GUIDE.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    const roles = new Set(GUIDE_ROLES.map((role) => role.id));
    for (const section of GUIDE) expect(roles.has(section.role)).toBe(true);
  });

  it("shows pictures that are files under public/guide, at their real size", () => {
    for (const figure of figures) {
      expect(figure.src).toMatch(/^\/guide\/[\w-]+\.jpg$/);
      const path = join(process.cwd(), "public", figure.src);
      expect(existsSync(path), figure.src).toBe(true);
      expect(jpegSize(path), figure.src).toEqual({ width: figure.width, height: figure.height });
    }
  });

  it("keeps no picture in public/guide that no section shows", () => {
    const shown = new Set(figures.map((figure) => figure.src.replace("/guide/", "")));
    for (const file of readdirSync(join(process.cwd(), "public", "guide"))) expect(shown.has(file), file).toBe(true);
  });

  it("explains every badge it draws, and draws every badge it explains", () => {
    for (const figure of figures) {
      const drawn = figure.marks.map((mark) => mark.n);
      const named = figure.legend.map((item) => item.n);
      expect(named, figure.src).toEqual(drawn);
      expect(drawn, figure.src).toEqual(drawn.map((_, index) => index + 1));
      for (const mark of figure.marks) {
        expect(mark.x, figure.src).toBeGreaterThanOrEqual(0);
        expect(mark.x, figure.src).toBeLessThanOrEqual(100);
        expect(mark.y, figure.src).toBeGreaterThanOrEqual(0);
        expect(mark.y, figure.src).toBeLessThanOrEqual(100);
      }
    }
  });

  it("is linked from the changelog only by sections it has", () => {
    for (const entry of CHANGELOG.filter((e) => e.guide)) {
      expect(guideSection(entry.guide!), entry.version).toBeDefined();
    }
  });
});
