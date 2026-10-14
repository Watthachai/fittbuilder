import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateBilling } from "@/lib/billing/authenticate";
import { billingError } from "@/lib/billing/errors";
import { loadSnapshot } from "@/lib/billing/store";
import { pageOf, parseListQuery, projectSummaries } from "@/lib/billing/serialize";

/**
 * FITT Billing → FITT Builder: every project — every workspace's and everyone's
 * personal ones — oldest change first, so Billing can sync incrementally with
 * updatedSince and a cursor.
 * Order follows the FITT Voice receiver: credential, rate, input, then data.
 * Neither credentials nor contents are logged.
 */

/** Per credential. */
const RATE_PER_MINUTE = 120;

export async function GET(request: Request) {
  const requestId = randomUUID();
  const auth = await authenticateBilling(request.headers.get("authorization"));
  if (!auth.ok) return billingError(auth.code, auth.message, requestId);
  const limit = await rateLimit(`billing:${auth.binding.id}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) return billingError("rate_limited", "เรียกถี่เกินไป รอแล้วลองใหม่", requestId, limit.retryAfter);
  const q = parseListQuery(new URL(request.url).searchParams);
  if (!q.ok) return billingError("invalid_request", q.message, requestId);
  try {
    const today = new Date().toISOString().slice(0, 10);
    const items = projectSummaries(await loadSnapshot(), today);
    return Response.json(pageOf(items, q), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[billing] list failed (${requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId);
  }
}
