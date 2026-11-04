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

/** Either v1 contract, told apart by schemaVersion. */
export type VoiceDelivery = Delivery | SummaryDelivery;

/**
 * Contract fittbuilder.summary-delivery.v2 (schemas/summary-delivery-v2.schema.json,
 * agreed as v2.1 on 4 Nov 2026): one meeting's reviewed summary, into a new
 * project or one the sender picked. A project collects many meetings; a
 * meeting's next revision replaces only that meeting. The schema leaves the
 * target's two shapes open — checkDelivery holds them.
 */
export interface MeetingDelivery {
  schemaVersion: "fittbuilder.summary-delivery.v2";
  deliveryId: string;
  meeting: {
    meetingId: string;
    revision: number;
    title: string;
    recordedAt: string;
    profile: { profileId: string; profileVersion: number; templateId: string; label: string };
    /** Only for a company profile's meetings; kept, not used yet. */
    company: { fittcoreCompanyId: string; organizationId: string } | null;
  };
  target:
    | { mode: "CREATE_PROJECT"; projectTitle: string; builderProjectId?: null }
    | { mode: "ATTACH_TO_PROJECT"; builderProjectId: string; projectTitle?: null };
  source: { summaryId: string; sourceTranscriptVersionId: string; configRevisionId?: string | null };
  review: { approvalId: string; reviewedAt: string };
  content: { summaryMarkdown: string };
  sentAt: string;
  contentHash: string;
}

/**
 * One thing FITT Voice sent into a project, as fittbuilder_fittvoice_sources
 * (migration 0067) lists them, oldest first: the v1 interview the project came
 * from, or a v2 meeting at its newest revision with who sent that revision.
 */
export type VoiceSourceItem =
  | { kind: "session"; payload: VoiceDelivery; receivedAt: string }
  | { kind: "meeting"; id: string; payload: MeetingDelivery; receivedAt: string; sender: string | null };

/** Codes of both error envelopes; which one a code may go out in is the contract's (schemas/error-v*.schema.json). */
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
  | "TEMPORARILY_UNAVAILABLE"
  // v2 only
  | "PROJECT_WRITE_FORBIDDEN"
  | "MEETING_BOUND_TO_OTHER_PROJECT"
  | "UNSUPPORTED_SCHEMA_VERSION";

/** error v1 for the v1 contracts and whatever fails before the payload's version is known; v2 after. */
export type ErrorEnvelope = "v1" | "v2";
