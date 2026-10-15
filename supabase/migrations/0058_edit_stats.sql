-- How an edit turn's edits went (lib/apply-edit).
--
-- An edit turn now names the lines it changes instead of writing each file
-- again; the server places them. A <find> that does not match the file changes
-- nothing, so how often that happens is the number that says whether the
-- change is working: placed at once, placed on the second try, never placed —
-- and how many existing files the turn still wrote out whole.
--
-- {"applied": n, "repaired": n, "failed": n, "rewritten": n}; null on a first
-- build, which has nothing to edit.
alter table fittbuilder_ai_usage
  add column if not exists edit_stats jsonb;

notify pgrst, 'reload schema';
