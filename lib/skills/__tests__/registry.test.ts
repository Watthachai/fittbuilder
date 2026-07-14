import { expect, test } from "vitest";
import { SKILLS, SKILL_IDS, getSkill, detectSkillByKeywords } from "@/lib/skills/registry";

test("registry lists the flagship first, then the v1 domains", () => {
  expect(SKILL_IDS).toEqual(["exec-copilot", "erp", "crm", "ecommerce", "dashboard", "booking", "landing"]);
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

test("Executive Co-pilot is the flagship (richest content + a deep question set)", () => {
  const flagship = getSkill("exec-copilot")!;
  expect(SKILLS[0].id).toBe("exec-copilot");
  expect(flagship.questionBank.length).toBeGreaterThanOrEqual(6);
  // The flagship carries the most domain knowledge of any template.
  const maxOther = Math.max(
    ...SKILLS.filter((s) => s.id !== "exec-copilot").map((s) => s.domainKnowledge.length)
  );
  expect(flagship.domainKnowledge.length).toBeGreaterThan(maxOther);
});

test("ERP is the deep operational template (deeper than the shallow v1 domains)", () => {
  const erp = getSkill("erp")!;
  expect(erp.questionBank.length).toBeGreaterThanOrEqual(6);
  const shallow = ["crm", "ecommerce", "dashboard", "booking", "landing"];
  const maxShallow = Math.max(
    ...SKILLS.filter((s) => shallow.includes(s.id)).map((s) => s.domainKnowledge.length)
  );
  expect(erp.domainKnowledge.length).toBeGreaterThan(maxShallow);
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
