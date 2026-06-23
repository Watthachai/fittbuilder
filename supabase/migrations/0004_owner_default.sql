-- Let the DB stamp owner_id from the authenticated user's JWT, so it always
-- equals auth.uid() (satisfies the projects_insert RLS check by construction and
-- prevents a client from setting someone else's owner). Idempotent.
alter table fittbuilder_projects alter column owner_id set default auth.uid();

notify pgrst, 'reload schema';
