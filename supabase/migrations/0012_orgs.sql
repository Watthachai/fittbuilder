-- Organizations (workspaces) — a lightweight grouping layer above projects that
-- also carries the Org DNA. Per-project sharing/RLS is intentionally untouched:
-- an org is the OWNER's container, projects keep their own member access. The
-- Org DNA is read server-side (service role) when generating, so collaborators
-- benefit from it without needing direct read access to the org.
create table if not exists fittbuilder_orgs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'พื้นที่ของฉัน',
  -- Org DNA: the 4 building blocks + archetype + freeform notes; all optional,
  -- filled progressively. Shape lives in app code (lib/types), kept loose here.
  org_dna jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table fittbuilder_orgs enable row level security;

drop policy if exists orgs_select on fittbuilder_orgs;
create policy orgs_select on fittbuilder_orgs for select using (owner_id = auth.uid());
drop policy if exists orgs_insert on fittbuilder_orgs;
create policy orgs_insert on fittbuilder_orgs for insert with check (owner_id = auth.uid());
drop policy if exists orgs_update on fittbuilder_orgs;
create policy orgs_update on fittbuilder_orgs for update using (owner_id = auth.uid());
drop policy if exists orgs_delete on fittbuilder_orgs;
create policy orgs_delete on fittbuilder_orgs for delete using (owner_id = auth.uid());

-- Group projects under an org (nullable — a project can be orgless transiently).
alter table fittbuilder_projects
  add column if not exists org_id uuid references fittbuilder_orgs(id) on delete set null;
create index if not exists fittbuilder_projects_org_idx on fittbuilder_projects (org_id);

-- Backfill: one default workspace per existing project owner, then assign their
-- projects to it. (orgs is new/empty, so a plain insert of distinct owners.)
insert into fittbuilder_orgs (owner_id, name)
  select distinct owner_id, 'พื้นที่ของฉัน' from fittbuilder_projects;

update fittbuilder_projects p
  set org_id = o.id
  from fittbuilder_orgs o
  where o.owner_id = p.owner_id and p.org_id is null;

notify pgrst, 'reload schema';
