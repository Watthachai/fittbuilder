"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Who is signed in, read from the session this browser already holds.
 *
 * ── why this exists ──────────────────────────────────────────────────────────
 * `auth.getUser()` is a NETWORK CALL to /auth/v1/user every single time. The app
 * called it from 15 client modules, and lib/storage.ts called it again before
 * each of 7 database operations, so opening the studio once fired dozens of auth
 * round-trips. On 18 Aug 2026 the Auth service returned 522 under exactly that
 * traffic — the same shape as the 6 Aug outage: one user action amplified into
 * many backend calls.
 *
 * `getSession()` reads the JWT already in this browser. No request in the common
 * case (it only reaches the network when the token needs refreshing), and it
 * yields the same user id.
 *
 * ── why this is safe ─────────────────────────────────────────────────────────
 * The client uses the id to FILTER its own queries, never to authorise anything.
 * Authorisation is RLS on the database, which verifies the token server-side and
 * ignores whatever the client believes about itself. A tampered session here
 * buys nothing: the query still comes back empty.
 *
 * Server code MUST keep using getUser() — in proxy.ts and route handlers the
 * verification IS the security boundary.
 */

export interface CurrentUser {
  id: string;
  email: string | null;
  /**
   * Display name from the provider profile. DISPLAY ONLY — user_metadata is
   * user-editable, so it must never decide what anyone is allowed to do.
   */
  name: string | null;
  /** Provider avatar. Display only, same caveat as `name`. */
  avatar: string | null;
}

function shape(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): CurrentUser {
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? null,
    name: ((meta.full_name ?? meta.name) as string | undefined) ?? null,
    avatar: ((meta.avatar_url ?? meta.picture) as string | undefined) ?? null,
  };
}

/** undefined = not read yet; null = signed out. */
let cached: CurrentUser | null | undefined;
let inflight: Promise<CurrentUser | null> | null = null;
let subscribed = false;

/** Drop the cache whenever the session changes, so a sign-out is never stale. */
function watch() {
  if (subscribed) return;
  subscribed = true;
  createClient().auth.onAuthStateChange((_event, session) => {
    cached = session?.user ? shape(session.user) : null;
  });
}

export async function currentUser(): Promise<CurrentUser | null> {
  watch();
  if (cached !== undefined) return cached;
  // Collapse concurrent callers onto one read — the studio mounts several
  // components at once and they would otherwise each start their own.
  inflight ??= (async () => {
    const { data } = await createClient().auth.getSession();
    const u = data.session?.user;
    cached = u ? shape(u) : null;
    inflight = null;
    return cached;
  })();
  return inflight;
}

/** The signed-in user's id, or throw — for calls that cannot proceed without it. */
export async function currentUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}
