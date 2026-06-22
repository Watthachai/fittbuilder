import { expect, test } from "vitest";
import { SKILLS, SKILL_IDS, getSkill, detectSkillByKeywords } from "@/lib/skills/registry";

test("registry has the six v1 domains", () => {
  expect(SKILL_IDS).toEqual(["erp", "crm", "ecommerce", "dashboard", "booking", "landing"]);
});

test("every template has the required fields populated", () => {
  for (const s of SKILLS) {
    expect(s.id).toBeTruthy();
    expect(s.name).toBeTruthy();
    expect(s.icon).toBeTruthy();
    expect(s.keywords.length).toBeGreaterThan(0);
    expect(s.persona.length).toBeGreaterThan(0);
    expect(s.questionBank.length).toBeGreaterThan(0);
    expect(s.domainKnowledge.length).toBeGreaterThan(0);
    expect(s.buildGuidance.length).toBeGreaterThan(0);
    expect(s.seedData.length).toBeGreaterThan(0);
  }
});

test("ERP is the deep template (richest content + most questions)", () => {
  const erp = getSkill("erp")!;
  expect(erp.questionBank.length).toBeGreaterThanOrEqual(6);
  // ERP carries the most domain knowledge of any template.
  const maxOther = Math.max(...SKILLS.filter((s) => s.id !== "erp").map((s) => s.domainKnowledge.length));
  expect(erp.domainKnowledge.length).toBeGreaterThan(maxOther);
});

test("getSkill returns undefined for unknown / nullish", () => {
  expect(getSkill("nope")).toBeUndefined();
  expect(getSkill(null)).toBeUndefined();
  expect(getSkill(undefined)).toBeUndefined();
});

test("detectSkillByKeywords picks the right domain", () => {
  expect(detectSkillByKeywords("อยากได้ระบบจัดซื้อ PR PO อนุมัติ คลังสินค้า").skillId).toBe("erp");
  expect(detectSkillByKeywords("sales pipeline deal kanban ลูกค้า").skillId).toBe("crm");
  expect(detectSkillByKeywords("ร้านค้าออนไลน์ ตะกร้า checkout").skillId).toBe("ecommerce");
  // no keyword → score 0 (caller treats as "no clear match")
  expect(detectSkillByKeywords("xyz").score).toBe(0);
});
