-- Two sellable versions of one demo: "ปกติ" and "Premium".
--
-- The studio switches between them in place — same project, same customer, same
-- quotation — and each exports its own zip so Code Runner builds two different
-- products. A tier SWITCH inside the app would instead ship the paid code in the
-- free customer's bundle (see the tier rule in lib/prompts.ts).
--
-- ── why a separate table ──────────────────────────────────────────────────────
-- The heaviest project row is already ~4.3 MB (files + 10 history snapshots) —
-- the row shape behind the 2026-08-06 outage. A second file map in that row
-- would make every project read carry both versions whether or not the reader
-- wants them. Here, only the version being switched TO is ever fetched.
--
-- Invariant: fittbuilder_projects.files is ALWAYS the active version. This table
-- holds only the INACTIVE ones, so each version exists exactly once and every
-- existing feature (export, runner, quotation, preview) keeps reading `files`
-- with no idea versions exist.

create table if not exists fittbuilder_project_versions (
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  -- 'standard' | 'premium' — kept as text so a third tier needs no migration.
  key text not null,
  files jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (project_id, key)
);

alter table fittbuilder_projects
  add column if not exists active_version text not null default 'standard';

alter table fittbuilder_project_versions enable row level security;

-- Same access as the project: whoever can read it sees the other version,
-- whoever can edit it may write one.
drop policy if exists project_versions_select on fittbuilder_project_versions;
create policy project_versions_select on fittbuilder_project_versions
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

drop policy if exists project_versions_insert on fittbuilder_project_versions;
create policy project_versions_insert on fittbuilder_project_versions
  for insert with check (fittbuilder_can_edit_project(project_id, auth.uid()));

-- UPDATE needs both halves: without WITH CHECK a writer could move the row to
-- another project and overwrite someone else's version.
drop policy if exists project_versions_update on fittbuilder_project_versions;
create policy project_versions_update on fittbuilder_project_versions
  for update using (fittbuilder_can_edit_project(project_id, auth.uid()))
  with check (fittbuilder_can_edit_project(project_id, auth.uid()));

drop policy if exists project_versions_delete on fittbuilder_project_versions;
create policy project_versions_delete on fittbuilder_project_versions
  for delete using (fittbuilder_can_edit_project(project_id, auth.uid()));

notify pgrst, 'reload schema';
