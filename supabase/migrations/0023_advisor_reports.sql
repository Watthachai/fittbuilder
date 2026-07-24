-- FITT Advisor becomes a first-class module (/advisor): analyses move from the
-- single overwrite-in-place jsonb on the org row (orgs.pain_radar) to a proper
-- per-run history table — unlocking trends ("ดีขึ้น/แย่ลงจากรอบก่อน") and the
-- new health-check report kind. Reports are immutable rows.
--
-- orgs.pain_radar is left in place (dead) so currently-deployed code that still
-- SELECTs it keeps working during rollout; new code reads/writes only this table.

create table if not exists fittbuilder_advisor_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references fittbuilder_orgs(id) on delete cascade,
  kind text not null check (kind in ('pain_point', 'health_check')),
  result jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists advisor_reports_org_time
  on fittbuilder_advisor_reports (org_id, created_at desc);

alter table fittbuilder_advisor_reports enable row level security;

-- Any workspace member (owner included via fittbuilder_is_org_member) can read
-- and add reports; rows are immutable (no update policy). Delete allowed for
-- members so a bad run can be cleaned up.
drop policy if exists advisor_reports_select on fittbuilder_advisor_reports;
create policy advisor_reports_select on fittbuilder_advisor_reports
  for select using (fittbuilder_is_org_member(org_id, auth.uid()));
drop policy if exists advisor_reports_insert on fittbuilder_advisor_reports;
create policy advisor_reports_insert on fittbuilder_advisor_reports
  for insert with check (fittbuilder_is_org_member(org_id, auth.uid()));
drop policy if exists advisor_reports_delete on fittbuilder_advisor_reports;
create policy advisor_reports_delete on fittbuilder_advisor_reports
  for delete using (fittbuilder_is_org_member(org_id, auth.uid()));

-- Backfill: carry each org's last saved Pain Point analysis into the history
-- so nothing the teams already shared disappears from the new dashboard.
insert into fittbuilder_advisor_reports (org_id, kind, result, created_by, created_at)
select
  o.id,
  'pain_point',
  o.pain_radar -> 'result',
  nullif(o.pain_radar ->> 'by', '')::uuid,
  coalesce((o.pain_radar ->> 'at')::timestamptz, now())
from fittbuilder_orgs o
where o.pain_radar is not null
  and o.pain_radar ? 'result'
  and not exists (
    select 1 from fittbuilder_advisor_reports r where r.org_id = o.id
  );

notify pgrst, 'reload schema';
