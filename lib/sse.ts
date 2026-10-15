"use client";

import type {
  AgentEvent,
  AgentRequestBody,
  GenerateEvent,
  GenerateSkillEvent,
} from "./types";

/**
 * The connection to the server broke before the turn's answer arrived.
 *
 * Not a failed turn: the server runs every turn to the end whether or not
 * anyone is still listening (app/api/generate), so the turn is usually still
 * going. Kept apart from the server's own error event so the studio can wait
 * for that turn instead of starting the same one again (case #35).
 */
export class StreamDropped extends Error {
  constructor() {
    super("การเชื่อมต่อกับเซิร์ฟเวอร์หลุดกลางรอบ");
    this.name = "StreamDropped";
  }
}

/** A network failure, unless the caller cancelled — a cancel stays an abort. */
function dropped(error: unknown, signal: AbortSignal): unknown {
  return signal.aborted ? error : new StreamDropped();
}

/**
 * POST to an SSE endpoint and yield parsed events.
 * (EventSource only supports GET, so we parse the fetch stream by hand.)
 * Comment lines (": keepalive") carry no event and are passed by.
 */
async function* streamSse<T>(
  url: string,
  body: unknown,
  signal: AbortSignal
): AsyncGenerator<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw dropped(error, signal);
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${response.status})`);
  }
  if (!response.body) throw new Error("ไม่ได้รับข้อมูลจากเซิร์ฟเวอร์");

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<string>;
      try {
        chunk = await reader.read();
      } catch (error) {
        throw dropped(error, signal);
      }
      const { done, value } = chunk;
      if (done) break;
      buffer += value;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const block of events) {
        const dataLine = block
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        yield JSON.parse(dataLine.slice(6)) as T;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * A build turn's events. Every turn ends in `done` or `error`; a body that
 * ends without one was cut by something between us and the server, and is a
 * drop, not a turn that finished with whatever files had arrived.
 */
export async function* streamGenerate(
  body: unknown,
  signal: AbortSignal
): AsyncGenerator<GenerateEvent> {
  let answered = false;
  for await (const event of streamSse<GenerateEvent>("/api/generate", body, signal)) {
    if (event.type === "done" || event.type === "error") answered = true;
    yield event;
  }
  if (!answered && !signal.aborted) throw new StreamDropped();
}

export function streamAgent(
  body: AgentRequestBody,
  signal: AbortSignal
): AsyncGenerator<AgentEvent> {
  return streamSse<AgentEvent>("/api/agent", body, signal);
}

export function streamGenerateSkill(
  body: { topic: string; url?: string; webSearch?: boolean },
  signal: AbortSignal
): AsyncGenerator<GenerateSkillEvent> {
  return streamSse<GenerateSkillEvent>("/api/admin/generate-skill", body, signal);
}

export function streamOrgSkill(
  body: { orgId: string; brief?: string },
  signal: AbortSignal
): AsyncGenerator<GenerateSkillEvent> {
  return streamSse<GenerateSkillEvent>("/api/org-skill/generate", body, signal);
}

