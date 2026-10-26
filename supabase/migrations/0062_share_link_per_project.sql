-- One share link per project (0.116.0).
--
-- A partner sends a customer one link, the customer asks for changes, the partner
-- makes them — and the customer should see them by reloading that same link.
-- Until now every press of "share" minted a new snapshot under a new token, so
-- each round of changes meant a new link to send (case #39).
--
-- The project's link is its newest snapshot. "Update" rewrites that snapshot in
-- place, so the URL stays and the content changes — but only when someone
-- presses update, never while the project is mid-edit: a half-done change (a
-- page that crashes, say) does not reach the customer on its own. Older links of
-- the same project keep working, frozen as they were.
--
-- The table still has no select or update policy (0043): besides the public read
-- by token, the two functions below are the only way in, and each checks the
-- caller against the project.

alter table fittbuilder_shared_demos
  add column if not exists updated_at timestamptz not null default now();
update fittbuilder_shared_demos set updated_at = created_at where updated_at <> created_at;

-- Which snapshot is "the link" decides what every editor hands out next, so
-- making one is now an editor's act. 0043 let anyone who could read the project
-- publish one — harmless while each link stood alone, but a viewer's snapshot,
-- with whatever files they sent, would now become the project's link the next
-- editor copies to a customer. The same goes for deleting one.
drop policy if exists shared_demos_insert on fittbuilder_shared_demos;
create policy shared_demos_insert on fittbuilder_shared_demos
  for insert to authenticated
  with check (fittbuilder_can_edit_project(project_id, auth.uid()) and created_by = auth.uid());

drop policy if exists shared_demos_delete on fittbuilder_shared_demos;
create policy shared_demos_delete on fittbuilder_shared_demos
  for delete to authenticated
  using (created_by = auth.uid() and fittbuilder_can_edit_project(project_id, auth.uid()));

-- The project's link, named in one place so the read and the update can never
-- pick different rows; the token breaks a tie between two snapshots made in one
-- transaction (same now()). Internal: callers go through the two below.
create or replace function fittbuilder_project_share_token(pid uuid)
  returns text
  language sql stable security definer set search_path = public, pg_temp
as $$
  select token from fittbuilder_shared_demos
  where project_id = pid
  order by created_at desc, token desc
  limit 1
$$;

-- The project's link and when its content was last set, for anyone who can read
-- the project; no row when it has none yet.
create or replace function fittbuilder_project_share(pid uuid)
  returns table (token text, updated_at timestamptz)
  language sql stable security definer set search_path = public, pg_temp
as $$
  select s.token, s.updated_at
  from fittbuilder_shared_demos s
  where fittbuilder_can_read_project(pid, auth.uid())
    and s.project_id = pid
    and s.token = fittbuilder_project_share_token(pid)
$$;

-- Put this version on the project's link. Someone who can edit the project only:
-- it changes what every holder of the link sees. Returns the token, or null when
-- the project has no link yet.
create or replace function fittbuilder_update_project_share(pid uuid, share_name text, share_files jsonb)
  returns text
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  updated text;
begin
  if not fittbuilder_can_edit_project(pid, auth.uid()) then
    raise exception 'not allowed to update this project''s share link' using errcode = '42501';
  end if;
  update fittbuilder_shared_demos s
     set name = share_name, files = share_files, updated_at = now()
   where s.project_id = pid
     and s.token = fittbuilder_project_share_token(pid)
  returning s.token into updated;
  return updated;
end
$$;

revoke all on function fittbuilder_project_share_token(uuid) from public, anon, authenticated;
revoke all on function fittbuilder_project_share(uuid) from public, anon;
revoke all on function fittbuilder_update_project_share(uuid, text, jsonb) from public, anon;
grant execute on function fittbuilder_project_share(uuid) to authenticated;
grant execute on function fittbuilder_update_project_share(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
