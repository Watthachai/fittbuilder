-- Cross-tenant isolation for workspace specialists (final-review C1).
-- 0019's SELECT policy let the `status='published'` branch match for EVERYONE,
-- so an org's published specialist (org_id set) was world-readable and the
-- org-member branch was dead for reads. Tighten the public branch to GLOBAL
-- templates only (org_id null); org rows are readable solely by their creator
-- or members of that org. Idempotent.
drop policy if exists skill_templates_select on fittbuilder_skill_templates;
create policy skill_templates_select on fittbuilder_skill_templates
  for select using (
    (status = 'published' and org_id is null)
    or created_by = auth.uid()
    or (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()))
  );

-- One specialist per org (v1 invariant). Backs .maybeSingle() reads so a second
-- org row can never be created (fixes M3/T6b). Partial: global rows are exempt.
create unique index if not exists fittbuilder_skill_templates_one_per_org
  on fittbuilder_skill_templates (org_id) where org_id is not null;

notify pgrst, 'reload schema';
