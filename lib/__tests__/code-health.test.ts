import { describe, expect, it } from "vitest";
import { oversizedFiles, OVERSIZE_LINES } from "../code-health";
import { buildIterationUserPrompt } from "../prompts";

const lines = (n: number) => Array.from({ length: n }, (_, i) => `const x${i} = ${i};`).join("\n");

describe("oversizedFiles", () => {
  it("flags source files past the cap, biggest first", () => {
    const found = oversizedFiles({
      "src/App.tsx": lines(2628),
      "src/components/Card.tsx": lines(40),
      "src/pages/OrdersPage.tsx": lines(OVERSIZE_LINES + 1),
    });
    expect(found.map((f) => f.path)).toEqual(["src/App.tsx", "src/pages/OrdersPage.tsx"]);
    expect(found[0].lines).toBe(2628);
  });

  it("ignores docs and a file exactly at the cap", () => {
    expect(
      oversizedFiles({
        "docs/PRD.md": lines(5000),
        "src/App.tsx": lines(OVERSIZE_LINES),
      })
    ).toEqual([]);
  });

  it("treats no files as healthy", () => {
    expect(oversizedFiles(null)).toEqual([]);
  });
});

describe("buildIterationUserPrompt", () => {
  it("feeds measured structure debt back to the model", () => {
    const prompt = buildIterationUserPrompt("เปลี่ยนปุ่มเป็นสีเขียว", {
      "src/App.tsx": lines(2628),
    });
    expect(prompt).toContain("STRUCTURE DEBT");
    expect(prompt).toContain("src/App.tsx — 2628 lines");
    expect(prompt).toContain("USER REQUEST: เปลี่ยนปุ่มเป็นสีเขียว");
  });

  it("stays silent on a healthy project", () => {
    const prompt = buildIterationUserPrompt("เพิ่มหน้า about", {
      "src/App.tsx": lines(90),
    });
    expect(prompt).not.toContain("STRUCTURE DEBT");
  });
});
