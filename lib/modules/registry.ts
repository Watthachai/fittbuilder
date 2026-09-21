import type { Module } from "./types";
import { PA } from "./hr/pa";
import { PY } from "./hr/py";

/**
 * Every module, in catalogue order. Mirrors `lib/skills/registry.ts` — modules are
 * dev-authored and live in the repo, so a module earns its place by compiling and
 * being tested, not by being configured.
 *
 * HR ships first because payroll cannot exist without personnel records: the
 * `provides`/`needs` contract has a real dependency to prove itself against from
 * the first build rather than three families of unrelated screens.
 */
export const MODULES: Module[] = [PA, PY];

export function getModule(id: string | null | undefined): Module | undefined {
  if (!id) return undefined;
  return MODULES.find((m) => m.id === id);
}

/** The modules of one family, in catalogue order. */
export function modulesOf(family: Module["family"]): Module[] {
  return MODULES.filter((m) => m.family === family);
}
