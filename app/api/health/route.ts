import { createClient } from "@/lib/supabase/server";

/**
 * Is the product actually usable right now?
 *
 * We learned about the 2026-08-06 outage because a user said so. The app
 * itself was serving 200s the whole time — it was the database behind it that
 * had stopped answering, and nothing was watching that. So this endpoint
 * answers the only question worth alerting on: can a request reach the data?
 *
 * Point an uptime check at it (Cloud Monitoring, Better Stack, UptimeRobot —
 * anything that can alert on a non-200) and the next incident announces
 * itself.
 *
 * Deliberately unauthenticated and deliberately boring: it reads one row from
 * one small table, so it can never become the load it is meant to detect. It
 * reveals no data — just a latency number and up/down.
 */
export const dynamic = "force-dynamic";

/** Past this the database is answering, but not usefully. */
const SLOW_MS = 2_000;
const TIMEOUT_MS = 5_000;

export async function GET() {
  const started = Date.now();
  let db: "ok" | "slow" | "down" = "down";
  let detail: string | undefined;

  try {
    const supabase = await createClient();
    // Smallest possible round trip that still proves Postgres answered: a
    // HEAD count against a tiny table, capped so a hung database fails fast
    // instead of holding this request open too.
    const probe = supabase
      .from("fittbuilder_profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);
    const { error } = await Promise.race([
      probe,
      new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: `no answer in ${TIMEOUT_MS}ms` } }), TIMEOUT_MS)
      ),
    ]);
    if (error) detail = error.message;
    else db = Date.now() - started > SLOW_MS ? "slow" : "ok";
  } catch (e) {
    detail = e instanceof Error ? e.message : "unknown";
  }

  const latencyMs = Date.now() - started;
  // "slow" still alerts: by the time it is consistently slow, it is minutes
  // from being down, and that is the window worth waking someone for.
  const healthy = db === "ok";
  return Response.json(
    { status: healthy ? "ok" : "degraded", db, latencyMs, detail },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
