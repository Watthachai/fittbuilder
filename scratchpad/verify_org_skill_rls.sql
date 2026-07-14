-- Final-review C1 RLS proof. Rolled back — creates nothing durable.
-- Inserts an org-scoped published specialist + a global published template as the
-- superuser (bypasses RLS), then SELECTs under the `authenticated` role with the
-- JWT sub set to a non-member vs. a member to observe the RLS SELECT policy.
begin;

-- an org + its owner (a guaranteed member)
select o.id as org_id, o.owner_id as member_id from fittbuilder_orgs o limit 1 \gset

-- a definite non-member (real one if present, else a synthetic zero-uuid principal)
select coalesce(
  (select u.id from auth.users u
     where u.id <> :'member_id' and not fittbuilder_is_org_member(:'org_id', u.id) limit 1),
  '00000000-0000-0000-0000-000000000000'::uuid
) as other_id \gset

-- setup rows (as superuser → RLS bypassed for the inserts)
insert into fittbuilder_skill_templates (slug, name, name_en, status, created_by, org_id, source)
  values ('verify-global-'||substr(:'org_id',1,8), 'g', 'g', 'published', :'member_id', null, 'manual')
  on conflict (slug) do nothing;
insert into fittbuilder_skill_templates (slug, name, name_en, status, created_by, org_id, source)
  values ('org-'||:'org_id', 'x', 'x', 'published', :'member_id', :'org_id', 'ai')
  on conflict (slug) do nothing;

-- ===== NON-MEMBER (RLS enforced) =====
select set_config('request.jwt.claims', json_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::int as nm_org    from fittbuilder_skill_templates where org_id = :'org_id' \gset
select count(*)::int as nm_global from fittbuilder_skill_templates where org_id is null and status = 'published' \gset
reset role;

-- ===== MEMBER (RLS enforced) =====
select set_config('request.jwt.claims', json_build_object('sub', :'member_id', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::int as mem_org from fittbuilder_skill_templates where org_id = :'org_id' \gset
reset role;

select 'RESULT: nonmember_org=' || :nm_org
    || ' member_org=' || :mem_org
    || ' nonmember_global=' || :nm_global
    || '  => ' || case when :nm_org = 0 and :mem_org >= 1 and :nm_global >= 1
                       then 'PASS (isolated: non-member blocked, member allowed, global still readable)'
                       else 'FAIL' end as result;

rollback;
