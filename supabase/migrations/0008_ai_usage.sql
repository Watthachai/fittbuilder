-- Per-call AI token usage ledger for the admin usage report. One row per Gemini
-- call. RLS deny-all: only the trusted server path (service role) writes, and the
-- admin report (service role) reads — normal users can't see usage at all.
create table if not exists fittbuilder_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid references fittbuilder_projects(id) on delete set null,
  kind text not null,
  model text not null,
  prompt_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists fittbuilder_ai_usage_project_idx on fittbuilder_ai_usage (project_id);
create index if not exists fittbuilder_ai_usage_user_idx on fittbuilder_ai_usage (user_id);
create index if not exists fittbuilder_ai_usage_created_idx on fittbuilder_ai_usage (created_at);

alter table fittbuilder_ai_usage enable row level security;
-- No policies on purpose → deny-all for anon/authenticated. The service-role
-- client (admin report + recordUsage) bypasses RLS.

-- Aggregated report for the admin page. SECURITY INVOKER (default): a normal user
-- calling this sees nothing (RLS denies the underlying reads); the admin page
-- calls it via the service-role client, which bypasses RLS and sees everything.
create or replace function fittbuilder_ai_usage_report() returns json
  language sql stable as $$
  select json_build_object(
    'totals', (
      select json_build_object(
        'calls', count(*),
        'prompt_tokens', coalesce(sum(prompt_tokens), 0),
        'output_tokens', coalesce(sum(output_tokens), 0),
        'total_tokens', coalesce(sum(total_tokens), 0)
      ) from fittbuilder_ai_usage
    ),
    'by_project', (
      select coalesce(json_agg(r), '[]'::json) from (
        select u.project_id, p.name as project_name, pr.email as owner_email,
               count(*) as calls,
               sum(u.prompt_tokens) as prompt_tokens,
               sum(u.output_tokens) as output_tokens,
               sum(u.total_tokens) as total_tokens,
               max(u.created_at) as last_used
        from fittbuilder_ai_usage u
        left join fittbuilder_projects p on p.id = u.project_id
        left join fittbuilder_profiles pr on pr.id = p.owner_id
        group by u.project_id, p.name, pr.email
        order by sum(u.total_tokens) desc
      ) r
    ),
    'by_kind', (
      select coalesce(json_agg(r), '[]'::json) from (
        select kind, count(*) as calls, sum(total_tokens) as total_tokens
        from fittbuilder_ai_usage group by kind order by sum(total_tokens) desc
      ) r
    ),
    'by_user', (
      select coalesce(json_agg(r), '[]'::json) from (
        select u.user_id, pr.email, count(*) as calls,
               sum(u.prompt_tokens) as prompt_tokens,
               sum(u.output_tokens) as output_tokens,
               sum(u.total_tokens) as total_tokens
        from fittbuilder_ai_usage u
        left join fittbuilder_profiles pr on pr.id = u.user_id
        group by u.user_id, pr.email order by sum(u.total_tokens) desc
      ) r
    )
  );
$$;

notify pgrst, 'reload schema';
