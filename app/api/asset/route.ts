import { fetchAsset } from "@/lib/asset-proxy";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Relay one remote asset so the preview can display it.
 *
 * PUBLIC on purpose, and it has to be: the generated demo runs inside a
 * WebContainer on *.webcontainer-api.io, which carries none of our cookies, so
 * there is no session to check. Everything that keeps this from being an open
 * proxy therefore lives in what it will fetch and what it will hand back — see
 * lib/asset-proxy.ts for the fetch side; the response side is here.
 *
 * The three headers that make it useful are the three the upstream host was
 * missing: CORP so a cross-origin-isolated page may read it, ACAO so a CORS
 * request succeeds, and nosniff so the declared type is the type.
 */
export const runtime = "nodejs";

const FAILURE_STATUS: Record<string, number> = {
  blocked: 400,
  "type-not-allowed": 415,
  "too-large": 413,
  "too-many-redirects": 502,
  "upstream-error": 502,
  unreachable: 504,
};

export async function GET(request: Request) {
  const limit = await rateLimit(`asset:${clientIp(request)}`, 120);
  if (!limit.ok) return new Response("คำขอถี่เกินไป", { status: 429 });

  const url = new URL(request.url).searchParams.get("url");
  if (!url) return new Response("missing url", { status: 400 });

  const result = await fetchAsset(url);
  if ("error" in result) {
    return new Response(result.error, { status: FAILURE_STATUS[result.error] ?? 502 });
  }

  return new Response(new Uint8Array(result.body), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Length": String(result.body.length),
      // What the upstream host failed to say, and the whole point of the relay.
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
      // An SVG is a document that can carry script. It is a legitimate asset, so
      // it is relayed — but under a policy that lets it load nothing and run
      // nothing if anyone opens this URL directly instead of through an <img>.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      // Assets are immutable in practice; caching keeps a scrolling page from
      // asking us for the same picture on every frame.
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
