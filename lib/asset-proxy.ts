import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isAssetContentType, resolvePublicTarget } from "./asset-check";

/**
 * Fetch a remote asset on the preview's behalf, safely.
 *
 * The preview runs cross-origin isolated, so a host that sends neither
 * `Cross-Origin-Resource-Policy` nor a CORS header cannot be read from it —
 * and most places people host images (a Figma site, a design tool's CDN) send
 * neither. This relays those bytes from a server, which has no such rule, and
 * re-serves them with the headers the preview needs.
 *
 * That makes it a fetcher pointed at a URL an untrusted party chose, which is
 * the definition of SSRF, so every control here is load-bearing:
 *
 * - It DIALS THE VALIDATED IP, never the hostname. `fetch(url)` resolves again
 *   at connect time, and the name that passed the check a moment ago can answer
 *   with 169.254.169.254 on the next lookup. The hostname is carried in `Host`
 *   and in the TLS `servername`, so certificates still verify against the name.
 * - Redirects are followed BY HAND and every hop is validated again. A public
 *   URL that 302s to http://169.254.169.254/ defeats any check done once.
 * - Only image, font, audio and video types come back. Relaying HTML or
 *   JavaScript would turn this into an open redirect for content — our origin
 *   serving someone else's script.
 * - The body is capped and abandoned mid-stream past the limit, so a URL
 *   pointing at an endless response cannot hold memory.
 * - Nothing from the caller is forwarded upstream: no cookies, no auth, no
 *   referer. Nothing from upstream is forwarded back except the content type
 *   and length; the response headers are built here from nothing.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

export type ProxyFailure =
  | "blocked" // not a public http(s) target
  | "unreachable"
  | "too-many-redirects"
  | "upstream-error"
  | "type-not-allowed"
  | "too-large";

export interface ProxyResult {
  body: Buffer;
  contentType: string;
}

/** One hop. Returns either the bytes, a redirect location, or a failure. */
function hop(
  target: NonNullable<Awaited<ReturnType<typeof resolvePublicTarget>>>
): Promise<{ kind: "body"; body: Buffer; contentType: string } | { kind: "redirect"; location: string } | { kind: "fail"; reason: ProxyFailure }> {
  return new Promise((resolve) => {
    const send = target.protocol === "https:" ? httpsRequest : httpRequest;
    const req = send(
      {
        host: target.address,
        // TLS is verified against the NAME even though we dialled the address.
        servername: target.protocol === "https:" ? target.hostname : undefined,
        port: target.port,
        path: target.path,
        method: "GET",
        // A fixed, minimal set — nothing the caller sent travels upstream.
        headers: {
          Host: target.hostname,
          "User-Agent": "FITT-Builder-Asset-Proxy/1.0",
          Accept: "image/*,font/*,video/*,audio/*;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "identity",
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.destroy();
          resolve({ kind: "redirect", location: res.headers.location });
          return;
        }
        if (status !== 200) {
          res.destroy();
          resolve({ kind: "fail", reason: "upstream-error" });
          return;
        }
        const contentType = String(res.headers["content-type"] ?? "");
        if (!isAssetContentType(contentType)) {
          res.destroy();
          resolve({ kind: "fail", reason: "type-not-allowed" });
          return;
        }
        // Trust the declared length only to reject early; the running total below
        // is what actually enforces the cap.
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > MAX_BYTES) {
          res.destroy();
          resolve({ kind: "fail", reason: "too-large" });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            resolve({ kind: "fail", reason: "too-large" });
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ kind: "body", body: Buffer.concat(chunks), contentType }));
        res.on("error", () => resolve({ kind: "fail", reason: "unreachable" }));
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ kind: "fail", reason: "unreachable" });
    });
    req.on("error", () => resolve({ kind: "fail", reason: "unreachable" }));
    req.end();
  });
}

export async function fetchAsset(url: string): Promise<ProxyResult | { error: ProxyFailure }> {
  let next = url;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    // Re-validated on EVERY hop, not just the first.
    const target = await resolvePublicTarget(next);
    if (!target) return { error: "blocked" };

    const result = await hop(target);
    if (result.kind === "body") return { body: result.body, contentType: result.contentType };
    if (result.kind === "fail") return { error: result.reason };
    try {
      next = new URL(result.location, next).toString();
    } catch {
      return { error: "blocked" };
    }
  }
  return { error: "too-many-redirects" };
}
