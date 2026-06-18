import { z } from "zod";
import { generateText, MissingApiKeyError } from "@/lib/gemini";
import { DESIGN_OPTIONS_SYSTEM } from "@/lib/prompts";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  brd: z.string().max(50_000).optional(),
  prd: z.string().max(50_000).optional(),
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const optionSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(160),
  palette: z.object({
    bg: z.string().regex(HEX),
    surface: z.string().regex(HEX),
    primary: z.string().regex(HEX),
    text: z.string().regex(HEX),
  }),
  font: z.string().trim().min(1).max(120),
});
const responseSchema = z.object({ options: z.array(optionSchema) });

/** Strip an accidental ```json fence so JSON.parse never trips on it. */
function stripFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(request: Request) {
  const limit = rateLimit(`design:${clientIp(request)}`, 20);
  if (!limit.ok) {
    return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  // The idea + (optionally) a short slice of the approved docs steer the palettes.
  const context = [body.prd, body.brd].filter(Boolean).join("\n\n").slice(0, 2000);
  const user = context ? `${body.prompt}\n\nเอกสารอ้างอิง:\n${context}` : body.prompt;

  try {
    const raw = await generateText({
      system: DESIGN_OPTIONS_SYSTEM,
      user,
      temperature: 0.9,
      maxOutputTokens: 4096,
    });
    const parsed = responseSchema.parse(JSON.parse(stripFence(raw)));
    // Keep at most 5, drop any that slipped through malformed.
    const options = parsed.options.slice(0, 5);
    if (options.length < 2) {
      return Response.json({ error: "ออกแบบไม่สำเร็จ" }, { status: 502 });
    }
    return Response.json({ options });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    console.error("[design-options] failed:", error);
    return Response.json({ error: "ออกแบบไม่สำเร็จ" }, { status: 502 });
  }
}
