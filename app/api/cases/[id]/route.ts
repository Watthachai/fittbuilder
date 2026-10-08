import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authorKindFor,
  CASE_STATUSES,
  ownsAttachmentPath,
  type CaseAttachment,
  type CaseContext,
  type CaseDetail,
  type CaseMessage,
} from "@/lib/cases";
import {
  attachmentsSchema,
  CASE_COLUMNS,
  caseViewer,
  mayOpen,
  peopleById,
  projectsById,
  signAttachments,
  toSummary,
  type CaseRow,
  type CaseViewer,
} from "@/lib/cases-server";
import type { Json } from "@/lib/db/types";

/**
 * One case: read its thread, or add to it.
 *
 * Opening a case marks it read for the side that opened it — the reporter's
 * badge clears when they read the team's answer, the team's when one of them
 * looks. Only the team may move the status; a status change is a message, so the
 * thread records who moved it and when (the trigger in 0047 applies it).
 */
export const dynamic = "force-dynamic";

const uuid = z.uuid();

async function loadCase(id: string): Promise<CaseRow | null> {
  const { data, error } = await createAdminClient()
    .from("fittbuilder_cases")
    .select(CASE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as CaseRow | null;
}

async function markSeen(viewer: CaseViewer, row: CaseRow): Promise<void> {
  const now = new Date().toISOString();
  const update = {
    ...(row.reporter_id === viewer.id ? { reporter_seen_at: now } : {}),
    // Seen BY THE TEAM only when someone on it opens another person's case.
    ...(authorKindFor(viewer, row.reporter_id) === "team" ? { team_seen_at: now } : {}),
  };
  const { error } = await createAdminClient().from("fittbuilder_cases").update(update).eq("id", row.id);
  if (error) throw error;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await caseViewer();
  if (!viewer) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return Response.json({ error: "ไม่พบเคสนี้" }, { status: 404 });

  const row = await loadCase(id);
  if (!row || !mayOpen(viewer, row)) return Response.json({ error: "ไม่พบเคสนี้" }, { status: 404 });

  const { data: messageRows, error } = await createAdminClient()
    .from("fittbuilder_case_messages")
    .select("id, author_id, author_kind, body, attachments, status_to, fixed_in, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[cases] thread failed:", error);
    return Response.json({ error: "โหลดเคสไม่สำเร็จ" }, { status: 500 });
  }

  const authorIds = (messageRows ?? []).flatMap((m) => (m.author_id ? [m.author_id] : []));
  const [people, projects] = await Promise.all([
    peopleById([row.reporter_id, ...authorIds]),
    projectsById(row.project_id ? [row.project_id] : []),
  ]);
  const messages: CaseMessage[] = await signAttachments(
    (messageRows ?? []).map((m) => ({
      id: m.id,
      authorKind: m.author_kind,
      author: m.author_id ? (people.get(m.author_id) ?? null) : null,
      body: m.body,
      attachments: m.attachments as unknown as CaseAttachment[],
      statusTo: m.status_to,
      fixedIn: m.fixed_in,
      createdAt: m.created_at,
    }))
  );

  await markSeen(viewer, row);
  const detail: CaseDetail = {
    ...toSummary(viewer, row, people, projects),
    unread: false,
    context: row.context as CaseContext,
    messages,
  };
  // `team`: may answer as the team here — not on a case of your own.
  return Response.json({ team: authorKindFor(viewer, row.reporter_id) === "team", case: detail });
}

const replySchema = z.object({
  body: z.string().trim().max(10_000),
  attachments: attachmentsSchema,
  status: z.enum(CASE_STATUSES).nullable(),
  fixedIn: z.string().trim().min(1).max(60).nullable(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await caseViewer();
  if (!viewer) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return Response.json({ error: "ไม่พบเคสนี้" }, { status: 404 });

  let input: z.infer<typeof replySchema>;
  try {
    input = replySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "ข้อความไม่ครบหรือรูปแบบไม่ถูกต้อง" }, { status: 400 });
  }

  const row = await loadCase(id);
  if (!row || !mayOpen(viewer, row)) return Response.json({ error: "ไม่พบเคสนี้" }, { status: 404 });
  const authorKind = authorKindFor(viewer, row.reporter_id);
  if (authorKind === "reporter" && (input.status !== null || input.fixedIn !== null)) {
    return Response.json({ error: "เปลี่ยนสถานะได้เฉพาะทีมดูแล" }, { status: 403 });
  }
  if (!input.attachments.every((a) => ownsAttachmentPath(viewer.id, a.path))) {
    return Response.json({ error: "แนบได้เฉพาะรูปที่อัปโหลดเอง" }, { status: 400 });
  }
  const statusTo = input.status !== null && input.status !== row.status ? input.status : null;
  if (!input.body && input.attachments.length === 0 && statusTo === null && input.fixedIn === null) {
    return Response.json({ error: "พิมพ์ข้อความ แนบรูป หรือเปลี่ยนสถานะก่อนส่ง" }, { status: 400 });
  }

  const { error } = await createAdminClient().from("fittbuilder_case_messages").insert({
    case_id: id,
    author_id: viewer.id,
    author_kind: authorKind,
    body: input.body,
    attachments: input.attachments as Json,
    status_to: statusTo,
    fixed_in: input.fixedIn,
  });
  if (error) {
    console.error("[cases] reply failed:", error);
    return Response.json({ error: "ส่งข้อความไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
