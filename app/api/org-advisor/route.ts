import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { buildOrgDnaContext } from "@/lib/org-dna";
import { ADVISOR_SYSTEM, parseAdvisorResult } from "@/lib/org-advisor";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { OrgDna } from "@/lib/types";

export const maxDuration = 120;

const bodySchema = z
  .object({
    orgId: z.string().uuid(),
    feedback: z.string().trim().max(12_000).optional(),
    attachments: z
      .array(
        z.object({
          name: z.string().max(200),
          mimeType: z.string().max(120),
          data: z.string().max(8_000_000),
        })
      )
      .max(5)
      .optional(),
  })
  .refine(
    (b) => (b.feedback && b.feedback.length >= 20) || (b.attachments && b.attachments.length > 0),
    { message: "ต้องมีเสียง (อย่างน้อย 20 ตัวอักษร) หรือไฟล์อย่างน้อยหนึ่งอย่าง" }
  );

export async function POST(request: Request) {
  const limit = await rateLimit(`advisor:${clientIp(request)}`, 8);
  if (!limit.ok) {
    return Response.json({ error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "คำขอไม่ถูกต้อง (วางเสียงอย่างน้อย 20 ตัวอักษร หรือแนบไฟล์)" },
      { status: 400 }
    );
  }

  // Membership gate: the caller must be able to read the org (RLS orgs_select).
  // The user-scoped client enforces RLS before we touch Org DNA with the admin
  // client — so a caller can't analyze another workspace's DNA.
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("fittbuilder_orgs").select("id").eq("id", body.orgId).maybeSingle();
  if (!org) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึง workspace นี้" }, { status: 403 });

  // Org DNA via service role (same trust path as the generation context).
  const admin = createAdminClient();
  const { data: dnaRow } = await admin
    .from("fittbuilder_orgs").select("org_dna, name").eq("id", body.orgId).maybeSingle();
  const dnaCtx = buildOrgDnaContext((dnaRow?.org_dna ?? {}) as OrgDna);

  const feedback = body.feedback?.trim() ?? "";
  const user = [
    `องค์กร: ${dnaRow?.name ?? "-"}`,
    dnaCtx ? `\nOrg DNA (บริบท — วิเคราะห์ให้เข้ากับวิธีทำงานจริงขององค์กรนี้):\n${dnaCtx}` : "",
    feedback
      ? `\nเสียงจริงที่ต้องวิเคราะห์ (raw feedback ห้ามแต่งเพิ่ม):\n"""\n${feedback}\n"""`
      : `\nวิเคราะห์เสียงจริงจากไฟล์ที่แนบมา (ห้ามแต่งข้อมูลนอกเหนือจากไฟล์)`,
  ].filter(Boolean).join("\n");

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: null, kind: "advisor", usage }));

  try {
    let raw = "";
    for await (const part of streamParts({
      system: ADVISOR_SYSTEM,
      user,
      attachments: body.attachments,
      json: true,
      temperature: 0.4,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
      onUsage: (u) => { usage = u; },
    })) {
      if (!part.thought) raw += part.text;
    }
    const result = parseAdvisorResult(raw);
    if (!result) {
      return Response.json(
        { error: "วิเคราะห์ไม่สำเร็จ ลองวางเสียง/แนบไฟล์ให้มากขึ้นหรือลองใหม่" },
        { status: 502 }
      );
    }
    return Response.json({ result });
  } catch (error) {
    const message = error instanceof MissingApiKeyError ? error.message : "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่";
    console.error("[org-advisor] failed:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
