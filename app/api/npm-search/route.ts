import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 15;

export interface NpmHit {
  name: string;
  version: string;
  description: string;
  npmUrl?: string;
}

/** Search the public npm registry so the user can find a package to install. */
export async function GET(request: Request) {
  const limit = await rateLimit(`npm:${clientIp(request)}`);
  if (!limit.ok) {
    return Response.json(
      { error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });

  try {
    const res = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=12`,
      { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`registry ${res.status}`);
    const data = (await res.json()) as {
      objects?: { package: { name: string; version: string; description?: string; links?: { npm?: string } } }[];
    };
    const results: NpmHit[] = (data.objects ?? []).map((o) => ({
      name: o.package.name,
      version: o.package.version,
      description: o.package.description ?? "",
      npmUrl: o.package.links?.npm,
    }));
    return Response.json({ results });
  } catch (error) {
    console.error("[npm-search] failed:", error);
    return Response.json({ error: "ค้นหา npm ไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });
  }
}
