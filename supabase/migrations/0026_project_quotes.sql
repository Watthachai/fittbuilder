-- The quotation a customer is actually sent, built on top of the screen
-- inventory.
--
-- One row per project, not a list: a project has ONE current quotation, and
-- revising it is editing it. Versioning a quote is a real need for a sales team
-- but not for a demo builder — when it becomes one, this table grows a
-- `version` column and loses the primary-key-on-project_id.
--
-- Why its own table rather than a file in `files`: every iteration turn ships
-- the whole file map to the model, so a quotation living there would be read,
-- rewritten and occasionally "improved" by codegen. Pricing the customer signs
-- against must be untouchable by the thing that writes the app.
--
-- `payload` is the whole document (header, line items, rate, VAT) as one jsonb.
-- It is edited as a unit by one editor at a time in a panel, so splitting it
-- into columns would buy nothing and cost a migration per field.

create table if not exists fittbuilder_project_quotes (
  project_id uuid primary key references fittbuilder_projects(id) on delete cascade,
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists fittbuilder_quotes_touch on fittbuilder_project_quotes;
create trigger fittbuilder_quotes_touch
  before update on fittbuilder_project_quotes
  for each row execute function fittbuilder_touch_updated_at();

alter table fittbuilder_project_quotes enable row level security;

-- Same access as the project: whoever can read it sees the quotation, whoever
-- can edit it writes one.
drop policy if exists quotes_select on fittbuilder_project_quotes;
create policy quotes_select on fittbuilder_project_quotes
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

drop policy if exists quotes_insert on fittbuilder_project_quotes;
create policy quotes_insert on fittbuilder_project_quotes
  for insert with check (fittbuilder_can_edit_project(project_id, auth.uid()));

-- UPDATE needs both: without WITH CHECK a writer could move the row to another
-- project id and price someone else's work.
drop policy if exists quotes_update on fittbuilder_project_quotes;
create policy quotes_update on fittbuilder_project_quotes
  for update using (fittbuilder_can_edit_project(project_id, auth.uid()))
  with check (fittbuilder_can_edit_project(project_id, auth.uid()));

notify pgrst, 'reload schema';
