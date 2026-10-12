import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * A link to a project opened while signed out — FITT Voice's "open in Builder"
 * after a delivery — went to /login and, after signing in, to the home page:
 * the project it pointed at was forgotten. The login wall now carries the page
 * in `next`, which /login and /auth/callback already honour.
 */
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

const { updateSession } = await import("@/lib/supabase/middleware");

describe("the login wall", () => {
  it("sends a signed-out visit to /login with the page it wanted", async () => {
    const res = await updateSession(new NextRequest("http://builder.test/project/p1?tab=docs"));
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/login");
    expect(to.searchParams.get("next")).toBe("/project/p1?tab=docs");
    expect([...to.searchParams.keys()]).toEqual(["next"]);
  });

  it("lets public pages through", async () => {
    const res = await updateSession(new NextRequest("http://builder.test/login"));
    expect(res.headers.get("location")).toBeNull();
  });
});
