-- FITT Voice → FITT Builder, contract fittbuilder.summary-delivery.v2.
--
-- v1 is one interview per project: a session's next snapshot replaces the last.
-- v2 lets a project collect many meetings, from many senders: each meeting is
-- its own row in a project, and its next revision replaces only that meeting.
-- v1 keeps working beside it, untouched (0045, 0053).
--
-- The rules agreed with the FITT Voice team on 4 Nov 2026 (contract v2.1):
--   - A meeting belongs to one project at a time. Sending it to another project
--     is refused — unless the project it belonged to was deleted in Builder;
--     then it may go anywhere again.
--   - Only a person's connection sends v2: the sender is the person the token
--     stands for, never a field of the payload.
--   - Whoever may edit the project (fittbuilder_can_edit_project) may add a
--     meeting to it or send a meeting's next revision. Checked on every delivery.
--   - A new deliveryId at or below a meeting's latest revision is stale,
--     whatever its hash. Revisions may skip numbers.
--   - Receiving a meeting never renames the project or touches its documents.
--
-- No RLS policies: only the service role (the receiver routes) touches these
-- tables. The studio reads a project's meetings through fittbuilder_fittvoice_sources,
-- which asks fittbuilder_can_read_project like every project read.

-- ---------- meetings: one row per FITT Voice meeting, wherever it is now ----------
-- project_id goes null when the project is deleted: the meeting is then free
-- to be sent to another project (contract v2.1, 2.4).
create table if not exists fittbuilder_fittvoice_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_id text not null unique check (length(meeting_id) between 1 and 200),
  project_id uuid references fittbuilder_projects(id) on delete set null,
  latest_revision bigint not null check (latest_revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fittbuilder_fittvoice_meetings_project_idx on fittbuilder_fittvoice_meetings (project_id);
alter table fittbuilder_fittvoice_meetings enable row level security;

-- ---------- every accepted delivery of a meeting, with the receipt it got ----------
-- Keyed on the sender: a retry is the same person sending the same deliveryId,
-- and gets the receipt it got the first time (outcome DUPLICATE). The newest
-- revision of a meeting is what the project shows.
create table if not exists fittbuilder_fittvoice_meeting_deliveries (
  sender_id uuid not null references auth.users(id) on delete cascade,
  delivery_id text not null check (length(delivery_id) between 1 and 200),
  meeting uuid not null references fittbuilder_fittvoice_meetings(id) on delete cascade,
  revision bigint not null check (revision >= 1),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  receipt jsonb not null,
  received_at timestamptz not null default now(),
  primary key (sender_id, delivery_id)
);
create index if not exists fittbuilder_fittvoice_meeting_deliveries_meeting_idx
  on fittbuilder_fittvoice_meeting_deliveries (meeting, revision desc);
alter table fittbuilder_fittvoice_meeting_deliveries enable row level security;

-- ---------- a refusal, in the shape the route wraps in error v2 ----------
create or replace function fittbuilder_fittvoice_refusal(p_status int, p_code text, p_message text, p_latest bigint)
  returns jsonb
  language sql
  immutable
  set search_path = public
as $$
  select jsonb_build_object('status', p_status, 'body', jsonb_build_object(
    'code', p_code, 'message', p_message, 'latestSnapshotRevision', p_latest));
$$;
revoke execute on function fittbuilder_fittvoice_refusal(int, text, text, bigint) from public, anon, authenticated;

-- ---------- apply one v2 delivery ----------
-- Called by the receiver route after it has checked the token, the size, the
-- JSON, the schema, the Idempotency-Key, the hash and the target's shape.
-- Returns {status, body}: the receipt on success, or {code, message,
-- latestSnapshotRevision} for the route to wrap. One transaction, locked per
-- meeting: two people sending different meetings never wait on each other.
create or replace function fittbuilder_fittvoice_apply_v2(p_binding uuid, p_payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_org uuid;
  v_user uuid;
  v_meeting_id text := p_payload#>>'{meeting,meetingId}';
  v_delivery text := p_payload->>'deliveryId';
  v_revision bigint := (p_payload#>>'{meeting,revision}')::bigint;
  v_hash text := p_payload->>'contentHash';
  v_mode text := p_payload#>>'{target,mode}';
  v_target text := p_payload#>>'{target,builderProjectId}';
  v_title text := p_payload#>>'{target,projectTitle}';
  v_seen fittbuilder_fittvoice_meeting_deliveries%rowtype;
  v_meet fittbuilder_fittvoice_meetings%rowtype;
  v_known boolean;
  v_project uuid;
  v_project_org uuid;
  v_meeting uuid;
  v_outcome text;
  v_receipt jsonb;
begin
  select b.org_id, b.user_id into v_org, v_user
    from fittbuilder_integration_bindings b
   where b.id = p_binding and b.revoked_at is null;
  if v_org is null or v_user is null then
    return fittbuilder_fittvoice_refusal(401, 'UNAUTHORIZED', 'token ใช้ไม่ได้ หรือไม่ใช่การเชื่อมบัญชีรายผู้ใช้', null);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fittvoice-meeting:' || v_meeting_id, 0));

  -- 1. A retry returns the receipt the first attempt got — before every other
  --    rule, so a delivery superseded since still replays as a success.
  select * into v_seen from fittbuilder_fittvoice_meeting_deliveries
   where sender_id = v_user and delivery_id = v_delivery;
  if found then
    if v_seen.content_hash <> v_hash then
      return fittbuilder_fittvoice_refusal(409, 'IDEMPOTENCY_CONFLICT', 'deliveryId นี้เคยส่งด้วยเนื้อหาอื่น',
        (select latest_revision from fittbuilder_fittvoice_meetings where id = v_seen.meeting));
    end if;
    return jsonb_build_object('status', 200, 'body', v_seen.receipt || jsonb_build_object('outcome', 'DUPLICATE'));
  end if;

  select * into v_meet from fittbuilder_fittvoice_meetings where meeting_id = v_meeting_id for update;
  v_known := found;

  -- 2. Where it goes. The route has already checked the target's shape.
  if v_mode = 'CREATE_PROJECT' then
    if v_known and v_meet.project_id is not null then
      return fittbuilder_fittvoice_refusal(409, 'MEETING_BOUND_TO_OTHER_PROJECT', 'การประชุมนี้อยู่ในโปรเจกต์อื่นแล้ว', null);
    end if;
  else
    if v_target !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return fittbuilder_fittvoice_refusal(404, 'PROJECT_NOT_FOUND', 'ไม่พบโปรเจกต์ปลายทางใน workspace นี้', null);
    end if;
    v_project := v_target::uuid;
    select org_id into v_project_org from fittbuilder_projects where id = v_project;
    if not found or v_project_org is distinct from v_org then
      return fittbuilder_fittvoice_refusal(404, 'PROJECT_NOT_FOUND', 'ไม่พบโปรเจกต์ปลายทางใน workspace นี้', null);
    end if;
    if not fittbuilder_can_edit_project(v_project, v_user) then
      return fittbuilder_fittvoice_refusal(403, 'PROJECT_WRITE_FORBIDDEN', 'ผู้ส่งไม่มีสิทธิ์แก้ไขโปรเจกต์นี้', null);
    end if;
    if v_known and v_meet.project_id is not null and v_meet.project_id <> v_project then
      return fittbuilder_fittvoice_refusal(409, 'MEETING_BOUND_TO_OTHER_PROJECT', 'การประชุมนี้อยู่ในโปรเจกต์อื่นแล้ว', null);
    end if;
  end if;

  -- 3. Only a newer revision of a meeting replaces it.
  if v_known and v_revision <= v_meet.latest_revision then
    return fittbuilder_fittvoice_refusal(409, 'STALE_REVISION', 'มีฉบับใหม่กว่าของการประชุมนี้แล้ว', v_meet.latest_revision);
  end if;

  -- 4. Write. A new project belongs to its sender, in Define, named once.
  if v_mode = 'CREATE_PROJECT' then
    insert into fittbuilder_projects (name, owner_id, org_id, phase)
      values (left(v_title, 300), v_user, v_org, 'define')
      returning id into v_project;
  end if;
  if v_known then
    -- New to this project (it was free) is CREATED there; the same project is UPDATED.
    v_outcome := case when v_meet.project_id = v_project then 'UPDATED' else 'CREATED' end;
    update fittbuilder_fittvoice_meetings
       set project_id = v_project, latest_revision = v_revision, updated_by = v_user, updated_at = now()
     where id = v_meet.id;
    v_meeting := v_meet.id;
  else
    v_outcome := 'CREATED';
    insert into fittbuilder_fittvoice_meetings (meeting_id, project_id, latest_revision, created_by, updated_by)
      values (v_meeting_id, v_project, v_revision, v_user, v_user)
      returning id into v_meeting;
  end if;

  v_receipt := jsonb_build_object(
    'schemaVersion', 'fittbuilder.receipt.v2',
    'deliveryId', v_delivery,
    'meetingId', v_meeting_id,
    'revision', p_payload#>'{meeting,revision}',
    'contentHash', v_hash,
    'builderProjectId', v_project::text,
    'builderMeetingId', v_meeting::text,
    'outcome', v_outcome,
    'acceptedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  insert into fittbuilder_fittvoice_meeting_deliveries
    (sender_id, delivery_id, meeting, revision, content_hash, payload, receipt)
    values (v_user, v_delivery, v_meeting, v_revision, v_hash, p_payload, v_receipt);
  return jsonb_build_object('status', case when v_outcome = 'CREATED' then 201 else 200 end, 'body', v_receipt);
end;
$$;

revoke execute on function fittbuilder_fittvoice_apply_v2(uuid, jsonb) from public, anon, authenticated;
grant execute on function fittbuilder_fittvoice_apply_v2(uuid, jsonb) to service_role;

-- ---------- the projects a sender may pick ----------
-- The workspace's projects the person may read, newest edit first, with whether
-- they may write — for /projects (search, p_project null) and /projects/{id}.
-- Keyset paging on (updated_at, id); cursorAt is the exact updated_at for the
-- route's next cursor and is not part of the answer.
create or replace function fittbuilder_fittvoice_projects(
  p_org uuid,
  p_user uuid,
  p_project uuid,
  p_pattern text,
  p_after_at timestamptz,
  p_after_id uuid,
  p_limit int
)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(jsonb_agg(item order by updated_at desc, id desc), '[]'::jsonb)
    from (
      select p.id, p.updated_at, jsonb_build_object(
          'builderProjectId', p.id::text,
          'name', p.name,
          'workspaceId', p.org_id::text,
          'canWrite', fittbuilder_can_edit_project(p.id, p_user),
          'updatedAt', to_char(p.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          -- A project that came from v1 counts its interview as its first meeting.
          'meetingCount', (select count(*) from fittbuilder_fittvoice_meetings m where m.project_id = p.id)
                        + (select count(*) from fittbuilder_fittvoice_sessions s where s.project_id = p.id),
          'cursorAt', p.updated_at) as item
        from fittbuilder_projects p
       where p.org_id = p_org
         and fittbuilder_can_read_project(p.id, p_user)
         and (p_project is null or p.id = p_project)
         and (p_pattern is null or p.name ilike p_pattern escape '\')
         and (p_after_at is null or (p.updated_at, p.id) < (p_after_at, p_after_id))
       order by p.updated_at desc, p.id desc
       limit p_limit
    ) t;
$$;

revoke execute on function fittbuilder_fittvoice_projects(uuid, uuid, uuid, text, timestamptz, uuid, int) from public, anon, authenticated;
grant execute on function fittbuilder_fittvoice_projects(uuid, uuid, uuid, text, timestamptz, uuid, int) to service_role;

-- ---------- what the studio shows ----------
-- Everything FITT Voice sent into a project, oldest first: the v1 interview it
-- came from, if any, then each v2 meeting at its newest revision, with who
-- sent that revision. Empty for anyone who may not read the project.
create or replace function fittbuilder_fittvoice_sources(pid uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
begin
  if not fittbuilder_can_read_project(pid, auth.uid()) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(item order by sort_at)
      from (
        select jsonb_build_object('kind', 'session', 'payload', d.payload, 'receivedAt', d.received_at) as item,
               d.received_at as sort_at
          from fittbuilder_fittvoice_sessions s
          join fittbuilder_fittvoice_deliveries d
            on d.org_id = s.org_id and d.delivery_id = s.latest_delivery_id
         where s.project_id = pid
        union all
        select jsonb_build_object('kind', 'meeting', 'id', m.id, 'payload', d.payload, 'receivedAt', d.received_at,
                                  'sender', coalesce(nullif(pr.name, ''), pr.email)) as item,
               (d.payload#>>'{meeting,recordedAt}')::timestamptz as sort_at
          from fittbuilder_fittvoice_meetings m
          join lateral (
            select * from fittbuilder_fittvoice_meeting_deliveries dd
             where dd.meeting = m.id order by dd.revision desc limit 1
          ) d on true
          left join fittbuilder_profiles pr on pr.id = d.sender_id
         where m.project_id = pid
      ) t
  ), '[]'::jsonb);
end;
$$;

revoke execute on function fittbuilder_fittvoice_sources(uuid) from public, anon;
grant execute on function fittbuilder_fittvoice_sources(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
