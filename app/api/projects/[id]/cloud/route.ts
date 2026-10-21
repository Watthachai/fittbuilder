import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { UUID } from "@/lib/deploy/guard";
import { needsTeam } from "@/lib/deploy/pending";
import { EMAIL, type DeployEnv, type DeployEventRow } from "@/lib/deploy/types";

/**
 * The export dialog's "ส่งแบบ local หรือ cloud": the project's choice, what Code
 * Runner's deploy side last did in each environment, and whether a first
 * administrator's password waits to be shown. Reads go through the person's own
 * session, so RLS decides who sees what; only "is a password waiting" is read
 * with the service role, and never the password itself.
 *
 * Export belongs to the team (ADMIN_EMAILS), so both methods answer only to them.
 */

const EVENT = "project_id, env, stage, build_no, digest, url, message, at";
const noStore = { "cache-control": "no-store" };

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  if (!isAdminEmail(user.email)) return Response.json({ error: "การส่งออกทำได้เฉพาะทีม FITT" }, { status: 403 });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "ไม่พบโปรเจกต์" }, { status: 404 });
  const project = await supabase.from("fittbuilder_projects").select("id").eq("id", id).maybeSingle();
  if (project.error) return Response.json({ error: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" }, { status: 500 });
  if (!project.data) return Response.json({ error: "ไม่พบโปรเจกต์" }, { status: 404 });

  const [delivery, events, waiting] = await Promise.all([
    supabase.from("fittbuilder_project_delivery").select("target, admin_email").eq("project_id", id).maybeSingle(),
    supabase.from("fittbuilder_project_deploy_events").select(EVENT).eq("project_id", id).order("at", { ascending: false }).limit(30),
    createAdminClient().from("fittbuilder_project_initial_passwords").select("env").eq("project_id", id).not("ciphertext", "is", null),
  ]);
  if (delivery.error || events.error || waiting.error) return Response.json({ error: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" }, { status: 500 });

  const rows = ((events.data ?? []) as DeployEventRow[]).sort((a, b) => b.at.localeCompare(a.at));
  const newest = (env: DeployEnv) => rows.find((e) => e.env === env) ?? null;
  const waitingEnvs = new Set(((waiting.data ?? []) as { env: string }[]).map((w) => w.env));
  return Response.json(
    {
      target: delivery.data?.target ?? "local",
      admin_email: delivery.data?.admin_email ?? "",
      events: { uat: newest("uat"), production: newest("production") },
      needs_team: needsTeam(rows),
      password_waiting: { uat: waitingEnvs.has("uat"), production: waitingEnvs.has("production") },
    },
    { headers: noStore },
  );
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  if (!isAdminEmail(user.email)) return Response.json({ error: "การส่งออกทำได้เฉพาะทีม FITT" }, { status: 403 });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "ไม่พบโปรเจกต์" }, { status: 404 });
  let body: { target?: unknown; admin_email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "เนื้อหาคำขอไม่ถูกต้อง" }, { status: 400 });
  }
  if (body.target !== "local" && body.target !== "cloud") return Response.json({ error: "เลือกได้แค่ local หรือ cloud" }, { status: 400 });
  const email = typeof body.admin_email === "string" ? body.admin_email.trim().toLowerCase() : "";
  if (email && (email.length > 254 || !EMAIL.test(email))) return Response.json({ error: "อีเมลผู้ดูแลคนแรกไม่ถูกต้อง" }, { status: 400 });
  if (body.target === "cloud" && !email) return Response.json({ error: "ส่งแบบ cloud ต้องมีอีเมลผู้ดูแลคนแรก" }, { status: 400 });

  // RLS decides: only someone who can edit the project may insert or update its row.
  const saved = await supabase
    .from("fittbuilder_project_delivery")
    .upsert({ project_id: id, target: body.target, admin_email: email, updated_by: user.id, updated_at: new Date().toISOString() })
    .select("project_id");
  if (saved.error?.code === "42501" || (!saved.error && (saved.data ?? []).length === 0)) {
    return Response.json({ error: "ไม่มีสิทธิ์แก้โปรเจกต์นี้" }, { status: 403 });
  }
  if (saved.error) return Response.json({ error: "บันทึกไม่สำเร็จ ลองใหม่ได้" }, { status: 500 });
  return Response.json({ target: body.target, admin_email: email }, { headers: noStore });
}

