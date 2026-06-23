import { z } from "zod";
import { getAdminUser } from "@/lib/admin-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { skillTemplateUpdateSchema, updateToRow } from "@/lib/skills/admin-schema";
import type { Database } from "@/lib/db/types";

type TemplateUpdate = Database["public"]["Tables"]["fittbuilder_skill_templates"]["Update"];

/** Update a custom template (fields and/or publish status). */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  let body: z.infer<typeof skillTemplateUpdateSchema>;
  try {
    body = skillTemplateUpdateSchema.parse(await request.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "คำขอไม่ถูกต้อง";
    return Response.json({ error: msg }, { status: 400 });
  }

  const update = updateToRow(body);
  if (Object.keys(update).length === 0) {
    return Response.json({ error: "ไม่มีอะไรให้แก้" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fittbuilder_skill_templates")
    .update(update as unknown as TemplateUpdate)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ template: data });
}

/** Delete a custom template. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { error } = await admin.from("fittbuilder_skill_templates").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
