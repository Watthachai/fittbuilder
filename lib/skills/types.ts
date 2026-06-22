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
}
