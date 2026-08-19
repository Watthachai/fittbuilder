import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getProjectOrgDnaContext } from "@/lib/org-context";
import { docsFromFiles } from "@/lib/define";
import { screenIndexEntries } from "@/lib/screen-index";
import {
  buildPremiumAdviceUser,
  parsePremiumAdvice,
  PREMIUM_ADVICE_SYSTEM,
} from "@/lib/skills/premium-advice";
import type { PremiumOption } from "@/lib/skills/types";
import type { ProjectFiles } from "@/lib/types";

/**
 * Which of the offered upgrades suit this demo, and why.
 *
 * The options come from the client because they are the catalogue entries that
 * survived the `requires` filter — the server does not re-derive them, it ranks
 * the ones the user is actually being shown. What it does add is the material
 * the browser has no business holding: the project's BRD/PRD and its workspace
 * Org DNA, read here after the caller's access to the project is verified.
 */
const bodySchema = z.object({
  projectId: z.string().uuid(),
  options: z
    .array(
      z.object({
        id: z.string().max(40),
        name: z.string().max(200),
        pitch: z.string().max(600),
        effortDays: z.number(),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(request: Request) {
  const limit = await rateLimit(`premiumadvice:${clientIp(request)}`, 20);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  // The caller must be able to read the project before its brief is used as
  // context — RLS decides, the same gate /api/generate uses for the same reason.
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("fittbuilder_projects")
    .select("files")
    .eq("id", body.projectId)
    .maybeSingle();
  if (!row) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึงโปรเจกต์นี้" }, { status: 403 });

  const files = (row.files ?? {}) as ProjectFiles;
  const docs = docsFromFiles(files);
  const orgContext = await getProjectOrgDnaContext(body.projectId);

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() =>
    void recordUsage({ userId, projectId: body.projectId, kind: "premium_advice", usage })
  );

  try {
    const raw = await generateText({
      system: PREMIUM_ADVICE_SYSTEM,
      user: buildPremiumAdviceUser({
        options: body.options as PremiumOption[],
        brd: docs.brd ?? "",
        prd: docs.prd ?? "",
        screens: screenIndexEntries(files).map((e) => e.name),
        orgContext,
      }),
      json: true,
      level: "medium",
      maxOutputTokens: 4096,
      onUsage: (u) => {
        usage = u;
      },
    });
    const advice = parsePremiumAdvice(raw, body.options as PremiumOption[]);
    if (!advice) {
      return Response.json({ error: "วิเคราะห์ไม่สำเร็จ ลองอีกครั้งได้ครับ" }, { status: 422 });
    }
    return Response.json({ advice });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError ? error.message : "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่";
    console.error("[premium-advice] failed:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
