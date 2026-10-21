-- Reserve a due league before loading or calculating any round. Only the worker
-- can claim it; next_tick_at doubles as the retry deadline if that worker dies.
begin;
create or replace function public.rb_claim_tick(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  claimed public.rb_leagues;
begin
  select * into claimed from public.rb_leagues
  where id = p_id and next_tick_at <= clock_timestamp()
    and status in ('recruitment', 'preparation', 'broadcast')
  for update skip locked;
  if not found then return null; end if;
  update public.rb_leagues set next_tick_at = clock_timestamp() + interval '45 seconds'
    where id = claimed.id;
  return jsonb_build_object('id', claimed.id, 'revision', claimed.revision, 'state', claimed.state);
end;
$$;
revoke all on function public.rb_claim_tick(uuid) from public, anon, authenticated;
grant execute on function public.rb_claim_tick(uuid) to service_role;
commit;
