import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/db/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) return NextResponse.redirect(`${origin}/login`);

  // Cookies must be written to the SAME response we return, or the Set-Cookie
  // headers never reach the browser and the session is lost (redirect loop).
  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const { error: rpcError } = await supabase.rpc("fittbuilder_accept_invites", {
      uid: user.id,
      mail: user.email,
    });
    if (rpcError) console.error("[auth/callback] invite-accept failed:", rpcError);
  }
  return response;
}
