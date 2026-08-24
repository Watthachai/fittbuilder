import { latestVersion } from "@/lib/changelog";
import { publicSiteUrl } from "@/lib/origin";

/**
 * The version this server is running.
 *
 * A deploy replaces the server, but an open tab keeps the bundle it loaded —
 * so "Patiphan อัปเดตแล้ว" and a refresh that changes nothing are both true at
 * once. The client compares the version compiled into its own bundle against
 * this and offers a reload, instead of leaving people to discover hard-reload
 * on their own.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json(
    // siteUrl: the origin exports must bake into shipped code — the client
    // cannot read PUBLIC_SITE_URL itself, and its own location.origin is
    // whatever machine it happens to be on (see lib/asset-retarget.ts).
    { version: latestVersion(), siteUrl: publicSiteUrl(request) },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
