import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { DETECT_PRESET_SYSTEM } from "@/lib/prompts";
import { detectSkillByKeywords, SKILL_IDS } from "@/lib/skills/registry";
import { getAllSkills } from "@/lib/skills/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Detects the domain skill template from the user's prompt (short text), so the
// studio can confirm it before the Define interview / Build.
const bodySchema = z.object({
  text: z.string().trim().min(1).max(10_000),
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

  const excerpt = body.text.slice(0, 3000);
  // Keyword detection runs across built-in AND published custom templates.
  const allSkills = await getAllSkills();

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: null, kind: "detect_skill", usage }));

  try {
    const word = (
      await generateText({
        system: DETECT_PRESET_SYSTEM,
        user: excerpt,
        temperature: 0,
        maxOutputTokens: 2048,
        onUsage: (u) => {
          usage = u;
        },
      })
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    if (SKILL_IDS.includes(word)) {
      return Response.json({ skillId: word, confidence: "high" });
    }
    // Model said "other"/unexpected — fall back to keyword scoring.
    const fallback = detectSkillByKeywords(excerpt, allSkills);
    return Response.json({
      skillId: fallback.score > 0 ? fallback.skillId : null,
      confidence: fallback.score >= 2 ? "high" : "low",
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const fallback = detectSkillByKeywords(excerpt, allSkills);
    return Response.json({
      skillId: fallback.score > 0 ? fallback.skillId : null,
      confidence: "low",
    });
  }
}
