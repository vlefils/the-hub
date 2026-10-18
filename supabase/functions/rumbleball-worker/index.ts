import { store, json } from '../_shared/rumbleball.ts';
import { createLeagueService } from '../../../rumbleball/online/server.mjs';
const service = createLeagueService(store);
Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('RB_WORKER_SECRET');
  if (request.method !== 'POST' || !secret || request.headers.get('x-rumbleball-worker') !== secret) return json({ error: 'Accès refusé.' }, {}, 401);
  const body = await request.json().catch(() => ({}));
  if (typeof body.leagueId !== 'string') return json({ error: 'Ligue requise.' }, {}, 400);
  const results = await service.tick(body.leagueId);
  return json({ results }, {}, results.some((r: any) => !r.ok) ? 500 : 200);
});
