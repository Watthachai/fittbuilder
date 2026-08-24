-- The proposal that goes in front of the quotation: what was built, what it
-- does, and which problem each part of it answers.
--
-- Its own table rather than a column on the quotation, because the two are sent
-- separately as often as together — a customer who asks only for a price gets
-- the quotation alone, and a customer deciding whether to start gets this. They
-- also have different authors in practice: the quotation is priced, this is
-- argued.
--
-- Why not a file in `files`: same reason as 0026. Every iteration turn ships the
-- whole file map to the model, so a document living there would be read,
-- rewritten and occasionally "improved" by codegen. What a customer is told the
-- system does must be untouchable by the thing that writes the system.
--
-- One row per project, matching the quotation. Revising a proposal is editing
-- it; when versioning becomes a real need both tables grow a `version` column
-- together, not one at a time.
--
-- `payload` is the whole document as one jsonb — it is edited as a unit by one
-- editor at a time in a panel, so splitting it into columns would buy nothing
-- and cost a migration per field. Note that it deliberately holds NO figures:
-- days come from the quotation and money is never restated here, so two sheets
-- in one envelope cannot promise different numbers.

create table if not exists fittbuilder_project_proposals (
  project_id uuid primary key references fittbuilder_projects(id) on delete cascade,
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists fittbuilder_proposals_touch on fittbuilder_project_proposals;
create trigger fittbuilder_proposals_touch
  before update on fittbuilder_project_proposals
  for each row execute function fittbuilder_touch_updated_at();

alter table fittbuilder_project_proposals enable row level security;

-- Same access as the project: whoever can read it sees the proposal, whoever
-- can edit it writes one.
drop policy if exists proposals_select on fittbuilder_project_proposals;
create policy proposals_select on fittbuilder_project_proposals
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

drop policy if exists proposals_insert on fittbuilder_project_proposals;
create policy proposals_insert on fittbuilder_project_proposals
  for insert with check (fittbuilder_can_edit_project(project_id, auth.uid()));

-- UPDATE needs both: without WITH CHECK a writer could move the row to another
-- project id and rewrite what someone else is telling their customer.
drop policy if exists proposals_update on fittbuilder_project_proposals;
create policy proposals_update on fittbuilder_project_proposals
  for update using (fittbuilder_can_edit_project(project_id, auth.uid()))
  with check (fittbuilder_can_edit_project(project_id, auth.uid()));

notify pgrst, 'reload schema';
