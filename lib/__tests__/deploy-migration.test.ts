import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 0059 is re-run by `npm run db:migrate` on every deploy like 0054, so it must
 * rebuild the same checks and leave the one-time passwords to the service role.
 */
const sql = readFileSync(join(__dirname, "../../supabase/migrations/0059_code_runner_deploy.sql"), "utf8");
const flat = sql.replace(/\s+/g, " ");

describe("migration 0059", () => {
  it("adds CODE_RUNNER to the producers, keeping FITT Voice and FITT Billing", () => {
    expect(sql).toContain("~* '^check \\(\\(producer = '");
    expect(flat).toContain("check (producer in ('FITT_VOICE', 'FITT_BILLING', 'CODE_RUNNER'))");
  });

  it("lets a Code Runner credential, like Billing's, name no workspace and no person", () => {
    const scope = /add constraint fittbuilder_integration_bindings_scope_check\s+check \(([\s\S]*?)\);/i.exec(sql)?.[1].replace(/\s+/g, " ");
    expect(scope).toBe("case when producer in ('FITT_BILLING', 'CODE_RUNNER') then org_id is null and user_id is null else org_id is not null end");
  });

  it("keeps the delivery choice readable by readers and writable by editors of the project", () => {
    expect(flat).toContain("create table if not exists fittbuilder_project_delivery");
    expect(flat).toContain("check (target = 'local' or admin_email <> '')");
    expect(flat).toContain("for select using (fittbuilder_can_read_project(project_id, auth.uid()))");
    expect(flat).toContain("for insert with check (fittbuilder_can_edit_project(project_id, auth.uid()))");
    expect(flat).toContain("for update using (fittbuilder_can_edit_project(project_id, auth.uid())) with check (fittbuilder_can_edit_project(project_id, auth.uid()))");
  });

  it("shows deploy events to readers and lets nobody but the service role touch the passwords", () => {
    for (const t of ["fittbuilder_project_delivery", "fittbuilder_project_deploy_events", "fittbuilder_project_initial_passwords"]) {
      expect(flat).toContain(`alter table ${t} enable row level security`);
    }
    expect(flat).not.toMatch(/create policy \S+ on fittbuilder_project_initial_passwords/);
    expect(flat).not.toMatch(/create policy \S+ on fittbuilder_project_deploy_events for (insert|update|delete|all)/);
    expect(sql.match(/^drop policy if exists/gim)?.length).toBe(sql.match(/^create policy/gim)?.length);
  });

  it("tells the API to reload its schema", () => {
    expect(sql.trim().endsWith("notify pgrst, 'reload schema';")).toBe(true);
  });
});
