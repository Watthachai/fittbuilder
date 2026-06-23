import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Create a project from the SERVER (the cookie-based client sends the user's
// access token to PostgREST). If RLS still rejects it, we also report the
// auth.uid() PostgREST resolved for this request, to pinpoint token verification.
const bodySchema = z.object({
  name: z.string().max(120).optional(),
  phase: z.string().max(40).optional(),
  skillId: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .insert({
      name: body.name?.trim() || "Untitled",
      phase: body.phase ?? "define",
      skill_id: body.skillId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    // Diagnostic: what auth.uid() did PostgREST see for this request's token?
    const { data: pgAuthUid } = await supabase.rpc("fittbuilder_whoami");
    console.error("[api/projects] insert failed:", error.message, {
      getUserId: user.id,
      pgAuthUid,
    });
    return Response.json(
      { error: error.message, getUserId: user.id, pgAuthUid: pgAuthUid ?? null },
      { status: 400 }
    );
  }
  return Response.json(data);
}
