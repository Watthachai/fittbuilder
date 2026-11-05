import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { CHANGELOG, isChangelogUnseen, latestInGuide, latestVersion, type ChangelogEntry } from "@/lib/changelog";

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

test("the guide's latest updates skip a release that changed no section of it", () => {
  const release = (version: string, guide?: string): ChangelogEntry => ({
    version,
    date: "2026-11-05",
    title: version,
    items: [],
    guide,
  });
  const entries = [release("4.0.0", "a"), release("3.0.0"), release("2.0.0", "b"), release("1.0.0", "c")];

  expect(latestInGuide(2, entries).map((entry) => entry.version)).toEqual(["4.0.0", "2.0.0"]);
});
