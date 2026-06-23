import { expect, test } from "vitest";
import { rowToSkillTemplate, type SkillTemplateRow } from "@/lib/skills/db-mapper";

const row: SkillTemplateRow = {
  id: "uuid-1",
  slug: "logistics",
  name: "โลจิสติกส์",
  name_en: "Logistics",
  tagline: "ขนส่ง · คลัง · เส้นทาง",
  icon: "Truck",
  keywords: ["logistics", "ขนส่ง"],
  persona: "คุณคือผู้เชี่ยวชาญโลจิสติกส์",
  domain_knowledge: "shipments, routes",
  build_guidance: "screens: tracking",
  seed_data: "sample shipments",
  design_hints: null,
  question_bank: [{ id: "q1", label: "ขนส่งแบบไหน?", type: "single", options: ["รถ", "เรือ"] }],
  status: "published",
  created_by: "owner-1",
  created_at: "2026-06-23T00:00:00.000Z",
  updated_at: "2026-06-23T00:00:00.000Z",
};

test("maps a DB row to a SkillTemplate (slug → id)", () => {
  const t = rowToSkillTemplate(row);
  expect(t.id).toBe("logistics");
  expect(t.nameEn).toBe("Logistics");
  expect(t.icon).toBe("Truck");
  expect(t.keywords).toEqual(["logistics", "ขนส่ง"]);
  expect(t.questionBank).toHaveLength(1);
  expect(t.questionBank[0].label).toBe("ขนส่งแบบไหน?");
  expect(t.domainKnowledge).toBe("shipments, routes");
  expect(t.designHints).toBeUndefined(); // null → undefined
});
