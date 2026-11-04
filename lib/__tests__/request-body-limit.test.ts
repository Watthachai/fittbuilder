import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

/** Cloud Run refuses an HTTP/1 request body above 32 MiB with a 413 of its own. */
const CLOUD_RUN_MAX_BYTES = 32 * 1024 * 1024;

/** "32mb" → bytes, the way Next reads a SizeLimit string. */
function bytesOf(limit: string | number | undefined): number {
  if (typeof limit === "number") return limit;
  const m = /^(\d+)(b|kb|mb|gb)$/i.exec(limit ?? "");
  if (!m) return 10 * 1024 * 1024; // unset: Next's default
  const unit = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[m[2].toLowerCase() as "b" | "kb" | "mb" | "gb"];
  return Number(m[1]) * unit;
}

/**
 * Case #45: proxy.ts runs on every route, so Next buffers each request body for
 * it and, past the limit, keeps only the start — no error. A build turn sends
 * the project's files; PalmFlow AI's reached 10,507,276 bytes, past the 10MB
 * default, and every turn after that arrived as cut-off JSON and was refused as
 * "คำขอไม่ถูกต้อง". Whatever Cloud Run lets through must reach the route whole.
 */
describe("request bodies through the proxy", () => {
  it("buffers everything Cloud Run accepts", () => {
    expect(bytesOf(nextConfig.experimental?.proxyClientMaxBodySize)).toBeGreaterThanOrEqual(CLOUD_RUN_MAX_BYTES);
  });

  it("would have kept PalmFlow AI's files whole", () => {
    expect(bytesOf(nextConfig.experimental?.proxyClientMaxBodySize)).toBeGreaterThan(10_507_276);
  });
});
