-- Messenger features for the team chat: replies + emoji reactions.
--
-- Reply: denormalized author/excerpt on the message so the quoted bubble renders
-- without a second fetch (profiles_select_own would hide the original author).
alter table fittbuilder_project_chat
  add column if not exists reply_to uuid references fittbuilder_project_chat(id) on delete set null,
  add column if not exists reply_author text,
  add column if not exists reply_excerpt text;

-- Reactions: one row per (message, user, emoji). project_id is carried so RLS can
-- gate by membership without joining back to the message.
create table if not exists fittbuilder_chat_reactions (
  message_id uuid not null references fittbuilder_project_chat(id) on delete cascade,
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists fittbuilder_chat_reactions_project_idx
  on fittbuilder_chat_reactions (project_id);

alter table fittbuilder_chat_reactions enable row level security;

-- read: any project member
drop policy if exists reactions_select on fittbuilder_chat_reactions;
create policy reactions_select on fittbuilder_chat_reactions
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

-- insert: only your own reaction, on a project you can read
drop policy if exists reactions_insert on fittbuilder_chat_reactions;
create policy reactions_insert on fittbuilder_chat_reactions
  for insert with check (
    user_id = auth.uid() and fittbuilder_can_read_project(project_id, auth.uid())
  );

-- delete: only your own reaction
drop policy if exists reactions_delete on fittbuilder_chat_reactions;
create policy reactions_delete on fittbuilder_chat_reactions
  for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';
