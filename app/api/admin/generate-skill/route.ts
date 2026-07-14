import { after } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin-server";
import { recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { SKILL_SYSTEM, parseGeneratedSkill } from "@/lib/skills/generate";
import type { GenerateSkillEvent } from "@/lib/types";

export const maxDuration = 120;
const ATTEMPT_TIMEOUT_MS = 110_000;

const bodySchema = z.object({
  topic: z.string().trim().min(2).max(2_000),
  url: z.string().trim().url().max(500).optional().or(z.literal("")),
  webSearch: z.boolean().optional(),
});

function sse(event: GenerateSkillEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const tools: ("googleSearch" | "urlContext")[] = [];
  if (body.url) tools.push("urlContext");
  if (body.webSearch) tools.push("googleSearch");

  const user = [
    `โดเมน/โจทย์: ${body.topic}`,
    body.url ? `อ้างอิงจาก URL นี้: ${body.url}` : "",
    body.webSearch ? "ค้นเว็บเพิ่มเติมเพื่ออ้างอิงข้อมูลล่าสุด" : "",
  ]
    .filter(Boolean)
    .join("\n");

  let usage: TokenUsage | null = null;
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GenerateSkillEvent) => controller.enqueue(sse(e));
      try {
        for await (const part of streamParts({
          system: SKILL_SYSTEM,
          user,
          thinking: true,
          temperature: 0.7,
          tools,
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
          onUsage: (u) => {
            usage = u;
          },
        })) {
          if (part.thought) {
            send({ type: "thought", content: part.text });
            continue;
          }
          full += part.text;
          send({ type: "text", content: part.text });
        }
        send({ type: "done", template: parseGeneratedSkill(full) });
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : "สร้างไม่สำเร็จ กรุณาลองใหม่";
        console.error("[generate-skill] failed:", error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  after(() => void recordUsage({ userId: admin.id, projectId: null, kind: "generate_skill", usage }));

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
