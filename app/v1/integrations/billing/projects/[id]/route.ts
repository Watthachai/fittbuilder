import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateBilling } from "@/lib/billing/authenticate";
import { billingError } from "@/lib/billing/errors";
import { loadProjectBundle } from "@/lib/billing/store";
import { projectDetail } from "@/lib/billing/serialize";

/**
 * FITT Billing → FITT Builder: one project in full. A project outside the
 * token's workspace answers exactly like one that doesn't exist.
 */

const RATE_PER_MINUTE = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const auth = await authenticateBilling(request.headers.get("authorization"));
  if (!auth.ok) return billingError(auth.code, auth.message, requestId);
  const limit = await rateLimit(`billing:${auth.binding.id}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) return billingError("rate_limited", "เรียกถี่เกินไป รอแล้วลองใหม่", requestId, limit.retryAfter);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return billingError("not_found", "ไม่พบโปรเจกต์", requestId);
  try {
    const bundle = await loadProjectBundle(auth.binding.org_id, id);
    if (!bundle) return billingError("not_found", "ไม่พบโปรเจกต์", requestId);
    const today = new Date().toISOString().slice(0, 10);
    return Response.json(projectDetail(bundle, today), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[billing] detail failed (${requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId);
  }
}
