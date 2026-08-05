import { describe, expect, it } from "vitest";
import { buildScreenSpecUser, parseScreenSpecs } from "../screen-spec";

describe("buildScreenSpecUser", () => {
  it("sends the code that decides what a screen contains", () => {
    const user = buildScreenSpecUser(
      {
        "src/App.tsx": "APP",
        "src/pages/UsersPage.tsx": "USERS",
        "src/components/users/InviteUserModal.tsx": "INVITE",
        "src/data/users.ts": "DATA",
      },
      ["ผู้ใช้งาน"]
    );
    expect(user).toContain("USERS");
    // Wider than the screen map's dump: describing a screen means reading the
    // table, the form and the modal that live on it, not just the navigation.
    expect(user).toContain("INVITE");
    expect(user).not.toContain("DATA");
  });

  it("lists the names it wants back, so the keys can be matched exactly", () => {
    const user = buildScreenSpecUser({ "src/App.tsx": "A" }, ["หน้าแรก", "ตั้งค่า"]);
    expect(user).toContain("- หน้าแรก");
    expect(user).toContain("- ตั้งค่า");
  });

  it("caps one huge file rather than losing the rest of the app", () => {
    const user = buildScreenSpecUser(
      { "src/pages/A.tsx": "x".repeat(9_000), "src/pages/B.tsx": "MARKER" },
      ["A"]
    );
    expect(user).not.toContain("x".repeat(6_001));
    expect(user).toContain("MARKER");
  });
});

describe("parseScreenSpecs", () => {
  const NAMES = ["เอกสารทั้งหมด", "สร้าง Report"];

  it("reads name → description", () => {
    const out = parseScreenSpecs(
      `{"เอกสารทั้งหมด":"แสดงรายการเอกสารทั้งหมด ค้นหาและกรองตามสถานะได้","สร้าง Report":"เลือกช่วงวันที่แล้วออกรายงาน"}`,
      NAMES
    );
    expect(out["เอกสารทั้งหมด"]).toContain("ค้นหาและกรอง");
    expect(Object.keys(out)).toHaveLength(2);
  });

  /**
   * A description for a screen nobody asked about would put a line on a
   * quotation for work that was never scoped.
   */
  it("drops a name that was not asked for", () => {
    const out = parseScreenSpecs(`{"เอกสารทั้งหมด":"ok","หน้าที่ไม่มีจริง":"ok"}`, NAMES);
    expect(Object.keys(out)).toEqual(["เอกสารทั้งหมด"]);
  });

  it("tolerates prose or fences around the JSON", () => {
    const out = parseScreenSpecs('นี่ครับ:\n```json\n{"สร้าง Report":"ออกรายงาน"}\n```', NAMES);
    expect(out["สร้าง Report"]).toBe("ออกรายงาน");
  });

  it("collapses whitespace and caps a runaway description", () => {
    const out = parseScreenSpecs(
      JSON.stringify({ "สร้าง Report": `ก\n\nข   ค${"ง".repeat(500)}` }),
      NAMES
    );
    expect(out["สร้าง Report"].startsWith("ก ข ค")).toBe(true);
    expect(out["สร้าง Report"].length).toBe(400);
  });

  it("returns nothing usable rather than guessing", () => {
    expect(parseScreenSpecs("ขอโทษครับ เขียนไม่ได้", NAMES)).toEqual({});
    expect(parseScreenSpecs("[]", NAMES)).toEqual({});
    expect(parseScreenSpecs(`{"เอกสารทั้งหมด":123}`, NAMES)).toEqual({});
    expect(parseScreenSpecs(`{"เอกสารทั้งหมด":"   "}`, NAMES)).toEqual({});
  });
});
