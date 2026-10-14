-- FITT Billing App: a service credential per workspace (producer FITT_BILLING)
-- that pulls project data, and the billing status a project's deployed app
-- obeys (written in phase 2). See docs/integrations/fitt-billing.md.

-- The producer check was declared inline in 0045, so its name is Postgres's
-- choice. Drop the check whose expression compares `producer` — stored as
-- `producer = 'FITT_VOICE'::text` while it held one value, `producer = ANY
-- (ARRAY[...])` once it holds several — then name the new one. Nothing else
-- that merely mentions producer is touched when this file is re-run.
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
  check (producer in ('FITT_VOICE', 'FITT_BILLING'));

-- A project without a row here is active.
create table if not exists fittbuilder_project_billing (
  project_id uuid primary key references fittbuilder_projects(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  reason text not null default '',
  license_key_hash text unique check (license_key_hash ~ '^[a-f0-9]{64}$'),
  changed_at timestamptz not null default now(),
  changed_by uuid references fittbuilder_integration_bindings(id) on delete set null
);
alter table fittbuilder_project_billing enable row level security;

-- Every status change, kept: who, when and why a customer's app was suspended.
create table if not exists fittbuilder_project_billing_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  status text not null check (status in ('active', 'suspended')),
  reason text not null default '',
  binding_id uuid references fittbuilder_integration_bindings(id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists fittbuilder_project_billing_events_project_idx
  on fittbuilder_project_billing_events (project_id, at desc);
alter table fittbuilder_project_billing_events enable row level security;
-- No policies: both tables are read and written by the service role only.

notify pgrst, 'reload schema';
