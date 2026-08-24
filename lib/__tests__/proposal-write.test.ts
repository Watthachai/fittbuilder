import { describe, expect, it } from "vitest";
import { buildProposalUser, parseProposalDraft } from "@/lib/proposal-write";

/**
 * The model's answer is untrusted input like any other. What it gets wrong in
 * practice is not malformed JSON but half-filled objects — a feature with no
 * problem beside it — which would print as a blank cell in front of a customer.
 */
describe("parseProposalDraft", () => {
  const ok = {
    context: "ทุกวันนี้ทีมขายจดออเดอร์ลงกระดาษ",
    points: [{ problem: "ออเดอร์ตกหล่น", feature: "หน้ารับออเดอร์", outcome: "ไม่ต้องคีย์ซ้ำ" }],
    excluded: ["เชื่อมระบบบัญชี"],
  };

  it("reads a well-formed answer", () => {
    const draft = parseProposalDraft(JSON.stringify(ok))!;
    expect(draft.context).toBe(ok.context);
    expect(draft.points).toHaveLength(1);
    expect(draft.excluded).toEqual(["เชื่อมระบบบัญชี"]);
  });

  it("returns nothing when the answer is not JSON", () => {
    expect(parseProposalDraft("ไม่ใช่ JSON")).toBeNull();
    expect(parseProposalDraft("[1,2,3]")).toBeNull();
  });

  it("drops a point that names a feature but no problem", () => {
    const draft = parseProposalDraft(
      JSON.stringify({ ...ok, points: [...ok.points, { feature: "หน้ารายงาน", outcome: "ดี" }] })
    )!;
    expect(draft.points.map((p) => p.feature)).toEqual(["หน้ารับออเดอร์"]);
  });

  it("keeps a point whose outcome is missing — that cell can be filled by hand", () => {
    const draft = parseProposalDraft(
      JSON.stringify({ points: [{ problem: "ก", feature: "ข" }] })
    )!;
    expect(draft.points).toHaveLength(1);
    expect(draft.points[0].outcome).toBe("");
  });

  it("gives up rather than replacing the document with emptiness", () => {
    expect(parseProposalDraft(JSON.stringify({ points: [], context: "" }))).toBeNull();
    expect(parseProposalDraft(JSON.stringify({ points: [{ outcome: "ลอยๆ" }] }))).toBeNull();
  });

  it("throws away junk in the exclusions instead of printing it", () => {
    const draft = parseProposalDraft(
      JSON.stringify({ ...ok, excluded: ["จริง", 5, null, "  "] })
    )!;
    expect(draft.excluded).toEqual(["จริง"]);
  });

  it("gives each point a distinct id so the editor's keys are stable", () => {
    const draft = parseProposalDraft(
      JSON.stringify({ points: [{ problem: "ก", feature: "ก" }, { problem: "ข", feature: "ข" }] })
    )!;
    expect(new Set(draft.points.map((p) => p.id)).size).toBe(2);
  });
});

describe("buildProposalUser", () => {
  const base = { projectName: "Pace", brd: "", prd: "", screens: [], journey: [], orgContext: "" };

  it("puts the recorded walk in the prompt — the only part that came from running the app", () => {
    const user = buildProposalUser({
      ...base,
      journey: ["จากหน้า “รายการสินค้า” กด “เพิ่มสินค้า” → ฟอร์มเพิ่มสินค้า"],
    });
    expect(user).toContain("เดินระบบจริง");
    expect(user).toContain("เพิ่มสินค้า");
  });

  it("leaves a section out entirely rather than printing an empty heading", () => {
    const user = buildProposalUser(base);
    expect(user).not.toContain("--- BRD ---");
    expect(user).not.toContain("เดินระบบจริง");
  });

  it("pairs each screen with the description the quotation already uses", () => {
    const user = buildProposalUser({
      ...base,
      screens: [{ name: "รายการสินค้า", note: "ดูสต๊อกคงเหลือ" }, { name: "ตั้งค่า", note: "" }],
    });
    expect(user).toContain("- รายการสินค้า — ดูสต๊อกคงเหลือ");
    expect(user).toContain("- ตั้งค่า");
  });

  it("clips a long brief instead of shipping the whole thing", () => {
    const user = buildProposalUser({ ...base, brd: "ก".repeat(20_000) });
    expect(user).toContain("(ตัดทอน)");
    expect(user.length).toBeLessThan(12_000);
  });
});
