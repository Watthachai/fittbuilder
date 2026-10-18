import { createHash } from "node:crypto";
import { findDeployBinding, touchDeployBinding } from "./store";
import type { DeployBinding } from "./types";

export type DeployAuth =
  | { ok: true; binding: DeployBinding }
  | { ok: false; code: "unauthorized" | "internal"; message: string };

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Whether a bearer token is a live Code Runner credential. Only CODE_RUNNER
 * credentials match, revoked ones never do, and a database failure is "try
 * again", not "you are not allowed".
 */
export async function authenticateDeploy(authorization: string | null, now = new Date()): Promise<DeployAuth> {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1];
  if (!token) return { ok: false, code: "unauthorized", message: "ต้องส่ง Authorization: Bearer <token>" };
  try {
    const binding = await findDeployBinding(sha256hex(token));
    if (!binding) return { ok: false, code: "unauthorized", message: "token ไม่ถูกต้องหรือถูกยกเลิกแล้ว" };
    await touchDeployBinding(binding.id, now);
    return { ok: true, binding };
  } catch (e) {
    console.error(`[deploy] authenticate failed: ${(e as Error).message}`);
    return { ok: false, code: "internal", message: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" };
  }
}
