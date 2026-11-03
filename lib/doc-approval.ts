/**
 * Quotations and proposals are approved before they reach a customer
 * (docs/superpowers/specs/2026-11-03-document-approval-design.md).
 *
 * A request carries the document as sent. The document is approved while the
 * newest request was approved and the live document still reads the same as
 * that snapshot: any edit after that needs approving again. The comparison is
 * with the snapshot the approver read, never with a value the sender supplies.
 */

export type ApprovalDocKind = "quote" | "proposal";

export type ApprovalStatus = "pending" | "approved" | "returned" | "withdrawn";

/** A pending request waits on its reviewer first when it has one, then on its approver (migration 0066). */
export type ApprovalStage = "review" | "approve";

export interface ApprovalRow {
  id: string;
  approverId: string;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
  /** The document as sent, as stored. */
  snapshot: unknown;
  decidedBy: string | null;
  decidedAt: string | null;
  comment: string | null;
  reviewerId: string | null;
  stage: ApprovalStage;
  reviewedAt: string | null;
  reviewNote: string | null;
}

/** Who a pending request is waiting on right now. */
export function waitingOn(request: ApprovalRow): string {
  return request.stage === "review" && request.reviewerId ? request.reviewerId : request.approverId;
}

/** The status line of a pending request: whose desk it is on, and what comes next. */
export function pendingText(request: ApprovalRow, nameOf: (id: string) => string, sentOn: string): string {
  if (request.stage === "review" && request.reviewerId) {
    return `รอตรวจโดย ${nameOf(request.reviewerId)} แล้วจะส่งต่อให้ ${nameOf(request.approverId)} อนุมัติ · ส่งเมื่อ ${sentOn}`;
  }
  if (request.reviewerId && request.reviewedAt) {
    return `ตรวจแล้วโดย ${nameOf(request.reviewerId)} · รออนุมัติจาก ${nameOf(request.approverId)}`;
  }
  return `รออนุมัติจาก ${nameOf(request.approverId)} · ส่งเมื่อ ${sentOn}`;
}

/** Where a document stands: the panel's status line and whether it may be printed. */
export type ApprovalState =
  | { kind: "none" }
  | { kind: "pending"; request: ApprovalRow }
  | { kind: "returned"; request: ApprovalRow }
  | { kind: "approved"; request: ApprovalRow }
  /** Approved, then edited. */
  | { kind: "changed"; request: ApprovalRow };

/**
 * Issued on the first export and written into the document (SQP…, PRP…).
 * Counting them would undo an approval the moment the document is printed.
 */
const NUMBER_FIELDS: ReadonlySet<string> = new Set(["quoteNo", "proposalNo"]);

/** JSON with every object's keys sorted, so equal documents read the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** What an approval covers: the document without the number issued at export. */
export function docContent(doc: unknown): string {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return canonical(doc);
  return canonical(Object.fromEntries(Object.entries(doc).filter(([k]) => !NUMBER_FIELDS.has(k))));
}

/**
 * The document's state from its requests, in any order.
 *
 * Both sides are read through `read` — the parser the panel and the approval
 * page read the document with — before they are compared. A snapshot stored
 * before a field existed then reads with that field's default, as the approver
 * saw it, instead of reading as an edit (every quotation approved before
 * paymentHeads, 0.121.0). A snapshot that does not read as a document is changed.
 */
export function approvalState(rows: ApprovalRow[], live: object, read: (doc: unknown) => object | null): ApprovalState {
  const newest = rows
    .filter((r) => r.status !== "withdrawn")
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : a.requestedAt > b.requestedAt ? -1 : 0))[0];
  if (!newest) return { kind: "none" };
  if (newest.status === "pending") return { kind: "pending", request: newest };
  if (newest.status === "returned") return { kind: "returned", request: newest };
  const approved = read(newest.snapshot);
  return approved !== null && docContent(approved) === docContent(read(live))
    ? { kind: "approved", request: newest }
    : { kind: "changed", request: newest };
}

/** Printing and the Word file: a workspace project's document only once approved. */
export function canExport(state: ApprovalState, inWorkspace: boolean): boolean {
  return !inWorkspace || state.kind === "approved";
}
