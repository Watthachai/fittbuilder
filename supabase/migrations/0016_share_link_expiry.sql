-- Share-link expiry (free tier): a public /join/<share_token> link now carries
-- an optional expiry. Free-plan links are stamped 30 days out when created;
-- paid plans leave it null (never expires). Per-email invites already expire
-- (14 days) — this closes the gap for the anyone-with-the-link share token.

alter table fittbuilder_projects
  add column if not exists share_expires_at timestamptz;

-- Reject an expired share link at the point of joining (defense in depth — the
-- UI also checks, but the RPC is the actual grant).
create or replace function fittbuilder_join_by_token(tok text, uid uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare pid uuid; r text; exp timestamptz;
begin
  select id, share_role, share_expires_at into pid, r, exp
    from fittbuilder_projects where share_token = tok;
  if pid is null or r is null then return null; end if;
  if exp is not null and exp < now() then return null; end if; -- expired
  insert into fittbuilder_project_members (project_id, user_id, role)
    values (pid, uid, r) on conflict (project_id, user_id) do nothing;
  return pid;
end; $$;

notify pgrst, 'reload schema';
