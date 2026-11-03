import { describe, expect, it } from "vitest";
import { approvalState, canExport, docContent, type ApprovalRow } from "../doc-approval";
import { newDoc, parseDoc, type QuoteDoc } from "../quote";

const sent: QuoteDoc = newDoc([], "SiamPools", "2026-11-03");
/** What the database hands back: the snapshot after a trip through jsonb. */
const stored = (doc: object) => JSON.parse(JSON.stringify(doc)) as unknown;
/** A quotation is read the way the panel and the approval page read one. */
const read = (doc: unknown) => parseDoc(doc, "");

const row = (over: Partial<ApprovalRow>): ApprovalRow => ({
  id: "a1",
  approverId: "u-approver",
  requestedBy: "u-sales",
  requestedAt: "2026-11-03T05:00:00Z",
  status: "pending",
  snapshot: stored(sent),
  decidedBy: null,
  decidedAt: null,
  comment: null,
  ...over,
});

describe("docContent", () => {
  it("does not depend on the order keys were written in", () => {
    expect(docContent(Object.fromEntries(Object.entries(sent).reverse()))).toBe(docContent(sent));
  });

  it("survives the trip through the database", () => {
    expect(docContent(stored(sent))).toBe(docContent(sent));
  });

  // The running number is issued on the first export and written into the
  // document; counting it would undo the approval the moment it is printed.
  it("leaves out the document number issued at export", () => {
    expect(docContent({ ...sent, quoteNo: "SQP12611-0001" })).toBe(docContent(sent));
    expect(docContent({ ...sent, proposalNo: "PRP12611-0001" })).toBe(docContent({ ...sent, proposalNo: "" }));
  });
});

describe("approvalState", () => {
  it("is none for a document never sent", () => {
    expect(approvalState([], sent, read)).toEqual({ kind: "none" });
  });

  it("is pending while a request waits", () => {
    const pending = row({});
    expect(approvalState([pending], sent, read)).toEqual({ kind: "pending", request: pending });
  });

  it("is approved while the document reads as the snapshot the approver saw", () => {
    const approved = row({ status: "approved", decidedBy: "u-approver", decidedAt: "2026-11-03T06:00:00Z" });
    expect(approvalState([approved], sent, read)).toEqual({ kind: "approved", request: approved });
  });

  it("is changed once the approved document is edited", () => {
    const approved = row({ status: "approved" });
    expect(approvalState([approved], { ...sent, vatPercent: 0 }, read)).toEqual({ kind: "changed", request: approved });
  });

  it("is returned until it is sent again, edited or not", () => {
    const returned = row({ status: "returned", comment: "ราคาโมดูลคลังผิด" });
    expect(approvalState([returned], sent, read)).toEqual({ kind: "returned", request: returned });
    expect(approvalState([returned], { ...sent, vatPercent: 0 }, read)).toEqual({ kind: "returned", request: returned });
  });

  // 0.121.0 added paymentHeads, and every quotation approved before it read as
  // edited: the stored snapshot has no such key, the live document has {}.
  it("stays approved when a field added since reads as its default", () => {
    const older: Record<string, unknown> = { ...sent };
    delete older.paymentHeads;
    const approved = row({ status: "approved", snapshot: stored(older) });
    expect(approvalState([approved], sent, read)).toEqual({ kind: "approved", request: approved });
  });

  it("is changed when the snapshot cannot be read as a document", () => {
    const approved = row({ status: "approved", snapshot: { rows: "not a list" } });
    expect(approvalState([approved], sent, read)).toEqual({ kind: "changed", request: approved });
  });

  it("goes by the newest request and skips withdrawn ones", () => {
    const old = row({ id: "a0", status: "approved", requestedAt: "2026-11-01T00:00:00Z" });
    const returned = row({ id: "a1", status: "returned", requestedAt: "2026-11-02T00:00:00Z" });
    const withdrawn = row({ id: "a2", status: "withdrawn", requestedAt: "2026-11-03T00:00:00Z" });
    expect(approvalState([old, withdrawn, returned], sent, read)).toEqual({ kind: "returned", request: returned });
  });
});

describe("canExport", () => {
  it("needs an approval in a workspace project", () => {
    expect(canExport({ kind: "none" }, true)).toBe(false);
    expect(canExport({ kind: "changed", request: row({ status: "approved" }) }, true)).toBe(false);
    expect(canExport({ kind: "approved", request: row({ status: "approved" }) }, true)).toBe(true);
  });

  it("needs nothing outside a workspace", () => {
    expect(canExport({ kind: "none" }, false)).toBe(true);
  });
});
