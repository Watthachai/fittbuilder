import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { authenticate } from "@/lib/fittvoice/authenticate";
import { HTTP_STATUS, MAX_BODY_BYTES, checkDelivery, errorBody } from "@/lib/fittvoice/delivery";
import type { ErrorCode } from "@/lib/fittvoice/types";
import type { Json } from "@/lib/db/types";

/**
 * FITT Voice → FITT Builder deliveries (contracts fittbuilder.delivery.v1 and
 * fittbuilder.summary-delivery.v1, told apart by schemaVersion in checkDelivery).
 *
 * Backend to backend: FITT Voice's server sends the summary of a customer
 * interview its user reviewed; the first delivery of an export session creates a
 * project in the Define phase of the workspace the token is bound to — a service
 * credential, or a person's account connection (lib/fittvoice/connect.ts) — and
 * later ones update that project. Nothing here starts a generation.
 *
 * Order matters and follows the contract: the credential, then the rate, then
 * the size, the JSON, the schema, the hash and the references — all before
 * anything is written. The writing itself is one database function, so a retry
 * after a lost response always lands on what the first attempt did.
 *
 * Bodies and credentials are never logged: they hold what a customer said.
 */

/** Per credential. The figure offered to FITT Voice for the Sandbox. */
const RATE_PER_MINUTE = 60;

/** The body as UTF-8 text, or null past `max` bytes — counted while reading, not trusted from a header. */
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const fail = (code: ErrorCode, message: string, latest: number | null = null, headers?: HeadersInit) => {
    console.info(`[fittvoice] ${requestId} ${code}`);
    return Response.json(errorBody(code, message, requestId, latest), { status: HTTP_STATUS[code], headers });
  };

  const auth = await authenticate(request.headers.get("authorization"));
  if (!auth.ok) return fail(auth.code, auth.message);
  const { binding } = auth;
  // A connection speaks for a person; once they leave the workspace it stops.
  if (binding.user_id && !auth.role) {
    return fail("FORBIDDEN", "ผู้ใช้ที่เชื่อมบัญชีไม่ได้อยู่ใน workspace นี้แล้ว ให้ผู้ใช้เชื่อมใหม่กับ workspace ที่มีสิทธิ์");
  }

  const limit = await rateLimit(`fittvoice:${binding.id}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) {
    return fail("RATE_LIMITED", `เกิน ${RATE_PER_MINUTE} ครั้งต่อนาที ส่งชุดเดิมซ้ำหลัง Retry-After`, null, {
      "Retry-After": String(limit.retryAfter),
    });
  }

  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) {
    return fail("INVALID_PAYLOAD", "Content-Type ต้องเป็น application/json");
  }
  let raw: string | null;
  try {
    raw = await readCapped(request, MAX_BODY_BYTES);
  } catch {
    return fail("INVALID_PAYLOAD", "body ไม่ใช่ UTF-8 ที่ถูกต้อง");
  }
  if (raw === null) return fail("PAYLOAD_TOO_LARGE", "request เกิน 1 MiB — ลดข้อมูลแล้วส่งใหม่ ระบบไม่ตัดหลักฐานให้เอง");

  const checked = checkDelivery(raw, request.headers.get("idempotency-key"));
  if (!checked.ok) return fail(checked.code, checked.message);

  const { data, error } = await createAdminClient().rpc("fittbuilder_fittvoice_apply", {
    p_binding: binding.id,
    p_payload: checked.delivery as unknown as Json,
  });
  if (error || !data) {
    console.error(`[fittvoice] ${requestId} apply failed: ${error?.message ?? "no result"}`);
    return fail("TEMPORARILY_UNAVAILABLE", "บันทึกไม่สำเร็จชั่วคราว ส่งชุดเดิมซ้ำได้");
  }
  const result = data as { status: number; body: Record<string, unknown> };
  if (result.status >= 400) {
    return fail(
      result.body.code as ErrorCode,
      result.body.message as string,
      (result.body.latestSnapshotRevision as number | null) ?? null
    );
  }
  console.info(`[fittvoice] ${requestId} ${result.body.outcome} ${result.status}`);
  return Response.json(result.body, { status: result.status });
}
