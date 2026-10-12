import { randomUUID } from "node:crypto";
import { authenticate } from "@/lib/fittvoice/authenticate";
import { connectionBody } from "@/lib/fittvoice/connect";
import { userEmail, workspaceName } from "@/lib/fittvoice/connection-store";
import { HTTP_STATUS, errorBody } from "@/lib/fittvoice/delivery";

/**
 * What a FITT Voice token stands for: the workspace, the person, their role
 * there now, and whether a delivery would be accepted. A person who has left
 * the workspace gets canSend: false here rather than an error, so FITT Voice
 * can say why and offer to connect again. Counts as use, like a delivery.
 */
export async function GET(request: Request) {
  const requestId = randomUUID();
  const auth = await authenticate(request.headers.get("authorization"));
  if (!auth.ok) {
    return Response.json(errorBody(auth.code, auth.message, requestId, null), { status: HTTP_STATUS[auth.code] });
  }
  const { binding, role } = auth;
  try {
    const [name, email] = await Promise.all([
      workspaceName(binding.org_id),
      binding.user_id ? userEmail(binding.user_id) : null,
    ]);
    return Response.json(
      connectionBody({
        id: binding.id,
        clientId: binding.client_id,
        workspace: { id: binding.org_id, name },
        user: binding.user_id ? { id: binding.user_id, email: email ?? "" } : null,
        role,
        lastUsedAt: new Date(binding.last_used_at ?? binding.created_at),
      }),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(`[fittvoice] ${requestId} connection lookup failed: ${(e as Error).message}`);
    return Response.json(
      errorBody("TEMPORARILY_UNAVAILABLE", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId, null),
      { status: HTTP_STATUS.TEMPORARILY_UNAVAILABLE }
    );
  }
}
