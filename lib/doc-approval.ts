/**
 * Quotations and proposals are approved before they reach a customer
 * (docs/superpowers/specs/2026-11-03-document-approval-design.md).
 *
 * A request carries the document as sent and its hash. The document is
 * approved while the newest decided request was approved and the live document
 * still hashes to what was approved: any edit after that needs approving again.
 */

export type ApprovalDocKind = "quote" | "proposal";

export type ApprovalStatus = "pending" | "approved" | "returned" | "withdrawn";

export interface ApprovalRow {
  id: string;
  approverId: string;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
  docHash: string;
  decidedBy: string | null;
  decidedAt: string | null;
  comment: string | null;
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
 * Hashing them would undo an approval the moment the document is printed.
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

/** The hash a request carries and the live document is compared against. */
export async function docHash(doc: object): Promise<string> {
  const content = Object.fromEntries(Object.entries(doc).filter(([k]) => !NUMBER_FIELDS.has(k)));
  const bytes = new TextEncoder().encode(canonical(content));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The document's state from its requests, in any order. */
export function approvalState(rows: ApprovalRow[], liveHash: string): ApprovalState {
  const newest = rows
    .filter((r) => r.status !== "withdrawn")
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : a.requestedAt > b.requestedAt ? -1 : 0))[0];
  if (!newest) return { kind: "none" };
  if (newest.status === "pending") return { kind: "pending", request: newest };
  if (newest.status === "returned") return { kind: "returned", request: newest };
  return newest.docHash === liveHash ? { kind: "approved", request: newest } : { kind: "changed", request: newest };
}

/** Printing and the Word file: a workspace project's document only once approved. */
export function canExport(state: ApprovalState, inWorkspace: boolean): boolean {
  return !inWorkspace || state.kind === "approved";
}
