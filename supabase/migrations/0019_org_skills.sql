-- Workspace-scoped domain specialists. org_id null = global/admin template
-- (unchanged). org_id set = a workspace's own AI-generated specialist that org
-- members can read + manage.
alter table fittbuilder_skill_templates
  add column if not exists org_id uuid references fittbuilder_orgs(id) on delete cascade,
  add column if not exists source text not null default 'manual' check (source in ('manual','ai'));
create index if not exists fittbuilder_skill_templates_org_idx on fittbuilder_skill_templates (org_id);

-- SELECT: existing (published OR own draft) PLUS org members read their org's rows.
-- is_org_member queries orgs/org_members only (never skill_templates), so it is
-- safe under INSERT ... RETURNING (no self-reference; cf. 0006).
drop policy if exists skill_templates_select on fittbuilder_skill_templates;
create policy skill_templates_select on fittbuilder_skill_templates
  for select using (
    status = 'published'
    or created_by = auth.uid()
    or (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()))
  );

-- Writes: only for org-scoped rows, by members of that org. Global rows
-- (org_id null) keep NO client write policy → admin/service-role only.
drop policy if exists skill_templates_insert on fittbuilder_skill_templates;
create policy skill_templates_insert on fittbuilder_skill_templates
  for insert with check (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()));
drop policy if exists skill_templates_update on fittbuilder_skill_templates;
create policy skill_templates_update on fittbuilder_skill_templates
  for update using (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()));
drop policy if exists skill_templates_delete on fittbuilder_skill_templates;
create policy skill_templates_delete on fittbuilder_skill_templates
  for delete using (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()));

notify pgrst, 'reload schema';
