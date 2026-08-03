import { describe, expect, it } from "vitest";
import { shaOf } from "../revisions";

describe("shaOf", () => {
  it("is content-addressed: same files → same sha, always", async () => {
    const a = await shaOf({ "src/App.tsx": "x", "src/main.tsx": "y" });
    const b = await shaOf({ "src/App.tsx": "x", "src/main.tsx": "y" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{7}$/);
  });

  it("ignores key order (the map is serialized canonically)", async () => {
    const a = await shaOf({ "src/App.tsx": "x", "src/main.tsx": "y" });
    const b = await shaOf({ "src/main.tsx": "y", "src/App.tsx": "x" });
    expect(a).toBe(b);
  });

  it("changes when any byte of any file changes", async () => {
    const base = await shaOf({ "src/App.tsx": "x" });
    expect(await shaOf({ "src/App.tsx": "x " })).not.toBe(base);
    expect(await shaOf({ "src/App.tsx": "x", "src/b.ts": "" })).not.toBe(base);
  });

  it("distinguishes content moved between files", async () => {
    const a = await shaOf({ "a.ts": "1", "b.ts": "2" });
    const b = await shaOf({ "a.ts": "2", "b.ts": "1" });
    expect(a).not.toBe(b);
  });
});
