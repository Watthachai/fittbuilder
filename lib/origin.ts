/**
 * The public origin the user actually reached — for building redirects/links in
 * route handlers. Behind Cloud Run / a proxy, `request.url`'s host is the
 * internal bind address (0.0.0.0:3000), so prefer the forwarded host; only fall
 * back to the request URL's origin in local dev (no proxy headers).
 */
export function requestOrigin(request: Request): string {
  const fwdHost = request.headers.get("x-forwarded-host");
  const fwdProto = request.headers.get("x-forwarded-proto") ?? "https";
  return fwdHost ? `${fwdProto}://${fwdHost}` : new URL(request.url).origin;
}

/**
 * Our origin as it must appear INSIDE generated code.
 *
 * `requestOrigin` reads a header the caller controls, which is fine for a
 * redirect back to whoever asked — they only ever reach themselves. It is not
 * fine for a URL that gets written into a project's source and shipped: a
 * forged X-Forwarded-Host would bake somebody else's host into the demo. So
 * this prefers PUBLIC_SITE_URL and falls back to the request only in local
 * development, where there is no proxy to forge through.
 *
 * Returns null when neither is available, and callers must degrade rather than
 * guess — a proxy URL pointing at the wrong origin is worse than no proxy URL.
 */
export function publicSiteUrl(request: Request): string | null {
  const configured = process.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  return null;
}
