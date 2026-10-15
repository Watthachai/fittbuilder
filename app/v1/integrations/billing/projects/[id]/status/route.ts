import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateBilling } from "@/lib/billing/authenticate";
import { billingError } from "@/lib/billing/errors";
import { setBillingStatus } from "@/lib/billing/store";

/**
 * FITT Billing suspends or reactivates a project's app. Sending the same
 * command again leaves the state as it was, and every command is kept in the
 * project's history with the credential that sent it (migration 0055). The app
 * learns the change the next time it asks /v1/service-status.
 */

const RATE_PER_MINUTE = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON = 500;

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const auth = await authenticateBilling(request.headers.get("authorization"));
  if (!auth.ok) return billingError(auth.code, auth.message, requestId);
  const limit = await rateLimit(`billing:${auth.binding.id}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) return billingError("rate_limited", "เรียกถี่เกินไป รอแล้วลองใหม่", requestId, limit.retryAfter);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return billingError("not_found", "ไม่พบโปรเจกต์", requestId);
  const body: unknown = await request.json().catch(() => null);
  const b = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || (b.status !== "active" && b.status !== "suspended")) {
    return billingError("invalid_request", 'ต้องส่ง JSON { "status": "active" | "suspended", "reason": "..." }', requestId);
  }
  if (b.reason !== undefined && typeof b.reason !== "string") return billingError("invalid_request", "reason ต้องเป็นข้อความ", requestId);
  const reason = ((b.reason as string | undefined) ?? "").trim();
  if (reason.length > MAX_REASON) return billingError("invalid_request", `reason ยาวได้ไม่เกิน ${MAX_REASON} ตัวอักษร`, requestId);
  try {
    const state = await setBillingStatus(id, b.status, reason, auth.binding.id);
    if (!state) return billingError("not_found", "ไม่พบโปรเจกต์", requestId);
    return Response.json(
      { status: state.status, reason: state.reason, changedAt: new Date(state.changed_at).toISOString() },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error(`[billing] set status failed (${requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId);
  }
}
