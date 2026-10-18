import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const store = { binding: { id: "bind_1" } as { id: string } | null, fail: false, lookedUp: [] as string[] };
const touched = vi.fn();
vi.mock("@/lib/deploy/store", () => ({
  findDeployBinding: async (hash: string) => {
    store.lookedUp.push(hash);
    if (store.fail) throw new Error("db down");
    return store.binding;
  },
  touchDeployBinding: async (id: string) => touched(id),
}));
const { authenticateDeploy } = await import("@/lib/deploy/authenticate");

beforeEach(() => {
  store.binding = { id: "bind_1" };
  store.fail = false;
  store.lookedUp = [];
  touched.mockReset();
});

describe("authenticateDeploy", () => {
  it("looks the token up by its SHA-256 and counts the use", async () => {
    expect(await authenticateDeploy("Bearer fbd_secret")).toEqual({ ok: true, binding: { id: "bind_1" } });
    expect(store.lookedUp).toEqual([createHash("sha256").update("fbd_secret", "utf8").digest("hex")]);
    expect(touched).toHaveBeenCalledWith("bind_1");
  });

  it("refuses a missing or non-Bearer header and an unknown token; a database failure is retryable", async () => {
    expect(await authenticateDeploy(null)).toMatchObject({ ok: false, code: "unauthorized" });
    expect(await authenticateDeploy("Basic abc")).toMatchObject({ ok: false, code: "unauthorized" });
    store.binding = null;
    expect(await authenticateDeploy("Bearer fbb_billing_token")).toMatchObject({ ok: false, code: "unauthorized" });
    store.fail = true;
    expect(await authenticateDeploy("Bearer fbd_x")).toMatchObject({ ok: false, code: "internal" });
  });
});
