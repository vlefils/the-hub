-- Apply before deploying both readers. Enable RB_SPLIT_MATCH_STORAGE only after
-- the API and worker are updated. Existing leagues and replay archives are kept.
begin;

alter table public.rb_leagues add column if not exists bot_count integer
  generated always as (jsonb_array_length(coalesce(state->'bots', '[]'::jsonb))) stored;
alter table public.rb_solo_saves add column if not exists career_mode text generated always as (state->>'mode') stored;
alter table public.rb_solo_saves add column if not exists career_division integer generated always as ((state #>> '{longCareer,division}')::integer) stored;

create table public.rb_matches (
  league_id uuid not null references public.rb_leagues(id) on delete cascade,
  match_id text not null,
  config jsonb not null,
  initial jsonb not null,
  checkpoint jsonb not null,
  round_count integer not null check (round_count between 0 and 32),
  settled boolean not null default false,
  primary key (league_id, match_id)
);
create table public.rb_match_rounds (
  league_id uuid not null,
  match_id text not null,
  round_index integer not null check (round_index between 0 and 31),
  frame jsonb not null,
  primary key (league_id, match_id, round_index),
  foreign key (league_id, match_id) references public.rb_matches(league_id, match_id) on delete cascade
);
alter table public.rb_matches enable row level security;
alter table public.rb_match_rounds enable row level security;
revoke all on public.rb_matches, public.rb_match_rounds from public, anon, authenticated, service_role;

-- The league document carries scheduling and result summaries. Hydrate only a
-- worker's next unfinished match and due settlements, or the public live round.
create function public.rb_read_league(p_id uuid, p_now timestamptz, p_mode text default 'view', p_frames boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  row public.rb_leagues;
  game jsonb;
  games jsonb := '[]'::jsonb;
  stored public.rb_matches;
  selected boolean := false;
  hydrate boolean;
  frames jsonb;
  at_round integer;
begin
  select * into row from public.rb_leagues where id=p_id;
  if not found then return null; end if;
  if coalesce((row.state->>'matchStorage')::integer, 1) <> 2 then
    return jsonb_build_object('id', row.id, 'revision', row.revision, 'state', row.state);
  end if;
  for game in select value from jsonb_array_elements(row.state->'night'->'games') loop
    hydrate := false;
    if p_mode='worker' then
      if not coalesce((game->'broadcast'->'final'->>'finished')::boolean, false) and not selected then
        hydrate := true; selected := true;
      end if;
      hydrate := hydrate or (not (game->>'settled')::boolean and (game->>'endsAt')::timestamptz <= p_now);
    elsif p_frames then
      hydrate := (game->>'startsAt')::timestamptz <= p_now
        and ((game->>'endsAt') is null or p_now < (game->>'endsAt')::timestamptz + interval '7 seconds');
    end if;
    if hydrate then
      select * into stored from public.rb_matches where league_id=p_id and match_id=game->>'id';
      if not found then raise exception 'RB_MATCH_NOT_FOUND'; end if;
      at_round := case when p_mode='worker' then stored.round_count
        else greatest(0, floor(extract(epoch from (p_now-(game->>'playsAt')::timestamptz))/12)::integer) end;
      frames := '[]'::jsonb;
      if p_mode <> 'worker' then
        select coalesce(jsonb_agg(frame), '[]'::jsonb) into frames from public.rb_match_rounds
          where league_id=p_id and match_id=game->>'id' and round_index=at_round;
      end if;
      game := jsonb_set(game, '{config}', stored.config);
      game := jsonb_set(game, '{broadcast}', jsonb_build_object(
        'initial', stored.initial, 'final', stored.checkpoint, 'rounds', frames, 'roundsOffset', at_round));
    end if;
    games := games || jsonb_build_array(game);
  end loop;
  if row.state->'night' is not null and row.state->'night' <> 'null'::jsonb then
    row.state := jsonb_set(row.state, '{night,games}', games);
  end if;
  return jsonb_build_object('id', row.id, 'revision', row.revision, 'state', row.state);
end;
$$;

create function public.rb_claim_tick_v2(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claimed jsonb; observed_at timestamptz;
begin
  claimed := public.rb_claim_tick(p_id);
  if claimed is null then return null; end if;
  observed_at := clock_timestamp();
  return public.rb_read_league(p_id, observed_at, 'worker', false) || jsonb_build_object('claimedAt', observed_at);
end;
$$;

-- The existing CAS, membership, locking, scheduling and archive checks still
-- run in the same transaction as checkpoints and immutable round insertions.
create function public.rb_commit_league_v2(p_id uuid, p_expected_revision bigint, p_state jsonb, p_preparation boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  old public.rb_leagues;
  game jsonb;
  games jsonb := '[]'::jsonb;
  doc jsonb := jsonb_set(p_state, '{matchStorage}', '2'::jsonb);
  view jsonb;
  item jsonb;
  stored public.rb_matches;
  offset_round integer;
  count_round integer;
  index_round integer;
  revision bigint;
begin
  perform pg_catalog.set_config('idle_in_transaction_session_timeout', '30s', true);
  select * into old from public.rb_leagues where id=p_id for update;
  if not found or old.revision <> p_expected_revision then raise exception 'RB_CONFLICT'; end if;
  for game in select value from jsonb_array_elements(p_state->'night'->'games') loop
    view := game->'broadcast';
    if view->'initial' is not null then
      offset_round := coalesce((view->>'roundsOffset')::integer, 0);
      count_round := offset_round + jsonb_array_length(view->'rounds');
      -- Legacy completed games already archived before this migration have no
      -- live rounds. Their unchanged archive remains the replay source.
      if offset_round=0 and count_round=0 and (game->>'settled')::boolean then
        count_round := coalesce((view->'final'->>'round')::integer, 0);
      end if;
      select * into stored from public.rb_matches where league_id=p_id and match_id=game->>'id';
      if found then
        if stored.initial <> view->'initial' or stored.config <> game->'config'
          or (offset_round <> stored.round_count and not (offset_round=0 and count_round >= stored.round_count))
          or count_round < stored.round_count
        then raise exception 'RB_MATCH_CONFLICT'; end if;
        update public.rb_matches set checkpoint=view->'final', round_count=count_round, settled=(game->>'settled')::boolean
          where league_id=p_id and match_id=game->>'id';
      else
        if offset_round <> 0 then raise exception 'RB_MATCH_NOT_FOUND'; end if;
        insert into public.rb_matches(league_id,match_id,config,initial,checkpoint,round_count,settled)
          values(p_id,game->>'id',game->'config',view->'initial',view->'final',count_round,(game->>'settled')::boolean);
      end if;
      index_round := offset_round;
      for item in select value from jsonb_array_elements(view->'rounds') loop
        insert into public.rb_match_rounds(league_id,match_id,round_index,frame)
          values(p_id,game->>'id',index_round,item) on conflict do nothing;
        if not exists(select 1 from public.rb_match_rounds where league_id=p_id and match_id=game->>'id'
          and round_index=index_round and frame=item) then raise exception 'RB_ROUND_CONFLICT'; end if;
        index_round := index_round+1;
      end loop;
    else
      select * into stored from public.rb_matches where league_id=p_id and match_id=game->>'id';
      if not found then raise exception 'RB_MATCH_NOT_FOUND'; end if;
      count_round := stored.round_count;
      -- Unhydrated checkpoints remain untouched, even during club mutations.
    end if;
    view := jsonb_build_object('final', jsonb_build_object('finished', view->'final'->'finished', 'result', view->'final'->'result'),
      'rounds', '[]'::jsonb, 'roundsOffset', count_round);
    if game->'broadcast'->'archive' is not null then view := view || jsonb_build_object('archive', game->'broadcast'->'archive'); end if;
    game := jsonb_set(game, '{broadcast}', view);
    game := jsonb_set(game, '{config}', jsonb_build_object('teamNames', game->'config'->'teamNames'));
    games := games || jsonb_build_array(game);
  end loop;
  if doc->'night' is not null and doc->'night' <> 'null'::jsonb then doc := jsonb_set(doc, '{night,games}', games); end if;
  revision := public.rb_commit_league(p_id,p_expected_revision,doc,p_preparation);
  return revision;
end;
$$;

create function public.rb_read_match_replay(p_league_id uuid, p_match_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare stored public.rb_matches; frames jsonb;
begin
  select * into stored from public.rb_matches where league_id=p_league_id and match_id=p_match_id and settled;
  if not found then return null; end if;
  select jsonb_agg(frame order by round_index) into frames from public.rb_match_rounds
    where league_id=p_league_id and match_id=p_match_id;
  if jsonb_array_length(frames) is distinct from stored.round_count then return null; end if;
  return jsonb_build_object('initial', stored.initial, 'rounds', frames);
end;
$$;

revoke all on function public.rb_read_league(uuid,timestamptz,text,boolean), public.rb_claim_tick_v2(uuid),
  public.rb_commit_league_v2(uuid,bigint,jsonb,boolean), public.rb_read_match_replay(uuid,text) from public, anon, authenticated;
grant execute on function public.rb_read_league(uuid,timestamptz,text,boolean), public.rb_claim_tick_v2(uuid),
  public.rb_commit_league_v2(uuid,bigint,jsonb,boolean), public.rb_read_match_replay(uuid,text) to service_role;
commit;
