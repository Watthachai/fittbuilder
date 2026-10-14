import type { Json } from "@/lib/db/types";
import type { BillingCycle, PaymentTerm } from "@/lib/quote";

/** The FITT Billing contract (docs/integrations/fitt-billing.md). */

export type BillingErrorCode = "unauthorized" | "not_found" | "invalid_request" | "rate_limited" | "internal";
export type BillingStatus = "active" | "suspended";

/** A Billing credential reads every project, so it carries no workspace. */
export interface BillingBinding {
  id: string;
}

/** A project as the store reads it. `files` is present only in a bundle. */
export interface ProjectRecord {
  id: string;
  name: string;
  phase: string;
  active_version: string;
  /** null for a personal project, which belongs to no workspace. */
  org_id: string | null;
  owner_id: string;
  /** The last hand-off to Code Runner (lib/types.ts RunnerSend), or null. */
  runner_last: Json | null;
  created_at: string;
  updated_at: string;
  files?: Json | null;
}

export interface OrgRecord {
  id: string;
  name: string;
}

export interface OwnerRecord {
  id: string;
  name: string | null;
  email: string;
}

/** A stored quotation or proposal. `payload` is absent where the store didn't read it. */
export interface DocRecord {
  project_id: string;
  version: string;
  updated_at: string;
  payload?: Json;
}

export interface BillingRow {
  project_id: string;
  status: string;
  reason: string;
  changed_at: string;
  license_key_hash: string | null;
}

/** Every project in FITT Builder, with what listing them needs. */
export interface BillingSnapshot {
  projects: ProjectRecord[];
  quotes: DocRecord[];
  proposals: DocRecord[];
  billing: BillingRow[];
  orgs: OrgRecord[];
  owners: OwnerRecord[];
}

export interface ProjectBundle {
  project: ProjectRecord;
  org: OrgRecord | null;
  owner: OwnerRecord | null;
  quotes: DocRecord[];
  proposals: DocRecord[];
  billing: BillingRow | null;
}

export interface BillingBuild {
  sentAt: string;
  /** Code Runner's job id, to trace the build there. */
  jobId: string;
  /** Known only on hand-offs saved before the Gateway migration. */
  buildNo: number | null;
}

export interface BillingCustomer {
  name: string;
  attn: string;
  address: string;
  phone: string;
}

export interface BillingQuote {
  quoteNo: string;
  issuedAt: string;
  validDays: number;
  subject: string;
  currency: "THB";
  ratePerDay: number;
  vatPercent: number;
  rows: {
    name: string;
    pricing: "days" | "unit";
    days: number;
    qty: number;
    unit: string;
    unitPrice: number;
    note: string;
    sub: boolean;
    amount: number;
  }[];
  /** When enabled, `amount` is the agreed subtotal and replaces the rows' sum. */
  lumpSum: { enabled: boolean; amount: number };
  totals: { days: number; subtotal: number; discount: number; net: number; vat: number; grand: number };
  paymentSchedule: { when: PaymentTerm["when"]; percent: number; netDays: number; amount: number }[];
  maintenance: {
    enabled: boolean;
    billingCycle: BillingCycle | null;
    modules: number;
    perModule: number;
    monthly: number;
    includedMonths: number;
    includedValue: number;
    annual: number;
    note: string;
  };
  updatedAt: string;
}

export interface BillingProposal {
  proposalNo: string;
  issuedAt: string;
  subject: string;
  context: string;
  points: { problem: string; feature: string; outcome: string }[];
  excluded: string[];
  closing: string;
  quoteNo: string;
  updatedAt: string;
}

export interface BillingProjectSummary {
  id: string;
  name: string;
  phase: string;
  /** null for a personal project, which belongs to no workspace. */
  orgId: string | null;
  orgName: string | null;
  ownerId: string;
  /** null when the owner set no name. */
  ownerName: string | null;
  /** When the project was last sent to Code Runner to build; null when never. */
  buildSentAt: string | null;
  updatedAt: string;
  customerName: string | null;
  quoteNo: string | null;
  billingStatus: BillingStatus;
}

export interface BillingPage {
  items: BillingProjectSummary[];
  nextCursor: string | null;
}

export interface BillingProjectDetail {
  schemaVersion: "fittbuilder.billing.project.v1";
  project: {
    id: string;
    name: string;
    phase: string;
    /** null for a personal project, which belongs to no workspace. */
    orgId: string | null;
    orgName: string | null;
    ownerId: string;
    /** null when the owner set no name, or their profile is gone. */
    ownerName: string | null;
    ownerEmail: string | null;
    activeVersion: string;
    createdAt: string;
    updatedAt: string;
  };
  customer: BillingCustomer | null;
  /** The last time the project was sent to Code Runner to build — not whether that build passed. */
  build: BillingBuild | null;
  billing: { status: BillingStatus; reason: string; changedAt: string | null; licenseKeyIssued: boolean };
  quotes: { standard: BillingQuote | null; premium: BillingQuote | null };
  proposals: { standard: BillingProposal | null; premium: BillingProposal | null };
  documents: { brd: string | null; prd: string | null };
}
