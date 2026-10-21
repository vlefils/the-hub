-- Incident recovery for this project's abandoned Rumbleball REST transactions.
-- Cancels only uncommitted work idle for over a minute. Committed saves and
-- other applications are untouched. The worker will retry from its last state.
select count(*) filter (where pg_terminate_backend(pid))
  as released_stale_rumbleball_connections
from pg_stat_activity
where usename = 'authenticator'
  and state = 'idle in transaction'
  and state_change < clock_timestamp() - interval '60 seconds'
  and (query ilike '%rb_commit_league%' or query ilike '%rb_claim_tick%');
