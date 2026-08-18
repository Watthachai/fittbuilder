-- Undo stops costing 3 MB a click.
--
-- `history` is ten whole copies of the source tree kept inside the project row.
-- Measured on this database: 31 MB of the projects table's 56 MB, and on the
-- heaviest project (ETAX_SYC) 3,116 kB of history behind 361 kB of actual files
-- — 89% of the row. Every open selected it and every save wrote it back, so one
-- edit moved ~7 MB. That is the shape of the 2026-08-06 outage, still in place:
-- the projects upsert averages 200 ms (max 517 ms) while every other query in
-- pg_stat_statements is under 1 ms.
--
-- The stack itself is worth keeping — Undo is a core-loop key and revisions
-- (0025) snapshot the state AFTER a change, not the state before it, so they
-- cannot answer "go back one step" on their own. What has to stop is the stack
-- travelling to the browser and back to be edited there.
--
-- So the stack moves behind two functions. The client says "snapshot this" and
-- "give me the last one back"; the ten copies never leave the database.
--
-- SECURITY INVOKER on both: the UPDATE is then gated by projects_update
-- (fittbuilder_can_edit_project), the same policy an ordinary save passes. A
-- definer function here would hand any caller a write to any project.

alter table fittbuilder_projects
  add column if not exists history_count integer not null default 0;

-- Same reason as file_count in 0027: the browser needs to know whether Undo is
-- available, and that must not require reading what it would undo TO.
create or replace function fittbuilder_projects_count_history() returns trigger
  language plpgsql as $$
begin
  new.history_count := case
    when new.history is null or jsonb_typeof(new.history) <> 'array' then 0
    else jsonb_array_length(new.history)
  end;
  return new;
end;
$$;

drop trigger if exists fittbuilder_projects_history_count on fittbuilder_projects;
create trigger fittbuilder_projects_history_count
  before insert or update of history on fittbuilder_projects
  for each row execute function fittbuilder_projects_count_history();

/** Push `snapshot` onto the project's undo stack, keeping the newest 10.
    Returns the new depth. The snapshot is passed in rather than copied from the
    row because saves are debounced in the studio — the row's `files` can still
    be a step behind what the caller is snapshotting. */
create or replace function fittbuilder_history_push(pid uuid, snapshot jsonb)
  returns integer language plpgsql security invoker as $$
declare
  merged jsonb;
  kept jsonb;
  dropped integer;
begin
  select coalesce(history, '[]'::jsonb) || jsonb_build_array(snapshot)
    into merged
    from fittbuilder_projects
   where id = pid;
  -- No row: either it is gone or this caller cannot read it. Either way there
  -- is nothing to push onto and pretending otherwise hides the failure.
  if merged is null then
    raise exception 'project % not found or not readable', pid;
  end if;

  dropped := greatest(0, jsonb_array_length(merged) - 10);
  select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
    into kept
    from jsonb_array_elements(merged) with ordinality t(e, ord)
   where ord > dropped;

  update fittbuilder_projects set history = kept where id = pid;
  if not found then
    raise exception 'no permission to write project %', pid;
  end if;
  return jsonb_array_length(kept);
end;
$$;

/** Pop the newest snapshot, make it the project's files, and return it.
    NULL when the stack is empty. One round trip, and the only bytes that move
    are the one version being restored. */
create or replace function fittbuilder_history_pop(pid uuid)
  returns jsonb language plpgsql security invoker as $$
declare
  stack jsonb;
  restored jsonb;
begin
  select coalesce(history, '[]'::jsonb) into stack
    from fittbuilder_projects where id = pid;
  if stack is null then
    raise exception 'project % not found or not readable', pid;
  end if;
  if jsonb_array_length(stack) = 0 then
    return null;
  end if;

  restored := stack -> -1;
  update fittbuilder_projects
     set history = stack - (jsonb_array_length(stack) - 1),
         files = restored
   where id = pid;
  if not found then
    raise exception 'no permission to write project %', pid;
  end if;
  return restored;
end;
$$;

-- Backfill the counter for rows written before the trigger existed.
update fittbuilder_projects
   set history_count = case
     when history is null or jsonb_typeof(history) <> 'array' then 0
     else jsonb_array_length(history)
   end
 where history_count = 0;

notify pgrst, 'reload schema';
