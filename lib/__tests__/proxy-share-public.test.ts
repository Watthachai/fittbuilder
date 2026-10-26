import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// A shared demo is for a partner's customer, who has no account: the link must
// open signed out. Everything else still sends a signed-out visitor to /login.
const state = { user: null as { id: string; email: string } | null };
const rpc = vi.fn(async () => ({ data: false, error: null }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    rpc,
  }),
}));

const { updateSession } = await import("../supabase/middleware");
const visit = (path: string) => updateSession(new NextRequest(`https://builder.test${path}`));

beforeEach(() => {
  state.user = null;
  rpc.mockClear();
});

it("opens a shared demo link to someone signed out", async () => {
  const r = await visit("/share/aB3dE5gH");
  expect(r.headers.get("location")).toBeNull();
  expect(r.status).toBe(200);
});

it("opens a shared demo to a signed-in account without access, without asking the database", async () => {
  state.user = { id: "u-1", email: "someone@else.test" };
  const r = await visit("/share/aB3dE5gH");
  expect(r.headers.get("location")).toBeNull();
  expect(rpc).not.toHaveBeenCalled();
});

it("still sends a signed-out visitor elsewhere to /login", async () => {
  const r = await visit("/projects/p-1");
  expect(r.status).toBe(307);
  expect(new URL(r.headers.get("location")!).pathname).toBe("/login");
});
