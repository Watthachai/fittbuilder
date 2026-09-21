import { describe, expect, it } from "vitest";
import { composeModules } from "../modules/compose";
import { MODULES, FAMILIES, getModule, modulesOf } from "../modules/registry";
import type { Module } from "../modules/types";

/**
 * HR proved the contract inside one family, where every reader needed the same
 * one owner. Three families is the first time a module reads across a family line
 * — accounting reads the purchasing module's vendors — and the first time the
 * chain is longer than one hop: costing needs the ledger, which needs sales.
 *
 * That chain is what these hold. A need nobody provides is a module that can
 * never be bought; a cycle is a selection that can never be ordered.
 */
const providerOf = (entity: string) => MODULES.find((m) => m.provides.includes(entity));

/** Everything `m` transitively needs, `m` excluded. */
function closureOf(m: Module): Module[] {
  const seen = new Map<string, Module>();
  const walk = (x: Module) => {
    for (const entity of x.needs) {
      const owner = providerOf(entity);
      if (!owner || seen.has(owner.id)) continue;
      seen.set(owner.id, owner);
      walk(owner);
    }
  };
  walk(m);
  return [...seen.values()];
}

describe("the catalogue across families", () => {
  it("has a listed family for every module, and a module for every listed family", () => {
    const declared = new Set(MODULES.map((m) => m.family));
    const listed = new Set(FAMILIES.map((f) => f.id));

    expect([...declared].sort()).toEqual([...listed].sort());
  });

  it("can satisfy every need it declares", () => {
    for (const m of MODULES) {
      for (const entity of m.needs) {
        expect(providerOf(entity), `${m.id} needs "${entity}" and nothing provides it`).toBeDefined();
      }
    }
  });

  it("never asks a module to provide what it also needs", () => {
    for (const m of MODULES) {
      expect(m.needs.filter((n) => m.provides.includes(n))).toEqual([]);
    }
  });

  it("lets every module be bought by adding what it depends on", () => {
    // If a chain ever loops, the closure walk would not terminate and this fails
    // by timeout rather than assertion — which is the honest failure for a cycle.
    for (const m of MODULES) {
      expect(composeModules([m, ...closureOf(m)]).missing).toEqual([]);
    }
  });

  it("puts the ledger after the documents it posts from", () => {
    const co = getModule("co")!;
    const shell = composeModules([co, ...closureOf(co)]).files["src/App.tsx"];

    expect(shell.indexOf("จัดซื้อและคลังวัสดุ")).toBeLessThan(shell.indexOf("บัญชีการเงิน"));
    expect(shell.indexOf("บัญชีการเงิน")).toBeLessThan(shell.indexOf("บัญชีบริหารและต้นทุน"));
  });

  it("reads the material master rather than shipping a second catalogue", () => {
    // Same rule payroll lives under, applied to the entity the logistics family
    // shares: four modules price, plan, sell and store the same materials.
    for (const m of modulesOf("logistics").filter((x) => x.id !== "mm")) {
      expect(Object.values(m.files).join("\n")).toContain('from "../mm/data"');
      for (const source of Object.values(m.files)) {
        expect(source).not.toMatch(/export const MATERIALS/);
      }
    }
  });

  it("keeps a family's tabs together instead of interleaving three businesses", () => {
    // Data-flow order alone is correct but unreadable across families: purchasing,
    // then personnel, then production, then payroll. A buyer reads the nav as
    // "my HR system, my operations, my books", so family leads and data flow
    // breaks ties inside it. That is safe because no family needs a later one.
    const shell = composeModules(MODULES).files["src/App.tsx"];
    const firstIndexOf = (family: Module["family"]) =>
      Math.min(...modulesOf(family).map((m) => shell.indexOf(m.name)));
    const lastIndexOf = (family: Module["family"]) =>
      Math.max(...modulesOf(family).map((m) => shell.indexOf(m.name)));

    for (let i = 1; i < FAMILIES.length; i++) {
      expect(firstIndexOf(FAMILIES[i].id)).toBeGreaterThan(lastIndexOf(FAMILIES[i - 1].id));
    }
  });

  it("prices a whole family as the sum of its parts, families included", () => {
    const all = composeModules(MODULES);

    expect(all.quoteLines).toHaveLength(MODULES.length);
    expect(all.totalEffortDays).toBe(MODULES.reduce((n, m) => n + m.effortDays, 0));
    expect(all.totalMaPerMonth).toBe(MODULES.reduce((n, m) => n + m.maPerMonth, 0));
  });

  it("reports what is missing instead of quietly building a broken system", () => {
    const co = getModule("co")!;

    expect(composeModules([co]).missing.map((x) => x.entity).sort()).toEqual(
      [...co.needs].sort()
    );
  });
});
