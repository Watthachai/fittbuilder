import { createHash } from "node:crypto";
import { findBillingBinding, touchBillingBinding } from "./store";
import type { BillingBinding } from "./types";

export type BillingAuth =
  | { ok: true; binding: BillingBinding }
  | { ok: false; code: "unauthorized" | "internal"; message: string };

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Whether a bearer token is a live FITT Billing credential. Only FITT_BILLING
 * credentials match (a FITT Voice token is refused), revoked ones never do,
 * and a database failure is "try again", not "you are not allowed".
 */
export async function authenticateBilling(authorization: string | null, now = new Date()): Promise<BillingAuth> {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1];
  if (!token) return { ok: false, code: "unauthorized", message: "ต้องส่ง Authorization: Bearer <token>" };
  try {
    const binding = await findBillingBinding(sha256hex(token));
    if (!binding) return { ok: false, code: "unauthorized", message: "token ไม่ถูกต้องหรือถูกยกเลิกแล้ว" };
    await touchBillingBinding(binding.id, now);
    return { ok: true, binding };
  } catch (e) {
    console.error(`[billing] authenticate failed: ${(e as Error).message}`);
    return { ok: false, code: "internal", message: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" };
  }
}
