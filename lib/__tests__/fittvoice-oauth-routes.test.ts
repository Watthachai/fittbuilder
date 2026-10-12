import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The OAuth side of a FITT Voice account connection: exchanging an approval's
 * code (/token), describing a connection (/connection), and ending it
 * (/revoke). The database is the connection store, given here.
 */

const CALLBACK = "https://voice.test/v1/builder/connections/callback";
const client = { id: "fittvoice-sandbox", name: "FITT Voice", redirect_uris: [CALLBACK], disabled_at: null as string | null };
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = createHash("sha256").update(verifier).digest("base64url");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const state = {
  client: client as typeof client | null,
  code: null as null | { client_id: string; user_id: string; org_id: string; redirect_uri: string; code_challenge: string },
  role: "MEMBER" as string | null,
  binding: null as null | Record<string, string | null>,
};
const takeCode = vi.fn(async (_hash: string) => state.code);
const issueConnection = vi.fn(async (c: { orgId: string; userId: string; clientId: string; tokenHash: string; now: Date }) => ({
  id: "binding_new",
  org_id: c.orgId,
  user_id: c.userId,
  client_id: c.clientId,
  created_at: c.now.toISOString(),
  last_used_at: c.now.toISOString(),
}));
const revokeByToken = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/fittvoice/connection-store", () => ({
  getClient: async () => state.client,
  takeCode: (h: string) => takeCode(h),
  roleOf: async () => state.role,
  issueConnection: (c: never) => issueConnection(c),
  workspaceName: async () => "ทีมขาย",
  userEmail: async () => "a@example.com",
  findBinding: async (hash: string) => (state.binding && hash === sha("fvc_live") ? state.binding : null),
  touchBinding: async () => {},
  revokeByToken: (...args: unknown[]) => revokeByToken(...args),
}));

const token = await import("../../app/v1/integrations/fittvoice/token/route");
const connection = await import("../../app/v1/integrations/fittvoice/connection/route");
const revoke = await import("../../app/v1/integrations/fittvoice/revoke/route");

const form = (fields: Record<string, string>, type = "application/x-www-form-urlencoded") =>
  new Request("http://builder.test/x", {
    method: "POST",
    headers: { "content-type": type },
    body: new URLSearchParams(fields).toString(),
  });
const exchange = (patch: Record<string, string | null> = {}) => {
  const fields: Record<string, string | null> = {
    grant_type: "authorization_code",
    code: "fvcode_1",
    redirect_uri: CALLBACK,
    client_id: client.id,
    code_verifier: verifier,
    ...patch,
  };
  return token.POST(form(Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null)) as Record<string, string>));
};

beforeEach(() => {
  state.client = client;
  state.code = { client_id: client.id, user_id: "user_1", org_id: "org_1", redirect_uri: CALLBACK, code_challenge: challenge };
  state.role = "MEMBER";
  state.binding = null;
  takeCode.mockClear();
  issueConnection.mockClear();
  revokeByToken.mockClear();
});

describe("POST /v1/integrations/fittvoice/token", () => {
  it("exchanges a code for a connection token and says what it is bound to", async () => {
    const res = await exchange();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({
      token_type: "Bearer",
      connection: {
        schemaVersion: "fittbuilder.connection.v1",
        connectionId: "binding_new",
        clientId: client.id,
        workspace: { id: "org_1", name: "ทีมขาย" },
        user: { id: "user_1", email: "a@example.com" },
        role: "MEMBER",
        canSend: true,
      },
    });
    expect(body.access_token).toMatch(/^fvc_[A-Za-z0-9_-]{43}$/);
    expect(takeCode).toHaveBeenCalledWith(sha("fvcode_1"));
    expect(issueConnection).toHaveBeenCalledWith(expect.objectContaining({ tokenHash: sha(body.access_token) }));
  });

  it("refuses a spent, expired or unknown code, and one used with another redirect URI or verifier", async () => {
    for (const run of [
      () => ((state.code = null), exchange()),
      () => exchange({ redirect_uri: `${CALLBACK}?x=1` }),
      () => exchange({ code_verifier: `${verifier}A` }),
      () => ((state.code = { ...state.code!, client_id: "other" }), exchange()),
    ]) {
      state.code = { client_id: client.id, user_id: "user_1", org_id: "org_1", redirect_uri: CALLBACK, code_challenge: challenge };
      const res = await run();
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "invalid_grant" });
    }
    expect(issueConnection).not.toHaveBeenCalled();
  });

  it("refuses when the person has left the workspace since approving", async () => {
    state.role = null;
    expect(await (await exchange()).json()).toMatchObject({ error: "invalid_grant" });
    expect(issueConnection).not.toHaveBeenCalled();
  });

  it("answers invalid_client 401 for an unknown or disabled client", async () => {
    state.client = null;
    let res = await exchange();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_client" });
    state.client = { ...client, disabled_at: "2026-10-12T00:00:00Z" };
    res = await exchange();
    expect(res.status).toBe(401);
    expect(takeCode).not.toHaveBeenCalled();
  });

  it("refuses the wrong grant type, missing fields, JSON, and a field given twice", async () => {
    expect(await (await exchange({ grant_type: "refresh_token" })).json()).toMatchObject({ error: "unsupported_grant_type" });
    expect(await (await exchange({ code_verifier: null })).json()).toMatchObject({ error: "invalid_request" });
    const json = await token.POST(form({ grant_type: "authorization_code" }, "application/json"));
    expect(await json.json()).toMatchObject({ error: "invalid_request" });
    const twice = await token.POST(
      new Request("http://builder.test/x", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `grant_type=authorization_code&code=a&code=b&redirect_uri=${encodeURIComponent(CALLBACK)}&client_id=${client.id}&code_verifier=${verifier}`,
      })
    );
    expect(await twice.json()).toMatchObject({ error: "invalid_request" });
    expect(takeCode).not.toHaveBeenCalled();
  });
});

describe("GET /v1/integrations/fittvoice/connection", () => {
  const get = (auth: string | null) =>
    connection.GET(
      new Request("http://builder.test/v1/integrations/fittvoice/connection", {
        headers: auth ? { authorization: auth } : {},
      })
    );
  const live = () => ({
    id: "binding_c",
    org_id: "org_1",
    user_id: "user_1",
    client_id: client.id,
    created_at: "2026-10-12T00:00:00Z",
    last_used_at: new Date().toISOString(),
  });

  it("describes the connection the token stands for", async () => {
    state.binding = live();
    const res = await get("Bearer fvc_live");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      connectionId: "binding_c",
      workspace: { id: "org_1", name: "ทีมขาย" },
      user: { id: "user_1", email: "a@example.com" },
      role: "MEMBER",
      canSend: true,
    });
  });

  it("says it cannot send once the person has left, instead of failing", async () => {
    state.binding = live();
    state.role = null;
    expect(await (await get("Bearer fvc_live")).json()).toMatchObject({ role: null, canSend: false });
  });

  it("answers 401 in the error envelope for an unknown, revoked or missing token", async () => {
    for (const auth of ["Bearer fvc_other", null]) {
      const res = await get(auth);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.error.v1", code: "UNAUTHORIZED" });
    }
  });
});

describe("POST /v1/integrations/fittvoice/revoke", () => {
  it("revokes the token for its own client and answers 200 with no body", async () => {
    const res = await revoke.POST(form({ token: "fvc_live", client_id: client.id }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(revokeByToken).toHaveBeenCalledWith(sha("fvc_live"), client.id, expect.any(Date));
  });

  it("answers 200 for a token it does not know, as RFC 7009 asks", async () => {
    expect((await revoke.POST(form({ token: "fvc_unknown", client_id: client.id }))).status).toBe(200);
  });

  it("still revokes for a disabled client", async () => {
    state.client = { ...client, disabled_at: "2026-10-12T00:00:00Z" };
    expect((await revoke.POST(form({ token: "fvc_live", client_id: client.id }))).status).toBe(200);
    expect(revokeByToken).toHaveBeenCalled();
  });

  it("refuses a request without the token or from an unknown client", async () => {
    expect(await (await revoke.POST(form({ client_id: client.id }))).json()).toMatchObject({ error: "invalid_request" });
    state.client = null;
    const res = await revoke.POST(form({ token: "fvc_live", client_id: "nobody" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_client" });
    expect(revokeByToken).not.toHaveBeenCalled();
  });
});
