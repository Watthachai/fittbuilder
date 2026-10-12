import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { escapeJsxText } from "@/lib/jsx-text";

/**
 * Cases #12 and #14: a page quoted code or a comparison as JSX text —
 * `if (parsed.length > 0)`, "> 90%". esbuild, which compiles the preview,
 * rejects a bare ">" or "}" there and the whole app stops. The prompt rule
 * (0.103.1) did not hold: case #14 came from 0.103.1 with seven of them in one
 * file. Where they are is a fact in the file, so the fix is ours to make.
 */
describe("escapeJsxText", () => {
  it("writes > and } in JSX text as entities, which render the same characters", () => {
    const source = `export default function Report() {
  return (
    <p>
      <strong>Root Cause:</strong> เงื่อนไข \`if (parsed.length > 0)\` ทำให้ตก fallback
      <span>ผ่าน > 90% ของเคส } ทั้งหมด</span>
    </p>
  );
}
`;
    expect(escapeJsxText(source)).toBe(`export default function Report() {
  return (
    <p>
      <strong>Root Cause:</strong> เงื่อนไข \`if (parsed.length &gt; 0)\` ทำให้ตก fallback
      <span>ผ่าน &gt; 90% ของเคส &#125; ทั้งหมด</span>
    </p>
  );
}
`);
  });

  it("leaves code alone: comparisons, arrows, generics, expressions and attribute strings", () => {
    const source = `import { useState } from "react";
const ok = (xs: Array<number>) => xs.length > 0;
export default function Card({ n }: { n: number }) {
  const [v] = useState<number>(n);
  return <div title="a > b" className={v > 1 ? "big" : "small"}>{ok([v]) ? "มี" : "ไม่มี"} &gt; {">"}</div>;
}
`;
    expect(escapeJsxText(source)).toBeNull();
  });

  it("leaves a file it cannot parse to fail where it is", () => {
    expect(escapeJsxText("export default function X() { return <div> > ; }")).toBeNull();
  });
});

describe("/api/generate", () => {
  it("escapes this turn's JSX files before the turn is parked as complete", () => {
    const route = readFileSync("app/api/generate/route.ts", "utf8");
    const fix = route.indexOf("escapeJsxText(content)");
    expect(fix).toBeGreaterThan(-1);
    expect(fix).toBeLessThan(route.indexOf("await parkDraft(true)"));
  });
});
