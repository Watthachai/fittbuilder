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

  it("lets a FITT Billing credential, and only it, name no workspace and no person", () => {
    expect(sql).toMatch(/alter table fittbuilder_integration_bindings alter column org_id drop not null;/i);
    const scope = /add constraint fittbuilder_integration_bindings_scope_check\s+check \(([\s\S]*?)\);/i.exec(sql)?.[1].replace(/\s+/g, " ");
    expect(scope).toBe("case when producer = 'FITT_BILLING' then org_id is null and user_id is null else org_id is not null end");
  });

  it("tells the API to reload its schema, like 0045 and 0053", () => {
    expect(sql).toMatch(/notify\s+pgrst,\s*'reload schema';/i);
  });
});

/**
 * 0055: a status command is one transaction — the state and its history row land
 * together or not at all — and only the service role may run it.
 */
const sql55 = readFileSync(join(__dirname, "../../supabase/migrations/0055_billing_set_status.sql"), "utf8");

describe("migration 0055", () => {
  it("sets the status and records the command in one function", () => {
    expect(sql55).toMatch(/create or replace function fittbuilder_billing_set_status\(/i);
    expect(sql55).toMatch(/insert into fittbuilder_project_billing_events/i);
    expect(sql55).toMatch(/on conflict \(project_id\) do update/i);
  });

  it("is callable by the service role only", () => {
    expect(sql55).toMatch(/revoke all on function fittbuilder_billing_set_status\([^)]*\) from public, anon, authenticated;/i);
    expect(sql55).toMatch(/grant execute on function fittbuilder_billing_set_status\([^)]*\) to service_role;/i);
  });

  it("tells the API to reload its schema", () => {
    expect(sql55).toMatch(/notify\s+pgrst,\s*'reload schema';/i);
  });
});
