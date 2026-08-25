import { latestVersion } from "@/lib/changelog";
import { canonicalSiteUrl } from "@/lib/origin";

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

export function GET() {
  return Response.json(
    // siteUrl: the canonical origin exports should bake into shipped code, or
    // null when unconfigured — the client then uses its own location.origin,
    // which on the custom domain is the right one (see lib/export-origin).
    { version: latestVersion(), siteUrl: canonicalSiteUrl() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
