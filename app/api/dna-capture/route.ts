import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { buildDnaCaptureSystem } from "@/lib/prompts";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const BLOCKS = ["decisionRights", "information", "motivators", "structure"] as const;

const bodySchema = z.object({ text: z.string().trim().min(12).max(4_000) });

export async function POST(request: Request) {
  const limit = await rateLimit(`dnacap:${clientIp(request)}`, 30);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); }
  catch { return Response.json({ block: null }); } // too short / invalid → nothing to capture

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: null, kind: "org_dna", usage }));

  try {
    const raw = await generateText({
      system: buildDnaCaptureSystem(),
      user: body.text.slice(0, 4_000),
      json: true,
      temperature: 0,
      maxOutputTokens: 512,
      onUsage: (u) => { usage = u; },
    });
    const parsed = JSON.parse(raw) as { block?: unknown; snippet?: unknown };
    const block = typeof parsed.block === "string" && (BLOCKS as readonly string[]).includes(parsed.block)
      ? (parsed.block as (typeof BLOCKS)[number]) : null;
    const snippet = typeof parsed.snippet === "string" ? parsed.snippet.trim() : "";
    if (!block || !snippet) return Response.json({ block: null });
    return Response.json({ block, snippet: snippet.slice(0, 140) });
  } catch (error) {
    if (error instanceof MissingApiKeyError) return Response.json({ block: null });
    console.error("[dna-capture] failed:", error);
    return Response.json({ block: null }); // never disrupt the chat
  }
}
