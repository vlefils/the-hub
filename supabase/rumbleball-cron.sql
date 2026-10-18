-- Run only after deploying the worker and configuring the matching secret.
-- Create rb_project_url and rb_worker_secret in Supabase Vault first.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('rumbleball-evenings', '10 seconds', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='rb_project_url') || '/functions/v1/rumbleball-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-rumbleball-worker',
      (select decrypted_secret from vault.decrypted_secrets where name='rb_worker_secret')),
    body := jsonb_build_object('leagueId', due.id),
    timeout_milliseconds := 15000
  ) from (select id from public.rb_leagues where next_tick_at <= clock_timestamp() order by next_tick_at limit 10) due;
$$);
