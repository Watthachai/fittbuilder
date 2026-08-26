-- A quotation (and proposal) per version, not per project.
--
-- Premium is a separate tier with its own price — but both tiers shared one
-- quote row keyed by project_id alone, so editing the Premium price to 450,000
-- overwrote the Standard 350,000: same row, last write wins. The fix is a
-- composite key (project_id, version); each tier keeps its own document.
--
-- Existing rows have no version → they are the Standard quote (default), the
-- same rule the screenshot inventory uses for shots taken before versions.

-- ---- quotes ----
alter table fittbuilder_project_quotes
  add column if not exists version text not null default 'standard';

alter table fittbuilder_project_quotes
  drop constraint if exists fittbuilder_project_quotes_pkey;
alter table fittbuilder_project_quotes
  add primary key (project_id, version);

-- ---- proposals ----
alter table fittbuilder_project_proposals
  add column if not exists version text not null default 'standard';

alter table fittbuilder_project_proposals
  drop constraint if exists fittbuilder_project_proposals_pkey;
alter table fittbuilder_project_proposals
  add primary key (project_id, version);

-- RLS is unchanged: both tables' policies gate on the project via
-- fittbuilder_can_read/edit_project, and version does not affect who may see or
-- write a row. The cascade delete on project_id still covers every version.

notify pgrst, 'reload schema';
