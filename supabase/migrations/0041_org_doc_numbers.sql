-- Running document numbers per workspace.
--
-- A quotation or proposal needs one stable number a customer can quote back —
-- "SQP12605-0002" — assigned once (on first export) and unchanged on every
-- reprint. The number has two parts stored on the workspace:
--   doc_code : a code the team types once (the "12605"), the same on every doc
--   doc_seq  : the running counter (the "0002"), one shared sequence per
--              workspace so no two documents of any type ever collide
-- The document TYPE prefix (SQP/PRP) is decided in code, not stored.
--
-- doc_seq lives on the org row, not a separate table: it is one integer per
-- workspace and it is only ever bumped through the function below, so a column
-- with a locked bump is simpler than a table nobody else touches.

alter table fittbuilder_orgs
  add column if not exists doc_code text not null default '',
  add column if not exists doc_seq integer not null default 0;

-- Hand out the next number, atomically.
--
-- SECURITY DEFINER so it can UPDATE the counter, with an explicit membership
-- check first — anyone who can work in the workspace may issue a number, but
-- only they. The UPDATE ... RETURNING is a single statement, so two exports
-- racing get two different numbers rather than the same one.
create or replace function fittbuilder_next_doc_number(oid uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  next_seq integer;
begin
  if not fittbuilder_is_org_member(oid, auth.uid()) then
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

-- PUBLIC gets EXECUTE by default on a new function; keep it to signed-in roles.
revoke execute on function fittbuilder_next_doc_number(uuid) from public;
grant execute on function fittbuilder_next_doc_number(uuid) to authenticated;

notify pgrst, 'reload schema';
