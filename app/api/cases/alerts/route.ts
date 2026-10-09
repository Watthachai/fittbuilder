import { createAdminClient } from "@/lib/supabase/admin";
import { caseViewer } from "@/lib/cases-server";
import { alertFor, type CaseAlert } from "@/lib/cases";

/**
 * The cases waiting on this person — the bell's number, and what the inbox
 * compares to tell a new answer from one already shown. For a reporter: cases
 * the team answered since they last looked. For the team: cases nobody has
 * opened yet, or that the reporter wrote to since.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await caseViewer();
  if (!viewer) return Response.json({ signedIn: false, alerts: [] });

  let query = createAdminClient()
    .from("fittbuilder_cases")
    .select("id, number, title, reporter_id, status, last_reporter_at, last_team_at, reporter_seen_at, team_seen_at");
  if (!viewer.team) query = query.eq("reporter_id", viewer.id);
  const { data, error } = await query;
  if (error) {
    console.error("[cases] alerts failed:", error);
    return Response.json({ error: "โหลดการแจ้งเตือนไม่สำเร็จ" }, { status: 500 });
  }
  const alerts = (data ?? [])
    .map((row) => alertFor(viewer, row))
    .filter((a): a is CaseAlert => a !== null)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return Response.json({ signedIn: true, alerts });
}
