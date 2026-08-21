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
export interface PublicTarget {
  /** The resolved address to CONNECT to — not the hostname. */
  address: string;
  family: 4 | 6;
  hostname: string;
  port: number;
  protocol: "http:" | "https:";
  path: string;
}

/**
 * Resolve a URL to one validated public address, or null.
 *
 * Returns the ADDRESS, not just a verdict, because the caller must dial that
 * address rather than the hostname. Re-resolving at connect time is a DNS
 * rebinding hole: the name that answered 93.184.216.34 for this check can
 * answer 169.254.169.254 a moment later, and a check that only says "yes" hands
 * the caller a name to look up again.
 *
 * Every resolved address must be public, not merely the first: a name that
 * answers with both a public and a private address would otherwise pass and
 * then connect to whichever the OS preferred.
 */
export async function resolvePublicTarget(url: string): Promise<PublicTarget | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.username || parsed.password) return null;

  const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
  // Only the two ports assets are actually served on. Anything else is someone
  // using us to reach a service, not to load a picture.
  if (port !== 80 && port !== 443) return null;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const common = {
    hostname,
    port,
    protocol: parsed.protocol as "http:" | "https:",
    path: `${parsed.pathname}${parsed.search}`,
  };

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) return null;
    return { ...common, address: hostname, family: isIP(hostname) === 6 ? 6 : 4 };
  }
  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return null;
    if (addresses.some((a) => isPrivateAddress(a.address))) return null;
    const first = addresses[0];
    return { ...common, address: first.address, family: first.family === 6 ? 6 : 4 };
  } catch {
    return null;
  }
}

/** Whether this URL is safe for the server to fetch on the caller's behalf. */
export async function isPublicUrl(url: string): Promise<boolean> {
  return (await resolvePublicTarget(url)) !== null;
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

/**
 * Point the blocked URLs at our relay, in the files that mention them.
 *
 * Done here rather than asked of the model. A prompt rule would have to be
 * obeyed on every turn by something that cannot check whether a host sends the
 * header — and the last turn that tried to fix these images by reasoning about
 * markup stripped the one attribute that mattered. This runs on the finished
 * text, touches only URLs measured to be blocked, and leaves working hosts
 * alone: relaying an asset that already loads would put our bandwidth in the
 * path of something that never needed us.
 */
export function routeBlockedThroughProxy(
  files: ProjectFiles,
  blocked: BlockedAsset[],
  siteUrl: string
): { files: ProjectFiles; changed: string[] } {
  if (blocked.length === 0) return { files, changed: [] };
  const out: ProjectFiles = { ...files };
  const changed: string[] = [];
  // Longest first. One blocked URL is often a prefix of another (…/a.png and
  // …/a.png?v=2); replacing the short one first leaves the tail of the long one
  // stranded after the substitution, pointing at nothing.
  const targets = [...blocked].sort((a, b) => b.url.length - a.url.length);
  for (const [path, body] of Object.entries(files)) {
    let next = body;
    for (const { url } of targets) {
      next = next.split(url).join(`${siteUrl}/api/asset?url=${encodeURIComponent(url)}`);
    }
    if (next !== body) {
      out[path] = next;
      changed.push(path);
    }
  }
  return { files: out, changed };
}

/** What the reply says once the relay has been put in front of them. */
export function proxiedAssetsNote(blocked: BlockedAsset[]): string {
  if (blocked.length === 0) return "";
  const hosts = [...new Set(blocked.map((b) => new URL(b.url).hostname))];
  return [
    "",
    "",
    `📡 **ส่ง ${blocked.length} ไฟล์ผ่านตัวกลางให้แล้ว** — จาก ${hosts.join(", ")}`,
    "",
    "ต้นทางพวกนี้ไม่ส่ง CORS/CORP header มาให้ พรีวิวที่รันแบบ cross-origin isolated จึงเปิดไม่ได้เอง ระบบเลยดึงผ่านเซิร์ฟเวอร์เราแล้วส่งต่อพร้อม header ที่ขาด — รูปจะขึ้นตามปกติ ถ้าย้ายไฟล์ไปโฮสต์ที่ตั้ง CORS ไว้เองจะเร็วกว่าและไม่ต้องพึ่งตัวกลาง",
  ].join("\n");
}
