-- Telling "still running" apart from "died".
--
-- 0034 parks a turn's output as it streams, which already answers most of what a
-- separate "is generating" flag was meant to: a draft row exists exactly when a
-- turn did not finish. What it cannot answer is WHY it did not finish — a draft
-- looks identical whether the tab died a minute ago or another tab is writing to
-- it right now. Offering to recover work that is still being produced is how you
-- get two tabs fighting over one project.
--
-- The draft's own `updated_at` is the heartbeat: every checkpoint rewrites it, so
-- a timestamp that keeps moving means a turn is alive. All that is missing is
-- WHO, so the other person can be named instead of appearing as a mystery.
alter table fittbuilder_project_drafts
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
