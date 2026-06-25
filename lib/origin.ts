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
