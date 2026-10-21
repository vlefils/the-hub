-- Replays belong in the archive, not in every read/write of the live league.
begin;
create temporary table rb_compaction_archive_check on commit drop as
  select league_id, match_id, md5(replay::text) as fingerprint from public.rb_replays;

create or replace function public.rb_archive_finished_matches()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rb_replays(league_id, match_id, replay)
  select new.id, g->>'id', jsonb_build_object('initial', g->'broadcast'->'initial', 'rounds', g->'broadcast'->'rounds')
  from jsonb_array_elements(coalesce(new.state->'night'->'games', '[]'::jsonb)) g
  where (g->>'settled')::boolean and jsonb_array_length(g->'broadcast'->'rounds') > 0
  on conflict (league_id, match_id) do nothing;

  if jsonb_typeof(new.state->'night'->'games') = 'array' then
    new.state := jsonb_set(new.state, '{night,games}', (
      select coalesce(jsonb_agg(case
        when (g.entry->>'settled')::boolean and exists (
          select 1 from public.rb_replays r
          where r.league_id = new.id and r.match_id = g.entry->>'id'
            and r.replay->'initial' = g.entry->'broadcast'->'initial'
            and r.replay->'rounds' = g.entry->'broadcast'->'rounds'
        ) then jsonb_set(g.entry, '{broadcast,rounds}', '[]'::jsonb)
        else g.entry end order by g.ordinal), '[]'::jsonb)
      from jsonb_array_elements(new.state->'night'->'games') with ordinality g(entry, ordinal)
    ));
  end if;
  return new;
end;
$$;
drop trigger if exists rb_archive_matches on public.rb_leagues;
create trigger rb_archive_matches before insert or update of state on public.rb_leagues
for each row execute function public.rb_archive_finished_matches();

-- Preserve CAS: an in-flight worker must reload the compacted state.
update public.rb_leagues set state=state, revision=revision+1
where exists (
  select 1 from jsonb_array_elements(coalesce(state->'night'->'games', '[]'::jsonb)) g
  where (g->>'settled')::boolean and jsonb_array_length(g->'broadcast'->'rounds') > 0
);

-- Abort the entire migration if any pre-existing replay was changed or lost.
do $$ begin
  if exists (
    select 1 from rb_compaction_archive_check c left join public.rb_replays r
      on r.league_id=c.league_id and r.match_id=c.match_id
    where r.match_id is null or md5(r.replay::text) <> c.fingerprint
  ) then raise exception 'RB_REPLAY_COMPACTION_CHECK_FAILED'; end if;
end $$;
commit;
