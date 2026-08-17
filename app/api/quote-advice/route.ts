import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { buildQuoteAdviceUser, parseQuoteAdvice, QUOTE_ADVICE_SYSTEM } from "@/lib/quote-advice";
import { parseDoc } from "@/lib/quote";

/**
 * Price advice for a quotation: the market range for this scope, a
 * recommendation, and a second opinion on every line's size and day count.
 *
 * Returns a proposal. Applying it is the sender's decision, made in the panel.
 */
const bodySchema = z.object({
  doc: z.unknown(),
});

export async function POST(request: Request) {
  const limit = await rateLimit(`quoteadvice:${clientIp(request)}`, 20);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const doc = parseDoc(body.doc, new Date().toISOString().slice(0, 10));
  if (!doc || doc.rows.length === 0) {
    return Response.json({ error: "ยังไม่มีรายการให้ตั้งราคา" }, { status: 400 });
  }

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: null, kind: "quote_advice", usage }));

  try {
    const raw = await generateText({
      system: QUOTE_ADVICE_SYSTEM,
      user: buildQuoteAdviceUser(doc),
      json: true,
      level: "medium",
      maxOutputTokens: 8192,
      onUsage: (u) => {
        usage = u;
      },
    });
    const advice = parseQuoteAdvice(raw);
    if (!advice) {
      return Response.json({ error: "ตั้งราคาให้ไม่สำเร็จ ลองอีกครั้งได้ครับ" }, { status: 422 });
    }
    return Response.json({ advice });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    console.error("[quote-advice] failed:", error);
    return Response.json({ error: "ตั้งราคาให้ไม่สำเร็จ" }, { status: 500 });
  }
}
