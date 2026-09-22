import { describe, expect, it } from "vitest";
import { MODULE_SOURCES } from "../modules/generated/sources";
import { collectSources } from "../../scripts/sync-module-sources.mjs";

/**
 * `demo/modules/**` is the source of truth: the product renders those files as
 * pages, and the WebContainer gets the same code as text. The text is generated,
 * so it can go stale — and stale is the worst outcome here, because the demo a
 * buyer clicks through and the project they are handed would silently differ.
 */
describe("the generated module sources", () => {
  it("match the files the product renders", () => {
    const onDisk = collectSources() as Record<string, string>;
    const stale = Object.keys(onDisk).filter((path) => MODULE_SOURCES[path] !== onDisk[path]);
    const removed = Object.keys(MODULE_SOURCES).filter((path) => !(path in onDisk));

    expect(
      [...stale, ...removed],
      "รัน `npm run modules:sync` เพื่ออัปเดต lib/modules/generated/sources.ts"
    ).toEqual([]);
  });
});
