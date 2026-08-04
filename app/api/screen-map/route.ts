import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { buildScreenMapUser, parseScreenMap, SCREEN_MAP_SYSTEM } from "@/lib/screen-map";
import type { ProjectFiles } from "@/lib/types";

/**
 * Read the demo's own code and answer: which screens exist, what you click to
 * reach each one, and which modals hang off them. The auto-walk then drives the
 * running app from this map and photographs every stop.
 */
const bodySchema = z.object({
  files: z.record(z.string().max(200), z.string().max(200_000)),
});

export async function POST(request: Request) {
  const limit = await rateLimit(`screenmap:${clientIp(request)}`, 20);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: null, kind: "screen_map", usage }));

  try {
    const raw = await generateText({
      system: SCREEN_MAP_SYSTEM,
      user: buildScreenMapUser(body.files as ProjectFiles),
      json: true,
      temperature: 0,
      maxOutputTokens: 8192,
      onUsage: (u) => {
        usage = u;
      },
    });
    const screens = parseScreenMap(raw);
    if (screens.length === 0) {
      return Response.json({ error: "อ่านโครงสร้างหน้าจอไม่ออก ลองแคปเองทีละหน้าได้ครับ" }, { status: 422 });
    }
    return Response.json({ screens });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    console.error("[screen-map] failed:", error);
    return Response.json({ error: "อ่านโครงสร้างหน้าจอไม่สำเร็จ" }, { status: 500 });
  }
}
