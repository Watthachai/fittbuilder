import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/db/types";
import { requestOrigin } from "@/lib/origin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Public origin behind the Cloud Run proxy (not the 0.0.0.0 bind host).
  const origin = requestOrigin(request);

  if (!code) return NextResponse.redirect(`${origin}/login`);

  // Cookies must be written to the SAME response we return, or the Set-Cookie
  // headers never reach the browser and the session is lost (redirect loop).
  const cookieStore = await cookies();
  // `next` rides through OAuth in a one-shot cookie (set by /login), NOT a query —
  // so the redirect URL matches Supabase's allow list exactly (a `?next=` query
  // would fail the match and fall back to the Site URL, sending every env to prod).
  // Falls back to a legacy `?next=` query, then "/".
  let rawNext = "";
  try {
    rawNext = decodeURIComponent(cookieStore.get("sb_next")?.value ?? "");
  } catch {
    rawNext = "";
  }
  if (!rawNext) rawNext = url.searchParams.get("next") ?? "";
  // Same-origin only (leading "/", not "//") — never an open redirect.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.set("sb_next", "", { path: "/", maxAge: 0 }); // one-shot — consume it
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
    // Auto-accept any pending invites (project + workspace) addressed to this
    // verified email, so a fresh signup lands already joined.
    const [{ error: rpcError }, { error: orgRpcError }] = await Promise.all([
      supabase.rpc("fittbuilder_accept_invites", { uid: user.id, mail: user.email }),
      supabase.rpc("fittbuilder_accept_org_invites", { uid: user.id, mail: user.email }),
    ]);
    if (rpcError) console.error("[auth/callback] invite-accept failed:", rpcError);
    if (orgRpcError) console.error("[auth/callback] org-invite-accept failed:", orgRpcError);
  }
  return response;
}
