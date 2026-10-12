import { oauthError, readOAuthForm, sha256hex } from "@/lib/fittvoice/connect";
import { getClient, revokeByToken } from "@/lib/fittvoice/connection-store";

/**
 * End a connection from FITT Voice's side (RFC 7009) — when the person
 * disconnects there. 200 with no body whether or not the token was live: the
 * client cannot learn anything about a token by revoking it. A disabled client
 * may still revoke; turning a client off should never keep a token alive.
 */
export async function POST(request: Request) {
  const form = await readOAuthForm(request);
  if (form instanceof Response) return form;
  const token = form.get("token");
  const clientId = form.get("client_id");
  if (!token || !clientId) return oauthError("invalid_request", "token and client_id are required");
  try {
    const client = await getClient(clientId);
    if (!client) return oauthError("invalid_client", "unknown client_id", 401);
    await revokeByToken(sha256hex(token), client.id, new Date());
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(`[fittvoice] revoke failed: ${(e as Error).message}`);
    return oauthError("temporarily_unavailable", "try again shortly", 503);
  }
}
