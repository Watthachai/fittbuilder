import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { FittcorePayload } from "@/lib/fittcore";

export const maxDuration = 25;

const RUNNER_URL = process.env.FITTCORE_RUNNER_URL ?? "http://localhost:8080";

/**
 * Server-side proxy to the FITT Code Runner: forwards the project payload from
 * the Studio to CRN's `POST /internal/projects`. Runs server-side because the
 * Next server shares a host with CRN (localhost:8080) and to keep the Runner's
 * URL off the client. The Runner's JSON response and status are passed through;
 * transport/timeout failures are normalized to a clean `{ error }`.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(`fittcore:${clientIp(request)}`);
  if (!limit.ok) {
    return Response.json(
      { error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let payload: FittcorePayload;
  try {
    payload = (await request.json()) as FittcorePayload;
  } catch {
    return Response.json({ error: "เนื้อหาคำขอไม่ถูกต้อง (JSON ไม่สมบูรณ์)" }, { status: 400 });
  }

  if (!payload || typeof payload.name !== "string" || typeof payload.zip_base64 !== "string" || !payload.zip_base64) {
    return Response.json({ error: "payload ไม่ครบ — ต้องมี name และ zip_base64" }, { status: 400 });
  }

  try {
    const res = await fetch(`${RUNNER_URL}/internal/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      // Runner returned non-JSON (e.g. an HTML error page) — surface it cleanly.
      return Response.json(
        { error: `Code Runner ตอบกลับไม่ใช่ JSON (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    return Response.json(body, { status: res.status });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("[fittcore] proxy failed:", error);
    return Response.json(
      {
        error: timedOut
          ? "Code Runner ไม่ตอบกลับภายในเวลาที่กำหนด"
          : "เชื่อมต่อ Code Runner ไม่สำเร็จ ลองใหม่อีกครั้ง",
      },
      { status: 502 }
    );
  }
}
