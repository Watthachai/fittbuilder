-- Quotations and proposals are approved before they reach a customer (0.118.0).
-- Design: docs/superpowers/specs/2026-11-03-document-approval-design.md
--
-- A workspace gets a third kind of member, the approver: someone who reads every
-- project in the workspace and approves its documents, and writes nothing else.
-- Reading still goes through fittbuilder_is_org_member, which an approver
-- passes. Every write that used it now asks fittbuilder_can_work_in_org, which
-- an approver does not.

-- ---------- the role ----------
alter table fittbuilder_org_members drop constraint if exists fittbuilder_org_members_role_check;
alter table fittbuilder_org_members
  add constraint fittbuilder_org_members_role_check check (role in ('admin', 'member', 'approver'));
alter table fittbuilder_org_invites drop constraint if exists fittbuilder_org_invites_role_check;
alter table fittbuilder_org_invites
  add constraint fittbuilder_org_invites_role_check check (role in ('admin', 'member', 'approver'));

-- ---------- working in a workspace, as against seeing it ----------
create or replace function fittbuilder_can_work_in_org(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_orgs o where o.id = oid and o.owner_id = uid)
        or exists(select 1 from fittbuilder_org_members m
                  where m.org_id = oid and m.user_id = uid and m.role in ('admin', 'member'));
  $$;

-- Approving: the owner, an admin, or an approver.
create or replace function fittbuilder_can_approve_in_org(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_orgs o where o.id = oid and o.owner_id = uid)
        or exists(select 1 from fittbuilder_org_members m
                  where m.org_id = oid and m.user_id = uid and m.role in ('admin', 'approver'));
  $$;

-- The org branch of editing a project: an approver reads the project, never edits it.
create or replace function fittbuilder_can_edit_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m
                  where m.project_id = pid and m.user_id = uid and m.role = 'editor')
        or exists(select 1 from fittbuilder_projects p
                  where p.id = pid and p.org_id is not null
                    and fittbuilder_can_work_in_org(p.org_id, uid));
  $$;

-- The other writes that took any member (checked live on 2026-11-03).
drop policy if exists skill_templates_insert on fittbuilder_skill_templates;
create policy skill_templates_insert on fittbuilder_skill_templates
  for insert with check (org_id is not null and fittbuilder_can_work_in_org(org_id, auth.uid()));
drop policy if exists skill_templates_update on fittbuilder_skill_templates;
create policy skill_templates_update on fittbuilder_skill_templates
  for update using (org_id is not null and fittbuilder_can_work_in_org(org_id, auth.uid()));
drop policy if exists skill_templates_delete on fittbuilder_skill_templates;
create policy skill_templates_delete on fittbuilder_skill_templates
  for delete using (org_id is not null and fittbuilder_can_work_in_org(org_id, auth.uid()));

drop policy if exists advisor_reports_insert on fittbuilder_advisor_reports;
create policy advisor_reports_insert on fittbuilder_advisor_reports
  for insert with check (fittbuilder_can_work_in_org(org_id, auth.uid()));
drop policy if exists advisor_reports_delete on fittbuilder_advisor_reports;
create policy advisor_reports_delete on fittbuilder_advisor_reports
  for delete using (fittbuilder_can_work_in_org(org_id, auth.uid()));

create or replace function fittbuilder_next_doc_number(oid uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  next_seq integer;
begin
  if not fittbuilder_can_work_in_org(oid, auth.uid()) then
    raise exception 'not a member of this workspace';
  end if;
  update fittbuilder_orgs
    set doc_seq = doc_seq + 1, updated_at = now()
    where id = oid
    returning doc_seq into next_seq;
  if next_seq is null then
    raise exception 'workspace not found';
  end if;
  return next_seq;
end;
$$;

-- ---------- approvals ----------
-- One row per request. The snapshot is the document as sent: the approver reads
-- that, not the live one, which may change while they read. A document is
-- approved while the newest approved row's doc_hash equals the live document's.
create table if not exists fittbuilder_doc_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  doc_kind text not null check (doc_kind in ('quote', 'proposal')),
  version text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  approver_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  doc_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'returned', 'withdrawn')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  comment text
);
create index if not exists fittbuilder_doc_approvals_doc_idx
  on fittbuilder_doc_approvals (project_id, doc_kind, version, requested_at desc);
create index if not exists fittbuilder_doc_approvals_approver_idx
  on fittbuilder_doc_approvals (approver_id) where status = 'pending';
-- One open request per document: a new one withdraws the old (request_approval).
create unique index if not exists fittbuilder_doc_approvals_one_pending
  on fittbuilder_doc_approvals (project_id, doc_kind, version) where status = 'pending';

alter table fittbuilder_doc_approvals enable row level security;
-- Read with the project. No write policy: the functions below are the only way in.
drop policy if exists doc_approvals_select on fittbuilder_doc_approvals;
create policy doc_approvals_select on fittbuilder_doc_approvals
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

-- Who can approve a project's documents, with names, for the "ส่งอนุมัติ" list.
-- Gated on editing the project, so someone shared into one project (not in the
-- workspace) can still pick an approver.
create or replace function fittbuilder_project_approvers(pid uuid)
  returns table (user_id uuid, email text, name text, role text)
  language plpgsql security definer stable set search_path = public as $$
declare
  oid uuid;
begin
  if not fittbuilder_can_edit_project(pid, auth.uid()) then
    return;
  end if;
  select p.org_id into oid from fittbuilder_projects p where p.id = pid;
  if oid is null then
    return;
  end if;
  return query
    select o.owner_id, pr.email, pr.name, 'owner'::text
      from fittbuilder_orgs o
      left join fittbuilder_profiles pr on pr.id = o.owner_id
      where o.id = oid
    union all
    select m.user_id, pr.email, pr.name, m.role
      from fittbuilder_org_members m
      left join fittbuilder_profiles pr on pr.id = m.user_id
      where m.org_id = oid and m.role in ('admin', 'approver');
end;
$$;

-- Send a document for approval. Withdraws the request already open on it.
create or replace function fittbuilder_request_approval(
  pid uuid, kind text, ver text, approver uuid, snap jsonb, hash text
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  oid uuid;
  new_id uuid;
begin
  if not fittbuilder_can_edit_project(pid, auth.uid()) then
    raise exception 'cannot edit this project';
  end if;
  select p.org_id into oid from fittbuilder_projects p where p.id = pid;
  if oid is null then
    raise exception 'project is not in a workspace';
  end if;
  if not fittbuilder_can_approve_in_org(oid, approver) then
    raise exception 'that person cannot approve in this workspace';
  end if;
  update fittbuilder_doc_approvals
    set status = 'withdrawn', decided_by = auth.uid(), decided_at = now()
    where project_id = pid and doc_kind = kind and version = ver and status = 'pending';
  insert into fittbuilder_doc_approvals (project_id, doc_kind, version, requested_by, approver_id, snapshot, doc_hash)
    values (pid, kind, ver, auth.uid(), approver, snap, hash)
    returning id into new_id;
  return new_id;
end;
$$;

-- Approve or return a request. The person it was sent to, or the workspace's
-- owner or an admin. A return needs a reason: it is what the sender fixes.
create or replace function fittbuilder_decide_approval(aid uuid, approve boolean, note text)
  returns void
  language plpgsql security definer set search_path = public as $$
declare
  req fittbuilder_doc_approvals%rowtype;
  oid uuid;
begin
  select * into req from fittbuilder_doc_approvals where id = aid for update;
  if req.id is null or req.status <> 'pending' then
    raise exception 'request is not waiting for a decision';
  end if;
  select p.org_id into oid from fittbuilder_projects p where p.id = req.project_id;
  if req.approver_id <> auth.uid() and not fittbuilder_can_admin_org(oid, auth.uid()) then
    raise exception 'not yours to decide';
  end if;
  if not approve and coalesce(btrim(note), '') = '' then
    raise exception 'a return needs a reason';
  end if;
  update fittbuilder_doc_approvals
    set status = case when approve then 'approved' else 'returned' end,
        decided_by = auth.uid(), decided_at = now(), comment = nullif(btrim(note), '')
    where id = aid;
end;
$$;

-- The owner or an admin approving the document as it stands, without a request.
create or replace function fittbuilder_approve_now(pid uuid, kind text, ver text, snap jsonb, hash text)
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  oid uuid;
  new_id uuid;
begin
  select p.org_id into oid from fittbuilder_projects p where p.id = pid;
  if oid is null or not fittbuilder_can_admin_org(oid, auth.uid()) then
    raise exception 'only the owner or an admin approves without a request';
  end if;
  update fittbuilder_doc_approvals
    set status = 'withdrawn', decided_by = auth.uid(), decided_at = now()
    where project_id = pid and doc_kind = kind and version = ver and status = 'pending';
  insert into fittbuilder_doc_approvals
    (project_id, doc_kind, version, requested_by, approver_id, snapshot, doc_hash, status, decided_by, decided_at)
    values (pid, kind, ver, auth.uid(), auth.uid(), snap, hash, 'approved', auth.uid(), now())
    returning id into new_id;
  return new_id;
end;
$$;

-- The two predicates stay callable like fittbuilder_is_org_member, which policies
-- also call; the functions that act are for signed-in callers only.
revoke execute on function fittbuilder_project_approvers(uuid) from public;
revoke execute on function fittbuilder_request_approval(uuid, text, text, uuid, jsonb, text) from public;
revoke execute on function fittbuilder_decide_approval(uuid, boolean, text) from public;
revoke execute on function fittbuilder_approve_now(uuid, text, text, jsonb, text) from public;
grant execute on function fittbuilder_project_approvers(uuid) to authenticated;
grant execute on function fittbuilder_request_approval(uuid, text, text, uuid, jsonb, text) to authenticated;
grant execute on function fittbuilder_decide_approval(uuid, boolean, text) to authenticated;
grant execute on function fittbuilder_approve_now(uuid, text, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
