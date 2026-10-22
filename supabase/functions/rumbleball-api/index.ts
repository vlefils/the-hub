import { createAdmin, createStore, cors, json, metric } from '../_shared/rumbleball.ts';
import { createLeagueService } from '../../../rumbleball/online/server.mjs';
import { createSoloService } from '../../../rumbleball/online/solo-service.mjs';
import { createSoloStore } from '../_shared/solo.ts';
Deno.serve(async (request: Request) => {
  const headers = cors(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Méthode refusée.' }, headers, 405);
  const started = performance.now(), deadline = AbortSignal.timeout(12000), admin = createAdmin(deadline);
  let action = 'auth', ok = false;
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '');
    if (!token) return json({ error: 'Authentification requise.' }, headers, 401);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ error: 'Session invalide ou expirée.' }, headers, 401);
    const body = await request.text();
    if (body.length > 12000000) return json({ error: 'Requête trop volumineuse.' }, headers, 413);
    const command = JSON.parse(body), isSolo = typeof command?.action === 'string' && command.action.startsWith('solo_');
    action = command.action;
    if (!isSolo && body.length > 32000) return json({ error: 'Requête trop volumineuse.' }, headers, 413);
    const service = isSolo ? createSoloService(createSoloStore(admin)) : createLeagueService(createStore(admin), { onMetric: metric });
    const result = await service.command(data.user.id, command); ok = true;
    return json(result, headers);
  } catch (error) {
    console.error('Rumbleball API command failed', (error as Error).message);
    const message = (error as Error).message;
    return json({ error: message.includes('RB_LOCKED') ? 'Équipes verrouillées pour la soirée.' : message.includes('RB_CONFLICT') ? 'Une autre modification vient d’être enregistrée. Réessayez.' : message, code: (error as Error & { code?: string }).code }, headers, 400);
  } finally { console.info(JSON.stringify({ service: 'rumbleball', stage: 'command', action, ok, ms: Math.round(performance.now() - started) })); }
});
