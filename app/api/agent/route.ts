import { after } from "next/server";
import { z } from "zod";
import { getAgentForPhase } from "@/lib/agents/registry";
import { AgentStreamFilter } from "@/lib/agent-stream";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { isBuildPhase, isPhaseId } from "@/lib/phases";
import { buildAgentSystemPrompt } from "@/lib/prompts";
import { resolveSkill } from "@/lib/skills/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { AgentEvent } from "@/lib/types";

export const maxDuration = 60;

const ATTEMPT_TIMEOUT_MS = 55_000;

const DOC_KINDS = ["idea", "brd", "prd", "verify", "review", "ship"] as const;

const bodySchema = z.object({
  phase: z.string().refine(isPhaseId, "unknown phase"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(10_000),
      })
    )
    .max(80),
  // partialRecord: the client sends only the docs that exist so far (often none
  // on the first turn). z.record with an enum key is exhaustive in Zod v4 and
  // would reject any partial set — including {} — which 400s every agent call.
  docs: z.partialRecord(z.enum(DOC_KINDS), z.string().max(50_000)).optional(),
  skillId: z.string().max(40).optional(),
  express: z.boolean().optional(),
  projectId: z.string().uuid().optional(),
});

function sse(event: AgentEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  const limit = rateLimit(`agent:${clientIp(request)}`);
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

  // The Build phase produces code, not a markdown doc — that path is /api/generate.
  if (isBuildPhase(body.phase)) {
    return Response.json(
      { error: "เฟส Build ใช้ /api/generate" },
      { status: 400 }
    );
  }

  const agent = await getAgentForPhase(body.phase);
  const system = buildAgentSystemPrompt(
    agent.body,
    body.docs ?? {},
    await resolveSkill(body.skillId),
    body.express
  );
  const transcript = body.messages
    .map((m) => `${m.role === "user" ? "ผู้ใช้" : "FITT"}: ${m.content}`)
    .join("\n\n");
  const user =
    transcript ||
    (body.express
      ? "(สร้างเอกสารของเฟสนี้จาก brief และเอกสารก่อนหน้าให้สมบูรณ์ในครั้งเดียว)"
      : "(เริ่มบทสนทนา — ทักทายสั้นๆ แล้วเริ่มงานของเฟสนี้)");

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() =>
    void recordUsage({ userId, projectId: body.projectId ?? null, kind: "agent", usage })
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(sse(event));
      const filter = new AgentStreamFilter();
      try {
        for await (const part of streamParts({
          system,
          user,
          temperature: 0.6,
          thinking: true,
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
          onUsage: (u) => {
            usage = u;
          },
        })) {
          if (part.thought) {
            send({ type: "thought", content: part.text });
            continue;
          }
          const { text, actions } = filter.push(part.text);
          if (text) send({ type: "text", content: text });
          for (const a of actions) send({ type: "action", icon: a.icon, label: a.label });
        }
        send({ type: "done", turn: filter.getTurn() });
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "AI ใช้เวลานานเกินไป กรุณาลองใหม่"
              : "ตัวแทน AI สะดุด กรุณาส่งข้อความอีกครั้ง";
        console.error("[agent] failed:", error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
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
