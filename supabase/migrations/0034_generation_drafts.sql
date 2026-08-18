-- A generation that dies with its tab stops taking the work with it.
--
-- The model stream is held by the BROWSER: the studio opens an SSE connection to
-- /api/generate and receives files one at a time. lib/generation/registry.ts
-- keeps the run alive across SPA navigation by living on globalThis — but a
-- reload builds a new globalThis, so the connection dies with the page.
--
-- What made that expensive is that files reached the database only when a turn
-- ENDED (Studio.tsx persists at the start of the turn and at the end, never
-- between). A refresh at file 11 of 12 lost all twelve. Observed live on
-- 18 Aug 2026: the studio reported 12 files written while the row still said 2.
--
-- The obvious fix — write the streamed files into projects.files as they arrive
-- — is the one thing that must NOT happen, and the cancel path says why: a
-- half-streamed set has no index.html yet, hasRunnableApp only checks
-- package.json, so a partial set that becomes the project's truth boots to a
-- permanent white screen. The saved project must stay the last COMPLETE one.
--
-- So the partial goes somewhere it can be offered back instead of applied: one
-- draft per project, replaced as the stream advances, dropped when the turn
-- finishes either way. A separate table for the same reason 0031 used one —
-- this is a whole file map, and no ordinary project read should carry it.

create table if not exists fittbuilder_project_drafts (
  project_id uuid primary key references fittbuilder_projects(id) on delete cascade,
  files jsonb not null,
  /** What was asked for — shown when offering the draft back. */
  prompt text not null default '',
  updated_at timestamptz not null default now()
);

alter table fittbuilder_project_drafts enable row level security;

-- Same access as the project: a draft is that project's unfinished work.
drop policy if exists drafts_select on fittbuilder_project_drafts;
create policy drafts_select on fittbuilder_project_drafts
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

drop policy if exists drafts_insert on fittbuilder_project_drafts;
create policy drafts_insert on fittbuilder_project_drafts
  for insert with check (fittbuilder_can_edit_project(project_id, auth.uid()));

-- Both halves: without WITH CHECK a writer could move the row onto another
-- project and hand it a draft it never generated.
drop policy if exists drafts_update on fittbuilder_project_drafts;
create policy drafts_update on fittbuilder_project_drafts
  for update using (fittbuilder_can_edit_project(project_id, auth.uid()))
  with check (fittbuilder_can_edit_project(project_id, auth.uid()));

drop policy if exists drafts_delete on fittbuilder_project_drafts;
create policy drafts_delete on fittbuilder_project_drafts
  for delete using (fittbuilder_can_edit_project(project_id, auth.uid()));

notify pgrst, 'reload schema';
