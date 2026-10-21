-- FITT Builder for our team and our partners only, and a welcome for new partners.
--
-- Until now anyone with a Google account could sign in and have our AI build
-- their own system. From here a signed-in account uses the app only when it is:
--   - on the team: an admin (ADMIN_EMAILS — the company domain and the owner).
--     The proxy (lib/supabase/middleware.ts) lets them in before it asks this,
--     since the database does not know that list;
--   - on the partner list (0060). Everyone else asks to be a partner through
--     /partner, and an admin adds them;
--   - connected to FITT Voice: Voice users do not ask first. The connect page
--     sits under /v1/integrations, outside the gate, so the connection that
--     lets them in can be made before they are let in.
--
-- Being invited into a workspace or a project does not count: an invitation is
-- made by whoever owns the workspace, and making a workspace takes no
-- permission, so counting it would let any two accounts let each other in.
-- A shared demo (/share) still opens for any account.
--
-- Every function here answers for auth.uid() only, so a signed-in caller learns
-- about itself and nobody else.

create or replace function fittbuilder_has_access() returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = auth.uid()
       and (
         exists (select 1 from fittbuilder_partner_emails pe where pe.email = lower(btrim(u.email)))
         or exists (
           select 1
             from fittbuilder_integration_bindings b
            where b.user_id = u.id and b.producer = 'FITT_VOICE' and b.revoked_at is null
         )
       )
  )
$$;

revoke all on function fittbuilder_has_access() from public, anon;
grant execute on function fittbuilder_has_access() to authenticated;

-- ---------- the partner welcome on the home page ----------
-- Shown to a partner until they close it, on whichever device they close it on.
alter table fittbuilder_partner_emails add column if not exists welcomed_at timestamptz;

create or replace function fittbuilder_partner_welcome() returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from auth.users u
      join fittbuilder_partner_emails pe on pe.email = lower(btrim(u.email))
     where u.id = auth.uid() and pe.welcomed_at is null
  )
$$;

create or replace function fittbuilder_partner_welcome_done() returns void
  language sql
  security definer
  set search_path = public, pg_temp
as $$
  update fittbuilder_partner_emails pe
     set welcomed_at = now()
    from auth.users u
   where u.id = auth.uid()
     and pe.email = lower(btrim(u.email))
     and pe.welcomed_at is null
$$;

revoke all on function fittbuilder_partner_welcome() from public, anon;
revoke all on function fittbuilder_partner_welcome_done() from public, anon;
grant execute on function fittbuilder_partner_welcome() to authenticated;
grant execute on function fittbuilder_partner_welcome_done() to authenticated;

notify pgrst, 'reload schema';
