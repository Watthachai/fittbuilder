-- Partner status granted by email, from /admin/partners.
--
-- Until now a partner was one SQL statement against a workspace id (0029), so a
-- partner could only be made after they had signed in and made a workspace.
-- This list is the grant itself: an email on it makes every workspace its owner
-- has — and every workspace they make later — a partner workspace, whether or
-- not they have an account yet. Taking the email off takes it back from all of
-- them. Workspaces are made by their owner (there is no default one), so "later"
-- covers someone added before their first sign-in.
--
-- Service role only, like 0030: RLS on and no policies. /admin/partners reaches
-- it through the two functions below, which nobody else may execute.

create table if not exists fittbuilder_partner_emails (
  email text primary key check (email = lower(btrim(email)) and email <> ''),
  -- The admin who added it, by email: the list is short and read by people.
  added_by text not null,
  created_at timestamptz not null default now()
);

alter table fittbuilder_partner_emails enable row level security;

-- ---------- a new workspace takes its partner flag from the list ----------
-- Every insert, whoever makes it. This also closes what 0029 left open: its pin
-- fires on UPDATE only, so a signed-in user could INSERT a workspace with
-- is_partner = true through the Data API. Now whatever an insert says is
-- replaced by the list's answer.
--
-- SECURITY DEFINER to read auth.users and the policy-less list.
create or replace function fittbuilder_orgs_partner_from_list() returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  new.is_partner := exists (
    select 1
      from auth.users u
      join fittbuilder_partner_emails pe on pe.email = lower(btrim(u.email))
     where u.id = new.owner_id
  );
  return new;
end $$;

revoke all on function fittbuilder_orgs_partner_from_list() from public, anon, authenticated;

create or replace trigger fittbuilder_orgs_partner_from_list
  before insert on fittbuilder_orgs
  for each row execute function fittbuilder_orgs_partner_from_list();

-- ---------- add or remove an email ----------
-- One transaction: the list and the workspaces the owner already has change
-- together. Returns how many of those workspaces it set.
create or replace function fittbuilder_set_partner_email(p_email text, p_partner boolean, p_by text)
  returns integer
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  mail text := lower(btrim(p_email));
  changed integer;
begin
  if p_partner then
    insert into fittbuilder_partner_emails (email, added_by) values (mail, p_by)
      on conflict (email) do nothing;
  else
    delete from fittbuilder_partner_emails where email = mail;
  end if;
  update fittbuilder_orgs o
     set is_partner = p_partner, updated_at = now()
    from auth.users u
   where u.id = o.owner_id
     and lower(btrim(u.email)) = mail
     and o.is_partner is distinct from p_partner;
  get diagnostics changed = row_count;
  return changed;
end $$;

revoke all on function fittbuilder_set_partner_email(text, boolean, text) from public, anon, authenticated;
grant execute on function fittbuilder_set_partner_email(text, boolean, text) to service_role;

-- ---------- the list as /admin/partners shows it ----------
-- Whether each email has signed in yet, and how many workspaces it owns.
create or replace function fittbuilder_partner_email_list()
  returns table (email text, added_by text, created_at timestamptz, has_account boolean, workspaces integer)
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select pe.email,
         pe.added_by,
         pe.created_at,
         u.id is not null,
         (select count(*)::integer from fittbuilder_orgs o where o.owner_id = u.id)
    from fittbuilder_partner_emails pe
    left join auth.users u on lower(btrim(u.email)) = pe.email
   order by pe.created_at desc
$$;

revoke all on function fittbuilder_partner_email_list() from public, anon, authenticated;
grant execute on function fittbuilder_partner_email_list() to service_role;

notify pgrst, 'reload schema';
