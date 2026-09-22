import type { ProjectFiles } from "@/lib/types";

/**
 * A module: one named, priced, buildable piece of business capability.
 *
 * This is `PremiumOption` widened, not a new idea beside it. That type already
 * carried everything a paid add-on needs — a name a buyer recognises, the pitch,
 * the effort that becomes a quotation line, and the build spec. What it could not
 * express is base scope: the parts the customer is buying in the first place, which
 * is where an SAP-shaped catalogue lives. `tier` is the only field that separates
 * the two, so pricing and MA keep one home instead of two.
 *
 * `provides` / `needs` are entity names, compared as plain strings. Payroll reads
 * the employee that personnel records owns. Nothing here describes a schema — the
 * composer only has to answer "is this satisfied", and a type system for types is
 * a cost with no buyer.
 */
export type ModuleFamily = "hr" | "logistics" | "finance";

/**
 * Catalogue order of the families, and the order their tabs appear in.
 *
 * It must stay dependency-safe: no family may need an entity a later family owns,
 * because the composer uses this ahead of data flow when breaking ties.
 */
export const FAMILY_ORDER: ModuleFamily[] = ["hr", "logistics", "finance"];

/**
 * What a family is called when it faces a buyer: a system, of which the modules
 * are parts. The registry's FAMILIES reads from here so the two never disagree.
 */
export const SYSTEM_NAMES: Record<ModuleFamily, string> = {
  hr: "บุคคลและเงินเดือน",
  logistics: "จัดซื้อ ผลิต ขาย คลัง",
  finance: "บัญชีและต้นทุน",
};

export interface Module {
  id: string;
  /** Thai display name — what the buyer reads on the quotation. */
  name: string;
  family: ModuleFamily;
  /** `base` is scope the customer is buying; `premium` is sold on top. */
  tier: "base" | "premium";
  /** Why they want it, said from what they cannot do today. Never from the technology. */
  pitch: string;
  /** Entities this module owns. */
  provides: string[];
  /** Entities this module reads but does not own. */
  needs: string[];
  /** Build effort in days — becomes a quotation line item. */
  effortDays: number;
  /** Monthly maintenance, charged per module. */
  maPerMonth: number;
  /** What the generator must actually produce. */
  build: string;
  /**
   * The capabilities this module is expected to cover, taken from the SAP module
   * it is named after rather than invented here.
   *
   * They are data instead of prose because a claim of completeness that nothing
   * checks is worth nothing: the first pass at this catalogue shipped one screen
   * per module and called it HR, and the gap only surfaced when somebody read the
   * source document. The tests hold each module's own source against this list.
   */
  keyFeatures: string[];
  /**
   * Whether the module ships a dashboard of its own at its index route.
   *
   * Without it the index renders the first capability, which is fine — but the
   * navigation must not offer "ภาพรวม" and then show something else. The menu
   * and the screen answer to the same flag.
   */
  hasOverview?: boolean;
  /** The module's own source, confined to `src/modules/<id>/`. */
  files: ProjectFiles;
  /** The SAP module this is comparable to — a search alias, never a claim. */
  sapCode?: string;
}

/** One line on the quotation. Priced exactly as the module is priced — no bundle maths. */
export interface QuoteLine {
  moduleId: string;
  name: string;
  effortDays: number;
  maPerMonth: number;
}

/** An entity a selected module reads that no selected module owns. */
export interface MissingEntity {
  moduleId: string;
  entity: string;
}

export interface Composition {
  /** Every module's own files, plus the shell the composer owns. */
  files: ProjectFiles;
  missing: MissingEntity[];
  /** Scope text for the PRD — the part that outlives the demo. */
  prdSection: string;
  quoteLines: QuoteLine[];
  totalEffortDays: number;
  totalMaPerMonth: number;
}
