-- How build turns ended since a given time, for the admin usage page: a count
-- per outcome, how long turns ran, and the latest ones that did not end on their
-- own. Aggregated here rather than in the page: PostgREST returns at most 1000
-- rows, and two weeks of turns already pass that.
-- SECURITY INVOKER (default), like fittbuilder_ai_usage_report: RLS denies the
-- underlying reads to normal users; the admin page calls it with the service role.
create or replace function fittbuilder_turn_report(since timestamptz) returns json
  language sql stable as $$
  with turns as (
    select * from fittbuilder_ai_usage
    where kind = 'generate' and outcome is not null and created_at >= since
  )
  select json_build_object(
    'counts', (
      select coalesce(json_object_agg(outcome, n), '{}'::json)
      from (select outcome, count(*) as n from turns group by outcome) c
    ),
    'p50_ms', (select percentile_disc(0.5) within group (order by duration_ms) from turns),
    'p90_ms', (select percentile_disc(0.9) within group (order by duration_ms) from turns),
    'unfinished', (
      select coalesce(json_agg(r), '[]'::json) from (
        select t.created_at, t.outcome, t.duration_ms, t.error, t.project_id,
               p.name as project_name, pr.email
        from turns t
        left join fittbuilder_projects p on p.id = t.project_id
        left join fittbuilder_profiles pr on pr.id = t.user_id
        where t.outcome <> 'done'
        order by t.created_at desc
        limit 20
      ) r
    )
  );
$$;

notify pgrst, 'reload schema';
