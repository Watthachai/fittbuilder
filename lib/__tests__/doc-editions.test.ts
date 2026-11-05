import { describe, expect, it } from "vitest";
import { applyOps, diffDoc } from "../co-edit";
import { approvalState, type ApprovalRow } from "../doc-approval";
import { editionName, matchingEdition, restoredDoc, type DocEdition } from "../doc-editions";
import { newProposal, parseProposal } from "../proposal";
import { newDoc, parseDoc, type QuoteDoc } from "../quote";

const base: QuoteDoc = newDoc([], "SiamPools", "2026-11-05");
const read = (doc: unknown) => parseDoc(doc, "");
/** What the database hands back: the document after a trip through jsonb. */
const stored = (doc: object) => JSON.parse(JSON.stringify(doc)) as unknown;
const edition = (number: number, doc: object, label = ""): DocEdition => ({
  id: `e${number}`,
  number,
  label,
  payload: stored(doc),
  savedByName: "ผู้ขาย",
  savedAt: "2026-11-05T05:00:00Z",
});

describe("editionName", () => {
  it("names an edition by its number and the name it was given", () => {
    expect(editionName({ number: 2, label: "ราคาก่อนต่อรอง" })).toBe("v2 · ราคาก่อนต่อรอง");
  });

  it("is the number alone when it was given no name", () => {
    expect(editionName({ number: 2, label: "" })).toBe("v2");
  });
});

describe("restoredDoc", () => {
  it("brings back what the edition says", () => {
    const back = restoredDoc({ ...base, ratePerDay: 8000 }, { ...base, ratePerDay: 9000 });
    expect(back.ratePerDay).toBe(8000);
  });

  // A number is issued once, at the first export. Going back to an edition saved
  // before that must not leave the document without the number already on paper.
  it("keeps the number the document was issued after the edition was saved", () => {
    const back = restoredDoc({ ...base, quoteNo: "" }, { ...base, quoteNo: "SQP12611-0002" });
    expect(back.quoteNo).toBe("SQP12611-0002");
  });

  it("takes the edition's number when the open document has none", () => {
    const back = restoredDoc({ ...base, quoteNo: "SQP12611-0002" }, { ...base, quoteNo: "" });
    expect(back.quoteNo).toBe("SQP12611-0002");
  });

  it("keeps a proposal's number the same way", () => {
    const proposal = newProposal("SiamPools", "2026-11-05");
    const back = restoredDoc({ ...proposal, proposalNo: "" }, { ...proposal, proposalNo: "PRP12611-0007" });
    expect(back.proposalNo).toBe("PRP12611-0007");
  });
});

describe("matchingEdition", () => {
  it("finds the newest edition that says the same as the open document", () => {
    const list = [edition(3, base), edition(2, { ...base, ratePerDay: 8000 }), edition(1, base)];
    expect(matchingEdition(base, list, read)?.number).toBe(3);
  });

  it("finds nothing when the open document has been changed since", () => {
    expect(matchingEdition({ ...base, ratePerDay: 9000 }, [edition(1, { ...base, ratePerDay: 8000 })], read)).toBeNull();
  });

  // The number is issued at export, not written by anyone: it is not a change of content.
  it("does not count the document number as a difference", () => {
    expect(matchingEdition({ ...base, quoteNo: "SQP12611-0002" }, [edition(1, { ...base, quoteNo: "" })], read)?.number).toBe(1);
  });

  // An edition saved before a field existed reads with that field's default.
  it("matches an edition saved before a field existed", () => {
    const old = stored(base) as Record<string, unknown>;
    delete old.paymentHeads;
    const list = [{ ...edition(1, base), payload: old }];
    expect(matchingEdition(base, list, read)?.number).toBe(1);
  });

  it("skips an edition that does not read as a document", () => {
    expect(matchingEdition(base, [{ ...edition(1, base), payload: "not a document" }], read)).toBeNull();
  });

  it("reads a proposal with the proposal's reader", () => {
    const proposal = newProposal("SiamPools", "2026-11-05");
    expect(matchingEdition(proposal, [edition(1, proposal)], (d) => parseProposal(d, ""))?.number).toBe(1);
  });
});

describe("pulling an edition back, against its approval", () => {
  const approvedOf = (doc: object): ApprovalRow => ({
    id: "a1",
    approverId: "u-approver",
    requestedBy: "u-sales",
    requestedAt: "2026-11-05T05:00:00Z",
    status: "approved",
    snapshot: stored(doc),
    decidedBy: "u-approver",
    decidedAt: "2026-11-05T06:00:00Z",
    comment: null,
    reviewerId: null,
    stage: "approve",
    reviewedAt: null,
    reviewNote: null,
  });
  const approvedDoc = { ...base, ratePerDay: 8000 };

  it("is approved again when the edition says what was approved", () => {
    const live = { ...base, ratePerDay: 9000, quoteNo: "SQP12611-0002" };
    const back = restoredDoc(approvedDoc, live);
    expect(approvalState([approvedOf(approvedDoc)], back, read).kind).toBe("approved");
  });

  it("needs approving again when the edition says something else", () => {
    const back = restoredDoc({ ...base, ratePerDay: 7000 }, approvedDoc);
    expect(approvalState([approvedOf(approvedDoc)], back, read).kind).toBe("changed");
  });
});

describe("pulling an edition back, with someone else on the document", () => {
  it("reaches the other screen whole, lines and fields it no longer has included", () => {
    const term = { ...base.payment[0], due: "ชำระภายใน 7 วัน ณ วันสั่งซื้อ" };
    const live: QuoteDoc = { ...base, ratePerDay: 9000, payment: [term, ...base.payment.slice(1)] };
    const saved: QuoteDoc = { ...base, ratePerDay: 8000, payment: base.payment.slice(1) };
    const back = restoredDoc(saved, live);
    const { doc: there, complete } = applyOps(live, diffDoc(live, back));
    expect(complete).toBe(true);
    expect(stored(there)).toEqual(stored(back));
  });
});
