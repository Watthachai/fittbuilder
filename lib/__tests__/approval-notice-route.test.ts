import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  user: { id: "boss" } as { id: string } | null,
  row: null as Record<string, unknown> | null,
  sent: [] as { to: string; actionLink: string; name: string }[],
  sendFails: false,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: world.user } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "fittbuilder_doc_approvals" ? world.row : { name: "SiamPools" },
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        in: async () => ({
          data: [
            { id: "sender", email: "sender@co.th", name: "อริสรา" },
            { id: "boss", email: "boss@co.th", name: "พี่เอ๋" },
          ],
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/email", () => ({
  sendApprovalNoticeEmail: async (args: { to: string; actionLink: string; name: string }) => {
    if (world.sendFails) throw new Error("DMAIL error 500");
    world.sent.push(args);
    return { sent: true };
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ ok: true, retryAfter: 0 }) }));
vi.mock("@/lib/origin", () => ({ mailOrigin: () => "https://app.test" }));

import { POST } from "@/app/api/approval-notice/route";

const ID = "0d746b03-6acc-4a0d-b09c-87f06056b82d";
const call = (body: unknown = { id: ID }) =>
  POST(new Request("https://x/api/approval-notice", { method: "POST", body: JSON.stringify(body) }));
const approved = () => ({
  id: ID,
  status: "approved",
  stage: "approve",
  requested_by: "sender",
  requested_at: new Date().toISOString(),
  reviewer_id: null,
  reviewed_at: null,
  review_note: null,
  approver_id: "boss",
  decided_by: "boss",
  decided_at: new Date().toISOString(),
  comment: null,
  doc_kind: "quote",
  project_id: "p1",
});

describe("the approval notice route", () => {
  beforeEach(() => {
    world.user = { id: "boss" };
    world.row = approved();
    world.sent = [];
    world.sendFails = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("mails the person the move concerns, with a link on our own site", async () => {
    const res = await call();
    expect(await res.json()).toEqual({ sent: 1 });
    expect(world.sent).toHaveLength(1);
    expect(world.sent[0].to).toBe("sender@co.th");
    expect(world.sent[0].name).toBe("อริสรา");
    expect(world.sent[0].actionLink).toBe("https://app.test/project/p1");
  });

  it("refuses someone signed out", async () => {
    world.user = null;
    expect((await call()).status).toBe(401);
    expect(world.sent).toEqual([]);
  });

  it("refuses a request the caller cannot read", async () => {
    world.row = null;
    expect((await call()).status).toBe(403);
  });

  it("refuses a malformed id", async () => {
    expect((await call({ id: "x" })).status).toBe(400);
  });

  it("sends nothing when the caller did not make the move", async () => {
    world.user = { id: "sender" };
    expect(await (await call()).json()).toEqual({ sent: 0 });
    expect(world.sent).toEqual([]);
  });

  it("does not fail the move when the mail cannot go out", async () => {
    world.sendFails = true;
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0 });
  });
});
