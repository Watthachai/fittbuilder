import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const store = {
  binding: { id: "bind_1", org_id: "org_1" } as { id: string; org_id: string } | null,
  fail: false,
  lookedUp: [] as string[],
};
const touched = vi.fn();
vi.mock("@/lib/billing/store", () => ({
  findBillingBinding: async (hash: string) => {
    store.lookedUp.push(hash);
    if (store.fail) throw new Error("db down");
    return store.binding;
  },
  touchBillingBinding: async (id: string) => touched(id),
}));

const { authenticateBilling } = await import("@/lib/billing/authenticate");

beforeEach(() => {
  store.binding = { id: "bind_1", org_id: "org_1" };
  store.fail = false;
  store.lookedUp = [];
  touched.mockReset();
});

describe("authenticateBilling", () => {
  it("looks the token up by its SHA-256 and counts the use", async () => {
    const r = await authenticateBilling("Bearer fbb_secret");
    expect(r).toEqual({ ok: true, binding: { id: "bind_1", org_id: "org_1" } });
    expect(store.lookedUp).toEqual([createHash("sha256").update("fbb_secret", "utf8").digest("hex")]);
    expect(touched).toHaveBeenCalledWith("bind_1");
  });

  it("refuses a missing header, a non-Bearer header and an unknown or revoked token", async () => {
    expect(await authenticateBilling(null)).toMatchObject({ ok: false, code: "unauthorized" });
    expect(await authenticateBilling("Basic abc")).toMatchObject({ ok: false, code: "unauthorized" });
    store.binding = null;
    expect(await authenticateBilling("Bearer fvb_voice_token")).toMatchObject({ ok: false, code: "unauthorized" });
    expect(touched).not.toHaveBeenCalled();
  });

  it("answers internal, not unauthorized, when the database is down", async () => {
    store.fail = true;
    expect(await authenticateBilling("Bearer fbb_secret")).toMatchObject({ ok: false, code: "internal" });
  });
});
