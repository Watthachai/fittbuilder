-- Cases: a person reports a problem, the team answers in a thread until it is fixed.
--
-- Users meet failures FITT Builder cannot get them out of — a preview that will
-- not boot after the files were already saved, an app that throws, a build that
-- died half way — and until now the only way to tell anyone was a screenshot in
-- LINE, after which the developer had to ask which project, what they did, and
-- what the screen said. A case keeps what the developer needs (the error, the
-- tail of the log, the project, the version) beside the conversation about it,
-- and keeps it after the tab is closed.
--
-- Both tables have RLS on and NO policies: every read and write goes through
-- /api/cases, which checks who is asking — the reporter, or the team (the
-- ADMIN_EMAILS list) — and then uses the service role. The team is defined by an
-- env var the database cannot see, so the API is the one place it is enforced.

create table if not exists fittbuilder_cases (
  id uuid primary key default gen_random_uuid(),
  -- What people say out loud: "เคส #12".
  number bigint generated always as identity unique,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references fittbuilder_projects(id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  kind text not null check (kind in ('preview', 'runtime', 'generation', 'other')),
  status text not null default 'new'
    check (status in ('new', 'investigating', 'need_info', 'fixed', 'released')),
  -- What the reporter's screen knew when they pressed the button (lib/cases.ts CaseContext).
  context jsonb not null default '{}'::jsonb,
  -- The version the fix ships in, once there is one.
  fixed_in text check (fixed_in is null or length(fixed_in) between 1 and 60),
  last_reporter_at timestamptz not null default now(),
  last_team_at timestamptz,
  reporter_seen_at timestamptz not null default now(),
  team_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fittbuilder_cases_reporter_idx on fittbuilder_cases (reporter_id, updated_at desc);
create index if not exists fittbuilder_cases_updated_idx on fittbuilder_cases (updated_at desc);
alter table fittbuilder_cases enable row level security;

create table if not exists fittbuilder_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references fittbuilder_cases(id) on delete cascade,
  -- Null for a team answer written outside the app (e.g. straight into the database).
  author_id uuid references auth.users(id) on delete set null,
  author_kind text not null check (author_kind in ('reporter', 'team')),
  body text not null default '' check (length(body) <= 10000),
  -- [{path, name, type, size}] in the case-files bucket.
  attachments jsonb not null default '[]'::jsonb,
  -- A status change is a message: the thread shows when and by whom it moved.
  status_to text check (status_to in ('new', 'investigating', 'need_info', 'fixed', 'released')),
  fixed_in text check (fixed_in is null or length(fixed_in) between 1 and 60),
  created_at timestamptz not null default now(),
  check (author_kind = 'team' or (status_to is null and fixed_in is null)),
  check (length(body) > 0 or jsonb_array_length(attachments) > 0 or status_to is not null)
);
create index if not exists fittbuilder_case_messages_case_idx on fittbuilder_case_messages (case_id, created_at);
alter table fittbuilder_case_messages enable row level security;

-- ---------- a message moves its case ----------
-- The case's status, version and activity times follow from its messages, so a
-- team answer written by any route — the app, or SQL — leaves the case right.
-- Whoever writes has also seen everything before it.
create or replace function fittbuilder_case_message_applied() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.author_kind = 'team' then
    update fittbuilder_cases
       set status = coalesce(new.status_to, status),
           fixed_in = coalesce(new.fixed_in, fixed_in),
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

drop trigger if exists fittbuilder_case_message_applied on fittbuilder_case_messages;
create trigger fittbuilder_case_message_applied
  after insert on fittbuilder_case_messages
  for each row execute function fittbuilder_case_message_applied();

-- ---------- pictures attached to a case ----------
-- Private: a screenshot of someone's work is theirs and the team's, nobody
-- else's. Each person uploads into their own folder ("<user id>/…"); the API
-- accepts only attachments from the author's own folder and signs every read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('case-files', 'case-files', false, 5242880,
          array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists case_files_insert on storage.objects;
create policy case_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'case-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
