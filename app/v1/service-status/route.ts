import { createHash, randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { billingError } from "@/lib/billing/errors";
import { findLicenseStatus, recordSwitchVersion } from "@/lib/billing/store";
import type { BillingStatus } from "@/lib/billing/types";

/**
 * A customer's deployed app asks whether FITT Billing has suspended it or put it
 * in read-only, with the project's license key. The answer carries the status
 * and the message to show — nothing else about the project. An app that can't
 * get an answer keeps the last status it knew (the switch in the app decides
 * that, not this route). The app's switch says which version it runs (header
 * x-fitt-switch-version; none = 1): the last one seen is kept for Billing.
 */

/** Per key. Apps ask at start and every 5 minutes; this leaves room for many replicas. */
const RATE_PER_MINUTE = 60;
const MESSAGE: Record<BillingStatus, string> = {
  active: "",
  suspended: "บริการถูกระงับชั่วคราว กรุณาติดต่อผู้ให้บริการ",
  read_only: "ระบบอยู่ในโหมดอ่านอย่างเดียว ดูข้อมูลได้ แต่บันทึกหรือแก้ไขไม่ได้ กรุณาติดต่อผู้ให้บริการ",
};

/** The switch version an app sends: none is 1; one that isn't a whole number from 1 to 9999 is not read (null). */
function switchVersion(header: string | null): number | null {
  if (header === null) return 1;
  const v = header.trim();
  return /^[1-9]\d{0,3}$/.test(v) ? Number(v) : null;
}

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
    const status: BillingStatus = found.status === "suspended" || found.status === "read_only" ? found.status : "active";
    // written only when it changes, and never in the way of the answer: an app always learns its status
    const version = switchVersion(request.headers.get("x-fitt-switch-version"));
    if (version !== null && version !== found.switch_version) {
      await recordSwitchVersion(keyHash, version).catch((e: Error) => console.error(`[service-status] switch version not kept (${requestId}): ${e.message}`));
    }
    return Response.json({ status, message: MESSAGE[status], checkedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[service-status] lookup failed (${requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId);
  }
}
