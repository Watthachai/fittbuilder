import { createHash, randomBytes } from "node:crypto";

/**
 * FITT Voice account connections — the rules that need no database.
 *
 * A FITT Voice user connects their own Builder account and picks one workspace
 * (OAuth 2.0 authorization code + PKCE S256, agreed with the FITT Voice team on
 * 12 Oct 2026). Builder is the authorization server: /connect shows the consent
 * page, /token exchanges the code for a connection token, /connection describes
 * it, /revoke ends it. The token is a binding (migration 0053) with a person, so
 * the delivery receiver checks it exactly as it checks a service credential.
 */

/** A connection lapses after this many days without a delivery or a /connection call. */
export const CONNECTION_IDLE_DAYS = 90;
/** How long an approval's code waits to be exchanged. */
export const CODE_TTL_MS = 5 * 60_000;

export type ConnectionRole = "OWNER" | "ADMIN" | "MEMBER";

export interface IntegrationClient {
  id: string;
  name: string;
  redirect_uris: string[];
  disabled_at: string | null;
}

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}

export type AuthorizeCheck =
  | { ok: true; request: AuthorizeRequest }
  // The client or its redirect URI cannot be trusted: say so on our own page.
  // Redirecting there would hand an error — or a code — to whoever wrote the link.
  | { ok: false; redirect: null; message: string }
  // Everything else goes back to the client as an OAuth error (RFC 6749 §4.1.2.1).
  | { ok: false; redirect: string };

const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const STATE_MAX = 500;

/** The URI with our parameters added to its own query. */
export function redirectWith(uri: string, add: Record<string, string>): string {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(add)) url.searchParams.set(k, v);
  return url.toString();
}

export function checkAuthorizeRequest(params: URLSearchParams, client: IntegrationClient | null): AuthorizeCheck {
  const one = (k: string) => (params.getAll(k).length === 1 ? params.get(k) : null);
  const clientId = one("client_id");
  const redirectUri = one("redirect_uri");
  if (!client || client.disabled_at || clientId !== client.id) {
    return { ok: false, redirect: null, message: "ไม่รู้จักแอปที่ขอเชื่อม (client_id) หรือแอปนี้ถูกปิดแล้ว" };
  }
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
    return { ok: false, redirect: null, message: "redirect_uri ไม่ตรงกับที่ลงทะเบียนไว้" };
  }

  const state = one("state");
  const back = (error: string, description: string) => ({
    ok: false as const,
    redirect: redirectWith(redirectUri, {
      error,
      error_description: description,
      ...(state ? { state } : {}),
    }),
  });
  if (one("response_type") !== "code") return back("unsupported_response_type", "response_type must be code");
  if (!state || state.length > STATE_MAX) return back("invalid_request", `state is required (1-${STATE_MAX} chars)`);
  if (one("code_challenge_method") !== "S256") return back("invalid_request", "code_challenge_method must be S256");
  const codeChallenge = one("code_challenge");
  if (!codeChallenge || !CHALLENGE.test(codeChallenge)) {
    return back("invalid_request", "code_challenge must be BASE64URL(SHA256(code_verifier)), 43 chars");
  }
  for (const k of params.keys()) {
    if (params.getAll(k).length > 1) return back("invalid_request", `${k} given more than once`);
  }
  return { ok: true, request: { clientId: client.id, redirectUri, state, codeChallenge } };
}

/** RFC 7636 S256: BASE64URL(SHA256(ASCII(code_verifier))) == code_challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier)) return false;
  return createHash("sha256").update(verifier, "ascii").digest("base64url") === challenge;
}

export const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** A bearer secret: a recognisable prefix and 256 random bits. */
export const newSecret = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`;

/** UTC to the second, as the receipt's acceptedAt. */
export const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

const expiresAt = (lastUsedAt: Date) => new Date(lastUsedAt.getTime() + CONNECTION_IDLE_DAYS * 86_400_000);

export function isExpired(lastUsedAt: Date, now: Date): boolean {
  return now.getTime() > expiresAt(lastUsedAt).getTime();
}

/**
 * What GET /connection answers. A service credential has no person: it always
 * may send and never lapses. A connection may send while its person is still in
 * the workspace.
 */
export function connectionBody(c: {
  id: string;
  clientId: string | null;
  workspace: { id: string; name: string };
  user: { id: string; email: string } | null;
  role: ConnectionRole | null;
  lastUsedAt: Date;
}) {
  return {
    schemaVersion: "fittbuilder.connection.v1" as const,
    connectionId: c.id,
    clientId: c.clientId,
    workspace: c.workspace,
    user: c.user,
    role: c.role,
    canSend: c.user === null || c.role !== null,
    lastUsedAt: isoSeconds(c.lastUsedAt),
    expiresAt: c.user ? isoSeconds(expiresAt(c.lastUsedAt)) : null,
  };
}

/** An OAuth error from /token or /revoke (RFC 6749 §5.2), never cached. */
export function oauthError(error: string, description: string, status = 400): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
}

/** A form-encoded OAuth request body, each field at most once (RFC 6749 §3.2) — or the error to answer. */
export async function readOAuthForm(request: Request): Promise<URLSearchParams | Response> {
  if (!/^application\/x-www-form-urlencoded\b/i.test(request.headers.get("content-type") ?? "")) {
    return oauthError("invalid_request", "Content-Type must be application/x-www-form-urlencoded");
  }
  const form = new URLSearchParams(await request.text());
  for (const k of new Set(form.keys())) {
    if (form.getAll(k).length > 1) return oauthError("invalid_request", `${k} given more than once`);
  }
  return form;
}

/** The /connect query, carried through the consent form as hidden fields. */
export const AUTHORIZE_FIELDS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "state",
  "code_challenge",
  "code_challenge_method",
] as const;
