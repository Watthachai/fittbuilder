import { CONNECTION_IDLE_DAYS, isExpired, sha256hex, type ConnectionRole } from "./connect";
import { findBinding, roleOf, touchBinding, type BindingRow } from "./connection-store";

export type Authenticated =
  | {
      ok: true;
      binding: BindingRow;
      /** The connected person's role now; null for a service credential, or a person who left. */
      role: ConnectionRole | null;
    }
  | { ok: false; code: "UNAUTHORIZED" | "TEMPORARILY_UNAVAILABLE"; message: string };

/**
 * Who a FITT Voice bearer token speaks for — one answer for /deliveries and
 * /connection. A service credential is good until revoked. A connection is
 * good until revoked or CONNECTION_IDLE_DAYS without use, and its person's
 * membership is looked up on every call, so leaving the workspace takes
 * effect at once. Each good call counts as use.
 */
export async function authenticate(authorization: string | null, now = new Date()): Promise<Authenticated> {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1];
  if (!token) return { ok: false, code: "UNAUTHORIZED", message: "ต้องส่ง Authorization: Bearer <token>" };
  try {
    const binding = await findBinding(sha256hex(token));
    if (!binding) return { ok: false, code: "UNAUTHORIZED", message: "token ไม่ถูกต้องหรือถูกเพิกถอนแล้ว" };
    let role: ConnectionRole | null = null;
    if (binding.user_id) {
      if (isExpired(new Date(binding.last_used_at ?? binding.created_at), now)) {
        return {
          ok: false,
          code: "UNAUTHORIZED",
          message: `การเชื่อมหมดอายุเพราะไม่ได้ใช้ ${CONNECTION_IDLE_DAYS} วัน ให้ผู้ใช้เชื่อมบัญชีใหม่`,
        };
      }
      role = await roleOf(binding.org_id, binding.user_id);
      if (!role) return { ok: true, binding, role };
    }
    await touchBinding(binding.id, now);
    return { ok: true, binding: { ...binding, last_used_at: now.toISOString() }, role };
  } catch (e) {
    console.error(`[fittvoice] authenticate failed: ${(e as Error).message}`);
    return { ok: false, code: "TEMPORARILY_UNAVAILABLE", message: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" };
  }
}
