import { after } from "next/server";
import { z } from "zod";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { OrgDna } from "@/lib/types";

export const maxDuration = 60;

const ARCHETYPE_KEYS = [
  "resilient",
  "military-precision",
  "just-in-time",
  "passive-aggressive",
  "fits-and-starts",
  "overmanaged",
  "outgrown",
] as const;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(20_000),
});

const SYSTEM = `คุณคือที่ปรึกษาด้าน Org DNA (กรอบ Strategy& / PwC) สกัด "Org DNA" จากข้อมูลบริษัทที่ผู้ใช้ให้มา (ภาษาไทยหรืออังกฤษ)

ตอบกลับเป็น JSON อย่างเดียว ตาม schema นี้:
{"decisionRights":"","information":"","motivators":"","structure":"","archetype":null,"notes":""}

กติกา:
- decisionRights / information / motivators / structure: สรุปสั้น กระชับ (1-3 ประโยค) "เฉพาะที่อนุมานได้จากข้อมูลที่ให้มาเท่านั้น" ถ้าด้านไหนไม่มีข้อมูลพอ ให้เว้นเป็น "" (ห้ามแต่งขึ้นเอง)
- archetype: เลือกหนึ่งใน [${ARCHETYPE_KEYS.join(", ")}] ที่ตรงที่สุด หรือ null ถ้าข้อมูลไม่พอจะจัดประเภท
- notes: จุดที่ข้อมูลยังขาด/ควรถามเพิ่มเพื่อให้ Org DNA สมบูรณ์ (1-2 ประโยค)
- ตอบเป็นภาษาไทย ยกเว้น archetype ที่เป็น key อังกฤษตาม list`;

export async function POST(request: Request) {
  const limit = rateLimit(`orgdna:${clientIp(request)}`);
  if (!limit.ok) {
    return Response.json(
      { error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  // Must be signed in (Org DNA is workspace data).
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  let usage: TokenUsage | null = null;
  after(() => void recordUsage({ userId, projectId: null, kind: "agent", usage }));

  try {
    let raw = "";
    for await (const part of streamParts({
      system: SYSTEM,
      user: body.text,
      json: true,
      temperature: 0.3,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
      onUsage: (u) => {
        usage = u;
      },
    })) {
      if (!part.thought) raw += part.text;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const archetype = ARCHETYPE_KEYS.includes(parsed.archetype as (typeof ARCHETYPE_KEYS)[number])
      ? (parsed.archetype as OrgDna["archetype"])
      : null;
    const dna: OrgDna = {
      decisionRights: str(parsed.decisionRights),
      information: str(parsed.information),
      motivators: str(parsed.motivators),
      structure: str(parsed.structure),
      archetype,
      notes: str(parsed.notes),
    };
    return Response.json({ dna });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError ? error.message : "ร่าง Org DNA ไม่สำเร็จ ลองใหม่อีกครั้ง";
    console.error("[org-dna] failed:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
