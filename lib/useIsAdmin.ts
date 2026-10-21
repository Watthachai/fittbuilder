"use client";

import { useEffect, useState } from "react";

/**
 * Whether the signed-in person is on the team (ADMIN_EMAILS), from /api/me.
 * A hint for what to show, false until the answer arrives — the routes behind
 * anything it reveals check the same list themselves.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me")
      .then((res) => (res.ok ? (res.json() as Promise<{ isAdmin?: boolean }>) : null))
      .then((data) => {
        if (!cancelled) setIsAdmin(Boolean(data?.isAdmin));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return isAdmin;
}
