-- Read-only, manual Rumbleball health snapshot; no player data or secrets.
-- This does not exercise the authenticated API or prove browser responsiveness.
select jsonb_build_object(
  'observed_at', clock_timestamp(),
  'leagues', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'status', status, 'revision', revision,
      'completed_days', state->>'completedDays',
      'matches_played', jsonb_array_length(state->'history'),
      'state_bytes', octet_length(state::text),
      'stored_bytes', pg_column_size(state),
      'next_tick_at', next_tick_at,
      'overdue_seconds', case when next_tick_at < clock_timestamp()
        then extract(epoch from clock_timestamp() - next_tick_at)::integer else 0 end,
      'updated_at', updated_at
    ) order by id), '[]'::jsonb) from public.rb_leagues
  ),
  'recent_cron_runs', (
    select coalesce(jsonb_agg(to_jsonb(recent) order by recent.runid desc), '[]'::jsonb)
    from (
      select d.runid, d.status, d.start_time, d.end_time, d.return_message
      from cron.job_run_details d join cron.job j using (jobid)
      where j.jobname = 'rumbleball-evenings'
      order by d.runid desc limit 5
    ) recent
  ),
  'stale_rumbleball_transactions', (
    select count(*) from pg_stat_activity
    where state = 'idle in transaction' and state_change < clock_timestamp() - interval '30 seconds'
      and (query ilike '%rb_commit_league%' or query ilike '%rb_claim_tick%')
  )
);
