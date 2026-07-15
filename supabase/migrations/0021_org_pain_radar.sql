-- Shared Pain Point Radar result per workspace.
--
-- Stores the LATEST analysis on the org row as jsonb: { result, at, by }. It is
-- governed by the existing policies (no new RLS needed): every org member reads
-- it via orgs_select, and the member who runs an analysis saves it via
-- orgs_update (0015: `using (fittbuilder_is_org_member(id, auth.uid()))`).
-- Nullable — null means "no analysis yet". Additive + idempotent.
alter table fittbuilder_orgs
  add column if not exists pain_radar jsonb;
