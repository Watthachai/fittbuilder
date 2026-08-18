/**
 * Domain Skill Templates — dev-authored domain expertise that makes FITT's
 * questioning and generation behave like a specialist (e.g. an ERP consultant).
 * One template per domain feeds detection, the Define/Plan interview, and the
 * Build generation (incl. realistic seed data).
 */

export type SkillQuestionType = "single" | "multi" | "text";

export interface SkillQuestion {
  id: string;
  /** The question, in Thai. */
  label: string;
  type: SkillQuestionType;
  /** Choices for single/multi. */
  options?: string[];
  /** Hint for text answers. */
  placeholder?: string;
  /** Short "why we ask" shown to the user — the visible signal that the AI is being smart. */
  why?: string;
}

/**
 * Something this domain can sell on top of the standard build.
 *
 * Premium is not "more technology" — it is the part of the job the standard
 * demo can only SHOW, done FOR the user. Standard records what happened;
 * Premium says what to do next. A 3D product viewer is one instance of that
 * (furniture buyers are blocked by not being able to picture it), not the
 * definition of it — for a warehouse the block is "when do I reorder", and 3D
 * answers nothing.
 *
 * These are a fixed, named catalogue rather than something the model invents per
 * project, for a commercial reason: quotations price work per module, and MA is
 * charged per module per month. You cannot put a price on an upgrade that comes
 * out different every time you ask for it, and a partner reselling this needs a
 * list to show a customer, not a surprise.
 */
export interface PremiumOption {
  id: string;
  /** Shown in the picker AND on the quotation — must read as a thing a buyer wants. */
  name: string;
  /** Why they pay more, said from what they cannot do today. Never from the technology. */
  pitch: string;
  /**
   * What the demo must already contain for this to be offerable — matched
   * against its screen names and file paths. An option that needs stock levels
   * is not worth showing for a demo that has no stock. Empty = always offerable.
   */
  requires: string[];
  /** Rough build effort in days — feeds the quotation's line items directly. */
  effortDays: number;
  /** What the generator must actually produce when this is chosen. */
  build: string;
}

export interface SkillTemplate {
  id: string;
  /** Thai display name. */
  name: string;
  /** English short name. */
  nameEn: string;
  /** One-line pitch for the gallery card. */
  tagline: string;
  /** lucide-react icon name (e.g. "Factory"). */
  icon: string;
  /** Detection keywords (Thai + English). */
  keywords: string[];
  /** Domain-expert framing injected into the Define interviewer. */
  persona: string;
  /** Deep domain question set (drives the smart interview + Spec-to-Demo Typeform). */
  questionBank: SkillQuestion[];
  /** Markdown: modules, workflows, roles, entities/fields, KPIs, glossary. */
  domainKnowledge: string;
  /** Markdown: screens, architecture, libraries, status/badge hints for Build. */
  buildGuidance: string;
  /** Markdown/JSON: realistic sample records to embed in the generated demo. */
  seedData: string;
  /** Optional domain visual direction. */
  designHints?: string;
  /** What this domain sells on top of the standard build. */
  premiumOptions: PremiumOption[];
}
