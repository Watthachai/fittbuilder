import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { noticesFor, type ApprovalEvent } from "@/lib/approval-notice";
import type { ApprovalDocKind, ApprovalStage, ApprovalStatus } from "@/lib/doc-approval";
import { sendApprovalNoticeEmail } from "@/lib/email";
import { mailOrigin } from "@/lib/origin";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ id: z.string().uuid() });

/**
 * Mail the people a move on a document concerns. The browser calls this straight
 * after the move; who hears what comes from the request as stored, never from the
 * caller, and only the person who just made the move can set it off (noticesFor).
 * Best effort: the move stands whether or not the mail goes out.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const limit = await rateLimit(`approval-notice:${user.id}`, 30, 10 * 60_000);
  if (!limit.ok) return Response.json({ error: "too many" }, { status: 429 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  // RLS reads a request with its project, so a stranger gets no row.
  const { data: row } = await supabase
    .from("fittbuilder_doc_approvals")
    .select(
      "id, status, stage, requested_by, requested_at, reviewer_id, reviewed_at, review_note, approver_id, decided_by, decided_at, comment, doc_kind, project_id"
    )
    .eq("id", body.id)
    .maybeSingle();
  if (!row) return Response.json({ error: "forbidden" }, { status: 403 });
  const { data: project } = await supabase.from("fittbuilder_projects").select("name").eq("id", row.project_id).maybeSingle();

  const event: ApprovalEvent = {
    id: row.id,
    status: row.status as ApprovalStatus,
    stage: row.stage as ApprovalStage,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewerId: row.reviewer_id,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    approverId: row.approver_id,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    comment: row.comment,
    kind: row.doc_kind as ApprovalDocKind,
    projectId: row.project_id,
    projectName: project?.name ?? "ไม่มีชื่อ",
  };

  // Not every profile is readable by a colleague.
  const ids = [event.requestedBy, event.approverId, event.reviewerId, event.decidedBy].filter((id): id is string => id !== null);
  const { data: people } = await createAdminClient().from("fittbuilder_profiles").select("id, email, name").in("id", ids);
  const person = new Map((people ?? []).map((p) => [p.id, p]));
  const nameOf = (id: string) => person.get(id)?.name || person.get(id)?.email || "ผู้ใช้";

  const notices = noticesFor(event, user.id, Date.now(), nameOf);
  const site = mailOrigin(request);
  if (!site && notices.length > 0) {
    console.error("[approval-notice] no public site URL — skipping");
    return Response.json({ sent: 0 });
  }

  const results = await Promise.all(
    notices.map(async (notice) => {
      const email = person.get(notice.to)?.email;
      if (!email) return false;
      try {
        const { sent } = await sendApprovalNoticeEmail({
          to: email,
          name: nameOf(notice.to),
          subject: notice.subject,
          heading: notice.heading,
          message: notice.message,
          actionLabel: notice.actionLabel,
          actionLink: `${site}${notice.path}`,
        });
        return sent;
      } catch (e) {
        console.error("[approval-notice] failed:", e);
        return false;
      }
    })
  );
  return Response.json({ sent: results.filter(Boolean).length });
}
