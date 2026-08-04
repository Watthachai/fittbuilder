import { latestVersion } from "@/lib/changelog";

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
    { version: latestVersion() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
