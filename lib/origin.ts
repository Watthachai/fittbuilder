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
  const configured = canonicalSiteUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  return null;
}

/**
 * The canonical public URL, or null — for telling the browser where EXPORTED
 * code should point (see /api/version, lib/export-origin).
 *
 * Unlike publicSiteUrl this never falls back to the request origin: on Cloud
 * Run the request host is the internal run.app address, so a request-origin
 * fallback would hand exports a run.app URL even when the user is on the custom
 * domain — and worse, do it silently whether or not NODE_ENV reads as
 * production. Returning null instead lets the client fall back to its OWN
 * location.origin, which on the custom domain is exactly the domain wanted.
 * PUBLIC_SITE_URL still wins when set, so a headless export gets the canonical
 * host too.
 */
export function canonicalSiteUrl(): string | null {
  const configured = process.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!configured) return null;
  // Typed by hand into a Cloud Build trigger; a bare host is the natural way to
  // type it, but without a scheme it bakes into <img src> as a RELATIVE url and
  // breaks silently — normalize rather than demand ceremony in a settings field.
  return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
}
