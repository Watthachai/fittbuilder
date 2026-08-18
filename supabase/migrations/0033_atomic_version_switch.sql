-- Switching tier becomes one write instead of four.
--
-- 0031 set the invariant: fittbuilder_projects.files is ALWAYS the active
-- version, and fittbuilder_project_versions holds only the inactive ones. The
-- studio then implemented a switch as four separate round trips — park the
-- outgoing version, delete the incoming version's parked row, save the files,
-- move the pointer — with nothing holding them together.
--
-- A real project ended up in exactly the state that allows: `active_version`
-- said 'standard' while `files` held the Premium build (three.js and all), and
-- the genuine 2D Standard sat parked under the key 'standard'. The label on the
-- phase bar lied about which product was on screen, and an export would have
-- shipped the paid build as the free one. Anything that interrupts the sequence
-- does this — a failed request, a reload, the Auth outage of 18 Aug.
--
-- So the whole switch moves into one function. A plpgsql function body is one
-- transaction: either the pointer, the files and both version rows all move, or
-- none of them do.

/** Switch the project from `from_key` to `to_key`, returning the files that are
    now active.

    `outgoing` is passed in rather than read from the row for the same reason
    fittbuilder_history_push takes its snapshot: studio saves are debounced, so
    the row can still hold the previous step, and parking that would lose work.

    A version that has never existed is SEEDED from `outgoing` — the first switch
    to Premium starts from whatever Standard is now. */
create or replace function fittbuilder_switch_version(
  pid uuid,
  from_key text,
  to_key text,
  outgoing jsonb
) returns jsonb language plpgsql security invoker as $$
declare
  incoming jsonb;
begin
  if from_key = to_key then
    raise exception 'switch to the same version (%) is not a switch', to_key;
  end if;

  -- Whatever is parked under the incoming key is what we are switching TO.
  select files into incoming
    from fittbuilder_project_versions
   where project_id = pid and key = to_key;
  if incoming is null then
    incoming := outgoing;
  end if;

  -- Pointer and files move together, and BEFORE the outgoing version is parked:
  -- the guard below forbids a parked row whose key is the active version, which
  -- is exactly what from_key still is until this statement lands.
  update fittbuilder_projects
     set files = incoming,
         active_version = to_key,
         updated_at = now()
   where id = pid;
  if not found then
    raise exception 'no permission to switch project %', pid;
  end if;

  -- The incoming version now lives in projects.files, so its parked copy has to
  -- go or the next switch would restore a stale snapshot over newer work.
  delete from fittbuilder_project_versions where project_id = pid and key = to_key;

  insert into fittbuilder_project_versions (project_id, key, files, updated_at)
    values (pid, from_key, outgoing, now())
    on conflict (project_id, key)
      do update set files = excluded.files, updated_at = excluded.updated_at;

  return incoming;
end;
$$;

-- ---------- the invariant, enforced rather than described ----------
-- 0031 stated it in a comment and the application broke it anyway. A version
-- parked under the key the project is currently pointed at means that version
-- exists twice and the other one exists nowhere — the shape the real project
-- was found in.
create or replace function fittbuilder_versions_not_active() returns trigger
  language plpgsql as $$
declare
  active text;
begin
  select active_version into active from fittbuilder_projects where id = new.project_id;
  if active = new.key then
    raise exception
      'version % is the active version of project % — projects.files already holds it',
      new.key, new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists fittbuilder_versions_not_active on fittbuilder_project_versions;
create trigger fittbuilder_versions_not_active
  before insert or update on fittbuilder_project_versions
  for each row execute function fittbuilder_versions_not_active();

notify pgrst, 'reload schema';
