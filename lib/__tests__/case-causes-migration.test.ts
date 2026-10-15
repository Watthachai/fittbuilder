import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CASE_AREAS, CASE_CAUSES } from "@/lib/cases";

/**
 * 0056 names why a case happened and where. The database and lib/cases.ts must
 * agree on every word, and `npm run db:migrate` re-runs the file, so it has to
 * land the same way twice.
 */
const sql = readFileSync(join(__dirname, "../../supabase/migrations/0056_case_causes.sql"), "utf8");
const flat = sql.replace(/\s+/g, " ");

const quoted = (list: readonly string[]) => list.map((v) => `'${v}'`).join(", ");

describe("migration 0056", () => {
  it("allows exactly the causes and areas lib/cases.ts knows, on cases and on messages", () => {
    expect(flat.split(`check (cause in (${quoted(CASE_CAUSES)}))`)).toHaveLength(3);
    expect(flat.split(`check (area in (${quoted(CASE_AREAS)}))`)).toHaveLength(3);
  });

  it("classifies every finished case it backfills with a known cause and area", () => {
    const rows = [...sql.matchAll(/\((\d+), '(\w+)', '(\w+)'\)/g)];
    expect(rows.length).toBeGreaterThan(0);
    for (const [, , cause, area] of rows) {
      expect(CASE_CAUSES).toContain(cause);
      expect(CASE_AREAS).toContain(area);
    }
    expect(flat).toContain("where c.number = v.number and c.cause is null;");
  });

  it("lets the team alone classify, and a classification alone be a message", () => {
    expect(flat).toContain(
      "check (author_kind = 'team' or (status_to is null and fixed_in is null and cause is null and area is null))"
    );
    expect(flat).toContain("or cause is not null or area is not null)");
  });

  it("carries a message's cause and area onto its case, keeping the old ones when it names none", () => {
    expect(flat).toContain("cause = coalesce(new.cause, cause),");
    expect(flat).toContain("area = coalesce(new.area, area),");
  });

  it("refuses to finish a case without a cause and an area, after the backfill", () => {
    const check =
      "check (status not in ('fixed', 'released', 'not_bug') or (cause is not null and area is not null))";
    expect(flat).toContain(check);
    expect(flat.indexOf(check)).toBeGreaterThan(flat.indexOf("as v(number, cause, area)"));
  });

  it("can run again: every add is guarded and every constraint dropped first", () => {
    expect(sql.match(/add column if not exists/g)).toHaveLength(4);
    for (const name of [
      "fittbuilder_case_messages_check",
      "fittbuilder_case_messages_check1",
      "fittbuilder_cases_cause_check",
    ]) {
      expect(flat).toContain(`drop constraint if exists ${name};`);
    }
    expect(flat).toContain("notify pgrst, 'reload schema';");
  });
});
