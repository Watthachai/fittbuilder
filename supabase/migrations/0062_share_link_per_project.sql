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
-- by token, these two functions are the only way in, and each checks the caller
-- against the project.

alter table fittbuilder_shared_demos
  add column if not exists updated_at timestamptz not null default now();
update fittbuilder_shared_demos set updated_at = created_at where updated_at <> created_at;

-- The project's link and when its content was last set, for anyone who can read
-- the project; no row when it has none yet.
create or replace function fittbuilder_project_share(pid uuid)
  returns table (token text, updated_at timestamptz)
  language sql stable security definer set search_path = public, pg_temp
as $$
  select s.token, s.updated_at
  from fittbuilder_shared_demos s
  where s.project_id = pid and fittbuilder_can_read_project(pid, auth.uid())
  order by s.created_at desc
  limit 1
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
   where s.token = (select token from fittbuilder_shared_demos
                    where project_id = pid order by created_at desc limit 1)
  returning s.token into updated;
  return updated;
end
$$;

revoke all on function fittbuilder_project_share(uuid) from public, anon;
revoke all on function fittbuilder_update_project_share(uuid, text, jsonb) from public, anon;
grant execute on function fittbuilder_project_share(uuid) to authenticated;
grant execute on function fittbuilder_update_project_share(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
