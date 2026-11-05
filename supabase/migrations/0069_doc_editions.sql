-- Editions of a quotation or proposal: keep this one, try another, come back (0.128.0).
--
-- The document is one row per project and tier, and every keystroke saves over
-- it, so nothing could be kept to return to. An edition is a copy someone chose
-- to keep. It is called an edition because "version" on these tables is the
-- Standard or Premium tier, and a revision is the demo's history.
--
-- Editions are never changed or removed, only added: there is no update or delete
-- policy, so what is kept stays what it was. They go with the project.

create table if not exists fittbuilder_doc_editions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  doc_kind text not null check (doc_kind in ('quote', 'proposal')),
  version text not null,
  number int not null,
  label text not null default '' check (char_length(label) <= 120),
  payload jsonb not null,
  saved_by uuid references auth.users(id) on delete set null,
  -- Still reads right after the person has left the workspace.
  saved_by_name text not null default '',
  saved_at timestamptz not null default now(),
  unique (project_id, doc_kind, version, number)
);

-- The number, the person and the time are the database's to say, not the sender's.
-- Security definer to read the person's profile; the lock keeps two saves at the
-- same moment from taking one number.
create or replace function fittbuilder_doc_edition_stamp() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('doc-edition:' || new.project_id || ':' || new.doc_kind || ':' || new.version, 0));
  select coalesce(max(number), 0) + 1 into new.number
    from fittbuilder_doc_editions
   where project_id = new.project_id and doc_kind = new.doc_kind and version = new.version;
  new.saved_by := auth.uid();
  new.saved_by_name := coalesce(
    (select coalesce(nullif(name, ''), email) from fittbuilder_profiles where id = auth.uid()), '');
  new.saved_at := now();
  return new;
end;
$$;

drop trigger if exists fittbuilder_doc_edition_stamp on fittbuilder_doc_editions;
create trigger fittbuilder_doc_edition_stamp
  before insert on fittbuilder_doc_editions
  for each row execute function fittbuilder_doc_edition_stamp();

alter table fittbuilder_doc_editions enable row level security;

-- Same access as the document: whoever reads the project sees its editions,
-- whoever edits it may keep one. A company's approver reads and does not write.
drop policy if exists doc_editions_select on fittbuilder_doc_editions;
create policy doc_editions_select on fittbuilder_doc_editions
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

drop policy if exists doc_editions_insert on fittbuilder_doc_editions;
create policy doc_editions_insert on fittbuilder_doc_editions
  for insert with check (fittbuilder_can_edit_project(project_id, auth.uid()));

notify pgrst, 'reload schema';
