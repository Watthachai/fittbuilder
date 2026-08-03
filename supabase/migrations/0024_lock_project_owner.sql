-- Ownership must never move on an UPDATE.
--
-- projects_update only had a USING clause, so an editor (or any org member —
-- fittbuilder_can_edit_project grants the whole workspace) could write ANY value
-- into owner_id. The client did exactly that: saveProject sent owner_id =
-- auth.uid() on every autosave, so the moment a shared collaborator opened the
-- project and anything saved, the row's owner became THEM. The real owner then
-- saw their own project listed under "แชร์กับฉัน" and lost delete rights
-- (projects_delete is owner-only).
--
-- The client no longer sends the column, but the DB is where the invariant
-- belongs: a stale browser tab still running the old bundle must not be able to
-- steal a project.

-- Pin the column instead of raising: an old tab's autosave then still saves the
-- user's actual work (files/messages) correctly rather than erroring out and
-- losing it. Ownership transfer is not a feature we offer, so there is nothing
-- legitimate to break here.
create or replace function fittbuilder_projects_pin_owner() returns trigger
  language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then
    new.owner_id := old.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists fittbuilder_projects_pin_owner on fittbuilder_projects;
create trigger fittbuilder_projects_pin_owner
  before update on fittbuilder_projects
  for each row execute function fittbuilder_projects_pin_owner();

-- An UPDATE also needs WITH CHECK: USING alone decides which rows may be
-- targeted, not what the row may become.
drop policy if exists projects_update on fittbuilder_projects;
create policy projects_update on fittbuilder_projects
  for update using (fittbuilder_can_edit_project(id, auth.uid()))
  with check (fittbuilder_can_edit_project(id, auth.uid()));

notify pgrst, 'reload schema';
