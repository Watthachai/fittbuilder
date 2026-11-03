-- A reviewer checks a document before the approver sees it (0.123.0).
--
-- The team wants a developer to read a quotation before พี่เอ๋ approves it.
-- A company gets a fourth role, the reviewer: reads every workspace of the
-- company like an approver, approves nothing. Sending for approval may name a
-- reviewer; the request then waits in stage 'review' on the reviewer, and
-- passing it moves it to stage 'approve' on the approver. Returning it at
-- either stage sends it back. Only the approver's decision unlocks printing —
-- approvalState still reads the newest request's status, and a request in
-- review is pending.

-- ---------- the role ----------
alter table fittbuilder_company_members drop constraint if exists fittbuilder_company_members_role_check;
alter table fittbuilder_company_members
  add constraint fittbuilder_company_members_role_check check (role in ('admin', 'approver', 'reviewer', 'member'));
alter table fittbuilder_company_invites drop constraint if exists fittbuilder_company_invites_role_check;
alter table fittbuilder_company_invites
  add constraint fittbuilder_company_invites_role_check check (role in ('admin', 'approver', 'reviewer', 'member'));

-- Reading a workspace through the company: its admins, approvers and reviewers.
create or replace function fittbuilder_company_reads_org(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(
      select 1
        from fittbuilder_orgs o
        join fittbuilder_company_members owner_m on owner_m.user_id = o.owner_id
        join fittbuilder_company_members me on me.company_id = owner_m.company_id
       where o.id = oid and me.user_id = uid and me.role in ('admin', 'approver', 'reviewer'));
  $$;

-- Reviewing in a workspace: its company's reviewers.
create or replace function fittbuilder_company_reviews_org(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(
      select 1
        from fittbuilder_orgs o
        join fittbuilder_company_members owner_m on owner_m.user_id = o.owner_id
        join fittbuilder_company_members me on me.company_id = owner_m.company_id
       where o.id = oid and me.user_id = uid and me.role = 'reviewer');
  $$;

-- Only SELECT policies call this (checked live on 2026-11-03).
create or replace function fittbuilder_is_org_member(oid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_orgs o where o.id = oid and o.owner_id = uid)
        or exists(select 1 from fittbuilder_org_members m where m.org_id = oid and m.user_id = uid)
        or fittbuilder_company_reads_org(oid, uid);
  $$;

-- ---------- the review stage ----------
alter table fittbuilder_doc_approvals
  add column if not exists reviewer_id uuid references auth.users(id) on delete set null,
  add column if not exists stage text not null default 'approve' check (stage in ('review', 'approve')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;
create index if not exists fittbuilder_doc_approvals_reviewer_idx
  on fittbuilder_doc_approvals (reviewer_id) where status = 'pending' and stage = 'review';

-- ---------- the "ส่งอนุมัติ" list: reviewers too ----------
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
    select distinct on (x.uid) x.uid, pr.email, pr.name, x.why
      from (
        select o.owner_id as uid, 'owner'::text as why, 1 as rank
          from fittbuilder_orgs o where o.id = oid
        union all
        select m.user_id, 'admin'::text, 2
          from fittbuilder_org_members m where m.org_id = oid and m.role = 'admin'
        union all
        select me.user_id, ('company_' || me.role)::text, 3
          from fittbuilder_orgs o
          join fittbuilder_company_members owner_m on owner_m.user_id = o.owner_id
          join fittbuilder_company_members me on me.company_id = owner_m.company_id
         where o.id = oid and me.role in ('admin', 'approver', 'reviewer')
      ) x
      left join fittbuilder_profiles pr on pr.id = x.uid
     order by x.uid, x.rank;
end;
$$;

-- ---------- sending, with an optional reviewer ----------
drop function if exists fittbuilder_request_approval(uuid, text, text, uuid, jsonb);
create or replace function fittbuilder_request_approval(
  pid uuid, kind text, ver text, approver uuid, snap jsonb, reviewer uuid default null
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
  if reviewer is not null and not fittbuilder_company_reviews_org(oid, reviewer) then
    raise exception 'that person cannot review in this workspace';
  end if;
  update fittbuilder_doc_approvals
    set status = 'withdrawn', decided_by = auth.uid(), decided_at = now()
    where project_id = pid and doc_kind = kind and version = ver and status = 'pending';
  insert into fittbuilder_doc_approvals
    (project_id, doc_kind, version, requested_by, approver_id, snapshot, reviewer_id, stage)
    values (pid, kind, ver, auth.uid(), approver, snap, reviewer,
            case when reviewer is null then 'approve' else 'review' end)
    returning id into new_id;
  return new_id;
end;
$$;

-- ---------- deciding, at either stage ----------
-- In review: the reviewer passes it on to the approver, or returns it.
-- In approval: the approver (or the workspace's owner or an admin) decides.
-- A return needs a reason at either stage: it is what the sender fixes.
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
  if not approve and coalesce(btrim(note), '') = '' then
    raise exception 'a return needs a reason';
  end if;
  if req.stage = 'review' then
    if req.reviewer_id is distinct from auth.uid() then
      raise exception 'not yours to review';
    end if;
    if approve then
      update fittbuilder_doc_approvals
        set stage = 'approve', reviewed_at = now(), review_note = nullif(btrim(note), '')
        where id = aid;
    else
      update fittbuilder_doc_approvals
        set status = 'returned', decided_by = auth.uid(), decided_at = now(),
            reviewed_at = now(), comment = nullif(btrim(note), '')
        where id = aid;
    end if;
    return;
  end if;
  select p.org_id into oid from fittbuilder_projects p where p.id = req.project_id;
  if req.approver_id is distinct from auth.uid() and not fittbuilder_can_admin_org(oid, auth.uid()) then
    raise exception 'not yours to decide';
  end if;
  update fittbuilder_doc_approvals
    set status = case when approve then 'approved' else 'returned' end,
        decided_by = auth.uid(), decided_at = now(), comment = nullif(btrim(note), '')
    where id = aid;
end;
$$;

-- ---------- links: reviewer ranks between member and approver ----------
create or replace function fittbuilder_accept_company_link(tok text) returns text
  language plpgsql security definer set search_path = public as $$
declare
  inv fittbuilder_company_invites%rowtype;
  mine fittbuilder_company_members%rowtype;
  rank_of constant jsonb := '{"member": 1, "reviewer": 2, "approver": 3, "admin": 4}';
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  select * into inv from fittbuilder_company_invites where token = tok for update;
  if inv.id is null then
    raise exception 'not a company link';
  end if;
  if inv.status <> 'pending' then
    raise exception 'link already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'link expired';
  end if;
  select * into mine from fittbuilder_company_members where user_id = auth.uid() for update;
  if mine.user_id is null then
    insert into fittbuilder_company_members (user_id, company_id, role)
      values (auth.uid(), inv.company_id, inv.role);
  elsif mine.company_id <> inv.company_id then
    raise exception 'in another company';
  elsif (rank_of ->> inv.role)::int <= (rank_of ->> mine.role)::int then
    raise exception 'already in this company';
  else
    update fittbuilder_company_members set role = inv.role where user_id = auth.uid();
  end if;
  update fittbuilder_company_invites set status = 'accepted' where id = inv.id;
  return inv.role;
end;
$$;

create or replace function fittbuilder_set_company_role(target uuid, new_role text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  cid uuid := fittbuilder_company_i_admin();
  cur text;
begin
  if new_role not in ('admin', 'approver', 'reviewer', 'member') then
    raise exception 'unknown role';
  end if;
  select m.role into cur from fittbuilder_company_members m
   where m.user_id = target and m.company_id = cid for update;
  if cur is null then
    raise exception 'not in this company';
  end if;
  if cur = 'admin' and new_role <> 'admin'
     and (select count(*) from fittbuilder_company_members m
           where m.company_id = cid and m.role = 'admin') = 1 then
    raise exception 'the company needs an admin';
  end if;
  update fittbuilder_company_members set role = new_role where user_id = target;
end;
$$;

create or replace function fittbuilder_create_company_link(r text) returns fittbuilder_company_invites
  language plpgsql security definer set search_path = public as $$
declare
  cid uuid := fittbuilder_company_i_admin();
  inv fittbuilder_company_invites;
begin
  if r not in ('admin', 'approver', 'reviewer', 'member') then
    raise exception 'unknown role';
  end if;
  insert into fittbuilder_company_invites (company_id, role, token, created_by)
    values (cid, r, replace(gen_random_uuid()::text, '-', ''), auth.uid())
    returning * into inv;
  return inv;
end;
$$;

-- ---------- grants ----------
revoke execute on function fittbuilder_request_approval(uuid, text, text, uuid, jsonb, uuid) from public, anon;
grant execute on function fittbuilder_request_approval(uuid, text, text, uuid, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
