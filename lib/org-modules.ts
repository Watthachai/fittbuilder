import { parseStoredModules } from "@/lib/proposal-modules";
import { emptyRow, lineTotal, type QuoteRow } from "@/lib/quote";

/**
 * What a workspace has had built, module by module (the workspace page).
 *
 * Every project in the workspace, broken into the modules on its proposal
 * (lib/proposal-modules), each priced from the quotation line of the same name
 * — the line "สร้างรายการจากโมดูล" writes. One project often carries several
 * modules, and this is where they are counted rather than the project.
 */

export interface DeliveredModule {
  name: string;
  /** How many parts (1.1, 1.2 …) it has. */
  parts: number;
  /** How many screens its parts cover. */
  screens: number;
  /** Its quotation line's total; 0 when given with the deal, null when no line names it. */
  price: number | null;
}

export interface DeliveredProject {
  id: string;
  name: string;
  updatedAt: string;
  /** Empty until someone breaks the project into modules on its proposal. */
  modules: DeliveredModule[];
}

/** Rows as read straight off the stored quotation, so each is filled out before it is priced. */
const priced = (rows: unknown, rate: unknown): Map<string, number> => {
  const out = new Map<string, number>();
  for (const raw of Array.isArray(rows) ? rows : []) {
    if (!raw || typeof raw !== "object") continue;
    const row: QuoteRow = { ...emptyRow(), ...(raw as Partial<QuoteRow>) };
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (name && !out.has(name)) out.set(name, lineTotal(row, Number(rate) || 0));
  }
  return out;
};

export function deliveredWork(
  projects: { id: string; name: string; updated_at: string }[],
  proposals: { project_id: string; version: string; modules: unknown }[],
  quotes: { project_id: string; version: string; rows: unknown; rate: unknown }[]
): DeliveredProject[] {
  return projects.map((p) => {
    // The standard version is what was sold first; another version speaks for
    // the project only when it is the one that has been broken down.
    const broken = proposals
      .filter((pr) => pr.project_id === p.id)
      .map((pr) => ({ version: pr.version, modules: parseStoredModules(pr.modules) }))
      .filter((pr) => pr.modules.length > 0)
      .sort((a, b) => Number(b.version === "standard") - Number(a.version === "standard"))[0];
    if (!broken) return { id: p.id, name: p.name, updatedAt: p.updated_at, modules: [] };
    const quote = quotes.find((q) => q.project_id === p.id && q.version === broken.version);
    const prices = quote ? priced(quote.rows, quote.rate) : new Map<string, number>();
    return {
      id: p.id,
      name: p.name,
      updatedAt: p.updated_at,
      modules: broken.modules.map((m) => ({
        name: m.name,
        parts: m.parts.length,
        screens: m.parts.reduce((n, part) => n + part.screens.length, 0),
        price: prices.get(m.name.trim()) ?? null,
      })),
    };
  });
}
