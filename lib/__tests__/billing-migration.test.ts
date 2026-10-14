import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 0054 is re-run by `npm run db:migrate` on every deploy, so what it drops and
 * whether the API sees its tables right away matter every time, not once.
 */
const sql = readFileSync(join(__dirname, "../../supabase/migrations/0054_fitt_billing.sql"), "utf8");

describe("migration 0054", () => {
  it("drops only the producer list check it replaces, never any other check that mentions producer", () => {
    expect(sql).not.toMatch(/ilike\s+'%producer%'/i);
    // Postgres stores the single-value IN of 0045 as `producer = 'FITT_VOICE'::text`
    // and a list as `producer = ANY (ARRAY[...])`; both start the same way.
    expect(sql).toContain("~* '^check \\(\\(producer = '");
  });

  it("tells the API to reload its schema, like 0045 and 0053", () => {
    expect(sql).toMatch(/notify\s+pgrst,\s*'reload schema';/i);
  });
});
