"use client";

import { useEffect, useState } from "react";
import { getOrgSkill } from "@/lib/org-skills";

/** The workspace's specialist name (Thai display name), or null when the
 *  project has no workspace or the workspace has no specialist yet. */
export function useOrgSkillName(orgId: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void getOrgSkill(orgId)
      .then((s) => {
        if (!cancelled) setName(s?.name ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId]);
  return orgId ? name : null;
}
