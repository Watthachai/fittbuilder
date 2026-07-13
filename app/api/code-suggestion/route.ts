import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { recordUsage } from "@/lib/ai-usage";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const bodySchema = z.object({
  prefix: z.string().max(8_000),
  suffix: z.string().max(4_000).optional(),
  language: z.string().max(40).optional(),
});

const SYSTEM = `You are an inline code-completion engine inside a code editor (like GitHub Copilot ghost text).
Continue the code AT THE CURSOR. Output ONLY the raw text to insert at the cursor:
- no explanations, no markdown fences, no comments about what you did,
- do NOT repeat code that already exists before or after the cursor,
- keep it short (usually one expression or a few lines),
- match the file's existing style/indentation,
- if there is nothing sensible to add, output an empty response.`;

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : trimmed).replace(/\n+$/, "");
}

export async function POST(request: Request) {
  const limit = await rateLimit(`suggest:${clientIp(request)}`);
  if (!limit.ok) return Response.json({ suggestion: "" });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ suggestion: "" });
  }

  const user = `Language: ${body.language ?? "javascript"}

--- CODE BEFORE CURSOR ---
${body.prefix}
--- CODE AFTER CURSOR ---
${body.suffix ?? ""}

Return ONLY the text to insert at the cursor.`;

  let usage: TokenUsage | null = null;
  // High-frequency ghost text → skip the auth round-trip; record kind only.
  after(() => void recordUsage({ userId: null, projectId: null, kind: "code_suggestion", usage }));

  try {
    const raw = await generateText({
      system: SYSTEM,
      user,
      temperature: 0.2,
      maxOutputTokens: 256,
      // Cancel the Gemini call if the editor cancels the completion (or on timeout).
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      onUsage: (u) => {
        usage = u;
      },
    });
    return Response.json({ suggestion: stripFences(raw) });
  } catch (error) {
    // Fail soft — autocomplete must never break typing.
    if (!(error instanceof MissingApiKeyError)) console.error("[code-suggestion] failed:", error);
    return Response.json({ suggestion: "" });
  }
}
