-- Clean up the duplicate empty default workspaces spawned by 0012's old
-- un-guarded backfill (root cause fixed in 0012). Deletes ONLY orgs that are:
--   - named the default 'พื้นที่ของฉัน'
--   - untouched Org DNA ('{}')
--   - completely empty: no projects, no members, no pending invites
--   - NOT the owner's oldest org (so nobody is ever left with zero workspaces)
-- Every renamed / non-empty / oldest workspace is preserved — no data is lost.
-- Idempotent: on a clean DB this deletes nothing.
delete from fittbuilder_orgs o
where o.name = 'พื้นที่ของฉัน'
  and o.org_dna = '{}'::jsonb
  and not exists (select 1 from fittbuilder_projects p where p.org_id = o.id)
  and not exists (select 1 from fittbuilder_org_members m where m.org_id = o.id)
  and not exists (select 1 from fittbuilder_org_invites i where i.org_id = o.id)
  and o.id <> (
    select o2.id from fittbuilder_orgs o2
    where o2.owner_id = o.owner_id
    order by o2.created_at, o2.id
    limit 1
  );

notify pgrst, 'reload schema';
