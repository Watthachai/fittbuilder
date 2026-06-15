import { z } from "zod";
import { generateText, MissingApiKeyError } from "@/lib/gemini";
import { buildExtractAnswersSystem } from "@/lib/prompts";
import { getPreset } from "@/lib/presets";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { SpecAnswers } from "@/lib/types";

const bodySchema = z.object({
  documentText: z.string().trim().min(20).max(100_000),
  presetId: z.string(),
});

export async function POST(request: Request) {
  const limit = rateLimit(`extract:${clientIp(request)}`, 20);
  if (!limit.ok) {
    return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const preset = getPreset(body.presetId);
  if (!preset) {
    return Response.json({ error: "ไม่รู้จัก preset นี้" }, { status: 400 });
  }

  try {
    const raw = await generateText({
      system: buildExtractAnswersSystem(JSON.stringify(preset.questions, null, 2)),
      user: body.documentText.slice(0, 24_000),
      json: true,
      temperature: 0,
      maxOutputTokens: 4096,
    });

    const parsed = JSON.parse(raw) as { answers?: Record<string, unknown> };
    const answers: SpecAnswers = {};
    for (const question of preset.questions) {
      const value = parsed.answers?.[question.id];
      if (question.type === "multi" && Array.isArray(value)) {
        const valid = value.filter(
          (v): v is string => typeof v === "string" && (question.options?.includes(v) ?? false)
        );
        if (valid.length > 0) answers[question.id] = valid;
      } else if (question.type === "single" && typeof value === "string") {
        if (question.options?.includes(value)) answers[question.id] = value;
      } else if (question.type === "text" && typeof value === "string" && value.trim()) {
        answers[question.id] = value.trim().slice(0, 500);
      }
    }
    return Response.json({ answers });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    // Extraction is best-effort pre-fill — an empty result is acceptable.
    return Response.json({ answers: {} });
  }
}
