/**
 * Rate limiter with two backends, chosen at runtime:
 *
 *  - **Upstash Redis** (distributed) when `UPSTASH_REDIS_REST_URL` +
 *    `UPSTASH_REDIS_REST_TOKEN` are set — correct across many serverless
 *    instances, which the in-memory limiter is NOT (each instance counts alone).
 *  - **In-memory sliding window** (per-instance) otherwise — the zero-config
 *    default for local dev and single-instance deploys.
 *
 * `rateLimit` is async so the same call sites work with either backend. To turn
 * on distributed limiting in production, create an Upstash Redis database and set
 * the two env vars — no code change.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the next request is allowed (when blocked). */
  retryAfter: number;
}

// ---------- in-memory fallback ----------
const hits = new Map<string, number[]>();
const SWEEP_INTERVAL = 5 * 60 * 1000;
let lastSweep = Date.now();

function rateLimitMemory(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (now - lastSweep > SWEEP_INTERVAL) {
    lastSweep = now;
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  const windowStart = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfter: 0 };
}

// ---------- Upstash (distributed) ----------
// Resolved once. `undefined` = not yet checked; `null` = not configured.
let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

// One Ratelimit instance per (max, windowMs) config — the limiter shape is fixed
// at construction, so distinct budgets (e.g. 10/min vs 20/min) need distinct instances.
const limiters = new Map<string, Ratelimit>();
function getLimiter(client: Redis, max: number, windowMs: number): Ratelimit {
  const cacheKey = `${max}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: "fittbuilder_rl",
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Sliding-window rate limit for `key`: at most `max` requests per `windowMs`.
 * Uses Upstash when configured, else the in-memory fallback. On any Upstash
 * error it fails OPEN (allows the request) so a Redis hiccup can't take the API
 * down — the limiter is a guardrail, not an auth gate.
 */
export async function rateLimit(
  key: string,
  max = 10,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const client = getRedis();
  if (!client) return rateLimitMemory(key, max, windowMs);
  try {
    const { success, reset } = await getLimiter(client, max, windowMs).limit(key);
    return {
      ok: success,
      retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (e) {
    console.error("[rate-limit] Upstash error (failing open):", e);
    return { ok: true, retryAfter: 0 };
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}
