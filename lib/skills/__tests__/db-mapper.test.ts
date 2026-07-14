import { describe, expect, it } from "vitest";
import { rowToSkillTemplate, skillTemplateToInsertRow, type SkillTemplateRow } from "@/lib/skills/db-mapper";

const row: SkillTemplateRow = {
  id: "u1", slug: "org-abc", name: "ธนาคาร", name_en: "Bank", tagline: "t", icon: "Landmark",
  keywords: ["bank"], persona: "p", domain_knowledge: "d", build_guidance: "b", seed_data: "s",
  design_hints: null, question_bank: [], status: "published", created_by: "user1",
  created_at: "2026-07-14T00:00:00Z", updated_at: "2026-07-14T00:00:00Z", org_id: "org1", source: "ai",
};

describe("skill db-mapper", () => {
  it("round-trips a generated skill into an insert row", () => {
    const ins = skillTemplateToInsertRow(
      { name: "ธนาคาร", nameEn: "Bank", tagline: "t", icon: "Landmark", keywords: ["bank"],
        persona: "p", domainKnowledge: "d", buildGuidance: "b", seedData: "s", questionBank: [] },
      { slug: "org-abc", orgId: "org1", createdBy: "user1", source: "ai" }
    );
    expect(ins.slug).toBe("org-abc");
    expect(ins.org_id).toBe("org1");
    expect(ins.source).toBe("ai");
    expect(ins.name_en).toBe("Bank");
    expect(ins.status).toBe("published");
    expect(rowToSkillTemplate(row).id).toBe("org-abc");
  });

  it("maps a db row into a SkillTemplate", () => {
    const tpl = rowToSkillTemplate(row);
    expect(tpl.id).toBe(row.slug);
    expect(tpl.nameEn).toBe("Bank");
    expect(tpl.icon).toBe("Landmark");
    expect(tpl.keywords).toEqual(["bank"]);
    expect(tpl.domainKnowledge).toBe("d");
    expect(tpl.questionBank).toEqual([]);
    expect(tpl.designHints).toBeUndefined();
  });
});
