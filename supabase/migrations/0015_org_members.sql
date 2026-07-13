-- Org membership + invites: turn a workspace from the owner's private container
-- (0012) into a shared team space. An org MEMBER inherits access to EVERY project
-- in the org — the meaningful "shared workspace" behaviour — on top of the
-- existing per-project sharing (which is untouched).
--
-- Roles: 'owner' (the fittbuilder_orgs.owner_id, implicit — not a row here),
--        'admin' (manage members + edit workspace/DNA),
--        'member' (edit workspace/DNA + work on all org projects, but not manage people).

-- ---------- org members ----------
create table if not exists fittbuilder_org_members (
  org_id uuid not null references fittbuilder_orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists fittbuilder_org_members_user_idx on fittbuilder_org_members (user_id);

-- ---------- org invites (mirror of project invites) ----------
create table if not exists fittbuilder_org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references fittbuilder_orgs(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','member')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index if not exists fittbuilder_org_invites_email_idx on fittbuilder_org_invites (lower(email));

-- ---------- helper functions (SECURITY DEFINER → no RLS recursion) ----------
-- Neither function touches fittbuilder_projects, so both are safe to call from a
-- projects RLS policy (incl. INSERT ... RETURNING; see 0006).

-- is-member: the org owner OR anyone in org_members.
create or replace function fittbuilder_is_org_member(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_orgs o where o.id = oid and o.owner_id = uid)
        or exists(select 1 from fittbuilder_org_members m where m.org_id = oid and m.user_id = uid);
  $$;

-- can-admin: the org owner OR a member with role 'admin' (manage people/settings).
create or replace function fittbuilder_can_admin_org(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_orgs o where o.id = oid and o.owner_id = uid)
        or exists(select 1 from fittbuilder_org_members m
                  where m.org_id = oid and m.user_id = uid and m.role = 'admin');
  $$;

-- ---------- extend project access so org members inherit ALL org projects ----------
-- can_read_project / can_edit_project are used by members/chat/approvals/storage
-- policies (SELECT on OTHER tables), never by projects' own SELECT during
-- INSERT ... RETURNING — so the self-referential projects subquery here is safe
-- (the row is already visible in those contexts).

create or replace function fittbuilder_can_read_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m where m.project_id = pid and m.user_id = uid)
        or exists(select 1 from fittbuilder_projects p
                  where p.id = pid and p.org_id is not null
                    and fittbuilder_is_org_member(p.org_id, uid));
  $$;

create or replace function fittbuilder_can_edit_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m
                  where m.project_id = pid and m.user_id = uid and m.role = 'editor')
        or exists(select 1 from fittbuilder_projects p
                  where p.id = pid and p.org_id is not null
                    and fittbuilder_is_org_member(p.org_id, uid));
  $$;

-- The projects SELECT policy (rewritten in 0006 to dodge the RETURNING self-ref
-- bug) inlines its checks instead of calling can_read_project. Add the org path
-- the same way — against the CURRENT row's org_id column, so a freshly-inserted
-- row is still visible to RETURNING (fittbuilder_is_org_member never reads projects).
drop policy if exists projects_select on fittbuilder_projects;
create policy projects_select on fittbuilder_projects
  for select using (
    owner_id = auth.uid()
    or fittbuilder_is_member(id, auth.uid())
    or (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()))
  );

-- ---------- RLS: enable + policies ----------
alter table fittbuilder_org_members enable row level security;
alter table fittbuilder_org_invites enable row level security;

-- orgs: was owner-only (0012). Members may now read; admins may edit; owner
-- deletes. The direct `owner_id = auth.uid()` disjunct keeps INSERT ... RETURNING
-- working (createOrg) without hitting the self-referential owner check in the fn.
drop policy if exists orgs_select on fittbuilder_orgs;
create policy orgs_select on fittbuilder_orgs
  for select using (owner_id = auth.uid() or fittbuilder_is_org_member(id, auth.uid()));
drop policy if exists orgs_update on fittbuilder_orgs;
create policy orgs_update on fittbuilder_orgs
  for update using (fittbuilder_is_org_member(id, auth.uid()));
-- orgs_insert / orgs_delete stay as defined in 0012 (owner-only).

-- org members
drop policy if exists org_members_select on fittbuilder_org_members;
create policy org_members_select on fittbuilder_org_members
  for select using (fittbuilder_is_org_member(org_id, auth.uid()));
drop policy if exists org_members_insert on fittbuilder_org_members;
create policy org_members_insert on fittbuilder_org_members
  for insert with check (fittbuilder_can_admin_org(org_id, auth.uid()));
drop policy if exists org_members_update on fittbuilder_org_members;
create policy org_members_update on fittbuilder_org_members
  for update using (fittbuilder_can_admin_org(org_id, auth.uid()));
drop policy if exists org_members_delete on fittbuilder_org_members;
create policy org_members_delete on fittbuilder_org_members
  for delete using (fittbuilder_can_admin_org(org_id, auth.uid()) or user_id = auth.uid());

-- org invites (admin-only, like project invites)
drop policy if exists org_invites_select on fittbuilder_org_invites;
create policy org_invites_select on fittbuilder_org_invites
  for select using (fittbuilder_can_admin_org(org_id, auth.uid()));
drop policy if exists org_invites_insert on fittbuilder_org_invites;
create policy org_invites_insert on fittbuilder_org_invites
  for insert with check (fittbuilder_can_admin_org(org_id, auth.uid()));
drop policy if exists org_invites_update on fittbuilder_org_invites;
create policy org_invites_update on fittbuilder_org_invites
  for update using (fittbuilder_can_admin_org(org_id, auth.uid()));
drop policy if exists org_invites_delete on fittbuilder_org_invites;
create policy org_invites_delete on fittbuilder_org_invites
  for delete using (fittbuilder_can_admin_org(org_id, auth.uid()));

-- ---------- roster with emails (bypasses profiles_select_own; gated to members) ----------
-- The owner is an implicit 'owner' row (not stored in org_members). created_at
-- from the org row is the earliest, so the owner naturally sorts first.
create or replace function fittbuilder_org_members_detailed(oid uuid)
  returns table (user_id uuid, email text, name text, role text, created_at timestamptz)
  language plpgsql security definer set search_path = public as $$
begin
  if not fittbuilder_is_org_member(oid, auth.uid()) then
    return; -- not a member → no rows
  end if;
  return query
    select o.owner_id, p.email, p.name, 'owner'::text, o.created_at
      from fittbuilder_orgs o
      left join fittbuilder_profiles p on p.id = o.owner_id
      where o.id = oid
    union all
    select m.user_id, p.email, p.name, m.role, m.created_at
      from fittbuilder_org_members m
      left join fittbuilder_profiles p on p.id = m.user_id
      where m.org_id = oid
    order by created_at;
end;
$$;

-- ---------- accept org invites (SECURITY DEFINER — invitee bypasses RLS) ----------
create or replace function fittbuilder_accept_org_invites(uid uuid, mail text) returns void
  language sql security definer set search_path = public as $$
    insert into fittbuilder_org_members (org_id, user_id, role)
      select org_id, uid, role from fittbuilder_org_invites
      where status = 'pending' and lower(email) = lower(mail)
    on conflict (org_id, user_id) do nothing;
    update fittbuilder_org_invites set status = 'accepted'
      where status = 'pending' and lower(email) = lower(mail);
  $$;

notify pgrst, 'reload schema';
