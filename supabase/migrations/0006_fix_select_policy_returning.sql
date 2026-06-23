-- Fix: project creation failed with "new row violates row-level security policy".
--
-- INSERT ... RETURNING (PostgREST's .select() always emits RETURNING) applies the
-- SELECT policy to the freshly-inserted row. The old SELECT policy called
-- fittbuilder_can_read_project(), whose owner check is a SELF-REFERENTIAL subquery
-- (select 1 from fittbuilder_projects where id = pid and owner_id = uid). During
-- RETURNING that subquery cannot see the row being inserted (it isn't in the
-- function's snapshot yet), so it returned false and RETURNING was denied — even
-- though auth.uid() and the INSERT WITH CHECK were both correct.
--
-- Fix: check ownership against the CURRENT row's owner_id column directly (no
-- subquery → the new row is visible to RETURNING). Keep the membership check in a
-- SECURITY DEFINER function that queries the MEMBERS table only — no self-reference
-- on projects, so no recursion and no RETURNING-visibility problem.

create or replace function fittbuilder_is_member(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_project_members m
                  where m.project_id = pid and m.user_id = uid);
  $$;

drop policy if exists projects_select on fittbuilder_projects;
create policy projects_select on fittbuilder_projects
  for select using (owner_id = auth.uid() or fittbuilder_is_member(id, auth.uid()));

notify pgrst, 'reload schema';
