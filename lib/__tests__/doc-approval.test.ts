import { describe, expect, it } from "vitest";
import { approvalState, canExport, docHash, type ApprovalRow } from "../doc-approval";
import { newDoc } from "../quote";

const row = (over: Partial<ApprovalRow>): ApprovalRow => ({
  id: "a1",
  approverId: "u-approver",
  requestedBy: "u-sales",
  requestedAt: "2026-11-03T05:00:00Z",
  status: "pending",
  docHash: "h1",
  decidedBy: null,
  decidedAt: null,
  comment: null,
  ...over,
});

describe("docHash", () => {
  const doc = newDoc([], "SiamPools", "2026-11-03");

  it("does not depend on the order keys were written in", async () => {
    const reordered = Object.fromEntries(Object.entries(doc).reverse());
    expect(await docHash(reordered)).toBe(await docHash(doc));
  });

  it("changes with the content", async () => {
    expect(await docHash({ ...doc, vatPercent: 0 })).not.toBe(await docHash(doc));
  });

  // The running number is issued on the first export and written into the
  // document; counting it would undo the approval the moment it is printed.
  it("ignores the document number issued at export", async () => {
    expect(await docHash({ ...doc, quoteNo: "SQP12611-0001" })).toBe(await docHash(doc));
    expect(await docHash({ ...doc, proposalNo: "PRP12611-0001" })).toBe(await docHash({ ...doc, proposalNo: "" }));
  });
});

describe("approvalState", () => {
  it("is none for a document never sent", () => {
    expect(approvalState([], "h1")).toEqual({ kind: "none" });
  });

  it("is pending while a request waits", () => {
    const pending = row({});
    expect(approvalState([pending], "h1")).toEqual({ kind: "pending", request: pending });
  });

  it("is approved while the document is what was approved", () => {
    const approved = row({ status: "approved", decidedBy: "u-approver", decidedAt: "2026-11-03T06:00:00Z" });
    expect(approvalState([approved], "h1")).toEqual({ kind: "approved", request: approved });
  });

  it("is changed once the approved document is edited", () => {
    const approved = row({ status: "approved" });
    expect(approvalState([approved], "h2")).toEqual({ kind: "changed", request: approved });
  });

  it("is returned until it is sent again, edited or not", () => {
    const returned = row({ status: "returned", comment: "ราคาโมดูลคลังผิด" });
    expect(approvalState([returned], "h1")).toEqual({ kind: "returned", request: returned });
    expect(approvalState([returned], "h2")).toEqual({ kind: "returned", request: returned });
  });

  it("goes by the newest request and skips withdrawn ones", () => {
    const old = row({ id: "a0", status: "approved", requestedAt: "2026-11-01T00:00:00Z" });
    const returned = row({ id: "a1", status: "returned", requestedAt: "2026-11-02T00:00:00Z" });
    const withdrawn = row({ id: "a2", status: "withdrawn", requestedAt: "2026-11-03T00:00:00Z" });
    expect(approvalState([old, withdrawn, returned], "h1")).toEqual({ kind: "returned", request: returned });
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
