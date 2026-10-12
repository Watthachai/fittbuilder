import { connectionBody, newSecret, oauthError, pkceMatches, readOAuthForm, sha256hex } from "@/lib/fittvoice/connect";
import { getClient, issueConnection, roleOf, takeCode, userEmail, workspaceName } from "@/lib/fittvoice/connection-store";

/**
 * Exchange an approval's code for a connection token (RFC 6749 §4.1.3 with
 * RFC 7636 PKCE S256). Backend to backend: FITT Voice's server posts the code
 * its callback received, the redirect URI it used, and the verifier behind the
 * challenge it sent to /connect.
 *
 * The code is spent by the lookup itself, so whatever is wrong with the rest of
 * the request, that code cannot be tried again. The person's membership is
 * checked once more here: they may have left the workspace in the minutes
 * since they approved.
 */
export async function POST(request: Request) {
  const form = await readOAuthForm(request);
  if (form instanceof Response) return form;
  if (form.get("grant_type") !== "authorization_code") {
    return oauthError("unsupported_grant_type", "grant_type must be authorization_code");
  }
  const clientId = form.get("client_id");
  const code = form.get("code");
  const redirectUri = form.get("redirect_uri");
  const verifier = form.get("code_verifier");
  if (!clientId || !code || !redirectUri || !verifier) {
    return oauthError("invalid_request", "client_id, code, redirect_uri and code_verifier are required");
  }

  try {
    const client = await getClient(clientId);
    if (!client || client.disabled_at) return oauthError("invalid_client", "unknown or disabled client_id", 401);

    const now = new Date();
    const grant = await takeCode(sha256hex(code), now);
    if (
      !grant ||
      grant.client_id !== client.id ||
      grant.redirect_uri !== redirectUri ||
      !pkceMatches(verifier, grant.code_challenge)
    ) {
      return oauthError(
        "invalid_grant",
        "code is unknown, expired or already used, or redirect_uri / code_verifier do not match it"
      );
    }
    const role = await roleOf(grant.org_id, grant.user_id);
    if (!role) return oauthError("invalid_grant", "the user is no longer a member of the chosen workspace");

    const accessToken = newSecret("fvc_");
    const [name, email] = await Promise.all([workspaceName(grant.org_id), userEmail(grant.user_id)]);
    const binding = await issueConnection({
      orgId: grant.org_id,
      userId: grant.user_id,
      clientId: client.id,
      tokenHash: sha256hex(accessToken),
      label: `${client.name} · ${email}`,
      now,
    });
    console.info(`[fittvoice] connection ${binding.id} issued to ${client.id}`);
    return Response.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        connection: connectionBody({
          id: binding.id,
          clientId: client.id,
          workspace: { id: grant.org_id, name },
          user: { id: grant.user_id, email },
          role,
          lastUsedAt: now,
        }),
      },
      { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
    );
  } catch (e) {
    console.error(`[fittvoice] token exchange failed: ${(e as Error).message}`);
    return oauthError("temporarily_unavailable", "try again shortly", 503);
  }
}
