import { createAdminClient } from "@/lib/supabase/admin";
import { caseViewer } from "@/lib/cases-server";
import { caseStats, toStatCases, type CaseStatRow, type StatusMoveRow } from "@/lib/case-stats";

/**
 * The cases overview: how many cases, why and where, week by week. Anyone
 * signed in may read it — only counts leave here, never a case, a person or a
 * project — so the whole team can see whether FITT Builder is getting better.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await caseViewer();
  if (!viewer) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const db = createAdminClient();
  const [cases, moves] = await Promise.all([
    db.from("fittbuilder_cases").select("id, number, kind, status, cause, area, created_at"),
    db.from("fittbuilder_case_messages").select("case_id, status_to, created_at").not("status_to", "is", null),
  ]);
  if (cases.error || moves.error) {
    console.error("[cases] stats failed:", cases.error ?? moves.error);
    return Response.json({ error: "โหลดภาพรวมไม่สำเร็จ" }, { status: 500 });
  }
  const stats = caseStats(
    toStatCases(cases.data as CaseStatRow[], moves.data as StatusMoveRow[]),
    new Date()
  );
  return Response.json(stats, { headers: { "cache-control": "no-store" } });
}
