import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { buildOrgDnaContext } from "@/lib/org-dna";
import { HEALTH_SYSTEM, parseHealthResult } from "@/lib/advisor-health";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { Json } from "@/lib/db/types";
import type { OrgDna } from "@/lib/types";

export const maxDuration = 120;

const bodySchema = z
  .object({
    orgId: z.string().uuid(),
    data: z.string().trim().max(12_000).optional(),
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
    (b) => (b.data && b.data.length >= 20) || (b.attachments && b.attachments.length > 0),
    { message: "ต้องมีข้อมูล (อย่างน้อย 20 ตัวอักษร) หรือไฟล์อย่างน้อยหนึ่งอย่าง" }
  );

export async function POST(request: Request) {
  const limit = await rateLimit(`advisor:${clientIp(request)}`, 8);
  if (!limit.ok) {
    return Response.json(
      { error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` },
      { status: 429 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "คำขอไม่ถูกต้อง (วางข้อมูลอย่างน้อย 20 ตัวอักษร หรือแนบไฟล์)" },
      { status: 400 }
    );
  }

  // Membership gate: the caller must be able to read the org (RLS orgs_select)
  // before we touch Org DNA with the admin client.
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("fittbuilder_orgs").select("id").eq("id", body.orgId).maybeSingle();
  if (!org) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึง workspace นี้" }, { status: 403 });

  const admin = createAdminClient();
  const { data: dnaRow } = await admin
    .from("fittbuilder_orgs").select("org_dna, name").eq("id", body.orgId).maybeSingle();
  const dnaCtx = buildOrgDnaContext((dnaRow?.org_dna ?? {}) as OrgDna);

  const provided = body.data?.trim() ?? "";
  const user = [
    `องค์กร: ${dnaRow?.name ?? "-"}`,
    dnaCtx ? `\nOrg DNA (บริบท — ตีความตัวเลขให้เข้ากับธุรกิจนี้จริงๆ):\n${dnaCtx}` : "",
    provided
      ? `\nข้อมูลธุรกิจจริงที่ต้องตรวจ (ห้ามแต่งตัวเลขเพิ่ม):\n"""\n${provided}\n"""`
      : `\nตรวจสุขภาพจากข้อมูลในไฟล์ที่แนบมา (ห้ามแต่งตัวเลขนอกเหนือจากไฟล์)`,
  ].filter(Boolean).join("\n");

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: null, kind: "advisor", usage }));

  try {
    let raw = "";
    for await (const part of streamParts({
      system: HEALTH_SYSTEM,
      user,
      attachments: body.attachments,
      json: true,
      temperature: 0.3,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
      onUsage: (u) => { usage = u; },
    })) {
      if (!part.thought) raw += part.text;
    }
    const result = parseHealthResult(raw);
    if (!result) {
      return Response.json(
        { error: "ตรวจไม่สำเร็จ ลองวางข้อมูล/แนบไฟล์ให้มากขึ้นหรือลองใหม่" },
        { status: 502 }
      );
    }
    // Persist into the shared report history (best-effort, RLS gates insert).
    const savedAt = new Date().toISOString();
    const { error: saveErr } = await supabase.from("fittbuilder_advisor_reports").insert({
      org_id: body.orgId,
      kind: "health_check",
      result: result as unknown as Json,
      created_by: userId,
      created_at: savedAt,
    });
    if (saveErr) console.error("[advisor-health] save failed:", saveErr);
    return Response.json({ result, savedAt });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError ? error.message : "ตรวจไม่สำเร็จ กรุณาลองใหม่";
    console.error("[advisor-health] failed:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
