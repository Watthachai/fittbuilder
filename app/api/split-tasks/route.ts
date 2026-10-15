import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { MESSAGE_MAX_CHARS } from "@/lib/limits";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Split a many-item change request into tasks the studio runs one turn each
 * (lib/tasks). A small JSON call: it reads the request, not the code.
 */
export const dynamic = "force-dynamic";

const MAX_TASKS = 15;

/**
 * A space every few seconds while the model works (case #8).
 *
 * The split takes about forty seconds and sends nothing until it is done, and a
 * company network cut exactly that: the server finished, the browser got
 * "Failed to fetch". JSON may start with whitespace, so the spaces keep the line
 * busy and the browser still parses one JSON answer. The status is committed
 * with the first byte, so a failure from here on is an `error` in the body —
 * which the studio already reads (lib/tasks-client).
 */
const KEEPALIVE_MS = 10_000;

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(MESSAGE_MAX_CHARS),
  projectId: z.uuid().nullable(),
});

const SYSTEM = `You split a change request for an existing web app into tasks. Each task will be carried out in its own AI turn, one after another, by a developer who can see the whole request.

Answer JSON only: {"tasks": [{"title": "...", "detail": "..."}]}
- One task per thing the user asked for, in their order. Keep their language (usually Thai).
- "title": a short line naming the change.
- "detail": everything the user said about that item, copied in full — numbers, names, field lists, sample data counts. Never summarise away a detail; the developer works from this.
- Do not invent tasks the user did not ask for, and do not drop any.
- Merge only items that cannot be done apart (e.g. "add a page" and "link it from the menu" for the same page).
- A request that is really one change: answer with one task.
- At most ${MAX_TASKS} tasks.`;

export async function POST(request: Request) {
  const limit = await rateLimit(`split-tasks:${clientIp(request)}`, 20);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: body.projectId, kind: "split_tasks", usage }));

  const split = async (): Promise<{ tasks: { title: string; detail: string }[] } | { error: string }> => {
    try {
      const raw = await generateText({
        system: SYSTEM,
        user: body.prompt,
        json: true,
        level: "low",
        maxOutputTokens: 16_384,
        abortSignal: AbortSignal.timeout(60_000),
        onUsage: (u) => {
          usage = u;
        },
      });
      const parsed = z
        .object({ tasks: z.array(z.object({ title: z.string().trim().min(1), detail: z.string().trim() })).min(1) })
        .parse(JSON.parse(raw));
      return { tasks: parsed.tasks.slice(0, MAX_TASKS) };
    } catch (error) {
      if (error instanceof MissingApiKeyError) return { error: error.message };
      console.error("[split-tasks] failed:", error);
      return { error: "แตกงานเป็นข้อไม่สำเร็จ ลองส่งอีกครั้ง" };
    }
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(" "));
        } catch {
          // The browser is gone; the answer has nowhere to go either.
        }
      }, KEEPALIVE_MS);
      const answer = await split();
      clearInterval(beat);
      try {
        controller.enqueue(encoder.encode(JSON.stringify(answer)));
        controller.close();
      } catch {
        // Closed by the browser — nothing left to send it.
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      // no-transform keeps compression off, so each space leaves at once
      // instead of waiting in a gzip buffer.
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
