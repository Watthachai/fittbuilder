import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * What a project read costs.
 *
 * Measured on the shared database: the projects table is 56 MB, of which 31 MB
 * is the `history` column — ten copies of the source tree per row. On the
 * heaviest project that is 3,116 kB of history behind 361 kB of actual files,
 * and the studio selected it on every open and wrote it back on every save.
 * The upsert averaged 200 ms (max 517 ms) while every other query in
 * pg_stat_statements was under 1 ms.
 *
 * The stack now lives in the database (migration 0032). These guards fail the
 * moment a column that heavy is put back in the round trip.
 */
const storage = readFileSync("lib/storage.ts", "utf8");
const mapper = readFileSync("lib/db/project-mapper.ts", "utf8");

/** The one SELECT that reads a whole project. */
const SELECT = /^const SELECT = "(.+)";$/m.exec(storage)?.[1] ?? "";

describe("project row payload", () => {
  it("has a readable SELECT to check", () => {
    expect(SELECT).not.toBe("");
  });

  it("never selects the undo stack — history_count answers what the UI asks", () => {
    const columns = SELECT.split(",").map((c) => c.trim());
    expect(columns).not.toContain("history");
    expect(columns).toContain("history_count");
  });

  it("never selects a column the studio does not read", () => {
    // `*` is the failure mode this guards: it would silently pull `history`
    // back in the day someone adds a column.
    expect(SELECT).not.toContain("*");
  });

  it("an ordinary save does not write the undo stack", () => {
    const body = mapper.slice(mapper.indexOf("export function projectToRow"));
    expect(body).not.toMatch(/^\s+history:/m);
  });
});
