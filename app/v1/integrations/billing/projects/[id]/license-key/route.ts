import { createHash, randomBytes, randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateBilling } from "@/lib/billing/authenticate";
import { billingError } from "@/lib/billing/errors";
import { setLicenseKeyHash } from "@/lib/billing/store";

/**
 * FITT Billing issues the license key a project's deployed app asks its status
 * with. Shown once, only its SHA-256 is kept, and it replaces the previous key
 * at once — an app still holding that one is answered 401 from then on.
 */

const RATE_PER_MINUTE = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const auth = await authenticateBilling(request.headers.get("authorization"));
  if (!auth.ok) return billingError(auth.code, auth.message, requestId);
  const limit = await rateLimit(`billing:${auth.binding.id}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) return billingError("rate_limited", "เรียกถี่เกินไป รอแล้วลองใหม่", requestId, limit.retryAfter);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return billingError("not_found", "ไม่พบโปรเจกต์", requestId);
  const licenseKey = `fbl_${randomBytes(32).toString("base64url")}`;
  try {
    const issued = await setLicenseKeyHash(id, createHash("sha256").update(licenseKey, "utf8").digest("hex"));
    if (!issued) return billingError("not_found", "ไม่พบโปรเจกต์", requestId);
    return Response.json({ licenseKey }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[billing] license key failed (${requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId);
  }
}
