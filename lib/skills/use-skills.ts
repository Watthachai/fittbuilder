"use client";

import { useEffect, useState } from "react";
import { SKILLS } from "./registry";
import type { SkillTemplate } from "./types";

/**
 * Client hook: built-in templates immediately, then replaced with the full set
 * (built-in + published custom) from /api/skills. Falls back to built-ins on error.
 */
export function useSkills(): SkillTemplate[] {
  const [skills, setSkills] = useState<SkillTemplate[]>(SKILLS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/skills");
        if (!res.ok) return;
        const data = (await res.json()) as { skills?: SkillTemplate[] };
        if (!cancelled && Array.isArray(data.skills) && data.skills.length) {
          setSkills(data.skills);
        }
      } catch {
        /* keep built-in fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return skills;
}
