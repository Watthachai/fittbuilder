-- How each build turn (kind 'generate') ended, and how long it ran. Until now a
-- turn that failed before the model reported usage left no row at all, and a
-- turn cut by the clock looked like any other — so the admin report could not
-- say how often builds stop half way. Null on every other kind of call.
alter table fittbuilder_ai_usage
  add column if not exists outcome text
    check (outcome in ('done', 'cut_time', 'cut_tokens', 'cut_error', 'failed')),
  add column if not exists duration_ms integer,
  add column if not exists error text;

notify pgrst, 'reload schema';
