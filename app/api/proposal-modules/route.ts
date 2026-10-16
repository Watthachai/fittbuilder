import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { docsFromFiles } from "@/lib/define";
import { buildModulesUser, MODULES_SYSTEM, parseModulesDraft } from "@/lib/proposal-modules";
import type { ProjectFiles } from "@/lib/types";

/**
 * Break a project into the modules it is sold as (lib/proposal-modules).
 *
 * The screens and what each one does come from the client, where the proposal's
 * manual lives; the server adds the BRD/PRD, read only after RLS has confirmed
 * the caller may read the project.
 */
const clamped = (n: number) => z.preprocess((v) => (typeof v === "string" ? v.slice(0, n) : ""), z.string());

const bodySchema = z.object({
  projectId: z.string().uuid(),
  projectName: clamped(200).default(""),
  context: clamped(2_000).default(""),
  features: z
    .array(clamped(300))
    .transform((a) => a.slice(0, 30))
    .catch([]),
  screens: z
    .array(
      z.object({
        name: clamped(200),
        does: clamped(400).default(""),
        modals: z
          .array(clamped(200))
          .transform((a) => a.slice(0, 40))
          .catch([]),
      })
    )
    .min(1)
    .transform((a) => a.slice(0, 300)),
});

export async function POST(request: Request) {
  const limit = await rateLimit(`proposal-modules:${clientIp(request)}`, 20);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "ยังไม่มีหน้าจอให้แตกเป็นโมดูล — สแกนหน้าจอในแท็บแกลเลอรีก่อน" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("fittbuilder_projects")
    .select("files")
    .eq("id", body.projectId)
    .maybeSingle();
  if (!row) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึงโปรเจกต์นี้" }, { status: 403 });
  const docs = docsFromFiles((row.files ?? {}) as ProjectFiles);

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: body.projectId, kind: "proposal_modules", usage }));

  try {
    const raw = await generateText({
      system: MODULES_SYSTEM,
      user: buildModulesUser({
        projectName: body.projectName,
        context: body.context,
        features: body.features,
        screens: body.screens,
        brd: docs.brd ?? "",
        prd: docs.prd ?? "",
      }),
      json: true,
      level: "medium",
      maxOutputTokens: 12288,
      onUsage: (u) => {
        usage = u;
      },
    });
    const modules = parseModulesDraft(raw, body.screens.map((s) => s.name));
    if (!modules) return Response.json({ error: "แตกเป็นโมดูลไม่สำเร็จ ลองอีกครั้งได้ครับ" }, { status: 422 });
    return Response.json({ modules });
  } catch (error) {
    const message = error instanceof MissingApiKeyError ? error.message : "แตกเป็นโมดูลไม่สำเร็จ กรุณาลองใหม่";
    console.error("[proposal-modules] failed:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
