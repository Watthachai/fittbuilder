import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A tier switch has to be one write.
 *
 * It used to be four — park the outgoing version, delete the incoming one's row,
 * save the files, move the pointer — and a real project was found stopped
 * between them: `active_version` said 'standard' while `files` held the Premium
 * build, with the genuine Standard parked under the key 'standard'. The phase
 * bar named one product while the export would have shipped the other.
 *
 * fittbuilder_switch_version (migration 0033) does all of it in one transaction.
 * These guards fail if the client ever starts doing any of that work itself
 * again, which is what made the split state reachable.
 */
const versions = readFileSync("lib/versions.ts", "utf8");
const storage = readFileSync("lib/storage.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/0033_atomic_version_switch.sql",
  "utf8"
);

describe("version switch", () => {
  it("switches through the one function that owns the whole move", () => {
    const body = versions.slice(versions.indexOf("export async function switchVersion"));
    expect(body).toContain("fittbuilder_switch_version");
  });

  it("never writes the versions table from the client", () => {
    // upsert/delete on the table is exactly the half-applied step that stranded
    // a project between two versions.
    expect(versions).not.toMatch(/\.upsert\(/);
    expect(versions).not.toMatch(/\.delete\(/);
  });

  it("has no second writer of active_version", () => {
    // The column moves only inside the switch. Any other writer can move the
    // pointer without moving the files, which is the bug itself.
    expect(storage).not.toContain("active_version");
    expect(versions).not.toMatch(/update\([^)]*active_version/);
  });

  it("enforces the 0031 invariant in the database, not in a comment", () => {
    expect(migration).toContain("fittbuilder_versions_not_active");
    expect(migration).toMatch(/before insert or update on fittbuilder_project_versions/);
  });
});
