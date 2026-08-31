-- Short share links for demos.
--
-- The copy-share button used to deflate the WHOLE project into the URL fragment
-- (BR-003, lib/share.ts): zero-backend, but the link ran to thousands of
-- characters and could be too long to paste or open. A snapshot stored here
-- turns the link into `…/share/<8-char-token>` instead.
--
-- It is a SNAPSHOT, copied at share time — the row keeps `name` + `files` as
-- they were, so a link sent to a customer does not change when the project is
-- edited afterwards. `project_id` is kept only so the snapshot is removed if the
-- project is deleted; the demo does not read back from the live project.
--
-- The pop-out-demo-in-a-new-tab path still uses the URL fragment (it is opened
-- by code, never pasted by a person, and must not write a row every time), so
-- lib/share.ts keeps both encoders.

create table if not exists fittbuilder_shared_demos (
  token text primary key,
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  name text not null,
  files jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists fittbuilder_shared_demos_project_idx
  on fittbuilder_shared_demos (project_id);

alter table fittbuilder_shared_demos enable row level security;

-- Publish: anyone who can read the project may snapshot it, as themselves.
-- created_by defaults to auth.uid(), so the client never sends it and the check
-- still binds the row to the caller.
drop policy if exists shared_demos_insert on fittbuilder_shared_demos;
create policy shared_demos_insert on fittbuilder_shared_demos
  for insert to authenticated
  with check (fittbuilder_can_read_project(project_id, auth.uid()) and created_by = auth.uid());

-- Revoke: the publisher can delete their own link.
drop policy if exists shared_demos_delete on fittbuilder_shared_demos;
create policy shared_demos_delete on fittbuilder_shared_demos
  for delete to authenticated
  using (created_by = auth.uid());

-- Deliberately NO select policy: a snapshot is readable ONLY through the
-- function below, by exact token. Nobody can enumerate the table or read
-- someone else's snapshot directly.

-- Public read by token — this is the whole point of a share link: open the demo
-- with no account. SECURITY DEFINER so an anonymous viewer can read past RLS,
-- but it returns ONLY name+files for the ONE row whose token matches, so there
-- is nothing to enumerate and no other column is exposed. Returns null for an
-- unknown/expired token.
create or replace function fittbuilder_shared_demo(share_token text)
  returns jsonb
  language sql
  security definer
  set search_path = public
  stable
as $$
  select jsonb_build_object('name', name, 'files', files)
  from fittbuilder_shared_demos
  where token = share_token;
$$;

-- PUBLIC keeps EXECUTE (the default) on purpose: an anonymous visitor must be
-- able to open a shared link. The function leaks nothing without a valid token.
grant execute on function fittbuilder_shared_demo(text) to anon, authenticated;

notify pgrst, 'reload schema';
