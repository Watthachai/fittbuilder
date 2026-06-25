-- Per-project TEAM chat — a real conversation room, separate from the AI builder
-- chat. Members talk, share files/images, and see system logs (e.g. phase
-- approvals). Append-only. Realtime is delivered via Broadcast (see
-- lib/team-chat.ts), matching Presence/AI-sync, so no realtime publication change
-- is needed here.
--
-- author_name / author_avatar are DENORMALIZED on the row: profiles_select_own
-- (0001) lets a client read only its own profile, so a sender can't be resolved
-- from fittbuilder_profiles on the reader's side. Each client stamps its own
-- display name from user_metadata on insert (the same way Presence shares names).
create table if not exists fittbuilder_project_chat (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text,
  author_avatar text,
  kind text not null default 'message' check (kind in ('message','system')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists fittbuilder_project_chat_project_idx
  on fittbuilder_project_chat (project_id, created_at);

alter table fittbuilder_project_chat enable row level security;

-- read: any project member (owner or member, any role) sees the room
drop policy if exists chat_select on fittbuilder_project_chat;
create policy chat_select on fittbuilder_project_chat
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

-- insert: a member posts messages AS THEMSELVES (user_id = auth.uid()); system
-- logs are unattributed (user_id null) so no one can forge another member's row.
drop policy if exists chat_insert on fittbuilder_project_chat;
create policy chat_insert on fittbuilder_project_chat
  for insert with check (
    fittbuilder_can_read_project(project_id, auth.uid())
    and (
      (kind = 'message' and user_id = auth.uid())
      or (kind = 'system' and user_id is null)
    )
  );

-- delete: authors remove their own; the owner can moderate any
drop policy if exists chat_delete on fittbuilder_project_chat;
create policy chat_delete on fittbuilder_project_chat
  for delete using (
    user_id = auth.uid() or fittbuilder_is_project_owner(project_id, auth.uid())
  );

-- ---------- chat attachments bucket (private; served via signed URLs) ----------
insert into storage.buckets (id, name, public)
  values ('project-chat', 'project-chat', false)
  on conflict (id) do nothing;

-- Path convention: "<project_id>/<file>" — the first folder segment is the
-- project, so membership gates every object. Any member may upload/read/remove
-- (team chat is open to viewers too; "read-only" only applies to the AI builder).
drop policy if exists chat_files_read on storage.objects;
create policy chat_files_read on storage.objects
  for select using (
    bucket_id = 'project-chat'
    and fittbuilder_can_read_project((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists chat_files_insert on storage.objects;
create policy chat_files_insert on storage.objects
  for insert with check (
    bucket_id = 'project-chat'
    and fittbuilder_can_read_project((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists chat_files_delete on storage.objects;
create policy chat_files_delete on storage.objects
  for delete using (
    bucket_id = 'project-chat'
    and fittbuilder_can_read_project((storage.foldername(name))[1]::uuid, auth.uid())
  );

notify pgrst, 'reload schema';
