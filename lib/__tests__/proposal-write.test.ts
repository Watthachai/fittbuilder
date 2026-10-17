import { describe, expect, it } from "vitest";
import {
  buildProposalUser,
  buildScreenDocsUser,
  parseProposalDraft,
  parseScreenDocs,
  SCREEN_BATCH,
  screenBatches,
} from "@/lib/proposal-write";

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

/**
 * The manual is written apart from the argument, a batch of screens at a time:
 * Sechin's 143 screens in one answer ran into the length cap seven times out of
 * seven, and a truncated answer is no answer at all.
 */
describe("parseScreenDocs", () => {
  it("clamps screen documentation to the names that were asked about", () => {
    const docs = parseScreenDocs(
      JSON.stringify({
        screens: {
          "รายการสินค้า": { does: "ดูสต๊อก", how: "เลือกสาขา", result: "เห็นคงเหลือ" },
          "หน้าที่โมเดลแต่งเอง": { does: "ไม่มีจริง", how: "", result: "" },
        },
      }),
      ["รายการสินค้า"]
    )!;
    expect(Object.keys(docs)).toEqual(["รายการสินค้า"]);
    expect(docs["รายการสินค้า"].how).toBe("เลือกสาขา");
  });

  it("drops a screen whose entry says nothing", () => {
    const docs = parseScreenDocs(JSON.stringify({ screens: { "ก": { does: " " }, "ข": { result: "ได้ผล" } } }), ["ก", "ข"])!;
    expect(Object.keys(docs)).toEqual(["ข"]);
  });

  it("is null when the answer was cut off or is not JSON", () => {
    expect(parseScreenDocs('{"screens": {"ก": {"does": "ทำ', ["ก"])).toBeNull();
    expect(parseScreenDocs("[]", ["ก"])).toBeNull();
  });
});

describe("screenBatches", () => {
  it("cuts a long list into batches small enough for one answer, every screen once, in order", () => {
    const names = Array.from({ length: 143 }, (_, i) => `หน้า ${i}`);
    const batches = screenBatches(names);
    expect(batches.every((b) => b.length <= SCREEN_BATCH)).toBe(true);
    expect(batches.flat()).toEqual(names);
  });

  it("has nothing to do when no screen needs writing", () => {
    expect(screenBatches([])).toEqual([]);
  });
});

describe("buildScreenDocsUser", () => {
  it("shows every screen for context but asks for the batch only", () => {
    const user = buildScreenDocsUser({
      projectName: "Pace",
      screens: [
        { name: "รายการสินค้า", note: "ดูสต๊อกคงเหลือ" },
        { name: "ตั้งค่า", note: "" },
      ],
      journey: ["จากหน้า “รายการสินค้า” กด “เพิ่มสินค้า” → ฟอร์มเพิ่มสินค้า"],
      write: ["ตั้งค่า"],
    });
    expect(user).toContain("- รายการสินค้า — ดูสต๊อกคงเหลือ");
    expect(user).toContain("เดินระบบจริง");
    const asked = user.slice(user.indexOf("--- หน้าที่ต้องเขียนคู่มือ"));
    expect(asked).toContain("- ตั้งค่า");
    expect(asked).not.toContain("รายการสินค้า");
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
