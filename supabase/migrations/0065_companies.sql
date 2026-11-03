-- Companies: approval belongs to the company that sends the quotation (0.119.0).
-- Design: docs/superpowers/specs/2026-11-03-company-approvers-design.md
--
-- Most workspaces are one customer each, made by whoever on the team sells to
-- them, with nobody else in them. An approver set on one workspace (0063) could
-- not reach the others, so the approver moves up a level: a company holds its
-- staff, a workspace belongs to the company of its owner, and the company's
-- approvers read every one of those workspaces and are offered in every one of
-- their "ส่งอนุมัติ" lists. The workspace approver role goes.

-- ---------- the company and its people ----------
create table if not exists fittbuilder_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Staff signing up with this domain join the company as members.
  email_domain text unique check (email_domain = lower(email_domain)),
  created_at timestamptz not null default now()
);

-- One company per person.
create table if not exists fittbuilder_company_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references fittbuilder_companies(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'approver', 'member')),
  created_at timestamptz not null default now()
);
create index if not exists fittbuilder_company_members_company_idx
  on fittbuilder_company_members (company_id);

-- A link the first signed-in account to open takes, once, within a week.
create table if not exists fittbuilder_company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references fittbuilder_companies(id) on delete cascade,
  role text not null check (role in ('admin', 'approver', 'member')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- ---------- predicates ----------
-- Neither reads fittbuilder_projects, so both are safe inside projects policies.

-- The person's role in a company, or null.
create or replace function fittbuilder_company_role(cid uuid, uid uuid) returns text
  language sql security definer stable set search_path = public as $$
    select m.role from fittbuilder_company_members m where m.company_id = cid and m.user_id = uid;
  $$;

-- Whether the person approves for the company the workspace's owner works in.
create or replace function fittbuilder_company_approves_org(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(
      select 1
        from fittbuilder_orgs o
        join fittbuilder_company_members owner_m on owner_m.user_id = o.owner_id
        join fittbuilder_company_members me on me.company_id = owner_m.company_id
       where o.id = oid and me.user_id = uid and me.role in ('admin', 'approver'));
  $$;

-- Reading a workspace: its owner, its members, and its company's approvers.
-- Only SELECT policies call this (checked live on 2026-11-03), so the
-- company's approvers gain reading and nothing else.
create or replace function fittbuilder_is_org_member(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_orgs o where o.id = oid and o.owner_id = uid)
        or exists(select 1 from fittbuilder_org_members m where m.org_id = oid and m.user_id = uid)
        or fittbuilder_company_approves_org(oid, uid);
  $$;

-- Approving in a workspace: its owner, an admin, or its company's approvers.
create or replace function fittbuilder_can_approve_in_org(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_orgs o where o.id = oid and o.owner_id = uid)
        or exists(select 1 from fittbuilder_org_members m
                  where m.org_id = oid and m.user_id = uid and m.role = 'admin')
        or fittbuilder_company_approves_org(oid, uid);
  $$;

-- A project goes into a workspace only by someone who works in it. Until now
-- any account could insert a project carrying any workspace id; readers who
-- write nothing (the company's approvers) now see those ids.
drop policy if exists projects_insert on fittbuilder_projects;
create policy projects_insert on fittbuilder_projects
  for insert with check (
    owner_id = auth.uid()
    and (org_id is null or fittbuilder_can_work_in_org(org_id, auth.uid()))
  );

-- ---------- the "ส่งอนุมัติ" list ----------
-- Gated on editing the project. One row per person, with the strongest reason.
create or replace function fittbuilder_project_approvers(pid uuid)
  returns table (user_id uuid, email text, name text, role text)
  language plpgsql security definer stable set search_path = public as $$
declare
  oid uuid;
begin
  if not fittbuilder_can_edit_project(pid, auth.uid()) then
    return;
  end if;
  select p.org_id into oid from fittbuilder_projects p where p.id = pid;
  if oid is null then
    return;
  end if;
  return query
    select distinct on (x.uid) x.uid, pr.email, pr.name, x.why
      from (
        select o.owner_id as uid, 'owner'::text as why, 1 as rank
          from fittbuilder_orgs o where o.id = oid
        union all
        select m.user_id, 'admin'::text, 2
          from fittbuilder_org_members m where m.org_id = oid and m.role = 'admin'
        union all
        select me.user_id, ('company_' || me.role)::text, 3
          from fittbuilder_orgs o
          join fittbuilder_company_members owner_m on owner_m.user_id = o.owner_id
          join fittbuilder_company_members me on me.company_id = owner_m.company_id
         where o.id = oid and me.role in ('admin', 'approver')
      ) x
      left join fittbuilder_profiles pr on pr.id = x.uid
     order by x.uid, x.rank;
end;
$$;

-- ---------- the workspace approver role goes ----------
-- Nobody holds it (checked 2026-11-03); the only rows are two revoked test links.
delete from fittbuilder_org_invites where role = 'approver';
alter table fittbuilder_org_members drop constraint if exists fittbuilder_org_members_role_check;
alter table fittbuilder_org_members
  add constraint fittbuilder_org_members_role_check check (role in ('admin', 'member'));
alter table fittbuilder_org_invites drop constraint if exists fittbuilder_org_invites_role_check;
alter table fittbuilder_org_invites
  add constraint fittbuilder_org_invites_role_check check (role in ('admin', 'member'));
-- Workspace invites are bound to an email again; links belong to companies.
alter table fittbuilder_org_invites alter column email set not null;
drop function if exists fittbuilder_accept_org_link(text);

-- ---------- using the app ----------
-- A company's people are let in (0061): a company is made by us, and only its
-- admins add people to it, so this lets in nobody we did not choose.
create or replace function fittbuilder_has_access() returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = auth.uid()
       and (
         exists (select 1 from fittbuilder_partner_emails pe where pe.email = lower(btrim(u.email)))
         or exists (
           select 1
             from fittbuilder_integration_bindings b
            where b.user_id = u.id and b.producer = 'FITT_VOICE' and b.revoked_at is null
         )
         or exists (select 1 from fittbuilder_company_members cm where cm.user_id = u.id)
       )
  )
$$;

-- ---------- joining by email domain ----------
create or replace function fittbuilder_handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into fittbuilder_profiles (id, email, name, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into fittbuilder_company_members (user_id, company_id)
    select new.id, c.id from fittbuilder_companies c
     where c.email_domain = lower(split_part(new.email, '@', 2))
  on conflict (user_id) do nothing;
  return new;
end; $$;

-- ---------- reading ----------
alter table fittbuilder_companies enable row level security;
alter table fittbuilder_company_members enable row level security;
alter table fittbuilder_company_invites enable row level security;
-- No write policies: the functions below are the only way in.
drop policy if exists companies_select on fittbuilder_companies;
create policy companies_select on fittbuilder_companies
  for select using (fittbuilder_company_role(id, auth.uid()) is not null);
drop policy if exists company_invites_select on fittbuilder_company_invites;
create policy company_invites_select on fittbuilder_company_invites
  for select using (fittbuilder_company_role(company_id, auth.uid()) = 'admin');
drop policy if exists company_members_select on fittbuilder_company_members;
create policy company_members_select on fittbuilder_company_members
  for select using (fittbuilder_company_role(company_id, auth.uid()) is not null);

-- My company's people, with names, for the company page.
create or replace function fittbuilder_company_members_detailed()
  returns table (user_id uuid, email text, name text, role text, created_at timestamptz)
  language sql security definer stable set search_path = public as $$
    select m.user_id, pr.email, pr.name, m.role, m.created_at
      from fittbuilder_company_members me
      join fittbuilder_company_members m on m.company_id = me.company_id
      left join fittbuilder_profiles pr on pr.id = m.user_id
     where me.user_id = auth.uid()
     order by m.created_at;
  $$;

-- ---------- what a company admin does ----------
-- The caller's company, when the caller is its admin; raises otherwise.
create or replace function fittbuilder_company_i_admin() returns uuid
  language plpgsql security definer stable set search_path = public as $$
declare
  cid uuid;
begin
  select m.company_id into cid from fittbuilder_company_members m
   where m.user_id = auth.uid() and m.role = 'admin';
  if cid is null then
    raise exception 'only a company admin can do this';
  end if;
  return cid;
end;
$$;

-- Change a person's role. The last admin stays an admin.
create or replace function fittbuilder_set_company_role(target uuid, new_role text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  cid uuid := fittbuilder_company_i_admin();
  cur text;
begin
  if new_role not in ('admin', 'approver', 'member') then
    raise exception 'unknown role';
  end if;
  select m.role into cur from fittbuilder_company_members m
   where m.user_id = target and m.company_id = cid for update;
  if cur is null then
    raise exception 'not in this company';
  end if;
  if cur = 'admin' and new_role <> 'admin'
     and (select count(*) from fittbuilder_company_members m
           where m.company_id = cid and m.role = 'admin') = 1 then
    raise exception 'the company needs an admin';
  end if;
  update fittbuilder_company_members set role = new_role where user_id = target;
end;
$$;

-- Take someone out of the company. Not oneself: an admin leaving would be the
-- last-admin question again, and nobody has asked for leaving yet.
create or replace function fittbuilder_remove_company_member(target uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  cid uuid := fittbuilder_company_i_admin();
begin
  if target = auth.uid() then
    raise exception 'cannot remove yourself';
  end if;
  delete from fittbuilder_company_members where user_id = target and company_id = cid;
end;
$$;

-- A one-use link joining the caller's company with a role.
create or replace function fittbuilder_create_company_link(r text) returns fittbuilder_company_invites
  language plpgsql security definer set search_path = public as $$
declare
  cid uuid := fittbuilder_company_i_admin();
  inv fittbuilder_company_invites;
begin
  if r not in ('admin', 'approver', 'member') then
    raise exception 'unknown role';
  end if;
  insert into fittbuilder_company_invites (company_id, role, token, created_by)
    values (cid, r, replace(gen_random_uuid()::text, '-', ''), auth.uid())
    returning * into inv;
  return inv;
end;
$$;

create or replace function fittbuilder_revoke_company_invite(iid uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  cid uuid := fittbuilder_company_i_admin();
begin
  update fittbuilder_company_invites set status = 'revoked'
   where id = iid and company_id = cid and status = 'pending';
end;
$$;

-- ---------- taking a link ----------
-- Someone new joins with the link's role. Someone already in the company moves
-- up to it (staff who joined by their email domain, made approvers), never down,
-- and a link that would not move them is not spent.
create or replace function fittbuilder_accept_company_link(tok text) returns text
  language plpgsql security definer set search_path = public as $$
declare
  inv fittbuilder_company_invites%rowtype;
  mine fittbuilder_company_members%rowtype;
  rank_of constant jsonb := '{"member": 1, "approver": 2, "admin": 3}';
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  select * into inv from fittbuilder_company_invites where token = tok for update;
  if inv.id is null then
    raise exception 'not a company link';
  end if;
  if inv.status <> 'pending' then
    raise exception 'link already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'link expired';
  end if;
  select * into mine from fittbuilder_company_members where user_id = auth.uid() for update;
  if mine.user_id is null then
    insert into fittbuilder_company_members (user_id, company_id, role)
      values (auth.uid(), inv.company_id, inv.role);
  elsif mine.company_id <> inv.company_id then
    raise exception 'in another company';
  elsif (rank_of ->> inv.role)::int <= (rank_of ->> mine.role)::int then
    raise exception 'already in this company';
  else
    update fittbuilder_company_members set role = inv.role where user_id = auth.uid();
  end if;
  update fittbuilder_company_invites set status = 'accepted' where id = inv.id;
  return inv.role;
end;
$$;

-- ---------- grants ----------
revoke execute on function fittbuilder_company_members_detailed() from public, anon;
revoke execute on function fittbuilder_company_i_admin() from public, anon;
revoke execute on function fittbuilder_set_company_role(uuid, text) from public, anon;
revoke execute on function fittbuilder_remove_company_member(uuid) from public, anon;
revoke execute on function fittbuilder_create_company_link(text) from public, anon;
revoke execute on function fittbuilder_revoke_company_invite(uuid) from public, anon;
revoke execute on function fittbuilder_accept_company_link(text) from public, anon;
grant execute on function fittbuilder_company_members_detailed() to authenticated;
grant execute on function fittbuilder_set_company_role(uuid, text) to authenticated;
grant execute on function fittbuilder_remove_company_member(uuid) to authenticated;
grant execute on function fittbuilder_create_company_link(text) to authenticated;
grant execute on function fittbuilder_revoke_company_invite(uuid) to authenticated;
grant execute on function fittbuilder_accept_company_link(text) to authenticated;

-- ---------- Digitalvalue ----------
-- Staff by their email domain; the owner of the team's shared workspace is its
-- first admin and adds the rest.
insert into fittbuilder_companies (name, email_domain)
  values ('Digitalvalue', 'digitalvalue.co.th')
  on conflict (email_domain) do nothing;
insert into fittbuilder_company_members (user_id, company_id)
  select u.id, c.id
    from auth.users u
    join fittbuilder_companies c on c.email_domain = lower(split_part(u.email, '@', 2))
  on conflict (user_id) do nothing;
insert into fittbuilder_company_members (user_id, company_id, role)
  select o.owner_id, c.id, 'admin'
    from fittbuilder_orgs o, fittbuilder_companies c
   where o.id = '088c8070-3ec3-46a9-b53f-52dcff35c23e' and c.email_domain = 'digitalvalue.co.th'
  on conflict (user_id) do update set role = 'admin';

notify pgrst, 'reload schema';
