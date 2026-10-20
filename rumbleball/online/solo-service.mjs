import { importCareer } from '../career-storage.mjs';

const need = (ok, message) => { if (!ok) throw new Error(message); };
const validId = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export const soloSummary = row => ({ id: row.id, revision: Number(row.revision), clubName: row.club_name ?? row.state?.clubs[0].name ?? 'Nouvelle partie',
  mode: row.mode ?? row.state?.mode ?? 'classic', division: Number(row.division ?? row.state?.longCareer?.division) || null,
  season: row.season ?? row.state?.season ?? null, completedDays: row.completed_days ?? row.state?.completedDays ?? 0,
  status: row.status ?? row.state?.status ?? 'empty', updatedAt: row.updated_at, createdAt: row.created_at, isCopy: Boolean(row.forked_from) });

export function createSoloService(store, { uuid = () => crypto.randomUUID() } = {}) {
  async function commit(owner, values) {
    try { return await store.commit(owner, values); }
    catch (error) {
      if (error.message.includes('RB_SOLO_CONFLICT')) throw Object.assign(new Error('Une version plus récente de cette partie existe sur le compte.'), { code: 'SOLO_CONFLICT' });
      if (error.message.includes('RB_SOLO_NOT_FOUND')) throw Object.assign(new Error('Partie introuvable sur ce compte.'), { code: 'SOLO_NOT_FOUND' });
      throw error;
    }
  }
  async function read(owner, id) {
    need(validId(id), 'Identifiant de partie invalide.');
    const row = await store.get(owner, id); need(row, 'Partie introuvable sur ce compte.');
    return { ...soloSummary(row), state: row.state };
  }
  return { async command(userId, { action, payload = {} }) {
    need(userId, 'Authentification requise.');
    // This is an account-switch guard, never the source of authorization.
    need(payload.accountId === userId, 'Le compte connecté a changé. Reconnectez-vous au compte de cette partie.');
    if (action === 'solo_list') return { games: (await store.list(userId)).map(soloSummary) };
    if (action === 'solo_get') return { game: await read(userId, payload.id) };
    if (action === 'solo_create') {
      const id = uuid(); await commit(userId, { id, revision: 0, state: null, writeId: uuid() });
      return { game: await read(userId, id) };
    }
    if (action === 'solo_import') {
      const state = importCareer(payload.json);
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(state)));
      const importKey = [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
      const saved = await commit(userId, { id: uuid(), revision: 0, state, writeId: uuid(), importKey });
      return { game: await read(userId, saved.id), alreadyImported: Boolean(saved.alreadyImported) };
    }
    need(action === 'solo_save', 'Commande solo inconnue.');
    need(validId(payload.id) && validId(payload.writeId), 'Identifiant de sauvegarde invalide.');
    need(Number.isSafeInteger(payload.revision) && payload.revision >= 0, 'Révision de sauvegarde invalide.');
    need(payload.forkedFrom === undefined || validId(payload.forkedFrom), 'Identifiant de copie invalide.');
    const state = payload.json === null ? null : importCareer(payload.json);
    return { saved: await commit(userId, { id: payload.id, revision: payload.revision, state, writeId: payload.writeId, forkedFrom: payload.forkedFrom }) };
  } };
}
