import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendProjectInviteEmail } from "@/lib/email";
import type { ShareRole } from "@/lib/types";

const schema = z.object({
  inviteId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); }
  catch { return Response.json({ error: "bad request" }, { status: 400 }); }

  // RLS (invites_select is owner-only) gates this — a non-owner gets no row.
  const { data: invite } = await supabase
    .from("fittbuilder_project_invites")
    .select("email, role, token, project_id")
    .eq("id", body.inviteId)
    .maybeSingle();
  if (!invite) return Response.json({ error: "forbidden" }, { status: 403 });

  const { data: project } = await supabase
    .from("fittbuilder_projects")
    .select("name")
    .eq("id", invite.project_id)
    .maybeSingle();

  // Derive sender and link server-side — never from the client.
  const senderName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "FITT Builder";
  const inviteLink = `${new URL(request.url).origin}/join/${invite.token}`;

  try {
    const r = await sendProjectInviteEmail({
      to: invite.email,
      projectName: project?.name ?? "FITT Builder",
      role: invite.role as ShareRole,
      inviteLink,
      senderName,
    });
    return Response.json(r);
  } catch (e) {
    console.error("[invite-email] failed:", e);
    return Response.json({ success: false }, { status: 200 }); // best-effort
  }
}
