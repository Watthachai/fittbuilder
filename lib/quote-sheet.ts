import type { ProposalModule } from "@/lib/proposal-modules";
import { lineTotal, printsPrice, quoteTotals, type QuoteDoc, type QuoteRow } from "@/lib/quote";

/**
 * The quotation as a contractor's two-sheet paper (QuoteLayout "cover"): a cover
 * that totals one line per section, and the detail where every line sits under
 * its section with จำนวน · หน่วย · ราคา/หน่วย and the section closes on its own
 * subtotal — the shape of First Chapter's quotation, which customers recognise.
 *
 * Sections are the modules broken out on the proposal (lib/proposal-modules), so
 * a line lands under the module that covers its screen, exactly as the module
 * cut on the quotation decides it (lib/quote-modules). Lines no module covers —
 * an annual fee, a licence typed by hand — close the detail as "รายการอื่น ๆ".
 * With no modules at all the whole quotation is one section, named after the
 * subject.
 *
 * Pure, like lib/quote: the printed page and the Word file both read this, so
 * the two cannot number or total a line differently.
 */

export interface SheetLine {
  /** "1.2" for a line of its own, empty for a modal printed under its screen. */
  no: string;
  name: string;
  /** What the line covers, printed small under its name. */
  note: string;
  /** Blank cells are null — a part of a module is scope, not a priced line. */
  qty: number | null;
  unit: string;
  unitPrice: number | null;
  amount: number | null;
  /** A modal: indented under the screen it opens from. */
  sub: boolean;
}

export interface SheetSection {
  /** "1", "2" … */
  no: string;
  name: string;
  lines: SheetLine[];
  /** The section's money before discount; null when the quotation is one lump sum. */
  subtotal: number | null;
}

export interface QuoteSheet {
  sections: SheetSection[];
  /** One line per section, for the cover. */
  cover: SheetLine[];
  /** The figure the cover's lines add up to — the quotation's subtotal before discount. */
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The unit a man-day line is counted in on the paper. */
export const MAN_DAY = "Man-day";
/** A section counted on the cover as one job. */
export const JOB = "งาน";

/** One quotation row as a detail line: man-days × rate, or quantity × unit price. */
function rowLine(r: QuoteRow, doc: QuoteDoc, no: string): SheetLine {
  const lump = doc.lumpSum.enabled;
  const amount = round2(lineTotal(r, doc.ratePerDay));
  const priced = !lump && printsPrice(r, doc.ratePerDay);
  // With the basis off the day rate is the sender's to keep (case #25): a man-day
  // line then prints as one job at its own price, never as days × a rate.
  const days = r.pricing === "days";
  const asJob = days && !doc.showBasis;
  return {
    no,
    name: r.name.trim() || "—",
    note: r.note.trim(),
    qty: asJob ? 1 : days ? r.days : r.qty,
    unit: asJob ? JOB : days ? MAN_DAY : r.unit.trim(),
    unitPrice: priced ? (asJob ? amount : days ? doc.ratePerDay : r.unitPrice) : null,
    amount: priced ? amount : null,
    sub: r.sub,
  };
}

/** Rows numbered under their section: a screen gets "s.k", a modal prints unnumbered beneath it. */
function numbered(rows: QuoteRow[], doc: QuoteDoc, sectionNo: string): SheetLine[] {
  let k = 0;
  return rows.map((r) => {
    if (r.sub && k > 0) return rowLine(r, doc, "");
    k += 1;
    return rowLine(r, doc, `${sectionNo}.${k}`);
  });
}

/** A module the quotation carries as one priced line (the module cut): its parts are the detail. */
function partLines(m: ProposalModule, sectionNo: string): SheetLine[] {
  return m.parts.map((p, j) => ({
    no: `${sectionNo}.${j + 1}`,
    name: p.name,
    note: p.points.map((x) => `- ${x}`).join("\n"),
    qty: null,
    unit: "",
    unitPrice: null,
    amount: null,
    sub: false,
  }));
}

export function quoteSheet(doc: QuoteDoc, modules: ProposalModule[]): QuoteSheet {
  const lump = doc.lumpSum.enabled;
  const total = quoteTotals(doc).subtotal;
  const money = (rows: QuoteRow[]) =>
    lump ? null : round2(rows.reduce((s, r) => s + round2(lineTotal(r, doc.ratePerDay)), 0));

  // Which module covers a row — by its own name (a module line), its screen's, or
  // the screen a modal opens from. The same rule the module cut uses.
  const moduleOf = new Map<string, number>();
  modules.forEach((m, k) => m.parts.forEach((p) => p.screens.forEach((s) => moduleOf.set(s.trim(), k))));
  const named = new Map(modules.map((m, k) => [m.name.trim(), k]));
  const owner = (r: QuoteRow): number | undefined =>
    named.get(r.name.trim()) ?? moduleOf.get((r.sub ? r.parent : r.name).trim());

  const groups: { name: string; rows: QuoteRow[]; module?: ProposalModule }[] = [];
  if (modules.length > 0) {
    modules.forEach((m, k) => {
      const rows = doc.rows.filter((r) => owner(r) === k);
      if (rows.length > 0) groups.push({ name: m.name.trim() || `โมดูล ${k + 1}`, rows, module: m });
    });
    const rest = doc.rows.filter((r) => owner(r) === undefined);
    if (rest.length > 0) groups.push({ name: groups.length > 0 ? "รายการอื่น ๆ" : sectionName(doc), rows: rest });
  } else if (doc.rows.length > 0) {
    groups.push({ name: sectionName(doc), rows: doc.rows });
  }

  const sections: SheetSection[] = groups.map((g, i) => {
    const no = String(i + 1);
    // Cut by module, the section's one row IS the module: list its parts beneath
    // it, unpriced, and let the subtotal carry the module's price.
    const asModuleLine =
      g.module && g.module.parts.length > 0 && g.rows.length === 1 && g.rows[0].name.trim() === g.module.name.trim();
    return {
      no,
      name: g.name,
      lines: asModuleLine ? partLines(g.module!, no) : numbered(g.rows, doc, no),
      subtotal: money(g.rows),
    };
  });

  const cover: SheetLine[] = sections.map((s) => ({
    no: s.no,
    name: s.name,
    note: "",
    qty: 1,
    unit: JOB,
    unitPrice: s.subtotal,
    amount: s.subtotal,
    sub: false,
  }));

  return { sections, cover, total };
}

/** The one section a quotation without modules prints under. */
function sectionName(doc: QuoteDoc): string {
  return doc.lumpSum.title.trim() || doc.subject.trim() || "ขอบเขตงานพัฒนาระบบ";
}
