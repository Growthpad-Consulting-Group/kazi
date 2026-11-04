-- Dashboard candidate aggregates, computed in the database.
--
-- The org and team dashboard used to load every candidate row and aggregate
-- in Node. This function returns the same figures as one JSON object, so the
-- dashboard makes one call instead of reading the candidates table.
--
-- p_job_ids: null for the org view, otherwise the job ids in scope (may be
-- empty, which returns zeros).

create or replace function public.dashboard_candidate_stats(
  p_job_ids uuid[],
  p_now timestamptz,
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with scoped as (
  select
    c.id,
    c.full_name,
    c.stage::text as stage,
    c.applied_at,
    c.ai_score,
    c.hired_user_id,
    j.title as job_title
  from public.candidates c
  left join public.jobs j on j.id = c.job_id
  where p_job_ids is null or c.job_id = any(p_job_ids)
)
select jsonb_build_object(
  'stageCounts', (
    select coalesce(jsonb_object_agg(s.stage, s.n), '{}'::jsonb)
    from (select stage, count(*)::int as n from scoped group by stage) s
  ),
  'activePipeline', (
    select count(*)::int from scoped where stage not in ('hired', 'rejected')
  ),
  'pendingScreen', (
    select count(*)::int from scoped where stage = 'applied' and ai_score is null
  ),
  'hired', (
    select count(*)::int from scoped where stage = 'hired'
  ),
  'rolePipeline', (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.total desc, r.role), '[]'::jsonb)
    from (
      select
        coalesce(job_title, 'Unassigned') as role,
        count(*) filter (where stage = 'applied')::int as applied,
        count(*) filter (where stage = 'screened')::int as screened,
        count(*) filter (where stage = 'interview')::int as interview,
        count(*) filter (where stage = 'offer')::int as offer,
        count(*)::int as total
      from scoped
      where stage in ('applied', 'screened', 'interview', 'offer')
      group by 1
      order by total desc, role
      limit 5
    ) r
  ),
  'stageAging', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'stage', st.stage,
        'count', coalesce(a.cnt, 0),
        'averageDays', coalesce(a.avg_days, 0)
      ) order by st.ord
    ), '[]'::jsonb)
    from unnest(array['applied', 'screened', 'interview', 'offer'])
      with ordinality as st(stage, ord)
    left join (
      select
        stage,
        count(*)::int as cnt,
        round(avg(extract(epoch from (p_now - applied_at)) / 86400.0))::int as avg_days
      from scoped
      group by stage
    ) a on a.stage = st.stage
  ),
  'averageDaysToHire', (
    select round(avg(extract(epoch from (p_now - applied_at)) / 86400.0))::int
    from scoped where stage = 'hired'
  ),
  'stalledCandidates', (
    select count(*)::int from scoped
    where stage not in ('hired', 'rejected')
      and applied_at < p_now - interval '14 days'
  ),
  'hiresAwaitingStaffRecord', (
    select count(*)::int from scoped
    where stage = 'hired' and hired_user_id is null
  ),
  'rangeCandidates', (
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'applied_at', applied_at)), '[]'::jsonb)
    from scoped
    where applied_at >= p_range_start and applied_at <= p_range_end
  ),
  'recent', (
    select coalesce(jsonb_agg(r.row_json order by r.applied_at desc), '[]'::jsonb)
    from (
      select applied_at, jsonb_build_object(
        'id', id,
        'full_name', full_name,
        'stage', stage,
        'applied_at', applied_at,
        'ai_score', ai_score,
        'jobs', case when job_title is null then null else jsonb_build_object('title', job_title) end
      ) as row_json
      from scoped
      order by applied_at desc
      limit 8
    ) r
  ),
  'interviewQueue', (
    select coalesce(jsonb_agg(q.row_json order by q.applied_at asc), '[]'::jsonb)
    from (
      select applied_at, jsonb_build_object(
        'id', id,
        'full_name', full_name,
        'stage', stage,
        'applied_at', applied_at,
        'ai_score', ai_score,
        'jobs', case when job_title is null then null else jsonb_build_object('title', job_title) end
      ) as row_json
      from scoped s
      where stage = 'interview'
        and not exists (
          select 1 from public.interview_scorecards sc
          where sc.candidate_id = s.id and sc.submitted_at is not null
        )
      order by applied_at asc
      limit 5
    ) q
  )
);
$$;

revoke all on function public.dashboard_candidate_stats(uuid[], timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.dashboard_candidate_stats(uuid[], timestamptz, timestamptz, timestamptz) to service_role;
