"use client";

import { useCallback, useEffect, useState } from "react";
import { MODULES } from "@/lib/modules/registry";
import type { Module } from "@/lib/modules/types";

const KEY = "fitt-marketplace-scope";

export const providerOf = (entity: string) => MODULES.find((m) => m.provides.includes(entity));

/**
 * Everything `picked` transitively needs, the picks excluded.
 *
 * Adding accounting without purchasing produces a ledger with no suppliers in it.
 * The catalogue knows that, so the basket resolves it instead of letting someone
 * discover it after the project is built.
 */
export function closureOf(picked: Module[]): Module[] {
  const seen = new Map<string, Module>();
  const walk = (m: Module) => {
    for (const entity of m.needs) {
      const owner = providerOf(entity);
      if (!owner || seen.has(owner.id)) continue;
      seen.set(owner.id, owner);
      walk(owner);
    }
  };
  for (const m of picked) walk(m);
  for (const m of picked) seen.delete(m.id);
  return [...seen.values()];
}

/** The scope a visitor has assembled, kept across the storefront and detail pages. */
export function useScope() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setIds(JSON.parse(raw) as string[]);
    } catch {
      // A blocked store just means the basket starts empty.
    }
    setReady(true);
  }, []);

  const write = useCallback((next: string[]) => {
    setIds(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Same: the in-memory basket still works for this visit.
    }
  }, []);

  const chosen = MODULES.filter((m) => ids.includes(m.id));

  /** Adding a module brings what it reads from; nothing else is guessed at. */
  const add = useCallback(
    (m: Module) => {
      const needed = closureOf([...MODULES.filter((x) => ids.includes(x.id)), m]);
      write([...new Set([...ids, m.id, ...needed.map((x) => x.id)])]);
      return needed.filter((x) => !ids.includes(x.id));
    },
    [ids, write]
  );

  /** Removing takes anything left reading from it, so the scope stays buildable. */
  const remove = useCallback(
    (m: Module) => {
      let next = ids.filter((id) => id !== m.id);
      for (;;) {
        const broken = MODULES.filter(
          (x) =>
            next.includes(x.id) &&
            x.needs.some((e) => {
              const owner = providerOf(e);
              return owner && !next.includes(owner.id);
            })
        );
        if (broken.length === 0) break;
        next = next.filter((id) => !broken.some((b) => b.id === id));
      }
      write(next);
    },
    [ids, write]
  );

  return {
    ready,
    chosen,
    add,
    remove,
    clear: useCallback(() => write([]), [write]),
    has: (id: string) => ids.includes(id),
  };
}
