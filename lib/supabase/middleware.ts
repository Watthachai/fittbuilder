import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";

// /api/version is a build stamp and /api/health is an uptime probe — neither is
// user data, and both must answer when nobody is signed in. Gating the version
// meant a tab on the login screen could never be told a deploy had happened;
// gating health would mean the monitor reports "up" by reading a redirect.
//
// /partner and its form endpoint are public for the obvious reason: the people
// it is written for do not have an account yet. Redirecting them to /login is
// redirecting away the only visitors that page exists to reach.
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/changelog",
  "/join",
  "/partner",
  "/api/version",
  "/api/health",
  "/api/partner-lead",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    // Carry over any auth cookies refreshed by getUser() — a bare redirect drops
    // them, desyncing browser/server and forcing a second login (Supabase SSR).
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}
