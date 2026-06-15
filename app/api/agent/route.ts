import { z } from "zod";
import { getAgentForPhase } from "@/lib/agents/registry";
import { MissingApiKeyError, streamText } from "@/lib/gemini";
import { isBuildPhase, isPhaseId } from "@/lib/phases";
import { buildAgentSystemPrompt } from "@/lib/prompts";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { AgentEvent, AgentTurn, DocKind } from "@/lib/types";

export const maxDuration = 60;

const ATTEMPT_TIMEOUT_MS = 55_000;

const DOC_KINDS = ["idea", "brd", "prd", "verify", "review", "ship"] as const;

const bodySchema = z.object({
  phase: z.string().refine(isPhaseId, "unknown phase"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(6_000),
      })
    )
    .max(80),
  docs: z.record(z.enum(DOC_KINDS), z.string().max(50_000)).optional(),
});

// Closing fence must sit at line start so a stray ``` inside the doc body
// (e.g. an example code block) doesn't truncate the capture early.
const DOC_BLOCK = /^```(idea|brd|prd|verify|review|ship)[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm;
const DOC_LABELS: Record<DocKind, string> = {
  idea: "IDEA",
  brd: "BRD",
  prd: "PRD",
  verify: "VERIFY",
  review: "REVIEW",
  ship: "SHIP",
};

/** Split the model's reply into chat text and the documents it issued. */
function extractTurn(raw: string): AgentTurn {
  const docs: AgentTurn["docs"] = {};
  const reply = raw
    .replace(DOC_BLOCK, (_match, kind: DocKind, body: string) => {
      docs[kind] = body.trim();
      return `📄 เอกสาร ${DOC_LABELS[kind]} อัปเดตแล้ว — เปิดดู/แก้ได้ที่ docs/${DOC_LABELS[kind]}.md ในแท็บ Code`;
    })
    .trim();
  return { reply: reply || "อัปเดตเอกสารเรียบร้อยแล้วครับ", docs };
}

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
  const system = buildAgentSystemPrompt(agent.body, body.docs ?? {});
  const transcript = body.messages
    .map((m) => `${m.role === "user" ? "ผู้ใช้" : "FITT"}: ${m.content}`)
    .join("\n\n");
  const user = transcript || "(เริ่มบทสนทนา — ทักทายสั้นๆ แล้วเริ่มงานของเฟสนี้)";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let raw = "";
        for await (const chunk of streamText({
          system,
          user,
          temperature: 0.6,
          abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        })) {
          raw += chunk;
          controller.enqueue(sse({ type: "delta", content: chunk }));
        }
        if (!raw.trim()) throw new Error("empty reply");
        controller.enqueue(sse({ type: "done", turn: extractTurn(raw) }));
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "AI ใช้เวลานานเกินไป กรุณาลองใหม่"
              : "ตัวแทน AI สะดุด กรุณาส่งข้อความอีกครั้ง";
        console.error("[agent] failed:", error);
        controller.enqueue(sse({ type: "error", message }));
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
