import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 0057 gives a parked draft the turn it belongs to and that turn's answer, and
 * the usage ledger the moment a browser stopped listening. `npm run db:migrate`
 * re-runs every file, so each column is added only if it is missing.
 */
const sql = readFileSync(join(__dirname, "../../supabase/migrations/0057_turn_reattach.sql"), "utf8");
const flat = sql.replace(/\s+/g, " ");

describe("migration 0057", () => {
  it("adds the turn's id and answer to the draft, and the leaving time to the ledger", () => {
    expect(flat).toContain("alter table fittbuilder_project_drafts add column if not exists turn_id uuid, add column if not exists result jsonb;");
    expect(flat).toContain("alter table fittbuilder_ai_usage add column if not exists client_left_ms integer;");
  });

  it("can run again, and tells the API about the new columns", () => {
    expect(sql.match(/add column(?! if not exists)/g)).toBeNull();
    expect(flat).toContain("notify pgrst, 'reload schema';");
  });
});
