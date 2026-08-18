import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { versionTag, VERSION_KEYS } from "@/lib/versions";

/**
 * Two tiers of one project export as two different products.
 *
 * Same project_id, same name, genuinely different code. If the filename does not
 * say which is which, the browser saves the second one as "…(1).zip" and Code
 * Runner receives two builds it cannot tell apart — with the paid one able to
 * overwrite the free one's artifact.
 */
describe("export filenames carry the tier", () => {
  it("leaves the standard tier unmarked — it is the product", () => {
    // Every export that already exists has this name; changing it would rename
    // artifacts downstream for no reason.
    expect(versionTag("standard")).toBe("");
  });

  it("marks every other tier", () => {
    for (const key of VERSION_KEYS.filter((k) => k !== "standard")) {
      expect(versionTag(key)).toBe(`-${key}`);
    }
    expect(versionTag("premium")).toBe("-premium");
  });

  it("is applied by BOTH export paths, from the same helper", () => {
    // Two call sites that must agree: the zip the user downloads, and the
    // zip_name handed to Code Runner. A second naming rule is a second answer.
    const zip = readFileSync("lib/zip.ts", "utf8");
    const fittcore = readFileSync("lib/fittcore.ts", "utf8");
    expect(zip).toContain("versionTag(version)");
    expect(fittcore).toContain("versionTag(version)");
    // Including the preview, or "ดู body" would show a name the send does not use.
    expect(fittcore.match(/versionTag\(version\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("defaults to standard, so an un-migrated caller cannot silently mislabel", () => {
    const zip = readFileSync("lib/zip.ts", "utf8");
    expect(zip).toMatch(/version: VersionKey = "standard"/);
  });
});
