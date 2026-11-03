-- The approval functions are for signed-in callers (0.118.1).
--
-- 0063 revoked them from PUBLIC, but Supabase grants EXECUTE to anon on its
-- own, so anon kept it. Each function already refuses a caller with no
-- auth.uid() — this takes the door away rather than relying on the lock.
revoke execute on function fittbuilder_accept_org_link(text) from anon;
revoke execute on function fittbuilder_project_approvers(uuid) from anon;
revoke execute on function fittbuilder_request_approval(uuid, text, text, uuid, jsonb) from anon;
revoke execute on function fittbuilder_decide_approval(uuid, boolean, text) from anon;
revoke execute on function fittbuilder_approve_now(uuid, text, text, jsonb) from anon;

notify pgrst, 'reload schema';
