import { billingOpenApi } from "@/lib/billing/openapi";

/**
 * The FITT Billing contract as OpenAPI 3.1. Public, and readable from any
 * origin so it opens in Swagger tools: it describes the API, not anyone's data.
 */
export function GET() {
  return Response.json(billingOpenApi, {
    headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
  });
}
