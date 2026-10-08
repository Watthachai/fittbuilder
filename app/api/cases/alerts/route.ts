import { createAdminClient } from "@/lib/supabase/admin";
import { caseViewer, unreadFor } from "@/lib/cases-server";

/**
 * How many cases want this person's attention — the number on their account
 * chip. For a reporter: cases the team answered since they last looked. For the
 * team: cases nobody has opened yet, or that the reporter wrote to since.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await caseViewer();
  if (!viewer) return Response.json({ count: 0 });

  let query = createAdminClient()
    .from("fittbuilder_cases")
    .select("reporter_id, status, last_reporter_at, last_team_at, reporter_seen_at, team_seen_at");
  if (!viewer.team) query = query.eq("reporter_id", viewer.id);
  const { data, error } = await query;
  if (error) {
    console.error("[cases] alerts failed:", error);
    return Response.json({ error: "โหลดการแจ้งเตือนไม่สำเร็จ" }, { status: 500 });
  }
  const count = (data ?? []).filter((row) => unreadFor(viewer, row)).length;
  return Response.json({ count });
}
