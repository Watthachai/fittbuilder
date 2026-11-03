import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { CHANGELOG, isChangelogUnseen, latestVersion } from "@/lib/changelog";

test("every release picture is a file under public/whats-new", () => {
  for (const image of CHANGELOG.flatMap((entry) => entry.images ?? [])) {
    expect(image.src).toMatch(/^\/whats-new\/[\w.-]+\.(jpg|png)$/);
    expect(existsSync(join(process.cwd(), "public", image.src))).toBe(true);
    expect(image.alt.trim()).not.toBe("");
  }
});

test("latestVersion is the first entry's version", () => {
  expect(latestVersion()).toBe(CHANGELOG[0].version);
});
test("unseen when lastSeen differs or is null", () => {
  expect(isChangelogUnseen(null)).toBe(true);
  expect(isChangelogUnseen("0.0.0-old")).toBe(true);
  expect(isChangelogUnseen(CHANGELOG[0].version)).toBe(false);
});
