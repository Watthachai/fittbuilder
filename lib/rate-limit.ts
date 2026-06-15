/**
 * In-memory sliding-window rate limiter (PRD §8.2: 10 req/min per IP on
 * /api/generate). Per-instance state — swap for Upstash/Redis when deploying
 * across multiple serverless instances.
 */

const hits = new Map<string, number[]>();

const SWEEP_INTERVAL = 5 * 60 * 1000;
let lastSweep = Date.now();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the next request is allowed (when blocked). */
  retryAfter: number;
}

export function rateLimit(key: string, max = 10, windowMs = 60_000): RateLimitResult {
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

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}
