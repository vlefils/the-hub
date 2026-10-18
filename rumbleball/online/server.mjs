// Transport-independent handlers, exercised with a fake DB and real game engine.
import { createLeague, joinLeague, startLeague, editPreparation, advanceLeague, leagueProjection } from './league.mjs';
const need = (ok, message) => { if (!ok) throw new Error(message); };
export function createLeagueService(store, { now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  async function update(id, transition, preparation) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await store.get(id); need(row, 'Ligue introuvable.');
      const state = transition(row.state, now());
      try { const revision = await store.commit(id, row.revision, state, preparation); return { ...row, state, revision }; }
      catch (error) { if (!error.message.includes('RB_CONFLICT') || attempt === 3) throw error; }
    }
  }
  async function command(userId, request) {
    need(userId, 'Authentification requise.');
    const { action, leagueId, payload = {} } = request;
    if (action === 'create') {
      const id = uuid(), state = createLeague({ ...payload, id, userId, inviteCode: uuid().replaceAll('-', ''), seed: uuid() }, now());
      const revision = await store.commit(id, 0, state, false); return { league: leagueProjection(state, userId, now()), revision };
    }
    if (action === 'list') return { leagues: await store.list(userId), serverTime: now() };
    if (action === 'join') {
      need(typeof payload.code === 'string' && /^[a-f0-9]{32}$/.test(payload.code), 'Code d’invitation invalide.');
      const row = await store.invite(payload.code); need(row, 'Invitation introuvable.');
      const updated = await update(row.id, (s, time) => joinLeague(s, userId, payload, time), false);
      return { league: leagueProjection(updated.state, userId, now()), revision: updated.revision };
    }
    const row = await store.get(leagueId);
    need(row?.state.members.some((m) => m.userId === userId), 'Accès réservé aux participants.');
    if (action === 'get') return { league: leagueProjection(row.state, userId, now()), revision: row.revision };
    const updated = await update(leagueId, (s, time) => action === 'start' ? startLeague(s, userId, time) : editPreparation(s, userId, action, payload, time), true);
    return { league: leagueProjection(updated.state, userId, now()), revision: updated.revision };
  }
  async function tick(leagueId) {
    const due = leagueId ? [{ id: leagueId }] : await store.due(now()), results = [];
    for (const row of due) {
      try { await update(row.id, (s, time) => advanceLeague(s, time, { maxRounds: 1 }), false); results.push({ id: row.id, ok: true }); }
      catch (error) { results.push({ id: row.id, ok: false, error: error.message }); }
    }
    return results;
  }
  return { command, tick };
}
