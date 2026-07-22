-- Owner attribution for the "แชร์กับฉัน" list. profiles_select_own hides other
-- users' profile rows, so the drawer can't resolve who created a shared
-- project client-side. Security definer, gated inside: returns owners ONLY for
-- projects the caller is actually a member of (anon → auth.uid() null → none).
create or replace function fittbuilder_shared_project_owners()
  returns table (project_id uuid, name text, email text)
  language sql security definer set search_path = public as $$
    select p.id, pr.name, pr.email
      from fittbuilder_projects p
      left join fittbuilder_profiles pr on pr.id = p.owner_id
      where exists (
        select 1 from fittbuilder_project_members m
        where m.project_id = p.id and m.user_id = auth.uid()
      );
  $$;
