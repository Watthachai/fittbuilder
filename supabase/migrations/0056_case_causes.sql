-- Why a case happened, and where in FITT Builder.
--
-- The cases overview (/cases → ภาพรวม) answers "is the system getting better,
-- and what keeps breaking". A case's kind only says where the reporter was when
-- it broke; the cause is what the team finds. So the team names a cause and an
-- area when it finishes a case — the same way it moves a status: on a message,
-- which the trigger applies to the case (0047), so the app and SQL agree.
-- The words live in lib/cases.ts (CASE_CAUSE, CASE_AREA).

alter table fittbuilder_cases
  add column if not exists cause text
    check (cause in ('platform_bug', 'ai_code', 'external', 'feature', 'not_issue')),
  add column if not exists area text
    check (area in ('ai_builder', 'preview', 'documents', 'project', 'integrations', 'other'));

alter table fittbuilder_case_messages
  add column if not exists cause text
    check (cause in ('platform_bug', 'ai_code', 'external', 'feature', 'not_issue')),
  add column if not exists area text
    check (area in ('ai_builder', 'preview', 'documents', 'project', 'integrations', 'other'));

-- Only the team classifies, and a classification alone is a message worth keeping.
alter table fittbuilder_case_messages drop constraint if exists fittbuilder_case_messages_check;
alter table fittbuilder_case_messages add constraint fittbuilder_case_messages_check
  check (author_kind = 'team' or (status_to is null and fixed_in is null and cause is null and area is null));
alter table fittbuilder_case_messages drop constraint if exists fittbuilder_case_messages_check1;
alter table fittbuilder_case_messages add constraint fittbuilder_case_messages_check1
  check (length(body) > 0 or jsonb_array_length(attachments) > 0 or status_to is not null
         or cause is not null or area is not null);

create or replace function fittbuilder_case_message_applied() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.author_kind = 'team' then
    update fittbuilder_cases
       set status = coalesce(new.status_to, status),
           fixed_in = coalesce(new.fixed_in, fixed_in),
           cause = coalesce(new.cause, cause),
           area = coalesce(new.area, area),
           last_team_at = new.created_at,
           team_seen_at = new.created_at,
           updated_at = new.created_at
     where id = new.case_id;
  else
    update fittbuilder_cases
       set last_reporter_at = new.created_at,
           reporter_seen_at = new.created_at,
           updated_at = new.created_at
     where id = new.case_id;
  end if;
  return new;
end $$;
revoke all on function fittbuilder_case_message_applied() from public, anon, authenticated;

-- The cases finished before this migration, classified from the team's answers
-- in their threads. Written on the case, not as messages: a message would tell
-- every reporter the team answered again.
update fittbuilder_cases c
   set cause = v.cause, area = v.area
  from (values
    (1, 'ai_code', 'ai_builder'),       -- pages exported without default
    (2, 'ai_code', 'ai_builder'),       -- ui.tsx rewritten, Skeleton lost
    (3, 'feature', 'other'),            -- paging on the AI usage report
    (4, 'not_issue', 'preview'),        -- React DevTools extension
    (5, 'ai_code', 'ai_builder'),       -- ref read inside a state updater
    (6, 'platform_bug', 'ai_builder'),  -- BRD/PRD build timed out, continuation blind
    (7, 'feature', 'other'),            -- show the app version
    (9, 'feature', 'integrations'),     -- FITT Voice summary-only delivery
    (10, 'platform_bug', 'ai_builder'), -- task list ran only in the open tab
    (11, 'platform_bug', 'ai_builder'), -- long prompt resent with every task
    (12, 'ai_code', 'ai_builder'),      -- ">" in JSX text
    (13, 'ai_code', 'ai_builder'),      -- import of a file never written
    (14, 'ai_code', 'ai_builder'),      -- ">" in JSX text, again
    (15, 'ai_code', 'ai_builder'),      -- calls to functions that did not exist
    (16, 'platform_bug', 'documents'),  -- BRD/PRD over 400 chat messages
    (17, 'platform_bug', 'ai_builder'), -- screen index turn ran out of time
    (18, 'platform_bug', 'ai_builder'), -- the same, after one continuation
    (19, 'feature', 'documents'),       -- hide screenshots in the proposal
    (20, 'platform_bug', 'preview'),    -- 3D packages need React 19
    (21, 'platform_bug', 'preview'),    -- source tags broke 3D scenes
    (22, 'platform_bug', 'documents'),  -- duplicate quote row id
    (23, 'feature', 'documents'),       -- qty × unit price rows
    (24, 'platform_bug', 'documents'),  -- long row left page one blank
    (25, 'feature', 'documents'),       -- hide the price basis
    (26, 'feature', 'documents'),       -- proposal without a quote reference
    (27, 'feature', 'documents'),       -- Word export
    (28, 'platform_bug', 'project'),    -- approval complete, phase stuck
    (32, 'ai_code', 'ai_builder'),      -- localStorage over its quota
    (33, 'ai_code', 'ai_builder')       -- the same error, filed again
  ) as v(number, cause, area)
 where c.number = v.number and c.cause is null;

-- A finished case says why. The trigger's update fails, and so does the message
-- that would have finished the case without one.
alter table fittbuilder_cases drop constraint if exists fittbuilder_cases_cause_check;
alter table fittbuilder_cases add constraint fittbuilder_cases_cause_check
  check (status not in ('fixed', 'released', 'not_bug') or (cause is not null and area is not null));

notify pgrst, 'reload schema';
