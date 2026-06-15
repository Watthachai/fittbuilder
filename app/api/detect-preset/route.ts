import { z } from "zod";
import { generateText, MissingApiKeyError } from "@/lib/gemini";
import { DETECT_PRESET_SYSTEM } from "@/lib/prompts";
import { detectPresetByKeywords, PRESET_IDS } from "@/lib/presets";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  documentText: z.string().trim().min(20).max(100_000),
});

export async function POST(request: Request) {
  const limit = rateLimit(`detect:${clientIp(request)}`, 20);
  if (!limit.ok) {
    return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  // PRD §9.3: classify on the first 3,000 chars only.
  const excerpt = body.documentText.slice(0, 3000);

  try {
    const word = (
      await generateText({
        system: DETECT_PRESET_SYSTEM,
        user: excerpt,
        temperature: 0,
        maxOutputTokens: 2048,
      })
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    if (PRESET_IDS.includes(word)) {
      return Response.json({ presetId: word, confidence: "high" });
    }
    // Model said "other" or something unexpected — fall back to keywords.
    const fallback = detectPresetByKeywords(excerpt);
    return Response.json({
      presetId: fallback.presetId,
      confidence: fallback.score >= 3 ? "high" : "low",
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const fallback = detectPresetByKeywords(excerpt);
    return Response.json({ presetId: fallback.presetId, confidence: "low" });
  }
}
