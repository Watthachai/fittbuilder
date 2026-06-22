-- ---------- profiles ----------
create table fittbuilder_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  plan text not null default 'free',
  last_seen_changelog text,
  created_at timestamptz not null default now()
);

-- auto-create a profile row on signup
create function fittbuilder_handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into fittbuilder_profiles (id, email, name, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger fittbuilder_on_auth_user_created
  after insert on auth.users
  for each row execute function fittbuilder_handle_new_user();

-- ---------- projects ----------
create table fittbuilder_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled',
  files jsonb,
  phase text not null default 'define',
  approved_phases jsonb not null default '[]',
  history jsonb not null default '[]',
  messages jsonb not null default '[]',
  share_token text unique,
  share_role text check (share_role in ('viewer','editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on fittbuilder_projects (owner_id);

create function fittbuilder_touch_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger fittbuilder_projects_touch
  before update on fittbuilder_projects
  for each row execute function fittbuilder_touch_updated_at();

-- ---------- members ----------
create table fittbuilder_project_members (
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer','editor')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on fittbuilder_project_members (user_id);

-- ---------- invites ----------
create table fittbuilder_project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  email text not null,
  role text not null check (role in ('viewer','editor')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index on fittbuilder_project_invites (lower(email));

-- ---------- RLS helper functions (bypass RLS internally to avoid recursion) ----------
create function fittbuilder_can_read_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m where m.project_id = pid and m.user_id = uid);
  $$;

create function fittbuilder_can_edit_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m
                  where m.project_id = pid and m.user_id = uid and m.role = 'editor');
  $$;

create function fittbuilder_is_project_owner(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid);
  $$;

-- ---------- enable RLS ----------
alter table fittbuilder_profiles         enable row level security;
alter table fittbuilder_projects         enable row level security;
alter table fittbuilder_project_members  enable row level security;
alter table fittbuilder_project_invites  enable row level security;

-- profiles
create policy profiles_select_own on fittbuilder_profiles
  for select using (id = auth.uid());
create policy profiles_update_own on fittbuilder_profiles
  for update using (id = auth.uid());

-- projects
create policy projects_select on fittbuilder_projects
  for select using (fittbuilder_can_read_project(id, auth.uid()));
create policy projects_insert on fittbuilder_projects
  for insert with check (owner_id = auth.uid());
create policy projects_update on fittbuilder_projects
  for update using (fittbuilder_can_edit_project(id, auth.uid()));
create policy projects_delete on fittbuilder_projects
  for delete using (owner_id = auth.uid());

-- members
create policy members_select on fittbuilder_project_members
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));
create policy members_insert on fittbuilder_project_members
  for insert with check (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy members_update on fittbuilder_project_members
  for update using (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy members_delete on fittbuilder_project_members
  for delete using (fittbuilder_is_project_owner(project_id, auth.uid()) or user_id = auth.uid());

-- invites
create policy invites_select on fittbuilder_project_invites
  for select using (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy invites_insert on fittbuilder_project_invites
  for insert with check (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy invites_update on fittbuilder_project_invites
  for update using (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy invites_delete on fittbuilder_project_invites
  for delete using (fittbuilder_is_project_owner(project_id, auth.uid()));

-- ---------- invite acceptance RPC (SECURITY DEFINER — bypasses RLS so invitee can accept) ----------
create function fittbuilder_accept_invites(uid uuid, mail text) returns void
  language sql security definer set search_path = public as $$
    insert into fittbuilder_project_members (project_id, user_id, role)
      select project_id, uid, role from fittbuilder_project_invites
      where status = 'pending' and lower(email) = lower(mail)
    on conflict (project_id, user_id) do nothing;
    update fittbuilder_project_invites set status = 'accepted'
      where status = 'pending' and lower(email) = lower(mail);
  $$;

-- ---------- join-by-token RPC (SECURITY DEFINER — bypasses RLS so anyone with the token can join) ----------
create function fittbuilder_join_by_token(tok text, uid uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare pid uuid; r text;
begin
  select id, share_role into pid, r from fittbuilder_projects where share_token = tok;
  if pid is null or r is null then return null; end if;
  insert into fittbuilder_project_members (project_id, user_id, role)
    values (pid, uid, r) on conflict (project_id, user_id) do nothing;
  return pid;
end; $$;
