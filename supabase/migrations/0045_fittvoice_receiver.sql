-- FITT Voice → FITT Builder deliveries (contract fittbuilder.delivery.v1).
--
-- FITT Voice turns a recorded customer interview into a structured summary and
-- sends it here backend-to-backend. The first delivery of an export session
-- creates a project in the Define phase; later ones update that same project.
-- Receiving data never starts a generation: the user asks for the BRD and the
-- prototype themselves.
--
-- Everything the route has to do atomically — "this delivery was seen", "this
-- session maps to that project", "this is the latest snapshot", "this is the
-- receipt" — happens inside fittbuilder_fittvoice_apply below, in one
-- transaction, so a retry after a lost response finds exactly what the first
-- attempt left and never creates a second project.
--
-- None of these tables has an RLS policy: only the service role (the receiver
-- route) writes or reads them. The studio reads a project's source through
-- fittbuilder_fittvoice_source, which asks the same question every project read
-- asks — fittbuilder_can_read_project.

-- ---------- bindings: one service credential, one workspace ----------
-- The credential itself is never stored, only its SHA-256. The workspace comes
-- from here, never from the payload.
create table if not exists fittbuilder_integration_bindings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references fittbuilder_orgs(id) on delete cascade,
  producer text not null check (producer in ('FITT_VOICE')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  label text not null default '',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists fittbuilder_integration_bindings_org_idx on fittbuilder_integration_bindings (org_id);
alter table fittbuilder_integration_bindings enable row level security;

-- ---------- sessions: (workspace, exportSessionId) is the project's identity ----------
-- Keyed on the workspace, not the credential, so rotating a token keeps the
-- projects it created. project_id goes null if someone deletes the project in
-- Builder: later updates then answer PROJECT_NOT_FOUND instead of quietly
-- creating a replacement.
create table if not exists fittbuilder_fittvoice_sessions (
  org_id uuid not null references fittbuilder_orgs(id) on delete cascade,
  export_session_id text not null check (length(export_session_id) between 1 and 200),
  project_id uuid references fittbuilder_projects(id) on delete set null,
  latest_revision bigint not null check (latest_revision >= 1),
  latest_delivery_id text not null,
  latest_hash text not null,
  -- A REVIEWED snapshot has been applied: drafts are closed for this session.
  finalized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, export_session_id)
);
create index if not exists fittbuilder_fittvoice_sessions_project_idx on fittbuilder_fittvoice_sessions (project_id);
alter table fittbuilder_fittvoice_sessions enable row level security;

-- ---------- deliveries: every applied snapshot, with the receipt it got ----------
-- Kept even after newer revisions, because replaying an old delivery exactly
-- must still return its original receipt (contract rule 3).
create table if not exists fittbuilder_fittvoice_deliveries (
  org_id uuid not null,
  delivery_id text not null check (length(delivery_id) between 1 and 200),
  export_session_id text not null,
  snapshot_revision bigint not null check (snapshot_revision >= 1),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  stage text not null check (stage in ('DRAFT', 'REVIEWED')),
  payload jsonb not null,
  receipt jsonb not null,
  received_at timestamptz not null default now(),
  primary key (org_id, delivery_id),
  foreign key (org_id, export_session_id)
    references fittbuilder_fittvoice_sessions (org_id, export_session_id) on delete cascade
);
create index if not exists fittbuilder_fittvoice_deliveries_session_idx
  on fittbuilder_fittvoice_deliveries (org_id, export_session_id, snapshot_revision desc);
alter table fittbuilder_fittvoice_deliveries enable row level security;

-- ---------- apply one delivery ----------
-- Called by the receiver route after it has checked the credential, the size,
-- the JSON, the schema, the hash and the references. Returns {status, body}:
-- body is the receipt on success, or {code, message, latestSnapshotRevision}
-- for the route to wrap in an error envelope.
create or replace function fittbuilder_fittvoice_apply(p_binding uuid, p_payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_org uuid;
  v_owner uuid;
  v_session text := p_payload->>'exportSessionId';
  v_delivery text := p_payload->>'deliveryId';
  v_revision bigint := (p_payload->>'snapshotRevision')::bigint;
  v_hash text := p_payload->>'contentHash';
  v_stage text := p_payload->>'stage';
  v_operation text := p_payload->>'operation';
  v_title text := p_payload#>>'{content,projectTitle}';
  v_name text;
  v_seen fittbuilder_fittvoice_deliveries%rowtype;
  v_sess fittbuilder_fittvoice_sessions%rowtype;
  v_project uuid;
  v_receipt jsonb;
  v_status int;
begin
  select b.org_id, o.owner_id into v_org, v_owner
    from fittbuilder_integration_bindings b
    join fittbuilder_orgs o on o.id = b.org_id
   where b.id = p_binding and b.revoked_at is null;
  if v_org is null then
    return jsonb_build_object('status', 401, 'body', jsonb_build_object(
      'code', 'UNAUTHORIZED', 'message', 'credential ใช้ไม่ได้', 'latestSnapshotRevision', null));
  end if;

  -- One delivery at a time per session: two retries racing must not both create.
  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':' || v_session, 0));

  -- 1. An exact replay returns the receipt it got the first time — checked before
  --    stale/finalized, so a delivery that has since been superseded still
  --    replays as a success.
  select * into v_seen from fittbuilder_fittvoice_deliveries
   where org_id = v_org and delivery_id = v_delivery;
  if found then
    if v_seen.content_hash <> v_hash then
      return jsonb_build_object('status', 409, 'body', jsonb_build_object(
        'code', 'IDEMPOTENCY_CONFLICT',
        'message', 'deliveryId นี้เคยส่งด้วยเนื้อหาอื่น',
        'latestSnapshotRevision', (select latest_revision from fittbuilder_fittvoice_sessions
                                    where org_id = v_org and export_session_id = v_seen.export_session_id)));
    end if;
    return jsonb_build_object('status', 200,
      'body', v_seen.receipt || jsonb_build_object('outcome', 'DUPLICATE'));
  end if;

  select * into v_sess from fittbuilder_fittvoice_sessions
   where org_id = v_org and export_session_id = v_session;

  -- Drafts are announced as drafts wherever the project is listed.
  v_name := case when v_stage = 'DRAFT' then 'ร่างระหว่างคุย — ' || v_title else v_title end;

  if v_operation = 'CREATE_PROJECT' then
    if found then
      -- A new delivery still saying CREATE for a session that already has its
      -- project: never a second project.
      return jsonb_build_object('status', 409, 'body', jsonb_build_object(
        'code', 'REVISION_CONFLICT',
        'message', 'session นี้สร้างโปรเจกต์ไปแล้ว ใช้ UPDATE_PROJECT กับ builderProjectId เดิม',
        'latestSnapshotRevision', v_sess.latest_revision));
    end if;
    insert into fittbuilder_projects (name, owner_id, org_id, phase)
      values (left(v_name, 300), v_owner, v_org, 'define')
      returning id into v_project;
    insert into fittbuilder_fittvoice_sessions
      (org_id, export_session_id, project_id, latest_revision, latest_delivery_id, latest_hash, finalized)
      values (v_org, v_session, v_project, v_revision, v_delivery, v_hash, v_stage = 'REVIEWED');
    v_status := 201;
  else
    if not found or v_sess.project_id is null
       or v_sess.project_id::text <> (p_payload->>'builderProjectId') then
      -- Unknown session, a deleted project, or a session pointing at another
      -- project: one session never writes another session's project.
      return jsonb_build_object('status', 404, 'body', jsonb_build_object(
        'code', 'PROJECT_NOT_FOUND',
        'message', 'ไม่พบโปรเจกต์ปลายทางของ session นี้',
        'latestSnapshotRevision', case when found then v_sess.latest_revision end));
    end if;
    if v_revision < v_sess.latest_revision then
      return jsonb_build_object('status', 409, 'body', jsonb_build_object(
        'code', 'STALE_REVISION', 'message', 'มีฉบับใหม่กว่าแล้ว',
        'latestSnapshotRevision', v_sess.latest_revision));
    end if;
    if v_revision = v_sess.latest_revision then
      return jsonb_build_object('status', 409, 'body', jsonb_build_object(
        'code', 'REVISION_CONFLICT', 'message', 'ฉบับนี้มีชุดข้อมูลอื่นอยู่แล้ว',
        'latestSnapshotRevision', v_sess.latest_revision));
    end if;
    if v_sess.finalized and v_stage = 'DRAFT' then
      return jsonb_build_object('status', 409, 'body', jsonb_build_object(
        'code', 'SESSION_FINALIZED', 'message', 'session นี้มีฉบับตรวจแล้ว ไม่รับร่างเพิ่ม',
        'latestSnapshotRevision', v_sess.latest_revision));
    end if;
    v_project := v_sess.project_id;
    update fittbuilder_fittvoice_sessions
       set latest_revision = v_revision, latest_delivery_id = v_delivery, latest_hash = v_hash,
           finalized = finalized or v_stage = 'REVIEWED', updated_at = now()
     where org_id = v_org and export_session_id = v_session;
    update fittbuilder_projects set name = left(v_name, 300) where id = v_project;
    v_status := 200;
  end if;

  v_receipt := jsonb_build_object(
    'schemaVersion', 'fittbuilder.receipt.v1',
    'exportSessionId', v_session,
    'deliveryId', v_delivery,
    'builderProjectId', v_project::text,
    'snapshotRevision', p_payload->'snapshotRevision',
    'contentHash', v_hash,
    'outcome', 'APPLIED',
    'acceptedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  insert into fittbuilder_fittvoice_deliveries
    (org_id, delivery_id, export_session_id, snapshot_revision, content_hash, stage, payload, receipt)
    values (v_org, v_delivery, v_session, v_revision, v_hash, v_stage, p_payload, v_receipt);
  return jsonb_build_object('status', v_status, 'body', v_receipt);
end;
$$;

revoke execute on function fittbuilder_fittvoice_apply(uuid, jsonb) from public, anon, authenticated;
grant execute on function fittbuilder_fittvoice_apply(uuid, jsonb) to service_role;

-- ---------- what the studio shows ----------
-- The latest applied snapshot of a project's FITT Voice session, for anyone who
-- may read the project. Null for a project that did not come from FITT Voice.
create or replace function fittbuilder_fittvoice_source(pid uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  result jsonb;
begin
  if not fittbuilder_can_read_project(pid, auth.uid()) then
    return null;
  end if;
  select jsonb_build_object('payload', d.payload, 'receivedAt', d.received_at)
    into result
    from fittbuilder_fittvoice_sessions s
    join fittbuilder_fittvoice_deliveries d
      on d.org_id = s.org_id and d.delivery_id = s.latest_delivery_id
   where s.project_id = pid;
  return result;
end;
$$;

revoke execute on function fittbuilder_fittvoice_source(uuid) from public, anon;
grant execute on function fittbuilder_fittvoice_source(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
