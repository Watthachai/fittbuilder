import { afterEach, describe, expect, it, vi } from "vitest";
import { mailOrigin } from "@/lib/origin";

const from = (host: string, url = "http://0.0.0.0:3000/api/x") =>
  new Request(url, { headers: { "x-forwarded-host": host, "x-forwarded-proto": "https" } });

/** A link in our own email must not take a colleague to an address the caller typed into a header. */
describe("the origin for a link in an email", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is the address the caller is on, when that is ours", () => {
    expect(mailOrigin(from("fitt-builder.fittbsa.com"))).toBe("https://fitt-builder.fittbsa.com");
  });

  it("ignores a forged host and uses the configured site", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://fitt-builder.example.run.app");
    expect(mailOrigin(from("evil.example.com"))).toBe("https://fitt-builder.example.run.app");
    expect(mailOrigin(from("fittbsa.com.evil.example.com"))).toBe("https://fitt-builder.example.run.app");
  });

  it("uses the local address in development", () => {
    expect(mailOrigin(new Request("http://localhost:3100/api/x"))).toBe("http://localhost:3100");
  });
});
