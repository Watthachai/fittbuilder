import { createHash } from "node:crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { FittcorePayload } from "@/lib/fittcore";

export const maxDuration = 25;

const GATEWAY_URL = process.env.FITTCORE_GATEWAY_URL ?? "http://localhost:8080";
const API_KEY = process.env.FITTCORE_GATEWAY_API_KEY ?? "";

// Gateway limits — pre-checked here so an oversized/invalid job fails fast
// without a wasted round-trip (and maps to the Gateway's own 413/422).
const MAX_ZIP_BYTES = 25 * 1024 * 1024; // 25MB (Gateway 413)
const MAX_PROMPTS = 500;
const MAX_PROMPT_BYTES = 64 * 1024; // 64KB per prompt
const MAX_DOC_BYTES = 400 * 1024; // 400KB per brd/prd

/** Validate the payload against the Gateway's limits. Returns an HTTP status +
 *  message on failure (413 for size, 400 for everything else), or null if OK. */
function preCheck(p: FittcorePayload): { status: number; error: string } | null {
  if (!p || typeof p !== "object") return { status: 400, error: "payload ไม่ถูกต้อง" };
  if (!p.org_id) return { status: 400, error: "ขาด org_id" };
  if (!p.project_id) return { status: 400, error: "ขาด project_id" };
  if (typeof p.name !== "string" || !p.name) return { status: 400, error: "ขาด name" };
  if (typeof p.zip_base64 !== "string" || !p.zip_base64) return { status: 400, error: "ขาด zip_base64" };
  if (typeof p.zip_bytes !== "number" || p.zip_bytes <= 0) return { status: 400, error: "zip_bytes ไม่ถูกต้อง" };
  if (p.zip_bytes > MAX_ZIP_BYTES) {
    return { status: 413, error: `prototype ใหญ่เกิน 25MB (${(p.zip_bytes / 1024 / 1024).toFixed(1)}MB) — ลดไฟล์แล้วลองใหม่` };
  }
  // Integrity: standard base64 of N bytes is exactly 4*ceil(N/3) chars (btoa,
  // no newlines). A mismatch means the zip was mangled before it got here.
  if (p.zip_base64.length !== 4 * Math.ceil(p.zip_bytes / 3)) {
    return { status: 400, error: "zip เสียหาย (ขนาด base64 ไม่ตรงกับ zip_bytes)" };
  }
  if (Array.isArray(p.prompts)) {
    if (p.prompts.length > MAX_PROMPTS) return { status: 400, error: `prompts เกิน ${MAX_PROMPTS} รายการ` };
    if (p.prompts.some((x) => typeof x === "string" && x.length > MAX_PROMPT_BYTES)) {
      return { status: 400, error: "มี prompt ยาวเกิน 64KB" };
    }
  }
  if (typeof p.brd === "string" && p.brd.length > MAX_DOC_BYTES) return { status: 400, error: "BRD เกิน 400KB" };
  if (typeof p.prd === "string" && p.prd.length > MAX_DOC_BYTES) return { status: 400, error: "PRD เกิน 400KB" };
  return null;
}

/**
 * Server-side proxy from the Studio to the FITT Code Runner **Gateway**
 * (`POST /v1/ingest`). Runs server-side so the Gateway URL and the org API key
 * stay off the client. Attaches `X-API-Key` (from env — a per-org key issued by
 * the Gateway) and a content-derived `Idempotency-Key` so re-sending the SAME
 * prototype deduplicates (Gateway → 200 duplicate:true) while a changed one
 * queues a new job. Gateway status codes are mapped to clean messages.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(`fittcore:${clientIp(request)}`);
  if (!limit.ok) {
    return Response.json(
      { error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (!API_KEY) {
    console.error("[fittcore] FITTCORE_GATEWAY_API_KEY is not set");
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า API key ของ Gateway (FITTCORE_GATEWAY_API_KEY)" },
      { status: 500 }
    );
  }

  let payload: FittcorePayload;
  try {
    payload = (await request.json()) as FittcorePayload;
  } catch {
    return Response.json({ error: "เนื้อหาคำขอไม่ถูกต้อง (JSON ไม่สมบูรณ์)" }, { status: 400 });
  }

  const bad = preCheck(payload);
  if (bad) return Response.json({ error: bad.error }, { status: bad.status });

  // Same prototype (same zip) → same key → Gateway dedups; a changed prototype
  // → new key → new job. Scoped by project so different projects never collide.
  const contentHash = createHash("sha256").update(payload.zip_base64).digest("hex").slice(0, 32);
  const idempotencyKey = `${payload.project_id}:${contentHash}`;

  try {
    const res = await fetch(`${GATEWAY_URL}/v1/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "X-API-Key": API_KEY,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return Response.json(
        { error: `Gateway ตอบกลับไม่ใช่ JSON (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    // 202 (queued) and 200 (idempotent duplicate) are both success — pass the
    // { jobId, state, duplicate } body through as 200 for the client.
    if (res.ok) return Response.json(body, { status: 200 });

    const detail = (body as { error?: string })?.error;
    const message =
      res.status === 403
        ? "API key ไม่ตรงกับ workspace นี้ (org_mismatch)"
        : res.status === 413
          ? "prototype ใหญ่เกิน 25MB — ลดไฟล์แล้วลองใหม่"
          : res.status === 422
            ? `payload ไม่ถูกต้อง (invalid_payload)${detail ? `: ${detail}` : ""}`
            : `Gateway ตอบกลับ HTTP ${res.status}${detail ? `: ${detail}` : ""}`;
    return Response.json({ error: message }, { status: res.status === 403 || res.status === 413 || res.status === 422 ? res.status : 502 });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("[fittcore] gateway proxy failed:", error);
    return Response.json(
      {
        error: timedOut
          ? "Gateway ไม่ตอบกลับภายในเวลาที่กำหนด"
          : "เชื่อมต่อ Gateway ไม่สำเร็จ ลองใหม่อีกครั้ง",
      },
      { status: 502 }
    );
  }
}
