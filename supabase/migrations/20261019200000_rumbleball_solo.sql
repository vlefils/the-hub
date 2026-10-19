-- Account-owned solo games. No changes to Riftbound or multiplayer league data.
begin;
create table if not exists public.rb_solo_saves (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision >= 1),
  state jsonb,
  import_key text,
  last_write_id uuid not null,
  forked_from uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  club_name text generated always as (state #>> '{clubs,0,name}') stored,
  season integer generated always as ((state->>'season')::integer) stored,
  completed_days integer generated always as ((state->>'completedDays')::integer) stored,
  status text generated always as (state->>'status') stored,
  constraint rb_solo_state_size check (state is null or octet_length(state::text) <= 8000000),
  constraint rb_solo_import_key check (import_key is null or length(import_key) = 64),
  unique(owner_id, import_key)
);
create index if not exists rb_solo_owner_updated on public.rb_solo_saves(owner_id, updated_at desc);
alter table public.rb_solo_saves enable row level security;
revoke all on public.rb_solo_saves from public, anon, authenticated, service_role;
grant select on public.rb_solo_saves to service_role;

create or replace function public.rb_commit_solo(
  p_owner_id uuid, p_id uuid, p_expected_revision bigint, p_state jsonb,
  p_write_id uuid, p_import_key text default null, p_forked_from uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  old public.rb_solo_saves;
  saved public.rb_solo_saves;
begin
  if p_expected_revision < 0 or p_write_id is null then raise exception 'RB_SOLO_INVALID'; end if;
  -- Serialize creations by account, including imports retried after a lost reply.
  if p_expected_revision = 0 then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text, 7030));
    if p_import_key is not null then
      select * into saved from public.rb_solo_saves where owner_id=p_owner_id and import_key=p_import_key;
      if found then return jsonb_build_object('id', saved.id, 'revision', saved.revision, 'updatedAt', saved.updated_at, 'alreadyImported', true); end if;
    end if;
  end if;
  select * into old from public.rb_solo_saves where id=p_id for update;
  if found then
    if old.owner_id <> p_owner_id then raise exception 'RB_SOLO_NOT_FOUND'; end if;
    if old.last_write_id = p_write_id then
      return jsonb_build_object('id', old.id, 'revision', old.revision, 'updatedAt', old.updated_at);
    end if;
    if old.revision <> p_expected_revision or p_import_key is not null then raise exception 'RB_SOLO_CONFLICT'; end if;
    update public.rb_solo_saves set state=p_state, revision=revision+1, last_write_id=p_write_id, updated_at=clock_timestamp()
      where id=p_id returning * into saved;
  else
    if p_expected_revision <> 0 then raise exception 'RB_SOLO_NOT_FOUND'; end if;
    if (select count(*) from public.rb_solo_saves where owner_id=p_owner_id) >= 100 then raise exception 'Cent parties maximum par compte.'; end if;
    if p_forked_from is not null and not exists(select 1 from public.rb_solo_saves where id=p_forked_from and owner_id=p_owner_id) then raise exception 'RB_SOLO_NOT_FOUND'; end if;
    insert into public.rb_solo_saves(id, owner_id, state, last_write_id, import_key, forked_from)
      values(p_id, p_owner_id, p_state, p_write_id, p_import_key, p_forked_from) returning * into saved;
  end if;
  return jsonb_build_object('id', saved.id, 'revision', saved.revision, 'updatedAt', saved.updated_at);
end;
$$;
revoke all on function public.rb_commit_solo(uuid,uuid,bigint,jsonb,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.rb_commit_solo(uuid,uuid,bigint,jsonb,uuid,text,uuid) to service_role;
commit;
