import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ProjectFiles } from "./types";

/**
 * Which remote assets in a generated demo the preview will refuse to show.
 *
 * Narrower than it first looks, and the narrowing was expensive to learn.
 *
 * The preview is cross-origin isolated — WebContainer needs SharedArrayBuffer —
 * but with COEP set to `credentialless`, not `require-corp` (next.config.ts).
 * Under credentialless a cross-origin PICTURE loads with no opt-in from the host
 * at all, so a missing CORP or CORS header costs an <img> nothing. Measured on
 * the real page: the same Figma-hosted PNG loads at 3840x2160 with a plain
 * <img src>, and FAILS the moment crossOrigin="anonymous" is added, because that
 * turns it into a CORS request the host will not answer.
 *
 * FONTS are the genuine case. @font-face is fetched in CORS mode by
 * specification, whatever the markup says, so a font whose host sends no
 * Access-Control-Allow-Origin cannot load — and that is what this reports.
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

/** The media the relay is willing to carry — and, therefore, what counts as an asset. */
const ASSET_TYPE = /^(image|font|audio|video)\//i;
const ASSET_TYPE_EXTRA = new Set([
  "application/font-woff",
  "application/font-woff2",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/vnd.ms-fontobject",
  "application/octet-stream", // what several font CDNs still label .woff2 as
]);

/**
 * Is what came back actually an asset?
 *
 * The scan finds URLs; it cannot tell an image from a hyperlink or from an XML
 * namespace, and both of those appear in ordinary generated code. Asking the
 * response settles it: a footer link to a site answers with text/html, and
 * `xmlns="http://www.w3.org/2000/svg"` — a NAME that is never fetched — answers
 * with a web page. Without this, both were reported blocked and rewritten, which
 * turned a working link into a 415 and corrupted an SVG by replacing the
 * namespace that makes it an SVG.
 */
export function isAssetContentType(raw: string): boolean {
  const type = raw.split(";")[0].trim().toLowerCase();
  return ASSET_TYPE.test(type) || ASSET_TYPE_EXTRA.has(type);
}

/** Fonts, which the browser always fetches in CORS mode. */
const FONT_TYPE = /^font\//i;
const FONT_TYPE_EXTRA = new Set([
  "application/font-woff",
  "application/font-woff2",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/vnd.ms-fontobject",
]);

/**
 * Will the browser demand CORS for this, regardless of how it is written?
 *
 * Only fonts. An image is fetched no-cors unless the markup asks otherwise, and
 * under COEP credentialless that is enough. Reporting anything else as blocked
 * produced false alarms — and, worse, rewrote working URLs through a relay that
 * nothing needed.
 */
export function needsCorsToLoad(contentType: string): boolean {
  const type = contentType.split(";")[0].trim().toLowerCase();
  // application/octet-stream is what several font CDNs label .woff2; treat it as
  // a font only when the path says so, which the caller checks.
  return FONT_TYPE.test(type) || FONT_TYPE_EXTRA.has(type);
}

/** Does this response satisfy a CORS request? */
export function respondsToIsolation(headers: Headers): boolean {
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
        const contentType = res.headers.get("content-type") ?? "";
        // Not an asset → not our business, whatever its headers say.
        if (!isAssetContentType(contentType)) return null;
        // Only what the browser will insist on fetching with CORS can actually
        // be blocked here; everything else loads on the credentialless path.
        const fontByPath = /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url);
        if (!needsCorsToLoad(contentType) && !fontByPath) return null;
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
    `📡 **ส่ง ${blocked.length} ฟอนต์ผ่านตัวกลางให้แล้ว** — จาก ${hosts.join(", ")}`,
    "",
    "เบราว์เซอร์โหลดฟอนต์แบบ CORS เสมอตามสเปก ต้นทางที่ไม่ส่ง Access-Control-Allow-Origin จึงใช้ไม่ได้ไม่ว่าจะเขียนยังไง ระบบเลยดึงผ่านเซิร์ฟเวอร์เราแล้วส่งต่อพร้อม header ที่ขาด — ถ้าย้ายฟอนต์ไปโฮสต์ที่ตั้ง CORS ไว้เองจะเร็วกว่าและไม่ต้องพึ่งตัวกลาง (รูปภาพไม่ต้องใช้ตัวกลาง โหลดตรงได้อยู่แล้ว)",
  ].join("\n");
}
