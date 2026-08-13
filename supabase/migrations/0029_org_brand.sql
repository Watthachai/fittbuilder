-- Workspace letterhead + the partner flag.
--
-- A partner takes FITT Builder to their own customers and sends the quotation
-- on their own paper: their logo, their legal name, their tax id. That identity
-- belongs to the WORKSPACE, not to a project — one company, many quotations —
-- so it lives here and every new quotation copies it in.
--
-- Deliberately NOT a fourth membership role. Who may edit a workspace is
-- already answered by owner/admin/member (0015), and adding 'partner' to that
-- check constraint would mean touching every policy and helper that reads it,
-- for no access-control question anyone actually has. What a partner IS, is a
-- workspace we have agreed to white-label — one boolean.

alter table fittbuilder_orgs
  add column if not exists brand jsonb not null default '{}'::jsonb,
  add column if not exists is_partner boolean not null default false;

-- ---------- the update policy 0012 left half-written ----------
-- It had USING but no WITH CHECK, which gates which rows you may update but not
-- what you may change them to: an owner could set owner_id to someone else and
-- hand their workspace away (or take one, mid-update). Both halves, same test.
drop policy if exists orgs_update on fittbuilder_orgs;
create policy orgs_update on fittbuilder_orgs
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------- is_partner is ours to grant, not theirs to take ----------
-- The column sits in a row its owner may freely update, so RLS alone cannot
-- protect it. This trigger pins it for anyone arriving through the Data API —
-- 'anon' and 'authenticated' are the only roles PostgREST ever runs requests as.
-- Everything else (service_role, postgres, this migration) may still set it, so
-- granting partner status stays a one-line SQL statement for us.
--
-- SECURITY INVOKER on purpose: a definer function would report its owner as
-- current_user and this check would never fire.
create or replace function fittbuilder_orgs_pin_partner() returns trigger
  language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.is_partner := old.is_partner;
  end if;
  return new;
end;
$$;

drop trigger if exists fittbuilder_orgs_pin_partner on fittbuilder_orgs;
create trigger fittbuilder_orgs_pin_partner
  before update on fittbuilder_orgs
  for each row execute function fittbuilder_orgs_pin_partner();

-- ---------- logo storage ----------
-- Public, unlike the private project-chat bucket: a company logo printed on a
-- quotation that goes to customers is not a secret, and the URL is COPIED into
-- the quotation document — it has to outlive any signed-url expiry, or a
-- quotation reopened next year renders with a broken letterhead.
--
-- No SVG: it can carry script, and this bucket is served over the open web.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'org-brand', 'org-brand', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp']
  )
  on conflict (id) do update set
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Path convention: "<org_id>/<file>" — the first folder segment is the
-- workspace, so admin rights gate every write. Reads need no policy: the bucket
-- is public.
--
-- Upload gated on can_admin_org, not is_org_member: the letterhead is the
-- company's legal identity on a document that quotes money. A member who can
-- work on projects should not be able to change whose name the invoice carries.
drop policy if exists org_brand_insert on storage.objects;
create policy org_brand_insert on storage.objects
  for insert with check (
    bucket_id = 'org-brand'
    and fittbuilder_can_admin_org((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists org_brand_update on storage.objects;
create policy org_brand_update on storage.objects
  for update using (
    bucket_id = 'org-brand'
    and fittbuilder_can_admin_org((storage.foldername(name))[1]::uuid, auth.uid())
  )
  with check (
    bucket_id = 'org-brand'
    and fittbuilder_can_admin_org((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists org_brand_delete on storage.objects;
create policy org_brand_delete on storage.objects
  for delete using (
    bucket_id = 'org-brand'
    and fittbuilder_can_admin_org((storage.foldername(name))[1]::uuid, auth.uid())
  );

notify pgrst, 'reload schema';
