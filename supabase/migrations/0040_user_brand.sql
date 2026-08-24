-- A personal default letterhead: set once, seeds every new quotation and
-- proposal on projects that belong to no workspace.
--
-- The workspace already solves this for teams (orgs.brand, 0029) — but a
-- personal project has no org, so its author retyped the company block for
-- every new project. This is the same idea one level down: one row per user,
-- the whole letterhead as one jsonb, copied into documents at birth exactly
-- like the org brand is. Documents still own their copy; changing the default
-- never rewrites a sheet that was already sent.

create table if not exists fittbuilder_user_brand (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brand jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists fittbuilder_user_brand_touch on fittbuilder_user_brand;
create trigger fittbuilder_user_brand_touch
  before update on fittbuilder_user_brand
  for each row execute function fittbuilder_touch_updated_at();

alter table fittbuilder_user_brand enable row level security;

-- Strictly personal: nobody reads or writes anyone else's letterhead.
drop policy if exists user_brand_select on fittbuilder_user_brand;
create policy user_brand_select on fittbuilder_user_brand
  for select using (user_id = auth.uid());

drop policy if exists user_brand_insert on fittbuilder_user_brand;
create policy user_brand_insert on fittbuilder_user_brand
  for insert with check (user_id = auth.uid());

drop policy if exists user_brand_update on fittbuilder_user_brand;
create policy user_brand_update on fittbuilder_user_brand
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- personal logos ----------
-- Same public bucket as workspace logos (0029 explains why public): the path's
-- first segment is the OWNER'S OWN user id instead of an org id. Deliberately a
-- bare uuid, not a "user-" prefix — the org policies cast that segment to uuid,
-- and a non-uuid segment would make their WITH CHECK expressions error out,
-- failing every insert instead of just not matching.
drop policy if exists user_brand_logo_insert on storage.objects;
create policy user_brand_logo_insert on storage.objects
  for insert with check (
    bucket_id = 'org-brand'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

drop policy if exists user_brand_logo_update on storage.objects;
create policy user_brand_logo_update on storage.objects
  for update using (
    bucket_id = 'org-brand'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  )
  with check (
    bucket_id = 'org-brand'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

drop policy if exists user_brand_logo_delete on storage.objects;
create policy user_brand_logo_delete on storage.objects
  for delete using (
    bucket_id = 'org-brand'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

notify pgrst, 'reload schema';
