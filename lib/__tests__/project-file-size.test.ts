import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";

vi.mock("@/lib/ai-usage", () => ({ currentUserId: async () => null, recordUsage: async () => {} }));
vi.mock("@/lib/skills/org-resolve", () => ({ resolveSkillForProject: async () => null }));

/**
 * Every request that carries a project's files capped each file at 200,000
 * characters. Seishin's translations.json (452,424) made every edit of the
 * project fail as a bare "คำขอไม่ถูกต้อง" — for good, whatever the person typed.
 * What the model reads is bounded where each route builds its prompt
 * (lib/iteration-context, lib/screen-map, lib/screen-spec), not per file.
 */
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("/api/generate", () => {
  it("takes a project file of any length, and names the field it refuses", async () => {
    const res = await post({
      prompt: "",
      iterationMode: true,
      previousFiles: { "src/i18n/translations.json": "x".repeat(452_424) },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "คำขอไม่ถูกต้อง (prompt)" });
  });
});

describe.each(["app/api/screen-map/route.ts", "app/api/screen-specs/route.ts"])("%s", (path) => {
  it("takes a project file of any length", () => {
    const route = readFileSync(path, "utf8");
    const schema = route.slice(route.indexOf("const bodySchema"), route.indexOf("export async function POST"));
    expect(schema).toContain("files: z.record(z.string().max(200), z.string())");
  });
});
