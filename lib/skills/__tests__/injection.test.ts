import { expect, test } from "vitest";
import { buildAgentSystemPrompt, buildGenerationSystemPrompt } from "@/lib/prompts";
import { getSkill, SKILLS } from "@/lib/skills/registry";

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

test("Executive Co-pilot is the flagship (first) and injects its framework library", () => {
  expect(SKILLS[0].id).toBe("exec-copilot");
  const skill = getSkill("exec-copilot")!;
  const build = buildGenerationSystemPrompt("SPEC", "PERSONA", skill);
  // The framework library and Human-in-the-Loop guardrail must survive edits.
  expect(build).toContain("MECE");
  expect(build).toContain("5 Whys");
  expect(build).toContain("Human-in-the-Loop");
  expect(build).toContain("Decision Matrix");
  expect(build).toContain("CEO อนุมัติ"); // the approve-to-decide (HITL) button in seed/build
});
