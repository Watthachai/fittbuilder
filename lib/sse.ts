"use client";

import type {
  AgentEvent,
  AgentRequestBody,
  GenerateEvent,
  GenerateSkillEvent,
} from "./types";

/**
 * POST to an SSE endpoint and yield parsed events.
 * (EventSource only supports GET, so we parse the fetch stream by hand.)
 */
async function* streamSse<T>(
  url: string,
  body: unknown,
  signal: AbortSignal
): AsyncGenerator<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${response.status})`);
  }
  if (!response.body) throw new Error("ไม่ได้รับข้อมูลจากเซิร์ฟเวอร์");

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
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

export function streamGenerate(
  body: unknown,
  signal: AbortSignal
): AsyncGenerator<GenerateEvent> {
  return streamSse<GenerateEvent>("/api/generate", body, signal);
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

