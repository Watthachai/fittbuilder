import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ProjectFiles } from "./types";

/**
 * Which remote assets in a generated demo the preview will refuse to show.
 *
 * The preview runs cross-origin isolated — WebContainer needs SharedArrayBuffer,
 * which needs COOP/COEP — and under `require-corp` a cross-origin response is
 * dropped unless it opts in, either with `Cross-Origin-Resource-Policy` or by
 * answering a CORS request with `Access-Control-Allow-Origin`. A host that sends
 * neither cannot be displayed, whatever the markup says.
 *
 * This exists because that failure is invisible from inside the demo: the image
 * is simply absent, and both the model and the person looking at it reach for
 * markup fixes. One real session burned a turn adding `referrerPolicy`,
 * `loading` and `decoding` to every layer — and stripped the one attribute that
 * mattered — for assets whose host was never going to serve them here. Naming
 * the host and the missing header ends that guessing in one line.
 */

/** Hosts the scaffold itself loads; checking them would only ever say "fine". */
const OURS = /(^|\.)(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/i;

const URL_RE = /https?:\/\/[^\s"'`)<>\\]+/g;

/**
 * Every distinct remote asset URL the generated code points at.
 *
 * Deliberately a plain scan of the source rather than a parse: an asset can be
 * an `<img src>`, a `<source>`, a CSS `url()`, a `@font-face`, or a string in a
 * data module, and the question here — "will this host serve us?" — is the same
 * for all of them.
 */
export function externalAssetUrls(files: ProjectFiles | null): string[] {
  const seen = new Set<string>();
  for (const body of Object.values(files ?? {})) {
    for (const raw of body.match(URL_RE) ?? []) {
      // Trailing punctuation rides along when a URL ends a sentence or a quote.
      const url = raw.replace(/[.,;:]+$/, "");
      let host: string;
      try {
        host = new URL(url).hostname;
      } catch {
        continue;
      }
      if (OURS.test(host)) continue;
      seen.add(url);
    }
  }
  return [...seen];
}

/** Private, loopback, link-local and carrier ranges — nothing here is a public asset. */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a === "::1" || a === "::") return true;
    if (/^f[cd]/.test(a) || a.startsWith("fe8") || a.startsWith("fe9") || a.startsWith("fea") || a.startsWith("feb"))
      return true;
    // IPv4-mapped addresses hide a v4 address inside a v6 one, and come in two
    // spellings. The URL parser rewrites ::ffff:169.254.169.254 into hex as
    // ::ffff:a9fe:a9fe, so matching only the dotted form let the cloud metadata
    // endpoint straight through this gate.
    const dotted = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateAddress(dotted[1]);
    const hex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return false;
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local, incl. the 169.254.169.254 metadata endpoint
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * Whether this URL is safe for the server to fetch on the caller's behalf.
 *
 * The URLs come out of model output, which the user's prompt steers — so this
 * request is attacker-influenced and must not become a probe of anything behind
 * our network. Resolution happens HERE and the resolved address is what gets
 * judged: a public hostname pointed at 169.254.169.254 passes every check that
 * only reads the string.
 */
export async function isPublicUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !isPrivateAddress(host);
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

export interface BlockedAsset {
  url: string;
  /** Why the preview will drop it, in the user's language. */
  reason: string;
}

/** Does this response opt in to being read from a cross-origin-isolated page? */
export function respondsToIsolation(headers: Headers): boolean {
  const corp = headers.get("cross-origin-resource-policy");
  if (corp === "cross-origin") return true;
  return Boolean(headers.get("access-control-allow-origin"));
}

/**
 * HEAD each URL and report the ones the preview will drop.
 *
 * A host that cannot be reached at all is NOT reported: this is a warning about
 * headers, and a transient network failure dressed up as "your asset is broken"
 * would send the user chasing the wrong thing.
 */
export async function blockedAssets(urls: string[], limit = 12): Promise<BlockedAsset[]> {
  const out: BlockedAsset[] = [];
  const checked = await Promise.all(
    urls.slice(0, limit).map(async (url) => {
      if (!(await isPublicUrl(url))) return null;
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          headers: { Origin: "https://preview.local" },
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) return null;
        return respondsToIsolation(res.headers) ? null : url;
      } catch {
        return null;
      }
    })
  );
  for (const url of checked) {
    if (url) out.push({ url, reason: "ต้นทางไม่ส่ง CORS/CORP header" });
  }
  return out;
}

/** The line appended to the build's chat reply when assets will not display. */
export function blockedAssetsNote(blocked: BlockedAsset[]): string {
  if (blocked.length === 0) return "";
  const hosts = [...new Set(blocked.map((b) => new URL(b.url).hostname))];
  return [
    "",
    "",
    `⚠️ **มี ${blocked.length} ไฟล์ที่พรีวิวจะไม่แสดง** — จาก ${hosts.join(", ")}`,
    "",
    "พรีวิวรันแบบ cross-origin isolated (จำเป็นสำหรับ WebContainer) เบราว์เซอร์จึงทิ้งไฟล์จากเซิร์ฟเวอร์ที่ไม่ส่ง `Access-Control-Allow-Origin` หรือ `Cross-Origin-Resource-Policy` มาให้ — **แก้ที่โค้ดไม่ได้ ต้องแก้ที่ต้นทาง** ถ้าย้ายไฟล์ไปโฮสต์ที่ส่ง header ครบ (เช่น CloudFront ที่ตั้ง CORS ไว้) จะขึ้นทันทีโดยไม่ต้องแก้อะไรอีก",
  ].join("\n");
}
