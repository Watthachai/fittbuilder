-- Domain skill template selected for a project (e.g. "erp"). Idempotent.
alter table fittbuilder_projects add column if not exists skill_id text;

-- Reload PostgREST schema cache so the new column is queryable immediately.
notify pgrst, 'reload schema';
