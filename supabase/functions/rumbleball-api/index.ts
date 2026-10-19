import { admin, store, cors, json } from '../_shared/rumbleball.ts';
import { createLeagueService } from '../../../rumbleball/online/server.mjs';
import { createSoloService } from '../../../rumbleball/online/solo-service.mjs';
import { soloStore } from '../_shared/solo.ts';
const service = createLeagueService(store);
const solo = createSoloService(soloStore);
Deno.serve(async (request: Request) => {
  const headers = cors(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Méthode refusée.' }, headers, 405);
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '');
    if (!token) return json({ error: 'Authentification requise.' }, headers, 401);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ error: 'Session invalide ou expirée.' }, headers, 401);
    const body = await request.text();
    if (body.length > 12000000) return json({ error: 'Requête trop volumineuse.' }, headers, 413);
    const command = JSON.parse(body), isSolo = typeof command?.action === 'string' && command.action.startsWith('solo_');
    if (!isSolo && body.length > 32000) return json({ error: 'Requête trop volumineuse.' }, headers, 413);
    return json(await (isSolo ? solo : service).command(data.user.id, command), headers);
  } catch (error) {
    console.error('Rumbleball API command failed', (error as Error).message);
    const message = (error as Error).message;
    return json({ error: message.includes('RB_LOCKED') ? 'Équipes verrouillées pour la soirée.' : message.includes('RB_CONFLICT') ? 'Une autre modification vient d’être enregistrée. Réessayez.' : message, code: (error as Error & { code?: string }).code }, headers, 400);
  }
});
