import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
import { prepareLeagueCommit, decodeReplayArchive } from '../../../rumbleball/online/replay-codec.mjs';

export const createAdmin = (signal?: AbortSignal) => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url: RequestInfo | URL, init?: RequestInit) => fetch(url, { ...init,
    signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : []), ...(init?.signal ? [init.signal] : [])]) }) },
});
export const admin = createAdmin();
export const metric = (stage: string, ms: number) => console.info(JSON.stringify({ service: 'rumbleball', stage, ms: Math.round(ms) }));
export const measured = async (stage: string, query: PromiseLike<any>) => {
  const start = performance.now(); let ok = false;
  try { const { data, error } = await query; if (error) throw new Error(error.message); ok = true; return data; }
  finally { console.info(JSON.stringify({ service: 'rumbleball', stage, ok, ms: Math.round(performance.now() - start) })); }
};
export function createStore(client = admin) {
  const commitLeague = async (id: string, revision: number, state: any, preparation: boolean) => {
    const split = revision > 0 && (state.matchStorage === 2 || Deno.env.get('RB_SPLIT_MATCH_STORAGE') === 'true');
    // Split storage keeps immutable rounds in their own table; its completed
    // games need no full replay compression during a league commit.
    const prepared = state.matchStorage === 2 ? state : await prepareLeagueCommit(state);
    return measured('league.commit', client.rpc(split ? 'rb_commit_league_v2' : 'rb_commit_league', {
      p_id: id, p_expected_revision: revision, p_state: prepared, p_preparation: preparation }));
  };
  return {
  async claim(id: string) { return measured('league.claim', client.rpc('rb_claim_tick_v2', { p_id: id })); },
  async commitTick(id: string, revision: number, state: unknown) { return commitLeague(id, revision, state, false); },
  async get(id: string, { now = new Date().toISOString(), broadcast = false } = {}) {
    return measured('league.read', client.rpc('rb_read_league', { p_id: id, p_now: now, p_frames: broadcast }));
  },
  async invite(code: string) { return measured('league.invite', client.from('rb_leagues').select('id,revision,state').eq('invite_code', code).maybeSingle()); },
  async replay(leagueId: string, matchId: string) {
    const row = await measured('replay.read', client.from('rb_replays').select('replay').eq('league_id', leagueId).eq('match_id', matchId).maybeSingle());
    return row ? await decodeReplayArchive(row.replay, matchId)
      : measured('replay.rounds', client.rpc('rb_read_match_replay', { p_league_id: leagueId, p_match_id: matchId }));
  },
  async commit(id: string, revision: number, state: unknown, preparation: boolean) {
    return commitLeague(id, revision, state, preparation);
  },
  async list(userId: string) {
    const memberships = await measured('league.memberships', client.from('rb_memberships').select('league_id').eq('user_id', userId));
    if (!memberships.length) return [];
    const rows = await measured('league.list', client.from('rb_leagues').select('id,name,status,capacity,member_count,bot_count').in('id', memberships.map((m: any) => m.league_id)));
    return rows.map((r: any) => ({ id: r.id, name: r.name, status: r.status, members: r.member_count + r.bot_count, capacity: r.status === 'lobby' ? null : r.capacity }));
  },
  async due(now: string) { return measured('league.due', client.from('rb_leagues').select('id').lte('next_tick_at', now).order('next_tick_at').limit(1)); },
  };
}
export const store = createStore();
export function cors(request: Request) {
  const origins = (Deno.env.get('RB_ALLOWED_ORIGINS') ?? 'https://vlefils.github.io,http://127.0.0.1:8765,http://localhost:8765').split(',');
  const origin = request.headers.get('Origin') ?? '';
  return { 'Access-Control-Allow-Origin': origins.includes(origin) ? origin : origins[0], 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
}
export const json = (data: unknown, headers: Record<string, string>, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
