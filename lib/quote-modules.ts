import { moduleNote, type ProposalModule } from "@/lib/proposal-modules";
import { emptyRow, lineTotal, type QuoteDoc, type QuoteRow } from "@/lib/quote";

/**
 * The quotation re-cut by module: one line per module in place of a line per
 * screen, its parts and their key points as the line's detail (SQP-0002).
 *
 * Only what the modules cover is replaced. A screen no module took, and every
 * line typed by hand — an annual fee, a discount — stays where it was. Money
 * already on the screen lines moves to the module that covers them, so cutting
 * by module never changes the total on its own; a price typed on a module line
 * is kept when the cut is run again.
 */
export function rowsFromModules(
  doc: QuoteDoc,
  modules: ProposalModule[]
): { rows: QuoteRow[]; replaced: QuoteRow[] } {
  const moduleOf = new Map<string, number>();
  modules.forEach((m, k) => m.parts.forEach((p) => p.screens.forEach((s) => moduleOf.set(s.trim(), k))));
  const named = new Map(modules.map((m, k) => [m.name.trim(), k]));

  /** Which module a line belongs to: by its own name, its screen's, or the screen a modal opens from. */
  const owner = (r: QuoteRow): number | undefined =>
    named.get(r.name.trim()) ?? moduleOf.get((r.sub ? r.parent : r.name).trim());

  const replaced = doc.rows.filter((r) => owner(r) !== undefined);
  const moduleRows = modules.map((m, k): QuoteRow => {
    const note = moduleNote(m, k + 1);
    const own = doc.rows.find((r) => r.name.trim() === m.name.trim());
    if (own) return { ...own, note, sub: false, parent: "" };
    const money = replaced
      .filter((r) => owner(r) === k)
      .reduce((sum, r) => sum + Math.round(lineTotal(r, doc.ratePerDay) * 100) / 100, 0);
    return { ...emptyRow(), id: `module:${m.id}`, name: m.name, pricing: "unit", qty: 1, unitPrice: money, note };
  });
  return { rows: [...moduleRows, ...doc.rows.filter((r) => owner(r) === undefined)], replaced };
}
