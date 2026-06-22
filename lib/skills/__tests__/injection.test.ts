import { expect, test } from "vitest";
import { buildAgentSystemPrompt, buildGenerationSystemPrompt } from "@/lib/prompts";
import { getSkill } from "@/lib/skills/registry";

const erp = getSkill("erp")!;

test("Build prompt injects domain knowledge + build guidance + seed data when a skill is given", () => {
  const withSkill = buildGenerationSystemPrompt("SPEC", "PERSONA", erp);
  expect(withSkill).toContain("DOMAIN EXPERTISE");
  expect(withSkill).toContain("procure-to-pay");      // from domainKnowledge
  expect(withSkill).toContain("ERP Build Guidance");   // from buildGuidance
  expect(withSkill).toContain("ERP Seed Data");        // from seedData
});

test("Build prompt omits the domain block when no skill", () => {
  const withoutSkill = buildGenerationSystemPrompt("SPEC", "PERSONA");
  expect(withoutSkill).not.toContain("DOMAIN EXPERTISE");
});

test("Interview prompt injects persona + question bank + knowledge when a skill is given", () => {
  const withSkill = buildAgentSystemPrompt("AGENT_BODY", {}, erp);
  expect(withSkill).toContain("AGENT_BODY");
  expect(withSkill).toContain("ที่ปรึกษา ERP");        // from persona
  expect(withSkill).toContain("PR → PO → GR");          // from a question bank label
});

test("Interview prompt omits the domain block when no skill", () => {
  const withoutSkill = buildAgentSystemPrompt("AGENT_BODY", {});
  expect(withoutSkill).not.toContain("บทบาทผู้เชี่ยวชาญโดเมน");
});
