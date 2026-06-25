import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/origin";

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const origin = requestOrigin(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/join/${token}`);

  const { data: pid } = await supabase.rpc("fittbuilder_join_by_token", {
    tok: token,
    uid: user.id,
  });
  if (!pid) return NextResponse.redirect(`${origin}/?joinError=1`);
  return NextResponse.redirect(`${origin}/project/${pid}`);
}
