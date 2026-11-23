-- FITT Billing can put a customer's app in read-only (phase 3): people still sign in and read, nothing can be
-- saved. A status is active, suspended or read_only, in the project's state and in its history alike. And each
-- app's switch says which version it runs when it asks /v1/service-status (header x-fitt-switch-version; an app
-- that sends none runs version 1): the last one seen is kept, so Billing can see which apps run the new switch.
-- Re-run on every deploy: each check is dropped if it exists and added again, the column added only if missing.
-- See docs/integrations/fitt-billing.md.

alter table fittbuilder_project_billing drop constraint if exists fittbuilder_project_billing_status_check;
alter table fittbuilder_project_billing
  add constraint fittbuilder_project_billing_status_check check (status in ('active', 'suspended', 'read_only'));

alter table fittbuilder_project_billing_events drop constraint if exists fittbuilder_project_billing_events_status_check;
alter table fittbuilder_project_billing_events
  add constraint fittbuilder_project_billing_events_status_check check (status in ('active', 'suspended', 'read_only'));

-- 0054 named neither check; these are the names Postgres gives them. A status check left under another name would
-- still refuse read_only, and Billing's command would fail later: stop here instead.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where contype = 'c'
      and conrelid in ('fittbuilder_project_billing'::regclass, 'fittbuilder_project_billing_events'::regclass)
      and pg_get_constraintdef(oid) like '%status%'
      and pg_get_constraintdef(oid) not like '%read_only%'
  ) then
    raise exception 'a status check without read_only is still on the billing tables';
  end if;
end $$;

-- null: the app has not asked since this column was added
alter table fittbuilder_project_billing add column if not exists switch_version integer check (switch_version >= 1);

notify pgrst, 'reload schema';
