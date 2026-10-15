-- FITT Billing suspends or reactivates a project's app (phase 2). One command is
-- one transaction: the project's billing state and its history row land together
-- or not at all. Sending the same command again leaves the state as it was —
-- changed_at moves only when the status or the reason changes — but every
-- command is kept in the history. See docs/integrations/fitt-billing.md.
--
-- Returns the state after the command, or no row when the project doesn't exist.
create or replace function fittbuilder_billing_set_status(p_project uuid, p_status text, p_reason text, p_binding uuid)
  returns table (status text, reason text, changed_at timestamptz)
  language plpgsql
  security definer
  set search_path = public
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from fittbuilder_projects where id = p_project) then
    return;
  end if;
  insert into fittbuilder_project_billing as b (project_id, status, reason, changed_at, changed_by)
  values (p_project, p_status, p_reason, now(), p_binding)
  on conflict (project_id) do update
    set status = excluded.status,
        reason = excluded.reason,
        changed_by = excluded.changed_by,
        changed_at = case
          when b.status is distinct from excluded.status or b.reason is distinct from excluded.reason then now()
          else b.changed_at
        end;
  insert into fittbuilder_project_billing_events (project_id, status, reason, binding_id)
  values (p_project, p_status, p_reason, p_binding);
  return query
    select b.status, b.reason, b.changed_at from fittbuilder_project_billing b where b.project_id = p_project;
end $$;

revoke all on function fittbuilder_billing_set_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function fittbuilder_billing_set_status(uuid, text, text, uuid) to service_role;

notify pgrst, 'reload schema';
