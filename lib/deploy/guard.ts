import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { billingError } from "@/lib/billing/errors";
import { authenticateDeploy } from "./authenticate";
import type { DeployBinding } from "./types";

const RATE_PER_MINUTE = 120;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every deploy API call: a request id, a live CODE_RUNNER credential and a rate
 * limit per credential. Errors use the shared fittbuilder.error.v1 envelope.
 */
export async function guardDeploy(request: Request): Promise<{ requestId: string; binding: DeployBinding } | Response> {
  const requestId = randomUUID();
  const auth = await authenticateDeploy(request.headers.get("authorization"));
  if (!auth.ok) return billingError(auth.code, auth.message, requestId);
  const limit = await rateLimit(`deploy:${auth.binding.id}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) return billingError("rate_limited", "เรียกถี่เกินไป รอแล้วลองใหม่", requestId, limit.retryAfter);
  return { requestId, binding: auth.binding };
}
