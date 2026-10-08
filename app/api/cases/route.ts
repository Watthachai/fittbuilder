import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { CASE_KINDS, ownsAttachmentPath, type CaseSummary } from "@/lib/cases";
import {
  attachmentsSchema,
  CASE_COLUMNS,
  caseViewer,
  contextSchema,
  peopleById,
  projectsById,
  toSummary,
  type CaseRow,
} from "@/lib/cases-server";
import type { Json } from "@/lib/db/types";

/**
 * Cases: list them, or open a new one.
 *
 * The reporter sees their own cases; the team (ADMIN_EMAILS) sees every case
 * unless it asks for ?scope=mine. Writes go through the service role after the
 * checks below — the tables have no RLS policies (migration 0047).
 */
export const dynamic = "force-dynamic";

const LIST_LIMIT = 300;

export async function GET(request: Request) {
  const viewer = await caseViewer();
  if (!viewer) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const mineOnly = !viewer.team || new URL(request.url).searchParams.get("scope") === "mine";
  let query = createAdminClient()
    .from("fittbuilder_cases")
    .select(CASE_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (mineOnly) query = query.eq("reporter_id", viewer.id);
  const { data, error } = await query;
  if (error) {
    console.error("[cases] list failed:", error);
    return Response.json({ error: "โหลดเคสไม่สำเร็จ" }, { status: 500 });
  }

  const rows = (data ?? []) as CaseRow[];
  const [people, projects] = await Promise.all([
    peopleById(rows.map((r) => r.reporter_id)),
    projectsById(rows.flatMap((r) => (r.project_id ? [r.project_id] : []))),
  ]);
  const cases: CaseSummary[] = rows.map((r) => toSummary(viewer, r, people, projects));
  return Response.json({ team: viewer.team, cases });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(CASE_KINDS),
  body: z.string().trim().max(10_000),
  projectId: z.uuid().nullable(),
  context: contextSchema,
  attachments: attachmentsSchema,
});

export async function POST(request: Request) {
  const viewer = await caseViewer();
  if (!viewer) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  // Far above anyone reporting real problems, far below a stuck retry loop.
  const limit = await rateLimit(`cases:${viewer.id}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "แจ้งเคสถี่เกินไป ลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "ข้อมูลเคสไม่ครบหรือรูปแบบไม่ถูกต้อง" }, { status: 400 });
  }
  if (!input.attachments.every((a) => ownsAttachmentPath(viewer.id, a.path))) {
    return Response.json({ error: "แนบได้เฉพาะรูปที่อัปโหลดเอง" }, { status: 400 });
  }

  // A case may name only a project its reporter can open — read through their
  // own session, so the project's RLS decides.
  if (input.projectId) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("fittbuilder_projects")
      .select("id")
      .eq("id", input.projectId)
      .maybeSingle();
    if (!project) return Response.json({ error: "ไม่พบโปรเจกต์นี้" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("fittbuilder_cases")
    .insert({
      reporter_id: viewer.id,
      project_id: input.projectId,
      title: input.title,
      kind: input.kind,
      context: input.context as Json,
    })
    .select("id, number")
    .single();
  if (error || !created) {
    console.error("[cases] create failed:", error);
    return Response.json({ error: "แจ้งเคสไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }

  // The description and pictures are the thread's first message. A case sent
  // straight from an error screen may have neither — its context says it all.
  if (input.body || input.attachments.length) {
    const { error: msgError } = await admin.from("fittbuilder_case_messages").insert({
      case_id: created.id,
      author_id: viewer.id,
      author_kind: "reporter",
      body: input.body,
      attachments: input.attachments as Json,
    });
    if (msgError) {
      console.error("[cases] first message failed:", msgError);
      return Response.json(
        { error: `เปิดเคส #${created.number} แล้ว แต่บันทึกรายละเอียดไม่สำเร็จ — เพิ่มในเคสอีกครั้ง`, id: created.id, number: created.number },
        { status: 500 }
      );
    }
  }

  return Response.json({ id: created.id, number: created.number });
}
