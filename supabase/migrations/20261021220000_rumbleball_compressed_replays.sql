-- Versioned gzip archives; live rounds use the server's lossless delta codec.
-- Readers must support both legacy JSON and the new envelope before conversion.
begin;

create or replace function public.rb_check_replay_archive(p_archive jsonb, p_match_id text, p_rounds integer)
returns void language plpgsql set search_path = '' as $$
declare compressed bytea;
begin
  if not coalesce(
    p_archive->>'format' = 'rb-replay-gzip-v1' and p_archive->>'matchId' = p_match_id
    and jsonb_typeof(p_archive->'rounds') = 'number'
    and (p_archive->>'rounds')::integer = p_rounds and p_rounds between 1 and 32
    and jsonb_typeof(p_archive->'rawBytes') = 'number'
    and (p_archive->>'rawBytes')::bigint between 1 and 33554432
    and length(p_archive->>'data') between 1 and 11184812
    and p_archive->>'data' ~ '^[A-Za-z0-9+/]*={0,2}$'
    and p_archive->>'sha256' ~ '^[a-f0-9]{64}$', false
  ) then raise exception 'RB_REPLAY_ARCHIVE_INVALID'; end if;
  compressed := pg_catalog.decode(p_archive->>'data', 'base64');
  if octet_length(compressed) > 8388608
    or pg_catalog.encode(pg_catalog.sha256(compressed), 'hex') <> p_archive->>'sha256'
  then raise exception 'RB_REPLAY_ARCHIVE_CHECKSUM'; end if;
end;
$$;
revoke all on function public.rb_check_replay_archive(jsonb,text,integer) from public, anon, authenticated, service_role;

create or replace function public.rb_archive_finished_matches()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  game jsonb;
  archive jsonb;
  games jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(new.state->'night'->'games') is distinct from 'array' then return new; end if;
  for game in select value from jsonb_array_elements(new.state->'night'->'games') loop
    archive := game->'broadcast'->'archive';
    if archive is not null then
      if not coalesce((game->>'settled')::boolean, false)
        or jsonb_array_length(game->'broadcast'->'rounds') <> 0
      then raise exception 'RB_REPLAY_ARCHIVE_UNSETTLED'; end if;
      perform public.rb_check_replay_archive(archive, game->>'id', (archive->>'rounds')::integer);
      insert into public.rb_replays(league_id,match_id,replay) values(new.id,game->>'id',archive)
        on conflict (league_id,match_id) do nothing;
      -- A pre-existing, different replay must never be overwritten or discarded.
      if not exists(select 1 from public.rb_replays r
        where r.league_id=new.id and r.match_id=game->>'id' and r.replay=archive)
      then raise exception 'RB_REPLAY_ARCHIVE_CONFLICT'; end if;
      game := jsonb_set(game, '{broadcast}', (game->'broadcast') - 'archive');
    elsif coalesce((game->>'settled')::boolean, false)
      and jsonb_array_length(game->'broadcast'->'rounds') > 0 then
      -- Compatible with a legacy worker that was already in flight at deploy.
      archive := jsonb_build_object('initial',game->'broadcast'->'initial','rounds',game->'broadcast'->'rounds');
      insert into public.rb_replays(league_id,match_id,replay) values(new.id,game->>'id',archive)
        on conflict (league_id,match_id) do nothing;
      if exists(select 1 from public.rb_replays r
        where r.league_id=new.id and r.match_id=game->>'id' and r.replay=archive)
      then game := jsonb_set(game,'{broadcast,rounds}','[]'::jsonb); end if;
    end if;
    games := games || jsonb_build_array(game);
  end loop;
  new.state := jsonb_set(new.state,'{night,games}',games);
  return new;
end;
$$;

-- One-off conversion is compare-and-swap. It cannot alter the league, accounts,
-- progression, or an archive that changed since the verified local backup.
create or replace function public.rb_compress_replay(
  p_league_id uuid, p_match_id text, p_expected jsonb, p_archive jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare old jsonb;
begin
  perform pg_catalog.set_config('idle_in_transaction_session_timeout','30s',true);
  select replay into old from public.rb_replays
    where league_id=p_league_id and match_id=p_match_id for update;
  if not found then raise exception 'RB_REPLAY_NOT_FOUND'; end if;
  if old=p_archive then return false; end if;
  if old is distinct from p_expected then raise exception 'RB_CONFLICT'; end if;
  if old->>'format' is not null then raise exception 'RB_REPLAY_ALREADY_ENCODED'; end if;
  perform public.rb_check_replay_archive(p_archive,p_match_id,jsonb_array_length(old->'rounds'));
  update public.rb_replays set replay=p_archive where league_id=p_league_id and match_id=p_match_id;
  return true;
end;
$$;
revoke all on function public.rb_compress_replay(uuid,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.rb_compress_replay(uuid,text,jsonb,jsonb) to service_role;

commit;
