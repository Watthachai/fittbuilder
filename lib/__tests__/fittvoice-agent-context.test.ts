import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectVoiceContext } from "@/lib/fittvoice/agent-context";
import type { VoiceSourceItem } from "@/lib/fittvoice/types";

const db = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: async () => ({ data: db.items, error: null }) }),
}));

const meeting = (title: string): VoiceSourceItem =>
  ({
    kind: "meeting",
    id: title,
    receivedAt: "2026-11-05T09:00:00Z",
    sender: null,
    payload: {
      sentAt: "2026-11-05T09:00:00Z",
      review: { reviewedAt: "2026-11-05T08:00:00Z" },
      meeting: { title, profile: { label: "คุยกับลูกค้า" }, recordedAt: "2026-11-05T07:00:00Z", revision: 1 },
      content: { summaryMarkdown: `สรุปของ ${title}` },
    },
  }) as unknown as VoiceSourceItem;

/**
 * A BRD drafted from two meetings used one, turned an open question into a
 * decision, and added figures nobody said. Two rules caused it: "the newer
 * meeting wins a conflict" read two different subjects as a conflict, and the
 * BRD template's "ต้องว่างก่อนอนุมัติ" read an open question as a thing to close.
 */
describe("the rules a phase agent gets with FITT Voice meetings", () => {
  beforeEach(() => {
    db.items = [];
  });

  it("says nothing for a project with no meetings", async () => {
    expect(await getProjectVoiceContext("p")).toBe("");
  });

  it("makes the agent ask which meetings to use when they differ, before drafting", async () => {
    db.items = [meeting("ระบบจัดซื้อ"), meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("ห้ามทิ้งการประชุมเก่าเพราะเรื่องไม่ตรงกัน");
    expect(context).toContain("แม้ผู้ใช้จะสั่งให้ร่างเลย");
    expect(context).toContain("เอกสารใช้การประชุมไหน และไม่ได้ใช้การประชุมไหน");
  });

  it("does what the person chose, even when that is every meeting", async () => {
    db.items = [meeting("ระบบจัดซื้อ"), meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("เลือกทั้งหมดก็รวมทุกการประชุมในเอกสารเดียว");
    expect(context).toContain("ห้ามปฏิเสธ");
  });

  it("does not raise choosing a meeting when there is only one", async () => {
    db.items = [meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).not.toContain("แม้ผู้ใช้จะสั่งให้ร่างเลย");
    expect(context).not.toContain("ห้ามทิ้งการประชุมเก่า");
  });

  it("keeps what the meeting left open as an open question", async () => {
    db.items = [meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("ให้เขียนเป็นคำถามค้างเท่านั้น");
    expect(context).toContain("ห้ามใส่ในรายการทำหรือไม่ทำ");
  });

  it("forbids sharpening or re-purposing what the summary said", async () => {
    db.items = [meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("วันที่ที่ละเอียดกว่าสรุป");
    expect(context).toContain("ห้ามนำไปตั้งเป็นเป้าหมาย");
  });

  it("puts these rules ahead of the document template's", async () => {
    db.items = [meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("กติกาชุดนี้มาก่อนกติกาการเขียนเอกสาร");
    expect(context).toContain("รอระบุ");
    expect(context).toContain("ห้ามเขียนว่าไม่มีคำถามค้าง");
  });
});
