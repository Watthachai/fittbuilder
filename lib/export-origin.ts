"use client";

/**
 * The origin exported code should carry.
 *
 * An export leaves the studio — a zip on someone's disk, a handoff built and
 * deployed by Code Runner — so its relay URLs must point at an origin that
 * will still answer from anywhere, which is the configured PUBLIC_SITE_URL.
 * The client cannot read that env var, so the server hands it over on
 * /api/version; the browser's own location.origin is only the fallback for a
 * dev machine with nothing configured, where an export is a test export.
 */

let cached: Promise<string> | null = null;

export function exportSiteUrl(): Promise<string> {
  cached ??= fetch("/api/version")
    .then((r) => r.json() as Promise<{ siteUrl?: string | null }>)
    .then((d) => d.siteUrl || location.origin)
    .catch(() => {
      cached = null; // a network blip must not pin the fallback forever
      return location.origin;
    });
  return cached;
}
