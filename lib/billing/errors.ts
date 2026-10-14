import type { BillingErrorCode } from "./types";

const STATUS: Record<BillingErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  invalid_request: 400,
  rate_limited: 429,
  internal: 500,
};

/** The shared error envelope (fittbuilder.error.v1). Only transient failures are worth sending again. */
export function billingError(code: BillingErrorCode, message: string, requestId: string, retryAfter?: number): Response {
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (code === "rate_limited" && retryAfter) headers["retry-after"] = String(retryAfter);
  return Response.json(
    {
      schemaVersion: "fittbuilder.error.v1",
      code,
      message,
      retryable: code === "rate_limited" || code === "internal",
      requestId,
    },
    { status: STATUS[code], headers }
  );
}
