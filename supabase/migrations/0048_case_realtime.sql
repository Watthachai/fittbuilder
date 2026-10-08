-- The cases page and the account chip, live.
--
-- Answers arrive from the app AND straight from the database (the team's own
-- tooling writes fittbuilder_case_messages directly — CLAUDE.md, Cases), so the
-- signal that something changed has to come from the database, not a route.
-- Every message moves its case's updated_at (trigger in 0047), so a trigger on
-- the case row covers new cases, replies and status changes alike.
--
-- The broadcast carries only the case id. Who may read what is still decided
-- by /api/cases, which the page asks again when it hears a change; the channel
-- is public like the studio's others, and an id tells a listener nothing it
-- can open.
--
-- Opening a case moves only the seen columns, never updated_at — so a reader
-- refetching on a ping does not set off another ping.

create or replace function fittbuilder_case_ping() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(jsonb_build_object('caseId', new.id), 'changed', 'fittbuilder:cases', false);
  return new;
end $$;
revoke all on function fittbuilder_case_ping() from public, anon, authenticated;

drop trigger if exists fittbuilder_case_ping_insert on fittbuilder_cases;
create trigger fittbuilder_case_ping_insert
  after insert on fittbuilder_cases
  for each row execute function fittbuilder_case_ping();

drop trigger if exists fittbuilder_case_ping_update on fittbuilder_cases;
create trigger fittbuilder_case_ping_update
  after update on fittbuilder_cases
  for each row
  when (old.updated_at is distinct from new.updated_at or old.status is distinct from new.status)
  execute function fittbuilder_case_ping();
