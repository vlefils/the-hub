// Transport-independent handlers, exercised with a fake DB and real game engine.
import { createLeague, joinLeague, startLeague, addBot, removeBot, editPreparation, advanceLeague, leagueProjection, replayProjection, historyProjection } from './league.mjs';
const need = (ok, message) => { if (!ok) throw new Error(message); };
export function createLeagueService(store, { now = () => new Date().toISOString(), uuid = () => crypto.randomUUID(), onMetric = () => {} } = {}) {
  function timed(stage, run) { const start = performance.now(); try { return run(); } finally { onMetric(stage, performance.now() - start); } }
  const project = (state, userId, options) => timed('league.projection', () => leagueProjection(state, userId, now(), options));
  async function update(id, transition, preparation, initial) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = attempt === 0 && initial ? initial : await store.get(id); need(row, 'Ligue introuvable.');
      const state = transition(row.state, now());
      try { const revision = await store.commit(id, row.revision, state, preparation); return { ...row, state, revision }; }
      catch (error) { if (!error.message.includes('RB_CONFLICT') || attempt === 3) throw error; }
    }
  }
  async function command(userId, request) {
    need(userId, 'Authentification requise.');
    const { action, leagueId, payload = {} } = request;
    need(payload.accountId === undefined || payload.accountId === userId, 'Le compte connecté a changé. Reconnectez-vous au compte de cette ligue.');
    if (action === 'create') {
      const id = uuid(), state = createLeague({ ...payload, id, userId, inviteCode: uuid().replaceAll('-', ''), seed: uuid() }, now());
      const revision = await store.commit(id, 0, state, false); return { league: project(state, userId, { broadcast: false, historyLimit: payload.view === undefined ? null : 30 }), revision };
    }
    if (action === 'list') return { leagues: await store.list(userId), serverTime: now() };
    if (action === 'join') {
      need(typeof payload.code === 'string' && /^[a-f0-9]{32}$/.test(payload.code), 'Code d’invitation invalide.');
      const row = await store.invite(payload.code); need(row, 'Invitation introuvable.');
      const updated = await update(row.id, (s, time) => joinLeague(s, userId, payload, time), false, row);
      return { league: project(updated.state, userId, { broadcast: false, historyLimit: payload.view === undefined ? null : 30 }), revision: updated.revision };
    }
    const row = await store.get(leagueId, { now: now(), broadcast: action === 'get' && (payload.view === undefined || payload.view === 'Direct') });
    need(row?.state.members.some((m) => m.userId === userId), 'Accès réservé aux participants.');
    if (action === 'get') return { league: project(row.state, userId, { broadcast: payload.view === undefined || payload.view === 'Direct', historyLimit: payload.view === undefined ? null : 30 }), revision: row.revision };
    if (action === 'history') return historyProjection(row.state, userId, payload, now());
    if (action === 'replay') {
      need(typeof payload.matchId === 'string' && payload.matchId.length <= 200, 'Identifiant de rencontre invalide.');
      const result = row.state.history.find(g => g.id === payload.matchId);
      need(result && Date.parse(result.endsAt) <= Date.parse(now()), 'Replay disponible uniquement après la fin de la rencontre.');
      const archive = await store.replay?.(leagueId, payload.matchId);
      return { replay: replayProjection(row.state, userId, payload.matchId, archive, now()) };
    }
    const updated = await update(leagueId, (s, time) => {
      need(s.members.some(m => m.userId === userId), 'Accès réservé aux participants.');
      if (action === 'start') return startLeague(s, userId, time, payload);
      if (action === 'addBot') return addBot(s, userId);
      if (action === 'removeBot') return removeBot(s, userId, payload.botId);
      return editPreparation(s, userId, action, payload, time);
    }, true, row);
    return { league: project(updated.state, userId, { broadcast: false, historyLimit: payload.view === undefined ? null : 30 }), revision: updated.revision };
  }
  async function tick(leagueId) {
    const due = leagueId ? [{ id: leagueId }] : await store.due(now()), results = [];
    for (const row of due) {
      try {
        if (store.claim) {
          const claimed = await store.claim(row.id);
          if (!claimed) { results.push({ id: row.id, ok: true, skipped: true }); continue; }
          const state = timed('league.compute', () => advanceLeague(claimed.state, claimed.claimedAt ?? now(), { maxRounds: 1 }));
          await (store.commitTick ?? store.commit)(row.id, claimed.revision, state, false);
        } else await update(row.id, (s, time) => advanceLeague(s, time, { maxRounds: 1 }), false);
        results.push({ id: row.id, ok: true });
      } catch (error) {
        // Another committed revision already won. Do not recalculate the same
        // round four times while the database is under pressure.
        if (store.claim && error.message.includes('RB_CONFLICT')) results.push({ id: row.id, ok: true, skipped: true });
        else results.push({ id: row.id, ok: false, error: error.message });
      }
    }
    return results;
  }
  return { command, tick };
}
