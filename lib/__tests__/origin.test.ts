import { afterEach, describe, expect, it } from "vitest";
import { publicSiteUrl } from "@/lib/origin";

/**
 * PUBLIC_SITE_URL is typed by hand into a Cloud Build trigger. Whatever gets
 * typed, the value that comes out of here must be usable as an absolute URL —
 * a scheme-less host baked into <img src> resolves RELATIVE to the preview
 * container and breaks every image silently.
 */
describe("publicSiteUrl", () => {
  const req = new Request("http://localhost:3000/api/version");
  const original = process.env.PUBLIC_SITE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.PUBLIC_SITE_URL;
    else process.env.PUBLIC_SITE_URL = original;
  });

  it("adds https:// when the trigger value is a bare host", () => {
    process.env.PUBLIC_SITE_URL = "fitt-builder.fittbsa.com";
    expect(publicSiteUrl(req)).toBe("https://fitt-builder.fittbsa.com");
  });

  it("keeps an explicit scheme as typed", () => {
    process.env.PUBLIC_SITE_URL = "https://fitt-builder.fittbsa.com";
    expect(publicSiteUrl(req)).toBe("https://fitt-builder.fittbsa.com");
    process.env.PUBLIC_SITE_URL = "http://172.168.1.222:3000";
    expect(publicSiteUrl(req)).toBe("http://172.168.1.222:3000");
  });

  it("strips trailing slashes so joins never double them", () => {
    process.env.PUBLIC_SITE_URL = "https://fitt-builder.fittbsa.com/";
    expect(publicSiteUrl(req)).toBe("https://fitt-builder.fittbsa.com");
  });

  it("falls back to the request origin outside production", () => {
    process.env.PUBLIC_SITE_URL = "";
    expect(publicSiteUrl(req)).toBe("http://localhost:3000");
  });
});
