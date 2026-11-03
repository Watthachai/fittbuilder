import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendOrgInviteEmail } from "@/lib/email";
import { requestOrigin } from "@/lib/origin";
import type { OrgInviteRole } from "@/lib/types";

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

  // RLS (org_invites_select is admin-only) gates this — a non-admin gets no row.
  const { data: invite } = await supabase
    .from("fittbuilder_org_invites")
    .select("email, role, token, org_id")
    .eq("id", body.inviteId)
    .maybeSingle();
  if (!invite) return Response.json({ error: "forbidden" }, { status: 403 });

  const { data: org } = await supabase
    .from("fittbuilder_orgs")
    .select("name")
    .eq("id", invite.org_id)
    .maybeSingle();

  // Derive sender and link server-side — never from the client.
  const senderName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "FITT Builder";
  const inviteLink = `${requestOrigin(request)}/join/${invite.token}`;

  try {
    const r = await sendOrgInviteEmail({
      to: invite.email,
      orgName: org?.name ?? "FITT Builder",
      role: invite.role as OrgInviteRole,
      inviteLink,
      senderName,
    });
    return Response.json(r);
  } catch (e) {
    console.error("[org-invite-email] failed:", e);
    return Response.json({ success: false }, { status: 200 }); // best-effort
  }
}
