import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = ({ data, error }: any) => { if (error) throw new Error(error.message); return data; };
export const store = {
  async get(id: string) { return checked(await admin.from('rb_leagues').select('*').eq('id', id).maybeSingle()); },
  async invite(code: string) { return checked(await admin.from('rb_leagues').select('*').eq('invite_code', code).maybeSingle()); },
  async replay(leagueId: string, matchId: string) {
    const row = checked(await admin.from('rb_replays').select('replay').eq('league_id', leagueId).eq('match_id', matchId).maybeSingle());
    return row?.replay ?? null;
  },
  async commit(id: string, revision: number, state: unknown, preparation: boolean) {
    return checked(await admin.rpc('rb_commit_league', { p_id: id, p_expected_revision: revision, p_state: state, p_preparation: preparation }));
  },
  async list(userId: string) {
    const memberships = checked(await admin.from('rb_memberships').select('league_id').eq('user_id', userId));
    if (!memberships.length) return [];
    const rows = checked(await admin.from('rb_leagues').select('id,name,status,capacity,member_count').in('id', memberships.map((m: any) => m.league_id)));
    return rows.map((r: any) => ({ id: r.id, name: r.name, status: r.status, members: r.member_count, capacity: r.capacity }));
  },
  async due(now: string) { return checked(await admin.from('rb_leagues').select('id').lte('next_tick_at', now).order('next_tick_at').limit(1)); },
};
export function cors(request: Request) {
  const origins = (Deno.env.get('RB_ALLOWED_ORIGINS') ?? 'https://vlefils.github.io,http://127.0.0.1:8765,http://localhost:8765').split(',');
  const origin = request.headers.get('Origin') ?? '';
  return { 'Access-Control-Allow-Origin': origins.includes(origin) ? origin : origins[0], 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
}
export const json = (data: unknown, headers: Record<string, string>, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
