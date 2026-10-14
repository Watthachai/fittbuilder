import { describe, expect, it } from "vitest";
import { approvalStep, type ApprovalPerson } from "@/lib/approval-roster";

const person = (over: Partial<ApprovalPerson>): ApprovalPerson => ({
  id: "u",
  name: "",
  approved: false,
  isMe: false,
  isOwner: false,
  ...over,
});

describe("what the approval modal offers", () => {
  it("asks for my approval while I have not given it", () => {
    expect(approvalStep([person({ isMe: true, isOwner: true }), person({ id: "m", approved: true })])).toBe("approve");
  });

  it("waits while I have approved and someone else has not", () => {
    expect(approvalStep([person({ isMe: true, approved: true }), person({ id: "m" })])).toBe("wait");
  });

  /**
   * Case #28: the owner approved while a member was still pending, then removed
   * that member. The roster became complete without anyone approving, and the
   * modal offered only "ปิด" — the phase could never move on.
   */
  it("offers to move on once everyone left on the roster has approved", () => {
    expect(approvalStep([person({ isMe: true, isOwner: true, approved: true })])).toBe("advance");
    expect(approvalStep([person({ isMe: true, approved: true }), person({ id: "m", approved: true })])).toBe("advance");
  });
});
