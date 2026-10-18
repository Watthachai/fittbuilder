import { billingError } from "@/lib/billing/errors";
import { guardDeploy } from "@/lib/deploy/guard";
import { pendingProjects } from "@/lib/deploy/pending";
import { loadCloudDeliveries, loadUatEvents } from "@/lib/deploy/store";

/**
 * Code Runner's deploy side → FITT Builder: the cloud projects its five-minute
 * sweep should work on — no UAT yet, switched to cloud after their last build,
 * or failed fewer than three times on their newest build.
 */
export async function GET(request: Request) {
  const g = await guardDeploy(request);
  if (g instanceof Response) return g;
  try {
    const deliveries = await loadCloudDeliveries();
    const events = await loadUatEvents(deliveries.map((d) => d.project_id));
    return Response.json({ projects: pendingProjects(deliveries, events).map((project_id) => ({ project_id })) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[deploy] pending failed (${g.requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", g.requestId);
  }
}
