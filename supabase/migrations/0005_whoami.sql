-- Diagnostic: returns auth.uid() AS SEEN BY PostgREST for the caller's JWT.
-- security invoker (default) so it reflects the request's auth context.
create or replace function fittbuilder_whoami() returns uuid
  language sql stable as $$ select auth.uid() $$;

notify pgrst, 'reload schema';
