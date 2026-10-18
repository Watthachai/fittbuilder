import { billingError } from "@/lib/billing/errors";
import { parseEventInput } from "@/lib/deploy/event-input";
import { guardDeploy, UUID } from "@/lib/deploy/guard";
import { seal } from "@/lib/deploy/secret-box";
import { insertDeployEvent, loadDeployProject, storeInitialPassword } from "@/lib/deploy/store";

/**
 * Code Runner's deploy side → FITT Builder: one step of a deploy. A first
 * administrator's password, when sent with "ready", is sealed and kept apart
 * from the event until someone shows it once. Anything that is not stored
 * answers non-2xx, so the deploy side sends it again.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardDeploy(request);
  if (g instanceof Response) return g;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return billingError("not_found", "ไม่พบโปรเจกต์", g.requestId);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return billingError("invalid_request", "เนื้อหาไม่ใช่ JSON", g.requestId);
  }
  const input = parseEventInput(body);
  if (!input.ok) return billingError("invalid_request", input.message, g.requestId);
  const { initial_admin_password: password, ...event } = input.value;
  try {
    if (!(await loadDeployProject(id))) return billingError("not_found", "ไม่พบโปรเจกต์", g.requestId);
    if (password) await storeInitialPassword(id, event.env, seal(password));
    await insertDeployEvent({ project_id: id, ...event, binding_id: g.binding.id });
    return Response.json({ ok: true }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[deploy] event failed (${g.requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", g.requestId);
  }
}
