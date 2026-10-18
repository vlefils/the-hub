-- Isolated Rumbleball objects; never replace Riftbound tables or auth settings.
begin;
create table if not exists public.rb_leagues (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  invite_code text not null unique check (length(invite_code) >= 16),
  revision bigint not null default 1,
  state jsonb not null,
  name text generated always as (state->>'name') stored,
  status text generated always as (state->>'status') stored,
  capacity integer generated always as ((state->>'capacity')::integer) stored,
  member_count integer generated always as (jsonb_array_length(state->'members')) stored,
  next_tick_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  check (state->>'id' = id::text),
  check (state->>'ownerId' = owner_id::text)
);
create table if not exists public.rb_memberships (
  league_id uuid not null references public.rb_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  primary key (league_id, user_id)
);
create index if not exists rb_due_leagues on public.rb_leagues(next_tick_at) where next_tick_at is not null;
create index if not exists rb_user_memberships on public.rb_memberships(user_id);
alter table public.rb_leagues enable row level security;
alter table public.rb_memberships enable row level security;
-- Full states contain private preparations, RNG and future results. Only the
-- authenticated Edge API returns an explicitly filtered projection.
revoke all on public.rb_leagues, public.rb_memberships from public, anon, authenticated, service_role;
grant select on public.rb_leagues, public.rb_memberships to service_role;

create or replace function public.rb_commit_league(
  p_id uuid, p_expected_revision bigint, p_state jsonb, p_preparation boolean default false
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  old public.rb_leagues;
  new_revision bigint;
  next_tick timestamptz;
begin
  -- A row lock + revision covers purchases, joining, payroll and worker races.
  select * into old from public.rb_leagues where id = p_id for update;
  if not found then
    if p_expected_revision <> 0 or p_preparation then raise exception 'RB_CONFLICT'; end if;
    if p_state->>'status' <> 'lobby' or jsonb_array_length(p_state->'members') <> 1 then raise exception 'RB_INVALID'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_state->>'ownerId', 7020));
    if (select count(*) from public.rb_leagues where owner_id=(p_state->>'ownerId')::uuid) >= 8 then
      raise exception 'Huit ligues créées maximum par compte.';
    end if;
    insert into public.rb_leagues(id, owner_id, invite_code, state)
      values(p_id, (p_state->>'ownerId')::uuid, p_state->>'inviteCode', p_state);
    new_revision := 1;
  else
    if old.revision <> p_expected_revision then raise exception 'RB_CONFLICT'; end if;
    if p_state->>'ownerId' <> old.owner_id::text or p_state->>'inviteCode' <> old.invite_code then raise exception 'RB_INVALID'; end if;
    if p_preparation and (old.state->>'status' = 'broadcast' or
      (old.state->>'status' = 'preparation' and clock_timestamp() >= (old.state->>'nextLockAt')::timestamptz)) then
      raise exception 'RB_LOCKED';
    end if;
    if p_state->>'status' = 'preparation' then next_tick := (p_state->>'nextLockAt')::timestamptz;
    elsif p_state->>'status' = 'broadcast' then
      if exists(select 1 from jsonb_array_elements(p_state->'night'->'games') g where not (g->'broadcast'->'final'->>'finished')::boolean) then
        next_tick := clock_timestamp();
      else
        select min((g->>'endsAt')::timestamptz) into next_tick
          from jsonb_array_elements(p_state->'night'->'games') g where not (g->>'settled')::boolean;
      end if;
    end if;
    update public.rb_leagues set state=p_state, revision=revision+1, next_tick_at=next_tick, updated_at=clock_timestamp()
      where id=p_id returning revision into new_revision;
  end if;
  insert into public.rb_memberships(league_id,user_id)
    select p_id,(m->>'userId')::uuid from jsonb_array_elements(p_state->'members') m
    on conflict do nothing;
  return new_revision;
end;
$$;
revoke all on function public.rb_commit_league(uuid,bigint,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.rb_commit_league(uuid,bigint,jsonb,boolean) to service_role;
commit;
