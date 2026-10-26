import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";
import { isAdminEmail } from "@/lib/admin";

// /api/version is a build stamp and /api/health is an uptime probe — neither is
// user data, and both must answer when nobody is signed in. Gating the version
// meant a tab on the login screen could never be told a deploy had happened;
// gating health would mean the monitor reports "up" by reading a redirect.
//
// /partner and its form endpoint are public for the obvious reason: the people
// it is written for do not have an account yet. Redirecting them to /login is
// redirecting away the only visitors that page exists to reach.
//
// /marketplace and /erp are the same visit: browse the modules, open the running
// system on one, decide. Both are reached before anyone has an account. Gating it
// behind a FITT Builder account would put a sign-up in front of the one thing
// that is meant to answer "what am I buying?" before anyone signs up. It has its
// own sign-in and carries nothing but seeded demo data.
//
// /share is a demo a partner sends their customer, who has no account. The page
// reads one snapshot by its token (fittbuilder_shared_demo, granted to anon) and
// runs it in the visitor's browser — no AI, nothing else of the project.
const PUBLIC_PREFIXES = [
  "/login",
  "/share",
  "/erp",
  "/marketplace",
  "/auth",
  "/changelog",
  "/join",
  "/partner",
  "/api/version",
  "/api/health",
  "/api/partner-lead",
  // The relay is reached from inside the preview, which runs on
  // *.webcontainer-api.io and carries none of our cookies.
  "/api/asset",
  // Backend-to-backend integrations (FITT Voice). They carry a service
  // credential, not a session; each route checks it before anything else.
  "/v1/integrations",
  // A customer's deployed app asks whether it is suspended (FITT Billing phase 2).
  // It carries the project's license key, which the route checks.
  "/v1/service-status",
];

// Signed in is not enough for the rest: FITT Builder is for our team and our
// partners (migration 0061). Any other account may still open the page that
// tells it so, and the WebContainer handshake a preview opened in its own tab
// runs on.
const OPEN_TO_ANY_ACCOUNT = ["/waiting", "/webcontainer"];

const under = (prefixes: string[], pathname: string) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

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
  const isPublic = under(PUBLIC_PREFIXES, pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // The page they wanted rides along, so a shared link — a project opened
    // from FITT Voice — lands on that page after signing in, not on home.
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    // Carry over any auth cookies refreshed by getUser() — a bare redirect drops
    // them, desyncing browser/server and forcing a second login (Supabase SSR).
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  // The team (ADMIN_EMAILS) is answered here because the database does not know
  // that list; partners and FITT Voice users are asked of the database. The AI
  // routes sit behind this same check, so no other account can spend on them.
  if (user && !isPublic && !under(OPEN_TO_ANY_ACCOUNT, pathname) && !isAdminEmail(user.email)) {
    const { data: allowed, error } = await supabase.rpc("fittbuilder_has_access");
    if (error) throw new Error(`access check failed: ${error.message}`);
    if (!allowed) {
      const waiting = request.nextUrl.clone();
      waiting.pathname = "/waiting";
      waiting.search = "";
      const denied = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้ FITT Builder" }, { status: 403 })
        : NextResponse.redirect(waiting);
      response.cookies.getAll().forEach((c) => denied.cookies.set(c));
      return denied;
    }
  }
  return response;
}
