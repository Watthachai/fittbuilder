/**
 * A FITT Voice delivery (contract fittbuilder.delivery.v1), as the shape the
 * receiver works with after the published schema (schemas/delivery-v1.schema.json)
 * has accepted it. The schema is the authority; these types only name what it
 * already guarantees.
 */

export type Assertion = "CUSTOMER_STATED" | "USER_CONFIRMED" | "AI_PROPOSED";
export type Priority = "P0" | "P1" | "P2" | "UNSPECIFIED";
export type KnowledgeStatus = "CAPTURED" | "NOT_CAPTURED" | "CONFIRMED_NONE";

export interface Item {
  id: string;
  text: string;
  assertion: Assertion;
  evidenceIds: string[];
  priority: Priority;
}

export interface WorkflowItem extends Item {
  actorId: string | null;
  tool: string | null;
  input: string | null;
  output: string | null;
  nextStepId: string | null;
}

export interface Category<T extends Item = Item> {
  knowledgeStatus: KnowledgeStatus;
  items: T[];
}

export const WORKFLOWS = ["asIsWorkflow", "toBeWorkflow"] as const;
export type WorkflowKey = (typeof WORKFLOWS)[number];

/** The fifteen categories, in the order the contract lists them. */
export const CATEGORIES = [
  "businessContext",
  "goals",
  "actors",
  "asIsWorkflow",
  "painPoints",
  "functionalRequirements",
  "nonFunctionalRequirements",
  "toBeWorkflow",
  "businessRules",
  "dataEntities",
  "integrations",
  "constraints",
  "acceptanceCriteria",
  "openQuestions",
  "outOfScope",
] as const;
export type CategoryKey = (typeof CATEGORIES)[number];

export type Discovery = { [K in CategoryKey]: K extends WorkflowKey ? Category<WorkflowItem> : Category };

export interface Evidence {
  id: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  speaker: string | null;
  text: string;
}

export interface Delivery {
  schemaVersion: "fittbuilder.delivery.v1";
  exportSessionId: string;
  deliveryId: string;
  snapshotRevision: number;
  operation: "CREATE_PROJECT" | "UPDATE_PROJECT";
  builderProjectId: string | null;
  stage: "DRAFT" | "REVIEWED";
  sentAt: string;
  source: {
    recordingId: string;
    transcriptVersionId: string;
    transcriptKind: "CLEANED" | "LIVE_STABLE";
    summaryId: string | null;
    requirementId: string | null;
    requirementRevision: number | null;
    capturedAt: string | null;
  };
  review: { reviewerRef: string; reviewedAt: string; approvalId: string } | null;
  content: {
    projectTitle: string;
    summaryMarkdown: string;
    discovery: Discovery;
  };
  evidence: Evidence[];
  contentHash: string;
}

/**
 * Contract fittbuilder.summary-delivery.v1 (schemas/summary-delivery-v1.schema.json):
 * only the summary the user reviewed in FITT Voice — no discovery, no evidence,
 * never a draft. The credential, idempotency, hash and revision rules are the
 * same as Delivery's.
 */
export interface SummaryDelivery {
  schemaVersion: "fittbuilder.summary-delivery.v1";
  exportSessionId: string;
  deliveryId: string;
  snapshotRevision: number;
  operation: "CREATE_PROJECT" | "UPDATE_PROJECT";
  builderProjectId: string | null;
  stage: "REVIEWED";
  sentAt: string;
  source: { summaryId: string };
  review: { approvalId: string; reviewedAt: string };
  content: { projectTitle: string; summaryMarkdown: string };
  contentHash: string;
}

/** Either contract, told apart by schemaVersion. */
export type VoiceDelivery = Delivery | SummaryDelivery;

export type ErrorCode =
  | "INVALID_PAYLOAD"
  | "HASH_MISMATCH"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PROJECT_NOT_FOUND"
  | "STALE_REVISION"
  | "IDEMPOTENCY_CONFLICT"
  | "REVISION_CONFLICT"
  | "SESSION_FINALIZED"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "TEMPORARILY_UNAVAILABLE";
