import { describe, expect, it } from "vitest";
import { undocumentedScreens } from "@/lib/doc-drift";
import type { ProjectFiles } from "@/lib/types";

const screen = (name: string) => `<button data-fitt-screen="${name}">${name}</button>`;

const files = (brief: string, screens: string[]): ProjectFiles => ({
  "docs/BRD.md": brief,
  "src/App.tsx": screens.map(screen).join("\n"),
});

/**
 * The brief goes stale silently. Nothing marks it, and everything downstream
 * keeps reading it — the Code Runner hand-off, the quotation's scope, the
 * premium advice. The person who could fix it in one click is the last to know.
 */
describe("docs that no longer describe the demo", () => {
  it("names the screens the brief has never heard of", () => {
    const drift = undocumentedScreens(
      files("ร้านขายกระเบื้อง มีหน้าแคตตาล็อก และตะกร้าสินค้า", [
        "แคตตาล็อก",
        "ตะกร้าสินค้า",
        "ติดต่อเรา",
        "รีวิวลูกค้า",
      ])
    );
    expect(drift).toEqual(["ติดต่อเรา", "รีวิวลูกค้า"]);
  });

  it("says nothing when the brief covers everything", () => {
    expect(undocumentedScreens(files("มีหน้าแคตตาล็อก", ["แคตตาล็อก"]))).toEqual([]);
  });

  it("says nothing before a brief exists", () => {
    // Not drift — the docs simply have not been written yet, which the phase
    // flow already asks for. Warning here would fire on every new project.
    expect(undocumentedScreens(files("", ["แคตตาล็อก"]))).toEqual([]);
    expect(undocumentedScreens(null)).toEqual([]);
  });

  it("counts a repeated screen once", () => {
    expect(undocumentedScreens(files("ร้านค้า", ["ติดต่อเรา", "ติดต่อเรา"]))).toEqual([
      "ติดต่อเรา",
    ]);
  });
});
