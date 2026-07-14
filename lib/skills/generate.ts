import { SKILL_ICON_NAMES } from "@/components/studio/SkillIcon";
import type { GeneratedSkill } from "@/lib/types";

export const SKILL_SYSTEM = `You are an expert at authoring DOMAIN SKILL TEMPLATES for "FITT Builder", an AI web-demo builder. A skill template makes the builder a domain expert: it carries a persona, domain knowledge, build guidance, realistic seed data, and a bank of deep questions to ask the user.

Research the requested domain thoroughly (use the provided URL and/or web search when available — cite what you learned in your report). Then produce TWO things, in this order:

1) A concise research report IN THAI, conversational like a chat — what the domain is, the key entities/workflows, what a great demo for it must include, and where you sourced facts. This is shown to the admin.

2) On a NEW LINE at the very end, a SINGLE fenced JSON block (\`\`\`json … \`\`\`) with the template. Content fields in Thai (except nameEn). Shape:
{
  "name": "ชื่อโดเมน (ไทย)",
  "nameEn": "English name",
  "tagline": "คำโปรยสั้นๆ (<=120 ตัวอักษร)",
  "icon": "<one of the allowed icon names>",
  "keywords": ["คำค้น","ที่ช่วยเดาโดเมน","8-15 คำ"],
  "persona": "กรอบผู้เชี่ยวชาญ: บทบาท วิธีคิด ศัพท์เฉพาะ (markdown, สั้นกระชับ)",
  "domainKnowledge": "ความรู้โดเมน: entity หลัก, workflow, KPI, กฎเกณฑ์ (markdown)",
  "buildGuidance": "หน้าจอ/ฟีเจอร์/สถาปัตยกรรมที่ demo ควรมี (markdown, เป็นรายการ)",
  "seedData": "ข้อมูลตัวอย่างสมจริงสำหรับฝังใน demo (markdown/ตาราง)",
  "designHints": "แนวทางดีไซน์/โทนสี (สั้นๆ)",
  "questionBank": [
    {"id":"shortid","label":"คำถามเชิงลึก","type":"single|multi|text","options":["..."],"why":"ทำไมถึงถาม"}
  ]
}

Rules:
- icon MUST be exactly one of: ${SKILL_ICON_NAMES.join(", ")}.
- questionBank: 4-6 high-signal questions; options only for single/multi.
- Output valid JSON (no trailing commas, no comments). Do NOT wrap anything except that one block in fences.`;

const ICONS = new Set<string>(SKILL_ICON_NAMES);

/** Pull the last ```json block and coerce it into a GeneratedSkill. */
export function parseGeneratedSkill(text: string): GeneratedSkill {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const raw = matches.length ? matches[matches.length - 1][1] : "";
  if (!raw.trim()) return {};
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
  const icon = str(obj.icon);
  const qb = Array.isArray(obj.questionBank)
    ? obj.questionBank.flatMap((q): NonNullable<GeneratedSkill["questionBank"]>[number][] => {
        if (!q || typeof q !== "object") return [];
        const o = q as Record<string, unknown>;
        const label = str(o.label);
        if (!label) return [];
        const type = o.type === "multi" || o.type === "text" ? o.type : "single";
        return [
          {
            id: str(o.id) || Math.random().toString(36).slice(2, 10),
            label,
            type,
            options: arr(o.options),
            why: str(o.why),
          },
        ];
      })
    : undefined;
  return {
    name: str(obj.name),
    nameEn: str(obj.nameEn),
    tagline: str(obj.tagline),
    icon: icon && ICONS.has(icon) ? icon : undefined,
    keywords: arr(obj.keywords),
    persona: str(obj.persona),
    domainKnowledge: str(obj.domainKnowledge),
    buildGuidance: str(obj.buildGuidance),
    seedData: str(obj.seedData),
    designHints: str(obj.designHints),
    questionBank: qb,
  };
}
