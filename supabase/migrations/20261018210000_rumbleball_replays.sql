-- Archive completed match frames atomically with settlement. No browser access.
begin;
create table if not exists public.rb_replays (
  league_id uuid not null references public.rb_leagues(id) on delete cascade,
  match_id text not null,
  replay jsonb not null,
  primary key (league_id, match_id)
);
alter table public.rb_replays enable row level security;
revoke all on public.rb_replays from public, anon, authenticated, service_role;
grant select on public.rb_replays to service_role;

create or replace function public.rb_archive_finished_matches()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rb_replays(league_id, match_id, replay)
  select new.id, g->>'id', jsonb_build_object('initial', g->'broadcast'->'initial', 'rounds', g->'broadcast'->'rounds')
  from jsonb_array_elements(coalesce(new.state->'night'->'games', '[]'::jsonb)) g
  where (g->>'settled')::boolean
  on conflict (league_id, match_id) do nothing;
  return new;
end;
$$;
revoke all on function public.rb_archive_finished_matches() from public, anon, authenticated, service_role;
drop trigger if exists rb_archive_matches on public.rb_leagues;
create trigger rb_archive_matches after insert or update of state on public.rb_leagues
for each row execute function public.rb_archive_finished_matches();

-- Recover completed matches of the last stored evening for existing leagues.
insert into public.rb_replays(league_id, match_id, replay)
select l.id, g->>'id', jsonb_build_object('initial', g->'broadcast'->'initial', 'rounds', g->'broadcast'->'rounds')
from public.rb_leagues l,
lateral jsonb_array_elements(coalesce(l.state->'night'->'games', '[]'::jsonb)) g
where (g->>'settled')::boolean
on conflict (league_id, match_id) do nothing;

-- Keep recovered replays discoverable after the next evening replaces night.
-- Bump the CAS revision so a concurrent worker reloads these history markers.
update public.rb_leagues l
set state = jsonb_set(l.state, '{history}', (
    select jsonb_agg(case when exists (
      select 1 from public.rb_replays r where r.league_id = l.id and r.match_id = h.entry->>'id'
    ) then h.entry || '{"replayAvailable":true}'::jsonb else h.entry end order by h.ordinal)
    from jsonb_array_elements(l.state->'history') with ordinality h(entry, ordinal)
  )), revision = l.revision + 1, updated_at = clock_timestamp()
where exists (
  select 1 from jsonb_array_elements(coalesce(l.state->'history', '[]'::jsonb)) h
  join public.rb_replays r on r.league_id = l.id and r.match_id = h->>'id'
  where h->>'replayAvailable' is distinct from 'true'
);
commit;
