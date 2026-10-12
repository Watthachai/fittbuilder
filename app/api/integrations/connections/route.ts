import { createClient } from "@/lib/supabase/server";
import { connectionsOf, revokeConnection } from "@/lib/fittvoice/connection-store";

/**
 * The signed-in person's own FITT Voice connections into one workspace, and
 * revoking one of them. Only ever their own: the person comes from the
 * session, and revokeConnection matches on it.
 */

async function viewerId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET(request: Request) {
  const userId = await viewerId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  const orgId = new URL(request.url).searchParams.get("org");
  if (!orgId) return Response.json({ error: "ต้องระบุ org" }, { status: 400 });
  return Response.json({ connections: await connectionsOf(userId, orgId) });
}

export async function DELETE(request: Request) {
  const userId = await viewerId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "ต้องระบุ id" }, { status: 400 });
  if (!(await revokeConnection(id, userId, new Date()))) {
    return Response.json({ error: "ไม่พบการเชื่อมนี้ หรือถูกถอนไปแล้ว" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
