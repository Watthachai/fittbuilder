import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/deploy/guard";
import { open } from "@/lib/deploy/secret-box";
import { DEPLOY_ENVS, type DeployEnv } from "@/lib/deploy/types";

/**
 * Shows a cloud app's first administrator password once, to someone who can edit
 * the project, then forgets it. The update only succeeds while the box it read is
 * still there, so two clicks at once reveal it to one of them at most.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "ไม่พบโปรเจกต์" }, { status: 404 });
  let env: DeployEnv;
  try {
    env = ((await request.json()) as { env?: DeployEnv }).env as DeployEnv;
  } catch {
    return Response.json({ error: "เนื้อหาคำขอไม่ถูกต้อง" }, { status: 400 });
  }
  if (!DEPLOY_ENVS.includes(env)) return Response.json({ error: "env ต้องเป็น uat หรือ production" }, { status: 400 });

  const can = await supabase.rpc("fittbuilder_can_edit_project", { pid: id, uid: user.id });
  if (can.error) return Response.json({ error: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" }, { status: 500 });
  if (can.data !== true) return Response.json({ error: "ไม่มีสิทธิ์แก้โปรเจกต์นี้" }, { status: 403 });

  const gone = Response.json({ error: "รหัสผ่านถูกแสดงไปแล้ว หรือยังไม่มี" }, { status: 404, headers: { "cache-control": "no-store" } });
  const admin = createAdminClient();
  const row = await admin.from("fittbuilder_project_initial_passwords").select("ciphertext").eq("project_id", id).eq("env", env).maybeSingle();
  if (row.error) return Response.json({ error: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" }, { status: 500 });
  const sealed = row.data?.ciphertext;
  if (!sealed) return gone;
  // Open before clearing: a box that cannot be opened stays for the team to look at.
  let password: string;
  try {
    password = open(sealed);
  } catch (e) {
    console.error(`[deploy] initial password could not be opened for ${id}/${env}: ${(e as Error).message}`);
    return Response.json({ error: "เปิดรหัสผ่านไม่ได้ ให้ทีมดูใน Secret Manager" }, { status: 500 });
  }
  const cleared = await admin
    .from("fittbuilder_project_initial_passwords")
    .update({ ciphertext: null, revealed_at: new Date().toISOString(), revealed_by: user.id })
    .eq("project_id", id)
    .eq("env", env)
    .eq("ciphertext", sealed)
    .select("project_id");
  if (cleared.error) return Response.json({ error: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" }, { status: 500 });
  if ((cleared.data ?? []).length === 0) return gone;
  return Response.json({ password }, { headers: { "cache-control": "no-store" } });
}
