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

  it("moves changed_at and changed_by only when the status or the reason changes, so a repeat leaves them be", () => {
    const changed = "when b.status is distinct from excluded.status or b.reason is distinct from excluded.reason";
    const flat = sql55.replace(/\s+/g, " ");
    expect(flat).toContain(`changed_at = case ${changed} then now() else b.changed_at end`);
    expect(flat).toContain(`changed_by = case ${changed} then excluded.changed_by else b.changed_by end`);
  });

  it("can't be steered by a temporary table of the caller's", () => {
    expect(sql55).toMatch(/set search_path = public, pg_temp/);
  });

  it("is callable by the service role only", () => {
    expect(sql55).toMatch(/revoke all on function fittbuilder_billing_set_status\([^)]*\) from public, anon, authenticated;/i);
    expect(sql55).toMatch(/grant execute on function fittbuilder_billing_set_status\([^)]*\) to service_role;/i);
  });

  it("tells the API to reload its schema", () => {
    expect(sql55).toMatch(/notify\s+pgrst,\s*'reload schema';/i);
  });
});

/**
 * 0070: FITT Billing can put an app in read-only (people sign in and read, nothing is saved), and each app's switch
 * says which version it runs. Like every migration it is re-run on every deploy, so it must apply again cleanly.
 */
const sql70 = readFileSync(join(__dirname, "../../supabase/migrations/0070_billing_read_only.sql"), "utf8");

describe("migration 0070", () => {
  it("lets a project's status and every status in its history be read_only, besides active and suspended", () => {
    for (const table of ["fittbuilder_project_billing", "fittbuilder_project_billing_events"]) {
      expect(sql70).toMatch(new RegExp(`alter table ${table}\\s+add constraint ${table}_status_check check \\(status in \\('active', 'suspended', 'read_only'\\)\\)`));
    }
  });

  it("drops only the two status checks it replaces, each if it exists, so it can run again", () => {
    const drops = [...sql70.matchAll(/drop constraint if exists (\w+)/g)].map((m) => m[1]);
    expect(drops).toEqual(["fittbuilder_project_billing_status_check", "fittbuilder_project_billing_events_status_check"]);
    expect(sql70).not.toMatch(/drop constraint (?!if exists)/);
  });

  it("stops if a status check without read_only is still there, rather than leave Billing's command to fail", () => {
    expect(sql70).toMatch(/raise exception/);
    expect(sql70).toMatch(/not like '%read_only%'/);
  });

  it("keeps the last switch version an app said it runs: 1 or more, or none when it never asked", () => {
    expect(sql70).toMatch(/add column if not exists switch_version integer check \(switch_version >= 1\)/);
  });

  it("tells the API to reload its schema", () => {
    expect(sql70).toMatch(/notify pgrst, 'reload schema';/);
  });
});
