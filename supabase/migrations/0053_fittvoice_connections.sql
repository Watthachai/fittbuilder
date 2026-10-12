-- FITT Voice account connections: a FITT Voice user connects their own Builder
-- account and picks one workspace (OAuth 2.0 authorization code + PKCE, agreed
-- with the FITT Voice team on 12 Oct 2026).
--
-- A connection is a row in fittbuilder_integration_bindings like a service
-- credential, with the person who made it: the receiver checks it the same way,
-- and the workspace still comes from the binding, never from the payload. What
-- a connection adds is a person whose membership is checked on every use, and
-- an idle expiry (lib/fittvoice/connect.ts CONNECTION_IDLE_DAYS) counted from
-- last_used_at.
--
-- Service role only, like 0045: no RLS policies. People see and revoke their
-- own connections through /api/integrations/connections.

-- ---------- clients: who may ask a person to connect ----------
-- Registered by the Builder team (scripts/fittvoice-binding.mjs client). A
-- redirect URI must match one of these exactly, character for character.
create table if not exists fittbuilder_integration_clients (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  producer text not null check (producer in ('FITT_VOICE')),
  name text not null check (length(name) between 1 and 100),
  redirect_uris text[] not null check (cardinality(redirect_uris) >= 1),
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);
alter table fittbuilder_integration_clients enable row level security;

-- ---------- bindings: a connection is a binding with a person ----------
alter table fittbuilder_integration_bindings
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists client_id text references fittbuilder_integration_clients(id),
  add column if not exists last_used_at timestamptz;
alter table fittbuilder_integration_bindings
  drop constraint if exists fittbuilder_integration_bindings_connection_check;
alter table fittbuilder_integration_bindings
  add constraint fittbuilder_integration_bindings_connection_check
  check ((user_id is null) = (client_id is null));
create index if not exists fittbuilder_integration_bindings_user_idx
  on fittbuilder_integration_bindings (user_id) where user_id is not null;

-- ---------- codes: one approval, exchanged once ----------
-- Only the SHA-256 of the code is kept. used_at is set by the exchange in the
-- same statement that checks it, so a code is never exchanged twice.
create table if not exists fittbuilder_integration_codes (
  code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
  client_id text not null references fittbuilder_integration_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references fittbuilder_orgs(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table fittbuilder_integration_codes enable row level security;

-- ---------- apply: the project's owner ----------
-- Unchanged from 0045 but for the owner line.
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
  -- A connection's projects belong to the person who connected; a service
  -- credential's to the workspace owner, as before.
  select b.org_id, coalesce(b.user_id, o.owner_id) into v_org, v_owner
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

notify pgrst, 'reload schema';
