"use client";

import { useCallback, useEffect, useState } from "react";
import { FAMILIES, MODULES, modulesOf } from "@/lib/modules/registry";
import type { Module, ModuleFamily } from "@/lib/modules/types";

const KEY = "fitt-marketplace-scope";

export const providerOf = (entity: string) => MODULES.find((m) => m.provides.includes(entity));

/** The system a module is part of, by its buyer-facing name. */
export const systemOf = (m: Module) => FAMILIES.find((f) => f.id === m.family)!;

/**
 * Everything `picked` transitively needs, the picks excluded.
 *
 * Adding the accounting system without purchasing produces a ledger with no
 * suppliers in it. The catalogue knows that, so the basket resolves it instead
 * of letting someone discover it after the project is built.
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

/** The ids that belong to a system every part of which is present. */
function wholeSystemsOnly(ids: string[]): string[] {
  return FAMILIES.filter((f) => modulesOf(f.id).every((m) => ids.includes(m.id))).flatMap((f) =>
    modulesOf(f.id).map((m) => m.id)
  );
}

/** The other systems a system cannot run without. */
export function systemsNeededBy(family: ModuleFamily): ModuleFamily[] {
  const parts = modulesOf(family);
  return [...new Set(closureOf(parts).map((m) => m.family))].filter((f) => f !== family);
}

/** Price of a system: the sum of its parts. No shared-cost discount in v1. */
export function systemPrice(family: ModuleFamily) {
  const parts = modulesOf(family);
  return {
    days: parts.reduce((n, m) => n + m.effortDays, 0),
    ma: parts.reduce((n, m) => n + m.maPerMonth, 0),
  };
}

/**
 * The scope a visitor has assembled, kept across the storefront and detail pages.
 *
 * It is bought in systems, because that is how it is used: one HR system that
 * different people see different parts of, not four products. The store still
 * remembers module ids underneath, since that is what the composer builds from.
 */
export function useScope() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      // A basket saved when parts were sold singly may hold half a system.
      // Half a system is not a product, so only whole ones are kept.
      if (raw) setIds(wholeSystemsOnly(JSON.parse(raw) as string[]));
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
  const systems = FAMILIES.filter((f) => modulesOf(f.id).every((m) => ids.includes(m.id)));

  /** Adding a system brings the systems it reads from; nothing else is guessed at. */
  const addSystem = useCallback(
    (family: ModuleFamily) => {
      const parts = modulesOf(family);
      const needed = closureOf([...MODULES.filter((x) => ids.includes(x.id)), ...parts]);
      write([...new Set([...ids, ...parts.map((m) => m.id), ...needed.map((x) => x.id)])]);
      return [...new Set(needed.filter((x) => !ids.includes(x.id)).map((x) => x.family))].filter((f) => f !== family);
    },
    [ids, write]
  );

  /** Removing a system takes any system left reading from it, so the scope stays buildable. */
  const removeSystem = useCallback(
    (family: ModuleFamily) => {
      let next = ids.filter((id) => !modulesOf(family).some((m) => m.id === id));
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
        // A broken part takes its whole system out; half a system is not a product.
        const families = new Set(broken.map((b) => b.family));
        next = next.filter((id) => !MODULES.some((m) => m.id === id && families.has(m.family)));
      }
      write(next);
    },
    [ids, write]
  );

  return {
    ready,
    chosen,
    systems,
    addSystem,
    removeSystem,
    clear: useCallback(() => write([]), [write]),
    hasSystem: (family: ModuleFamily) => modulesOf(family).every((m) => ids.includes(m.id)),
  };
}
