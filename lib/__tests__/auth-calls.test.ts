import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `auth.getUser()` is a NETWORK CALL to /auth/v1/user on every invocation.
 *
 * The app once made it from 15 client modules — and lib/storage.ts made it
 * again before each of 7 database operations — so opening the studio fired
 * dozens of auth round-trips. The Auth service returned 522 under exactly that
 * traffic on 18 Aug 2026.
 *
 * Client code reads the session it already holds (lib/current-user.ts) instead.
 * SERVER code must keep getUser(): in proxy.ts and route handlers the
 * verification is the security boundary, so this test never touches those.
 */

const ROOTS = ["lib", "components", "app"];
/** The one client module allowed to talk to the auth layer directly. */
const ALLOWED = new Set(["lib/current-user.ts"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(path, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe("auth call budget", () => {
  it("no client module calls auth.getUser() — it costs a network round trip", () => {
    const offenders = ROOTS.flatMap((r) => walk(r))
      .filter((p) => !ALLOWED.has(p))
      .filter((p) => {
        const src = readFileSync(p, "utf8");
        return src.startsWith('"use client"') && src.includes("auth.getUser()");
      });
    expect(offenders).toEqual([]);
  });

  /**
   * The guard above is only worth anything while the replacement exists and
   * reads the local session — if currentUser() ever started calling getUser()
   * itself, every call site would silently go back on the network.
   */
  it("currentUser() reads the local session, never the auth server", () => {
    const src = readFileSync("lib/current-user.ts", "utf8");
    const code = src.slice(src.indexOf("export interface CurrentUser"));
    expect(code).toContain("auth.getSession()");
    expect(code).not.toContain("auth.getUser()");
  });

  it("the session check stays in the proxy, where it is the security boundary", () => {
    expect(readFileSync("lib/supabase/middleware.ts", "utf8")).toContain("auth.getUser()");
  });
});
