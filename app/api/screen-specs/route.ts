import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { buildScreenSpecUser, parseScreenSpecs, SCREEN_SPEC_SYSTEM } from "@/lib/screen-spec";
import type { ProjectFiles } from "@/lib/types";

/**
 * Read the demo's code and describe what each named screen does, in the words
 * a customer reads a quotation in. The names come from the screen inventory,
 * so the descriptions line up one-to-one with the priced rows.
 */
const bodySchema = z.object({
  files: z.record(z.string().max(200), z.string().max(200_000)),
  names: z.array(z.string().max(200)).min(1).max(80),
});

export async function POST(request: Request) {
  const limit = await rateLimit(`screenspec:${clientIp(request)}`, 20);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: null, kind: "screen_spec", usage }));

  try {
    const raw = await generateText({
      system: SCREEN_SPEC_SYSTEM,
      user: buildScreenSpecUser(body.files as ProjectFiles, body.names),
      json: true,
      temperature: 0.2,
      maxOutputTokens: 8192,
      onUsage: (u) => {
        usage = u;
      },
    });
    const specs = parseScreenSpecs(raw, body.names);
    if (Object.keys(specs).length === 0) {
      return Response.json({ error: "เขียนคำอธิบายไม่ออก ลองพิมพ์เองได้ครับ" }, { status: 422 });
    }
    return Response.json({ specs });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    console.error("[screen-specs] failed:", error);
    return Response.json({ error: "เขียนคำอธิบายไม่สำเร็จ" }, { status: 500 });
  }
}
