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
  buildProposalUser,
  buildScreenDocsUser,
  parseProposalDraft,
  parseScreenDocs,
  PROPOSAL_SYSTEM,
  SCREEN_DOCS_SYSTEM,
  screenBatches,
} from "@/lib/proposal-write";
import type { ScreenDoc } from "@/lib/proposal";
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
 *
 * The argument and the screen manual are separate answers, the manual in
 * batches, all asked at once: one answer for 143 screens ran out of room every
 * time. Whatever succeeds is returned, with how many screens are still missing,
 * so pressing again writes only those.
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
  /** Whether the context, points and exclusions are wanted — false when all three are written. */
  argument: z.boolean().default(true),
  /** The screens with no manual entry yet: the only ones written. */
  document: z
    .array(clamped(200))
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
  /** Every answer's tokens together — the press costs all of them. */
  const addUsage = (u: TokenUsage) => {
    usage = usage
      ? {
          promptTokens: usage.promptTokens + u.promptTokens,
          outputTokens: usage.outputTokens + u.outputTokens,
          totalTokens: usage.totalTokens + u.totalTokens,
        }
      : u;
  };
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: body.projectId, kind: "proposal", usage }));

  const known = new Set(screens.map((s) => s.name.trim()));
  const batches = screenBatches(body.document.filter((n) => known.has(n.trim())));

  const writeArgument = async () => {
    if (!body.argument) return null;
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
      onUsage: addUsage,
    });
    return parseProposalDraft(raw);
  };
  const writeBatch = async (write: string[]) => {
    const raw = await generateText({
      system: SCREEN_DOCS_SYSTEM,
      user: buildScreenDocsUser({ projectName: body.projectName, screens, journey: body.journey, write }),
      json: true,
      level: "low",
      maxOutputTokens: 16384,
      onUsage: addUsage,
    });
    return parseScreenDocs(raw, write);
  };

  try {
    const [argument, ...written] = await Promise.allSettled([writeArgument(), ...batches.map(writeBatch)]);
    for (const r of [argument, ...written]) {
      if (r.status === "rejected") {
        if (r.reason instanceof MissingApiKeyError) return Response.json({ error: r.reason.message }, { status: 500 });
        console.error("[proposal] failed:", r.reason);
      }
    }
    const draft = argument.status === "fulfilled" ? argument.value : null;
    const manual: Record<string, ScreenDoc> = Object.assign(
      {},
      ...written.map((r) => (r.status === "fulfilled" ? (r.value ?? {}) : {}))
    );
    const asked = batches.flat().length;
    const missing = asked - Object.keys(manual).length;
    const argumentFailed = body.argument && !draft;
    if ((argumentFailed || !body.argument) && Object.keys(manual).length === 0) {
      return Response.json({ error: "เขียนข้อเสนอไม่สำเร็จ ลองอีกครั้งได้ครับ" }, { status: 422 });
    }
    return Response.json({
      draft: { context: "", points: [], excluded: [], ...draft, screens: manual },
      argumentFailed,
      missing,
    });
  } catch (error) {
    console.error("[proposal] failed:", error);
    return Response.json({ error: "เขียนข้อเสนอไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
