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

  // Measured on 2026-11-07: a fresh draft left the undecided accounting link out of
  // the requirements in 8 of 8 runs, a redraft over the old document kept it in 3 of 4.
  it("makes a full redraft come from the meetings, not from the document it replaces", async () => {
    db.items = [meeting("ระบบจัดซื้อ")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("เมื่อผู้ใช้สั่งร่างใหม่ทั้งฉบับ");
    expect(context).toContain("ห้ามยกเนื้อหาจากเอกสารฉบับเดิมหรือคำตอบเก่ามาเพียงเพราะมีอยู่แล้ว");
    expect(context).toContain("ให้บอกในแชตสั้นๆ ว่าเอาอะไรออกและเพราะอะไร");
  });

  it("keeps an undecided matter out of the requirements even with its priority left open", async () => {
    db.items = [meeting("ระบบจัดซื้อ")];
    expect(await getProjectVoiceContext("p")).toContain("แม้จะเขียนลำดับความสำคัญว่า รอระบุ ก็ตาม");
  });

  it("does not let goals, prices or sales terms become functions", async () => {
    db.items = [meeting("ระบบจัดซื้อ")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("ความต้องการเชิงฟังก์ชัน ให้ใส่เฉพาะสิ่งที่สรุปบอกว่าระบบต้องทำ");
    expect(context).toContain("เป้าหมาย ราคา ค่าบำรุงรักษา และเงื่อนไขการขาย ไม่ใช่ฟังก์ชัน");
  });

  it("does not let the agent make up a role for users nobody named", async () => {
    db.items = [meeting("ระบบจัดซื้อ")];
    expect(await getProjectVoiceContext("p")).toContain("ห้ามตั้งบทบาทขึ้นเอง เช่น เจ้าหน้าที่ หรือผู้ใช้งานทั่วไป");
  });

  // One run of three stopped to ask "shall I draft it?" after being told to draft it.
  it("does not ask again when the person already asked for the document", async () => {
    db.items = [meeting("ระบบจัดซื้อ")];
    expect(await getProjectVoiceContext("p")).toContain("ถ้าผู้ใช้ขอมาแล้วในข้อความนั้น ไม่ต้องถามซ้ำ");
  });

  it("keeps these rules out of what the person reads in the chat", async () => {
    db.items = [meeting("ระบบจัดซื้อ")];
    expect(await getProjectVoiceContext("p")).toContain("ห้ามพูดถึงคำว่ากติกาหรือกฎในแชต");
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
    expect(context).toContain("ห้ามใส่ในขอบเขต ความต้องการ หรือเกณฑ์การยอมรับ");
  });

  // A combined BRD named the decision maker as a user, set must/should on its own,
  // and listed "send the revised price" as scope and as an acceptance criterion.
  it("lists as users only the people the summary says use the system", async () => {
    db.items = [meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("ผู้ตัดสินใจหรือคนที่ร่วมประชุมไม่ถือเป็นผู้ใช้");
  });

  it("leaves a priority the summary does not give as รอระบุ", async () => {
    db.items = [meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("ลำดับความสำคัญ เช่น must หรือ should ให้ใส่เฉพาะที่สรุปบอก");
  });

  it("keeps follow-up work out of what the system must do", async () => {
    db.items = [meeting("แอป 2.1")];
    const context = await getProjectVoiceContext("p");
    expect(context).toContain("งานหลังประชุม");
    expect(context).toContain("ไม่ใช่ขอบเขต ความต้องการ หรือเกณฑ์การยอมรับของระบบ");
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
