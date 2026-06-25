-- Resolve project members WITH their profile email/name in one call.
--
-- The old client did `project_members → fittbuilder_profiles(email,name)` as a
-- PostgREST embed, which fails two ways: there is no FK between those tables (so
-- the embed errors, PGRST200), and profiles_select_own would hide every other
-- member's profile anyway. This SECURITY DEFINER function bypasses both, but is
-- gated to people who can already read the project — so it only ever exposes the
-- emails of co-members on a shared project.
create or replace function fittbuilder_project_members_detailed(pid uuid)
  returns table (user_id uuid, email text, name text, role text, created_at timestamptz)
  language plpgsql security definer set search_path = public as $$
begin
  if not fittbuilder_can_read_project(pid, auth.uid()) then
    return; -- not a member → no rows
  end if;
  return query
    select m.user_id, p.email, p.name, m.role, m.created_at
    from fittbuilder_project_members m
    left join fittbuilder_profiles p on p.id = m.user_id
    where m.project_id = pid
    order by m.created_at;
end;
$$;

notify pgrst, 'reload schema';
