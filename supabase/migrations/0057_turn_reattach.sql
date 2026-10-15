-- A dropped connection waits for its turn instead of starting it again (case #35).
--
-- The server runs every build turn to the end whether or not anyone is still
-- listening, and parks it in the project's draft (0034–0037). A studio that lost
-- the stream had no way to find its own turn there, so it called the turn
-- failed: a task list sent the same task again at once, and people pressed
-- retry — two full turns on one project side by side, 48 such pairs on 14 Oct,
-- and the first one's answer overwritten by the second.
--
-- turn_id: the id the studio gives a turn, so it reads back its own draft and
-- never another turn's. result: that turn's answer, parked as it ends — the note,
-- whether it was cut, and the files it deleted — which the files alone cannot say.
alter table fittbuilder_project_drafts
  add column if not exists turn_id uuid,
  add column if not exists result jsonb;

-- How far into a build turn its browser stopped listening, null when it stayed
-- to the end: how often connections drop, and when, which nothing recorded.
alter table fittbuilder_ai_usage
  add column if not exists client_left_ms integer;

notify pgrst, 'reload schema';
