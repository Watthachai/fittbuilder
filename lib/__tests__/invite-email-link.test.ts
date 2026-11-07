import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as projectInvite } from "@/app/api/invite-email/route";
import { POST as orgInvite } from "@/app/api/org-invite-email/route";

const mail = vi.hoisted(() => ({ project: vi.fn(), org: vi.fn() }));

vi.mock("@/lib/email", () => ({ sendProjectInviteEmail: mail.project, sendOrgInviteEmail: mail.org }));
vi.mock("@/lib/supabase/server", () => {
  const row = { email: "guest@example.com", role: "editor", token: "tok", project_id: "p", org_id: "o", name: "ชื่อ" };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row }) };
  return {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "me", email: "me@example.com", user_metadata: {} } } }) },
      from: () => query,
    }),
  };
});

const INVITE_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const asked = (host: string) =>
  new Request("http://0.0.0.0:3000/api/x", {
    method: "POST",
    headers: { "x-forwarded-host": host, "x-forwarded-proto": "https", "content-type": "application/json" },
    body: JSON.stringify({ inviteId: INVITE_ID }),
  });

/** The sender's browser sets the forwarded host, and our own mail must not carry an address they typed. */
describe.each([
  ["project", projectInvite, mail.project],
  ["workspace", orgInvite, mail.org],
] as const)("the link in a %s invite", (_name, post, send) => {
  beforeEach(() => {
    mail.project.mockReset().mockResolvedValue({ success: true });
    mail.org.mockReset().mockResolvedValue({ success: true });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("opens on the address the sender is on, when that is ours", async () => {
    await post(asked("fitt-builder.fittbsa.com"));
    expect(send.mock.calls[0][0].inviteLink).toBe("https://fitt-builder.fittbsa.com/join/tok");
  });

  it("ignores a forged host", async () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://fitt-builder.example.run.app");
    await post(asked("evil.example.com"));
    expect(send.mock.calls[0][0].inviteLink).toBe("https://fitt-builder.example.run.app/join/tok");
  });

  it("sends nothing when no address of ours can be named", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_URL", "");
    const res = await post(asked("evil.example.com"));
    expect(send).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ success: false });
  });
});
