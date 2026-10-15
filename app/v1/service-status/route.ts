import { createHash, randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { billingError } from "@/lib/billing/errors";
import { findLicenseStatus } from "@/lib/billing/store";

/**
 * A customer's deployed app asks whether FITT Billing has suspended it, with
 * the project's license key. The answer carries the status and the message to
 * show — nothing else about the project. An app that can't get an answer keeps
 * the last status it knew (the switch in the app decides that, not this route).
 */

/** Per key. Apps ask at start and every 5 minutes; this leaves room for many replicas. */
const RATE_PER_MINUTE = 60;
const SUSPENDED_MESSAGE = "บริการถูกระงับชั่วคราว กรุณาติดต่อผู้ให้บริการ";

export async function GET(request: Request) {
  const requestId = randomUUID();
  const key = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!key) return billingError("unauthorized", "ต้องส่ง Authorization: Bearer <license key>", requestId);
  const keyHash = createHash("sha256").update(key, "utf8").digest("hex");
  const limit = await rateLimit(`service-status:${keyHash}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) return billingError("rate_limited", "เรียกถี่เกินไป รอแล้วลองใหม่", requestId, limit.retryAfter);
  try {
    const found = await findLicenseStatus(keyHash);
    if (!found) return billingError("unauthorized", "license key ไม่ถูกต้องหรือถูกเปลี่ยนแล้ว", requestId);
    const suspended = found.status === "suspended";
    return Response.json(
      { status: suspended ? "suspended" : "active", message: suspended ? SUSPENDED_MESSAGE : "", checkedAt: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error(`[service-status] lookup failed (${requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId);
  }
}
