import { z } from "zod";
import { getAgent } from "@/lib/agents/registry";
import { buildSpecContext } from "@/lib/context-builder";
import { parseGeneration } from "@/lib/files";
import { MissingApiKeyError, streamText } from "@/lib/gemini";
import {
  buildGenerationSystemPrompt,
  buildIterationSystemPrompt,
  buildIterationUserPrompt,
} from "@/lib/prompts";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { PRESET_IDS } from "@/lib/presets";
import type { GenerateEvent } from "@/lib/types";

export const maxDuration = 120;

/** Per-attempt budget; one retry on bad output (PRD F-002). */
const ATTEMPT_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  previousFiles: z.record(z.string().max(200), z.string().max(200_000)).optional(),
  iterationMode: z.boolean().optional(),
  brd: z.string().max(50_000).optional(),
  prd: z.string().max(50_000).optional(),
  presetId: z
    .string()
    .refine((id) => PRESET_IDS.includes(id) || id === "other")
    .optional(),
  presetAnswers: z
    .record(z.string(), z.union([z.string().max(2_000), z.array(z.string().max(500)).max(20)]))
    .optional(),
});

function sse(event: GenerateEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  const limit = rateLimit(`generate:${clientIp(request)}`);
  if (!limit.ok) {
    return Response.json(
      { error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const iteration = Boolean(body.iterationMode && body.previousFiles);
  // The code-builder SKILL.md body is the Build-phase persona; fall back to the
  // built-in default if the file is unreadable so generation still works.
  const persona = (await getAgent("code-builder").catch(() => null))?.body;
  const system = iteration
    ? buildIterationSystemPrompt(persona)
    : buildGenerationSystemPrompt(
        buildSpecContext({
          brd: body.brd,
          prd: body.prd,
          presetId: body.presetId,
          answers: body.presetAnswers,
        }),
        persona
      );
  const user = iteration
    ? buildIterationUserPrompt(body.prompt, body.previousFiles!)
    : body.prompt;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateEvent) => controller.enqueue(sse(event));

      try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const abort = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
          let raw = "";
          try {
            for await (const chunk of streamText({
              system,
              user,
              json: true,
              abortSignal: abort,
              // Retries run slightly cooler for more conservative output.
              temperature: attempt === 1 ? 0.7 : 0.4,
            })) {
              raw += chunk;
              send({ type: "delta", content: chunk });
            }
            const result = parseGeneration(raw, { iteration });
            send({ type: "done", result });
            controller.close();
            return;
          } catch (error) {
            if (error instanceof MissingApiKeyError) throw error;
            if (attempt === MAX_ATTEMPTS) throw error;
            send({
              type: "status",
              message: "ผลลัพธ์รอบแรกใช้ไม่ได้ กำลังลองใหม่อีกครั้ง…",
            });
          }
        }
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "AI ใช้เวลานานเกินไป กรุณาลองใหม่"
              : "สร้างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
        console.error("[generate] failed:", error);
        controller.enqueue(sse({ type: "error", message }));
        controller.close();
      }
    },
    cancel() {
      // Client aborted (Escape key) — nothing to clean up beyond the stream.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
