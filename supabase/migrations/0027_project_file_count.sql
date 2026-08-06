-- Listing projects must not read project source.
--
-- The projects list rendered "12 ไฟล์" per row, and got that number by
-- selecting `files` — the entire source tree of every project the user can
-- see — and counting its keys in the browser. Combined with a studio that
-- re-read whole rows on every collaborator save and every tab focus, this took
-- the database down on 2026-08-06: 79 of 100 requests in a 25-minute window
-- timed out, all of them on fittbuilder_projects.
--
-- A maintained counter answers the same question from a 4-byte column. It is a
-- trigger rather than a generated column because jsonb_object_keys() is not
-- immutable, so Postgres will not accept it in GENERATED ALWAYS.

alter table fittbuilder_projects
  add column if not exists file_count integer not null default 0;

create or replace function fittbuilder_projects_count_files() returns trigger
  language plpgsql as $$
begin
  new.file_count := case
    when new.files is null or jsonb_typeof(new.files) <> 'object' then 0
    else (select count(*)::int from jsonb_object_keys(new.files))
  end;
  return new;
end;
$$;

drop trigger if exists fittbuilder_projects_file_count on fittbuilder_projects;
create trigger fittbuilder_projects_file_count
  before insert or update of files on fittbuilder_projects
  for each row execute function fittbuilder_projects_count_files();

-- Backfill existing rows. Rewrites every row once; the table is ~49 MB, which
-- is a few seconds, and it happens once.
update fittbuilder_projects
   set file_count = case
     when files is null or jsonb_typeof(files) <> 'object' then 0
     else (select count(*)::int from jsonb_object_keys(files))
   end
 where file_count = 0;

notify pgrst, 'reload schema';
