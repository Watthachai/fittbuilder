-- Addressable checkpoints for a project's files.
--
-- Until now history was `fittbuilder_projects.history` — an array of up to 10
-- unlabelled snapshots that Undo popped from the end. You could step back, but
-- you could not point at a moment ("the version before we changed the sidebar"),
-- name it, or share it. Wand makes that worse: quick edits land in seconds, so
-- the timeline needs identity, not a stack.
--
-- `sha` is the first 7 hex of SHA-256 over the canonical JSON of path→contents.
-- Same files ⇒ same sha, always: content-addressed like a git tree, without
-- needing git (which cannot run in WebContainer at all).

create table if not exists fittbuilder_project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  sha text not null,
  parent_sha text,
  label text not null,
  -- 'ai' (a generation turn) | 'quick' (a wand quick patch) | 'restore'
  kind text not null default 'ai' check (kind in ('ai', 'quick', 'restore')),
  /** Which element a wand edit targeted, e.g. src/App.tsx:64:8 — lets rapid
      quick edits on the same element amend one revision instead of flooding. */
  target_loc text,
  files jsonb not null,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fittbuilder_revisions_project_idx
  on fittbuilder_project_revisions (project_id, created_at desc);

alter table fittbuilder_project_revisions enable row level security;

-- Same access as the project itself: anyone who can read it sees the history,
-- anyone who can edit it writes one. Deleting history is not an operation we
-- offer (rolling back appends a new revision), so there is no delete policy.
drop policy if exists revisions_select on fittbuilder_project_revisions;
create policy revisions_select on fittbuilder_project_revisions
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

drop policy if exists revisions_insert on fittbuilder_project_revisions;
create policy revisions_insert on fittbuilder_project_revisions
  for insert with check (fittbuilder_can_edit_project(project_id, auth.uid()));

-- Amending the newest quick edit (same element, still fresh) is an update.
drop policy if exists revisions_update on fittbuilder_project_revisions;
create policy revisions_update on fittbuilder_project_revisions
  for update using (fittbuilder_can_edit_project(project_id, auth.uid()))
  with check (fittbuilder_can_edit_project(project_id, auth.uid()));

-- Keep the tail bounded: 30 newest per project. Full file maps are heavy, and a
-- prototype's useful history is recent history.
create or replace function fittbuilder_prune_revisions() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  delete from fittbuilder_project_revisions r
   where r.project_id = new.project_id
     and r.id not in (
       select id from fittbuilder_project_revisions
        where project_id = new.project_id
        order by created_at desc
        limit 30
     );
  return null;
end;
$$;

drop trigger if exists fittbuilder_revisions_prune on fittbuilder_project_revisions;
create trigger fittbuilder_revisions_prune
  after insert on fittbuilder_project_revisions
  for each row execute function fittbuilder_prune_revisions();

notify pgrst, 'reload schema';
