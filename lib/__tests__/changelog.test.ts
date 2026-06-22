import { expect, test } from "vitest";
import { CHANGELOG, isChangelogUnseen, latestVersion } from "@/lib/changelog";

test("latestVersion is the first entry's version", () => {
  expect(latestVersion()).toBe(CHANGELOG[0].version);
});
test("unseen when lastSeen differs or is null", () => {
  expect(isChangelogUnseen(null)).toBe(true);
  expect(isChangelogUnseen("0.0.0-old")).toBe(true);
  expect(isChangelogUnseen(CHANGELOG[0].version)).toBe(false);
});
