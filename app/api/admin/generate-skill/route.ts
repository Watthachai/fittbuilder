import { after } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin-server";
import { recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { SKILL_ICON_NAMES } from "@/components/studio/SkillIcon";
import type { GenerateSkillEvent, GeneratedSkill } from "@/lib/types";

export const maxDuration = 120;
const ATTEMPT_TIMEOUT_MS = 110_000;

const bodySchema = z.object({
  topic: z.string().trim().min(2).max(2_000),
  url: z.string().trim().url().max(500).optional().or(z.literal("")),
  webSearch: z.boolean().optional(),
});

function sse(event: GenerateSkillEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

const SYSTEM = `You are an expert at authoring DOMAIN SKILL TEMPLATES for "FITT Builder", an AI web-demo builder. A skill template makes the builder a domain expert: it carries a persona, domain knowledge, build guidance, realistic seed data, and a bank of deep questions to ask the user.

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
function parseTemplate(text: string): GeneratedSkill {
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

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const tools: ("googleSearch" | "urlContext")[] = [];
  if (body.url) tools.push("urlContext");
  if (body.webSearch) tools.push("googleSearch");

  const user = [
    `โดเมน/โจทย์: ${body.topic}`,
    body.url ? `อ้างอิงจาก URL นี้: ${body.url}` : "",
    body.webSearch ? "ค้นเว็บเพิ่มเติมเพื่ออ้างอิงข้อมูลล่าสุด" : "",
  ]
    .filter(Boolean)
    .join("\n");

  let usage: TokenUsage | null = null;
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GenerateSkillEvent) => controller.enqueue(sse(e));
      try {
        for await (const part of streamParts({
          system: SYSTEM,
          user,
          thinking: true,
          temperature: 0.7,
          tools,
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
          onUsage: (u) => {
            usage = u;
          },
        })) {
          if (part.thought) {
            send({ type: "thought", content: part.text });
            continue;
          }
          full += part.text;
          send({ type: "text", content: part.text });
        }
        send({ type: "done", template: parseTemplate(full) });
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : "สร้างไม่สำเร็จ กรุณาลองใหม่";
        console.error("[generate-skill] failed:", error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  after(() => void recordUsage({ userId: admin.id, projectId: null, kind: "generate_skill", usage }));

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
