import { quoteTotals, type QuoteDoc, type QuoteBrand, DEFAULT_ACCENT } from "@/lib/quote";
import type { Shot } from "@/lib/shots";

/**
 * The proposal: what was built, what it does, and which problem each part of it
 * answers.
 *
 * It is the sheet that goes in front of the quotation, and the division between
 * the two is deliberate. The quotation owns money — price, instalments, VAT,
 * maintenance, the clauses someone signs. The proposal owns everything else,
 * and carries no figure of its own; where it needs to point at the price it
 * names the quotation by number. Two documents that both quote a total are two
 * documents that will eventually disagree.
 *
 * Everything here is pure. The panel and the printed sheet call the same
 * functions, so the paper cannot say something the editor never showed.
 */

/**
 * One line of the argument: a problem the customer has, the thing that was
 * built for it, and what changes as a result.
 *
 * Three fields rather than a paragraph because this is the part a reader
 * actually scans, and because a feature with no problem beside it is a feature
 * nobody asked for — keeping them adjacent makes that visible while it can
 * still be fixed.
 */
export interface ProposalPoint {
  id: string;
  problem: string;
  feature: string;
  outcome: string;
}

/**
 * One step of the demonstrated walk: arrived at `name`, from `from`, by
 * pressing `via`.
 *
 * Derived, never typed. The fields come off the screenshots the capture bridge
 * recorded while it drove the app (lib/shots.ts), so a step can only describe a
 * click that actually happened.
 */
export interface ProposalStep {
  /** Storage path of the shot — stable identity for the row. */
  id: string;
  index: number;
  name: string;
  /** The screen this was reached from, when the walk recorded one. */
  from: string | null;
  /** The control that was pressed to get here, when one was pressed. */
  via: string | null;
  /** Set when this is a modal belonging to a screen rather than a screen. */
  parent: string | null;
  /** What this screen does — reused from the quotation, never written twice. */
  note: string;
  url: string;
}

/** How long the work takes, read off the quotation rather than restated. */
export interface ProposalTimeline {
  /** Working days of development, from the priced scope. */
  buildDays: number;
  /** Days the customer has to inspect after handover. */
  reviewDays: number;
  /** Months of maintenance already inside the project price. */
  includedMonths: number;
  /** False when there is no quotation yet — the panel shows a prompt, not a guess. */
  known: boolean;
}

export interface ProposalDoc {
  proposalNo: string;
  /** ISO yyyy-mm-dd. */
  issuedAt: string;
  subject: string;

  customerAttn: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  presentedBy: string;

  /** Copied in at birth, exactly as the quotation does — see QuoteBrand. */
  brand: QuoteBrand;

  /** The situation before this system existed. */
  context: string;
  points: ProposalPoint[];
  /** Named so the reader knows what is NOT in this phase. */
  excluded: string[];
  /** Print the demonstrated walk with its screenshots. */
  showSteps: boolean;
  closing: string;
  /** The quotation this proposal accompanies — the only place a price is named. */
  quoteNo: string;
}

export const DEFAULT_CLOSING =
  "ทีมงานพร้อมนำเสนอระบบจริงและตอบข้อสงสัยเพิ่มเติม ก่อนเริ่มงานตามขอบเขตในเอกสารฉบับนี้";

/** Ids are local to a document, so a counter beats a uuid dependency. */
const pointId = (seed: string, i: number): string => `${seed}-${i}-${Date.now().toString(36)}`;

export const emptyPoint = (i = 0): ProposalPoint => ({
  id: pointId("pt", i),
  problem: "",
  feature: "",
  outcome: "",
});

/** The letterhead a proposal starts from when no workspace brand is available. */
export const emptyBrand = (): QuoteBrand => ({
  logoUrl: "",
  name: "",
  taxId: "",
  address: "",
  contact: "",
  tagline: "",
  accent: DEFAULT_ACCENT,
  poweredBy: true,
});

/**
 * Seed a document.
 *
 * Deliberately empty of argument: the points are what the person is paid to
 * think about, and pre-filling them with plausible sentences invites shipping
 * whatever the machine guessed. The AI pass is a separate, explicit click.
 */
export function newProposal(projectName: string, today: string): ProposalDoc {
  return {
    proposalNo: "",
    issuedAt: today,
    subject: projectName ? `ข้อเสนอโครงการ ${projectName}` : "ข้อเสนอโครงการ",
    customerAttn: "",
    customerName: "",
    customerAddress: "",
    customerPhone: "",
    presentedBy: "",
    brand: emptyBrand(),
    context: "",
    points: [],
    excluded: [],
    showSteps: true,
    closing: DEFAULT_CLOSING,
    quoteNo: "",
  };
}

/**
 * Turn the captured walk into printable steps.
 *
 * Sorted by capture index, which IS the order the app was walked in
 * (lib/shots.ts writes it into the object key). Descriptions are joined from
 * the quotation's rows by screen name — the quotation is where "what this
 * screen does" already lives, and generating a second set would create two
 * descriptions of one screen that drift apart.
 *
 * Shots with no usable URL are dropped rather than printed as broken boxes.
 */
export function proposalSteps(shots: Shot[], quote: QuoteDoc | null): ProposalStep[] {
  const notes = new Map<string, string>();
  for (const r of quote?.rows ?? []) {
    if (r.name.trim() && r.note.trim()) notes.set(r.name.trim(), r.note.trim());
  }
  return shots
    .filter((s) => s.url)
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((s) => ({
      id: s.path,
      index: s.index,
      name: s.name,
      from: s.from ?? null,
      via: s.via ?? null,
      parent: s.parent,
      note: notes.get(s.name.trim()) ?? "",
      url: s.url,
    }));
}

/**
 * The one sentence a step is worth on paper.
 *
 * Returns null when the walk recorded no control — which is the honest answer
 * for the screen the app opens on, and for anything captured by a mode that
 * does not track navigation. A reader is better served by a screenshot with no
 * caption than by an invented click.
 */
export function stepJourney(step: ProposalStep): string | null {
  if (!step.via) return null;
  return step.from
    ? `จากหน้า “${step.from}” กด “${step.via}” → ${step.name}`
    : `กด “${step.via}” → ${step.name}`;
}

/** True when the walk produced at least one real navigation edge. */
export const hasJourney = (steps: ProposalStep[]): boolean =>
  steps.some((s) => s.via !== null);

/**
 * Read the schedule off the quotation.
 *
 * Never typed into the proposal, for the same reason the quotation's clauses
 * are generated from its own payment table: two documents in one envelope must
 * not be able to promise different numbers of days.
 */
export function proposalTimeline(quote: QuoteDoc | null): ProposalTimeline {
  if (!quote) return { buildDays: 0, reviewDays: 0, includedMonths: 0, known: false };
  return {
    buildDays: quoteTotals(quote).days,
    reviewDays: quote.acceptance.reviewDays,
    includedMonths: quote.ma.enabled ? quote.ma.includedMonths : 0,
    known: true,
  };
}

/**
 * Parse a stored payload back into a document.
 *
 * The column is jsonb, so this is untrusted input rather than a ProposalDoc —
 * same contract as parseDoc in lib/quote.ts. Anything unrecognisable returns
 * null and the caller seeds a fresh document instead of rendering a broken one.
 */
export function parseProposal(payload: unknown, fallbackDate: string): ProposalDoc | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const o = payload as Record<string, unknown>;
  if (!Array.isArray(o.points)) return null;

  const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const strs = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const b = obj(o.brand);
  const fallback = emptyBrand();

  return {
    proposalNo: str(o.proposalNo),
    issuedAt: str(o.issuedAt) || fallbackDate,
    subject: str(o.subject),
    customerAttn: str(o.customerAttn),
    customerName: str(o.customerName),
    customerAddress: str(o.customerAddress),
    customerPhone: str(o.customerPhone),
    presentedBy: str(o.presentedBy),
    brand: {
      logoUrl: str(b.logoUrl),
      name: str(b.name),
      taxId: str(b.taxId),
      address: str(b.address),
      contact: str(b.contact),
      tagline: str(b.tagline),
      accent: str(b.accent, fallback.accent) || fallback.accent,
      // Default true: a document whose flag went missing must fall back to
      // carrying our mark, never to silently dropping it.
      poweredBy: bool(b.poweredBy, true),
    },
    context: str(o.context),
    points: o.points.map((raw, i) => {
      const p = obj(raw);
      return {
        id: str(p.id) || pointId("pt", i),
        problem: str(p.problem),
        feature: str(p.feature),
        outcome: str(p.outcome),
      };
    }),
    excluded: strs(o.excluded),
    showSteps: bool(o.showSteps, true),
    closing: str(o.closing, DEFAULT_CLOSING),
    quoteNo: str(o.quoteNo),
  };
}
