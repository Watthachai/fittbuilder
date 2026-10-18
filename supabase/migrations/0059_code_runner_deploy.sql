-- Code Runner's deploy side (CRN, running in GCP Cloud Build): a service credential
-- (producer CODE_RUNNER) that reads each project's delivery choice and reports its
-- deploy events, plus the tables behind "ส่งแบบ local หรือ cloud" in the export
-- dialog. See docs/integrations/code-runner-deploy.md. Re-run on every deploy.

-- Rebuild the producer check exactly as 0054 does: drop the check whose expression
-- compares `producer`, then name the new one.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'fittbuilder_integration_bindings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '^check \(\(producer = '
  loop
    execute format('alter table fittbuilder_integration_bindings drop constraint %I', c.conname);
  end loop;
end $$;
alter table fittbuilder_integration_bindings
  add constraint fittbuilder_integration_bindings_producer_check
  check (producer in ('FITT_VOICE', 'FITT_BILLING', 'CODE_RUNNER'));

-- Like Billing's, the Code Runner credential is a service's, for every project.
alter table fittbuilder_integration_bindings
  drop constraint if exists fittbuilder_integration_bindings_scope_check;
alter table fittbuilder_integration_bindings
  add constraint fittbuilder_integration_bindings_scope_check
  check (case when producer in ('FITT_BILLING', 'CODE_RUNNER') then org_id is null and user_id is null
              else org_id is not null end);

-- How a project is delivered. No row = local.
create table if not exists fittbuilder_project_delivery (
  project_id uuid primary key references fittbuilder_projects(id) on delete cascade,
  target text not null default 'local' check (target in ('local', 'cloud')),
  admin_email text not null default ''
    check (admin_email = '' or (length(admin_email) <= 254 and admin_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  check (target = 'local' or admin_email <> ''),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table fittbuilder_project_delivery enable row level security;
drop policy if exists project_delivery_select on fittbuilder_project_delivery;
create policy project_delivery_select on fittbuilder_project_delivery
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));
drop policy if exists project_delivery_insert on fittbuilder_project_delivery;
create policy project_delivery_insert on fittbuilder_project_delivery
  for insert with check (fittbuilder_can_edit_project(project_id, auth.uid()));
-- UPDATE needs both, so a writer cannot move the row to a project they cannot edit.
drop policy if exists project_delivery_update on fittbuilder_project_delivery;
create policy project_delivery_update on fittbuilder_project_delivery
  for update using (fittbuilder_can_edit_project(project_id, auth.uid()))
  with check (fittbuilder_can_edit_project(project_id, auth.uid()));

-- What the deploy side did, in order. Written by the service role only.
create table if not exists fittbuilder_project_deploy_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  env text not null check (env in ('uat', 'production')),
  stage text not null check (stage in ('waiting_image', 'registering', 'deploying', 'ready', 'failed')),
  build_no integer check (build_no is null or build_no >= 0),
  digest text check (digest is null or digest ~ '^sha256:[a-f0-9]{64}$'),
  url text check (url is null or (url ~ '^https://' and length(url) <= 500)),
  message text not null default '' check (length(message) <= 2000),
  binding_id uuid references fittbuilder_integration_bindings(id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists fittbuilder_project_deploy_events_project_idx
  on fittbuilder_project_deploy_events (project_id, env, at desc);
alter table fittbuilder_project_deploy_events enable row level security;
drop policy if exists project_deploy_events_select on fittbuilder_project_deploy_events;
create policy project_deploy_events_select on fittbuilder_project_deploy_events
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

-- A first administrator's password, sealed (AES-256-GCM, FITT_DEPLOY_SECRET_KEY)
-- until someone who can edit the project shows it once; then ciphertext is null.
create table if not exists fittbuilder_project_initial_passwords (
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  env text not null check (env in ('uat', 'production')),
  ciphertext text,
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  revealed_by uuid,
  primary key (project_id, env)
);
alter table fittbuilder_project_initial_passwords enable row level security;
-- No policies: the service role only.

notify pgrst, 'reload schema';
