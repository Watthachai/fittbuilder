import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getProjectOrgDnaContext } from "@/lib/org-context";
import { docsFromFiles } from "@/lib/define";
import { screenIndexEntries } from "@/lib/screen-index";
import { buildProposalUser, parseProposalDraft, PROPOSAL_SYSTEM } from "@/lib/proposal-write";
import type { ProjectFiles } from "@/lib/types";

/**
 * Write the argument of a proposal from what this project actually is.
 *
 * The screens and the recorded journey come from the client because that is
 * where they live — the screenshots and their flow edges are in storage, joined
 * to the quotation's own descriptions in the panel. What the server adds is the
 * material the browser has no business holding: the project's BRD/PRD and the
 * workspace Org DNA, read only after RLS has confirmed the caller may read the
 * project at all.
 */
// Clamp rather than reject: this is context for a draft, not a form a user
// filled in. A quotation note can run long (one was 1525 chars), and a draft
// request that 400s because a description is verbose is a worse outcome than a
// description trimmed for the prompt. preprocess slices before .max can throw.
const clamped = (n: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.slice(0, n) : ""), z.string());

const bodySchema = z.object({
  projectId: z.string().uuid(),
  projectName: clamped(200).default(""),
  screens: z
    .array(z.object({ name: clamped(200), note: clamped(600).default("") }))
    .transform((a) => a.slice(0, 400))
    .catch([]),
  journey: z
    .array(clamped(300))
    .transform((a) => a.slice(0, 400))
    .catch([]),
});

export async function POST(request: Request) {
  const limit = await rateLimit(`proposal:${clientIp(request)}`, 20);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

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

  // The declared index is the fallback list of screens: a project whose walk
  // has not run yet still has names worth writing about.
  const screens = body.screens.length
    ? body.screens
    : screenIndexEntries(files).map((e) => ({ name: e.name, note: "" }));

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: body.projectId, kind: "proposal", usage }));

  try {
    const raw = await generateText({
      system: PROPOSAL_SYSTEM,
      user: buildProposalUser({
        projectName: body.projectName,
        brd: docs.brd ?? "",
        prd: docs.prd ?? "",
        screens,
        journey: body.journey,
        orgContext,
      }),
      json: true,
      level: "medium",
      maxOutputTokens: 12288,
      onUsage: (u) => {
        usage = u;
      },
    });
    const draft = parseProposalDraft(raw, screens.map((s) => s.name));
    if (!draft) {
      return Response.json({ error: "เขียนข้อเสนอไม่สำเร็จ ลองอีกครั้งได้ครับ" }, { status: 422 });
    }
    return Response.json({ draft });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError ? error.message : "เขียนข้อเสนอไม่สำเร็จ กรุณาลองใหม่";
    console.error("[proposal] failed:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
