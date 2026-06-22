import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendProjectInviteEmail } from "@/lib/email";

const schema = z.object({
  to: z.string().email(),
  projectName: z.string().max(200),
  role: z.enum(["viewer", "editor"]),
  inviteLink: z.string().url(),
  senderName: z.string().max(200),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); }
  catch { return Response.json({ error: "bad request" }, { status: 400 }); }
  try {
    const r = await sendProjectInviteEmail(body);
    return Response.json(r);
  } catch (e) {
    console.error("[invite-email] failed:", e);
    return Response.json({ success: false }, { status: 200 }); // best-effort
  }
}
