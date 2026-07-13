-- In-app invite inbox: let an invitee SEE their own pending invites (project +
-- workspace) without needing the emailed link. invites_select RLS is owner/admin
-- only, so a plain query returns nothing to the invitee — this SECURITY DEFINER
-- function bypasses that, scoped strictly to the caller's OWN verified email.
create or replace function fittbuilder_my_invites()
  returns table (
    kind text,
    invite_id uuid,
    entity_id uuid,
    entity_name text,
    role text,
    created_at timestamptz
  )
  language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  select email into mail from fittbuilder_profiles where id = auth.uid();
  if mail is null then return; end if;
  return query
    select 'project'::text, i.id, i.project_id, p.name, i.role, i.created_at
      from fittbuilder_project_invites i
      join fittbuilder_projects p on p.id = i.project_id
      where i.status = 'pending' and lower(i.email) = lower(mail) and i.expires_at > now()
    union all
    select 'org'::text, i.id, i.org_id, o.name, i.role, i.created_at
      from fittbuilder_org_invites i
      join fittbuilder_orgs o on o.id = i.org_id
      where i.status = 'pending' and lower(i.email) = lower(mail) and i.expires_at > now()
    order by created_at desc;
end $$;

notify pgrst, 'reload schema';
