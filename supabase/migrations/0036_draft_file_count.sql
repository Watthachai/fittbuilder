-- The projects list can say "still working" without reading the work.
--
-- A draft row already means a turn did not finish, and its `updated_at` is a
-- heartbeat (0035) — together they answer "is this project busy right now?" for
-- every tab and every teammate, not just the browser that started the turn.
-- What the list also wants to say is HOW MUCH is parked ("ค้างไว้ 12 ไฟล์"), and
-- that must not cost a read of `files`: the drafts table holds whole file maps,
-- and dragging one into a list render is the mistake that took the database
-- down on 2026-08-06.
--
-- So the count is maintained beside the map, the same way file_count is on
-- projects (0027) and history_count is (0032). A trigger rather than a
-- generated column because jsonb_object_keys() is not immutable.

alter table fittbuilder_project_drafts
  add column if not exists file_count integer not null default 0;

create or replace function fittbuilder_drafts_count_files() returns trigger
  language plpgsql as $$
begin
  new.file_count := case
    when new.files is null or jsonb_typeof(new.files) <> 'object' then 0
    else (select count(*)::int from jsonb_object_keys(new.files))
  end;
  return new;
end;
$$;

drop trigger if exists fittbuilder_drafts_file_count on fittbuilder_project_drafts;
create trigger fittbuilder_drafts_file_count
  before insert or update of files on fittbuilder_project_drafts
  for each row execute function fittbuilder_drafts_count_files();

update fittbuilder_project_drafts
   set file_count = case
     when files is null or jsonb_typeof(files) <> 'object' then 0
     else (select count(*)::int from jsonb_object_keys(files))
   end
 where file_count = 0;

notify pgrst, 'reload schema';
