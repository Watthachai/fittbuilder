import { z } from "zod";
import { getAdminUser } from "@/lib/admin-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bodyToRow, skillTemplateBodySchema } from "@/lib/skills/admin-schema";

/** List ALL custom templates (drafts + published) for the admin console. */
export async function GET() {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fittbuilder_skill_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ templates: data ?? [] });
}

/** Create a new custom template (draft). */
export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: z.infer<typeof skillTemplateBodySchema>;
  try {
    body = skillTemplateBodySchema.parse(await request.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "คำขอไม่ถูกต้อง";
    return Response.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fittbuilder_skill_templates")
    .insert(bodyToRow(body, user.id))
    .select("*")
    .single();
  if (error) {
    const conflict = error.code === "23505"; // unique_violation on slug
    return Response.json(
      { error: conflict ? "slug นี้ถูกใช้แล้ว" : error.message },
      { status: conflict ? 409 : 500 }
    );
  }
  return Response.json({ template: data });
}
