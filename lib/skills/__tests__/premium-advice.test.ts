import { describe, expect, it } from "vitest";
import { buildPremiumAdviceUser, parsePremiumAdvice } from "../premium-advice";
import { ECOMMERCE } from "../ecommerce";
import type { PremiumOption } from "../types";

const offered: PremiumOption[] = ECOMMERCE.premiumOptions.slice(0, 2);

/**
 * The model ranks a fixed list; it never adds to one.
 *
 * An option that is not in the catalogue has no effortDays, no build brief and
 * nothing a partner could put in front of a customer — it is a price with no
 * product behind it. Quotations are built from these entries, so the boundary
 * matters more than the ranking does.
 */
describe("premium advice", () => {
  it("drops picks for anything that was not offered", () => {
    const raw = JSON.stringify({
      summary: "s",
      picks: [
        { id: offered[0].id, recommend: true, reason: "เหมาะกับระบบนี้" },
        { id: "ฟีเจอร์ที่โมเดลคิดขึ้นเอง", recommend: true, reason: "..." },
      ],
    });
    const advice = parsePremiumAdvice(raw, offered);
    expect(advice?.picks.map((p) => p.id)).toEqual([offered[0].id]);
  });

  it("keeps the not-recommended ones, with their reason", () => {
    // Why an option was passed over is the half a fixed catalogue cannot tell
    // you, and the half that stops someone selling a promise the demo cannot keep.
    const raw = JSON.stringify({
      summary: "s",
      picks: [{ id: offered[1].id, recommend: false, reason: "ระบบนี้ยังไม่มีข้อมูลนั้น" }],
    });
    const advice = parsePremiumAdvice(raw, offered);
    expect(advice?.picks[0]).toMatchObject({ recommend: false });
    expect(advice?.picks[0].reason).toContain("ยังไม่มีข้อมูล");
  });

  it("ignores duplicates rather than double-counting a recommendation", () => {
    const raw = JSON.stringify({
      summary: "",
      picks: [
        { id: offered[0].id, recommend: true, reason: "a" },
        { id: offered[0].id, recommend: false, reason: "b" },
      ],
    });
    expect(parsePremiumAdvice(raw, offered)?.picks).toHaveLength(1);
  });

  it("returns null on junk instead of a half-parsed answer", () => {
    expect(parsePremiumAdvice("not json", offered)).toBeNull();
    expect(parsePremiumAdvice(JSON.stringify({ picks: [] }), offered)).toBeNull();
  });

  it("puts the brief in front of the model, not the file list", () => {
    // The file list says what screens exist; only the brief says what the
    // business is for, which is what decides whether an upgrade fits.
    const user = buildPremiumAdviceUser({
      options: offered,
      brd: "ร้านขายกระเบื้อง ลูกค้าเลือกจากลายและผิวสัมผัส",
      prd: "หน้ารายละเอียดสินค้าแสดงสเปก",
      screens: ["แคตตาล็อก"],
      orgContext: "",
    });
    expect(user).toContain("ผิวสัมผัส");
    expect(user).toContain("--- PRD ---");
    expect(user).toContain(offered[0].id);
  });
});
