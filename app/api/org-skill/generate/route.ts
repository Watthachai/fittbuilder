import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { SKILL_SYSTEM, parseGeneratedSkill } from "@/lib/skills/generate";
import { buildOrgDnaContext } from "@/lib/org-dna";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { GenerateSkillEvent, OrgDna } from "@/lib/types";

export const maxDuration = 120;
const ATTEMPT_TIMEOUT_MS = 110_000;

const bodySchema = z.object({
  orgId: z.string().uuid(),
  brief: z.string().trim().max(4_000).optional(),
});

function sse(e: GenerateSkillEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`);
}

export async function POST(request: Request) {
  const limit = await rateLimit(`orgskill:${clientIp(request)}`, 8);
  if (!limit.ok) {
    return Response.json({ error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); }
  catch { return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 }); }

  // Membership gate: the caller must be able to read the org (RLS orgs_select).
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("fittbuilder_orgs").select("id").eq("id", body.orgId).maybeSingle();
  if (!org) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึง workspace นี้" }, { status: 403 });

  // Org DNA via service role (same trust path as generation context).
  const admin = createAdminClient();
  const { data: dnaRow } = await admin
    .from("fittbuilder_orgs").select("org_dna, name").eq("id", body.orgId).maybeSingle();
  const dna = (dnaRow?.org_dna ?? {}) as OrgDna;
  const dnaCtx = buildOrgDnaContext(dna);

  const user = [
    `องค์กร: ${dnaRow?.name ?? "-"}`,
    body.brief ? `บริบท/อุตสาหกรรมเพิ่มเติม: ${body.brief}` : "",
    dnaCtx ? `\nนี่คือ Org DNA ขององค์กร ใช้เป็นฐานในการปั้นผู้เชี่ยวชาญให้ตรงกับวิธีทำงานจริง:\n${dnaCtx}` : "",
    "\nสร้างผู้เชี่ยวชาญประจำองค์กรนี้ (persona/questionBank/domainKnowledge/buildGuidance/seedData/designHints) ให้เหมาะกับอุตสาหกรรมและ Org DNA ข้างบน",
  ].filter(Boolean).join("\n");

  let usage: TokenUsage | null = null;
  let full = "";
  const userId = await currentUserId();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GenerateSkillEvent) => controller.enqueue(sse(e));
      try {
        for await (const part of streamParts({
          system: SKILL_SYSTEM,
          user,
          thinking: true,
          temperature: 0.7,
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
          onUsage: (u) => { usage = u; },
        })) {
          if (part.thought) { send({ type: "thought", content: part.text }); continue; }
          full += part.text;
          send({ type: "text", content: part.text });
        }
        send({ type: "done", template: parseGeneratedSkill(full) });
      } catch (error) {
        const message = error instanceof MissingApiKeyError ? error.message : "สร้างไม่สำเร็จ กรุณาลองใหม่";
        console.error("[org-skill/generate] failed:", error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  after(() => void recordUsage({ userId, projectId: null, kind: "generate_skill", usage }));

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
