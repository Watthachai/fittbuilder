import { describe, expect, it } from "vitest";
import { approvalAlerts, approvalNotices, noticesFor, type ApprovalEvent } from "@/lib/approval-notice";

const NAMES: Record<string, string> = { sender: "อริสรา", checker: "สมชาย", boss: "พี่เอ๋" };
const nameOf = (id: string) => NAMES[id] ?? "ผู้ใช้";
const NOW = Date.parse("2026-11-06T10:00:00Z");
const JUST = "2026-11-06T09:59:30Z";

const event = (over: Partial<ApprovalEvent> = {}): ApprovalEvent => ({
  id: "r1",
  status: "pending",
  stage: "approve",
  requestedBy: "sender",
  requestedAt: JUST,
  reviewerId: null,
  reviewedAt: null,
  reviewNote: null,
  approverId: "boss",
  decidedBy: null,
  decidedAt: null,
  comment: null,
  kind: "quote",
  projectId: "p1",
  projectName: "SiamPools",
  ...over,
});
const withReviewer = { reviewerId: "checker", stage: "review" as const };
const forwarded = { reviewerId: "checker", stage: "approve" as const, reviewedAt: JUST };
const to = (r: ApprovalEvent) => approvalNotices(r, nameOf).map((n) => n.to);

describe("who hears about a request's latest move", () => {
  it("tells the reviewer first when the sender chose one", () => {
    const [notice, ...rest] = approvalNotices(event(withReviewer), nameOf);
    expect(rest).toEqual([]);
    expect(notice.to).toBe("checker");
    expect(notice.subject).toContain("รอคุณตรวจ");
    expect(notice.message).toContain("อริสรา");
    expect(notice.message).toContain("พี่เอ๋");
    expect(notice.path).toBe("/approvals");
  });

  it("tells the approver when there is no reviewer", () => {
    const [notice] = approvalNotices(event(), nameOf);
    expect(notice.to).toBe("boss");
    expect(notice.subject).toContain("รอคุณอนุมัติ");
    expect(notice.subject).toContain("ใบเสนอราคา");
    expect(notice.subject).toContain("SiamPools");
  });

  it("tells both the approver and the sender when the reviewer passes it on", () => {
    const notices = approvalNotices(event({ ...forwarded, reviewNote: "ตัวเลขตรงแล้ว" }), nameOf);
    expect(notices.map((n) => n.to)).toEqual(["boss", "sender"]);
    expect(notices[0].subject).toContain("รอคุณอนุมัติ");
    expect(notices[0].message).toContain("สมชาย");
    expect(notices[0].message).toContain("ตัวเลขตรงแล้ว");
    expect(notices[0].path).toBe("/approvals");
    expect(notices[1].message).toContain("พี่เอ๋");
    expect(notices[1].path).toBe("/project/p1");
  });

  it("tells the sender it was approved, and links to the document", () => {
    const [notice] = approvalNotices(event({ status: "approved", decidedBy: "boss", decidedAt: JUST }), nameOf);
    expect(notice.to).toBe("sender");
    expect(notice.subject).toContain("อนุมัติแล้ว");
    expect(notice.message).toContain("PDF");
    expect(notice.path).toBe("/project/p1");
  });

  it("gives the sender the reason when it comes back, from either stage", () => {
    const [back] = approvalNotices(
      event({ status: "returned", decidedBy: "checker", decidedAt: JUST, comment: "ราคาผิดงวด 2", ...withReviewer }),
      nameOf
    );
    expect(back.to).toBe("sender");
    expect(back.subject).toContain("ส่งกลับให้แก้");
    expect(back.message).toContain("สมชาย");
    expect(back.message).toContain("ราคาผิดงวด 2");
  });

  it("says nothing about a withdrawn request", () => {
    expect(to(event({ status: "withdrawn" }))).toEqual([]);
  });

  it("does not tell people about their own move", () => {
    expect(to(event({ status: "approved", requestedBy: "boss", decidedBy: "boss", decidedAt: JUST }))).toEqual([]);
    expect(to(event({ requestedBy: "boss" }))).toEqual([]);
  });

  it("sends one person one notice when they hold two parts", () => {
    expect(to(event({ ...forwarded, requestedBy: "boss" }))).toEqual(["boss"]);
  });
});

describe("who may set the notices off", () => {
  const send = (r: ApprovalEvent, caller: string, now = NOW) => noticesFor(r, caller, now, nameOf).map((n) => n.to);

  it("is whoever just made the move", () => {
    expect(send(event(withReviewer), "sender")).toEqual(["checker"]);
    expect(send(event(forwarded), "checker")).toEqual(["boss", "sender"]);
    expect(send(event({ status: "approved", decidedBy: "boss", decidedAt: JUST }), "boss")).toEqual(["sender"]);
  });

  it("is nobody else, so someone who can read the project cannot mail people", () => {
    expect(send(event(), "stranger")).toEqual([]);
    expect(send(event(withReviewer), "checker")).toEqual([]);
    expect(send(event({ status: "approved", decidedBy: "boss", decidedAt: JUST }), "sender")).toEqual([]);
  });

  it("is nobody once the move is old, so a request cannot be re-sent later", () => {
    expect(send(event(), "sender", NOW + 3 * 60_000)).toEqual([]);
  });
});

describe("what the bell and the toasts say", () => {
  it("counts what waits on me, at the stage it is at", () => {
    const review = approvalAlerts([event(withReviewer)], "checker");
    expect(review).toHaveLength(1);
    expect(review[0].waiting).toBe(true);
    expect(review[0].title).toContain("รอคุณตรวจ");
    expect(review[0].href).toBe("/approvals");
    expect(approvalAlerts([event(withReviewer)], "boss")).toEqual([]);
    expect(approvalAlerts([event(forwarded)], "boss")[0].title).toContain("รอคุณอนุมัติ");
  });

  it("tells the sender each move on their request without counting it as waiting", () => {
    const moved = approvalAlerts([event(forwarded)], "sender");
    expect(moved[0].waiting).toBe(false);
    expect(moved[0].href).toBe("/project/p1");
    const done = approvalAlerts([event({ status: "approved", decidedBy: "boss", decidedAt: JUST })], "sender");
    expect(done[0].title).toContain("อนุมัติแล้ว");
    const back = approvalAlerts([event({ status: "returned", decidedBy: "boss", decidedAt: JUST, comment: "แก้ราคา" })], "sender");
    expect(back[0].body).toContain("แก้ราคา");
  });

  it("gives a new alert when the request moves on, so it is announced again", () => {
    const first = approvalAlerts([event(forwarded)], "sender")[0].key;
    const next = approvalAlerts([event({ ...forwarded, status: "approved", decidedBy: "boss", decidedAt: JUST })], "sender")[0].key;
    expect(next).not.toBe(first);
  });

  it("does not tell me about a move I made myself", () => {
    const own = event({ status: "approved", requestedBy: "boss", decidedBy: "boss", decidedAt: JUST });
    expect(approvalAlerts([own], "boss")).toEqual([]);
  });
});
