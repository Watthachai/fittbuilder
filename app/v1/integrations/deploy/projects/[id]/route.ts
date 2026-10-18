import { billingError } from "@/lib/billing/errors";
import { guardDeploy, UUID } from "@/lib/deploy/guard";
import { loadDeployProject } from "@/lib/deploy/store";

/**
 * Code Runner's deploy side → FITT Builder: was this project sent as local or
 * cloud, and who is its first administrator. No choice made means local.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardDeploy(request);
  if (g instanceof Response) return g;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return billingError("not_found", "ไม่พบโปรเจกต์", g.requestId);
  try {
    const p = await loadDeployProject(id);
    if (!p) return billingError("not_found", "ไม่พบโปรเจกต์", g.requestId);
    return Response.json(
      { project_id: p.id, name: p.name, target: p.delivery?.target ?? "local", admin_email: p.delivery?.admin_email ?? "" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    console.error(`[deploy] project failed (${g.requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", g.requestId);
  }
}
