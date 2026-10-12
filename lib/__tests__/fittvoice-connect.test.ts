import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  checkAuthorizeRequest,
  connectionBody,
  isExpired,
  pkceMatches,
  redirectWith,
  type IntegrationClient,
} from "@/lib/fittvoice/connect";

/**
 * The rules of a FITT Voice account connection that do not need a database:
 * which authorize requests are refused on our own page and which go back to
 * the client as OAuth errors, PKCE, the idle expiry, and what /connection says.
 */

const CALLBACK = "https://voice.test/v1/builder/connections/callback";
const client: IntegrationClient = { id: "fittvoice-sandbox", name: "FITT Voice", redirect_uris: [CALLBACK], disabled_at: null };
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = createHash("sha256").update(verifier).digest("base64url");

const params = (patch: Record<string, string | null> = {}) => {
  const base: Record<string, string | null> = {
    response_type: "code",
    client_id: client.id,
    redirect_uri: CALLBACK,
    state: "st_1",
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...patch,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v !== null) p.set(k, v);
  return p;
};

describe("checkAuthorizeRequest", () => {
  it("accepts a well-formed request from a registered client", () => {
    expect(checkAuthorizeRequest(params(), client)).toEqual({
      ok: true,
      request: { clientId: client.id, redirectUri: CALLBACK, state: "st_1", codeChallenge: challenge },
    });
  });

  it("never redirects for an unknown client, a disabled one, or an unregistered redirect URI", () => {
    for (const check of [
      checkAuthorizeRequest(params(), null),
      checkAuthorizeRequest(params(), { ...client, disabled_at: "2026-10-12T00:00:00Z" }),
      checkAuthorizeRequest(params({ redirect_uri: `${CALLBACK}/` }), client),
      checkAuthorizeRequest(params({ redirect_uri: CALLBACK.toUpperCase() }), client),
    ]) {
      expect(check).toMatchObject({ ok: false, redirect: null });
    }
  });

  it("sends everything else back to the client as an OAuth error carrying its state", () => {
    const back = (patch: Record<string, string | null>) => {
      const check = checkAuthorizeRequest(params(patch), client);
      if (check.ok || check.redirect === null) throw new Error("expected a redirect");
      return new URL(check.redirect);
    };
    expect(back({ response_type: "token" }).searchParams.get("error")).toBe("unsupported_response_type");
    expect(back({ code_challenge_method: "plain" }).searchParams.get("error")).toBe("invalid_request");
    expect(back({ code_challenge: null }).searchParams.get("error")).toBe("invalid_request");
    expect(back({ code_challenge: "short" }).searchParams.get("state")).toBe("st_1");
    expect(back({ state: null }).searchParams.has("state")).toBe(false);
    expect(back({ state: null }).searchParams.get("error")).toBe("invalid_request");
  });

  it("refuses a parameter given twice", () => {
    const p = params();
    p.append("state", "st_2");
    expect(checkAuthorizeRequest(p, client)).toMatchObject({ ok: false });
  });
});

describe("redirectWith", () => {
  it("keeps the client's own query and adds ours", () => {
    const url = new URL(redirectWith(`${CALLBACK}?env=sbx`, { code: "c1", state: "s 1" }));
    expect(url.searchParams.get("env")).toBe("sbx");
    expect(url.searchParams.get("code")).toBe("c1");
    expect(url.searchParams.get("state")).toBe("s 1");
  });
});

describe("pkceMatches", () => {
  it("matches the RFC 7636 S256 transform", () => {
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches(`${verifier}x`, challenge)).toBe(false);
  });

  it("refuses a verifier outside the RFC 7636 alphabet or length", () => {
    expect(pkceMatches("short", createHash("sha256").update("short").digest("base64url"))).toBe(false);
    const spaced = `${verifier.slice(0, 42)} `;
    expect(pkceMatches(spaced, createHash("sha256").update(spaced).digest("base64url"))).toBe(false);
  });
});

describe("isExpired", () => {
  const used = new Date("2026-10-12T00:00:00Z");
  it("lasts 90 days from the last use", () => {
    expect(isExpired(used, new Date("2027-01-09T23:59:59Z"))).toBe(false);
    expect(isExpired(used, new Date("2027-01-10T00:00:01Z"))).toBe(true);
  });
});

describe("connectionBody", () => {
  const base = {
    id: "b1",
    clientId: "fittvoice-sandbox",
    workspace: { id: "o1", name: "ทีมขาย" },
    lastUsedAt: new Date("2026-10-12T05:04:27.123Z"),
  };

  it("says who connected, where, with what role, and when it lapses", () => {
    expect(
      connectionBody({ ...base, user: { id: "u1", email: "a@example.com" }, role: "MEMBER" })
    ).toEqual({
      schemaVersion: "fittbuilder.connection.v1",
      connectionId: "b1",
      clientId: "fittvoice-sandbox",
      workspace: { id: "o1", name: "ทีมขาย" },
      user: { id: "u1", email: "a@example.com" },
      role: "MEMBER",
      canSend: true,
      lastUsedAt: "2026-10-12T05:04:27Z",
      expiresAt: "2027-01-10T05:04:27Z",
    });
  });

  it("cannot send once the person has left the workspace", () => {
    expect(connectionBody({ ...base, user: { id: "u1", email: "a@example.com" }, role: null })).toMatchObject({
      role: null,
      canSend: false,
    });
  });
});
