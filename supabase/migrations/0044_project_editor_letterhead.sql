-- A project editor works on the workspace's paper without belonging to the
-- workspace.
--
-- A project can be shared with someone outside its workspace and given edit
-- rights. They can then edit the quotation and proposal (RLS on those tables
-- asks fittbuilder_can_edit_project), but everything the paper takes from the
-- workspace was closed to them: orgs_select admits members only, so "ดึงจาก
-- workspace" read nothing, the document-code box stayed empty and locked, and
-- the first print failed to issue a number (fittbuilder_next_doc_number checks
-- workspace membership).
--
-- The rule is: whoever may edit the project may USE the workspace's letterhead
-- and take the next number for a document of that project. Changing the
-- workspace's own letterhead or code stays with the workspace owner (orgs_update
-- is unchanged) — `can_manage` tells the panel whether to offer it.

create or replace function fittbuilder_project_letterhead(pid uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  result jsonb;
begin
  if not fittbuilder_can_edit_project(pid, auth.uid()) then
    raise exception 'not an editor of this project';
  end if;
  select jsonb_build_object(
           'brand', o.brand,
           'is_partner', o.is_partner,
           'doc_code', o.doc_code,
           'can_manage', o.owner_id = auth.uid()
         )
    into result
    from fittbuilder_projects p
    join fittbuilder_orgs o on o.id = p.org_id
   where p.id = pid;
  -- Null for a project that belongs to no workspace.
  return result;
end;
$$;

-- The project-scoped twin of fittbuilder_next_doc_number: same counter on the
-- workspace row, same single-statement bump, gated on the project instead.
create or replace function fittbuilder_next_project_doc_number(pid uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  next_seq integer;
begin
  if not fittbuilder_can_edit_project(pid, auth.uid()) then
    raise exception 'not an editor of this project';
  end if;
  update fittbuilder_orgs o
     set doc_seq = o.doc_seq + 1, updated_at = now()
    from fittbuilder_projects p
   where p.id = pid and o.id = p.org_id
  returning o.doc_seq into next_seq;
  if next_seq is null then
    raise exception 'project has no workspace';
  end if;
  return next_seq;
end;
$$;

revoke execute on function fittbuilder_project_letterhead(uuid) from public;
grant execute on function fittbuilder_project_letterhead(uuid) to authenticated;
revoke execute on function fittbuilder_next_project_doc_number(uuid) from public;
grant execute on function fittbuilder_next_project_doc_number(uuid) to authenticated;

-- ---------- a link switched to edit upgrades the people already on it ----------
-- Joining twice did nothing the second time ("on conflict do nothing"), so
-- someone who opened the link while it was view-only stayed a viewer after the
-- owner switched it to edit, and the studio kept every field locked for them.
-- An edit link now raises an existing viewer to editor. It never lowers anyone:
-- switching a link to view-only says nothing about people already editing.
create or replace function fittbuilder_join_by_token(tok text, uid uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare pid uuid; r text; exp timestamptz;
begin
  select id, share_role, share_expires_at into pid, r, exp
    from fittbuilder_projects where share_token = tok;
  if pid is null or r is null then return null; end if;
  if exp is not null and exp < now() then return null; end if; -- expired
  insert into fittbuilder_project_members (project_id, user_id, role)
    values (pid, uid, r)
    on conflict (project_id, user_id) do update set role = 'editor'
      where excluded.role = 'editor';
  return pid;
end; $$;

notify pgrst, 'reload schema';
