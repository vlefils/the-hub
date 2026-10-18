import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, joinLeague, startLeague, editPreparation, advanceLeague, nextLock, isLocked, fixturesFor, leagueProjection, ONLINE_RULES } from './league.mjs';
import { salary } from '../progression.mjs';
import { createLeagueService } from './server.mjs';

const day = '2026-10-18T10:00:00Z', lock = '2026-10-18T18:00:00.000Z';
function fixture(capacity = 2) {
  let s = createLeague({ id: 'league', userId: 'u0', name: 'Ligue des Rebuts', clubName: 'Les Recrues', inviteCode: 'a'.repeat(32), seed: 'online-tests', capacity }, day);
  for (let i = 1; i < capacity; i++) s = joinLeague(s, `u${i}`, { clubName: `Club ${i}` }, day);
  return startLeague(s, 'u0', day);
}

test('Paris : 20 h en été/hiver, changement d’heure et frontière exacte du verrouillage', () => {
  assert.equal(nextLock(day), lock);
  assert.equal(nextLock('2026-10-25T10:00:00Z'), '2026-10-25T19:00:00.000Z');
  assert.equal(nextLock('2027-03-28T10:00:00Z'), '2027-03-28T18:00:00.000Z');
  assert.equal(nextLock('2026-12-31T20:00:00Z'), '2027-01-01T19:00:00.000Z');
  assert.equal(nextLock(lock), '2026-10-19T18:00:00.000Z');
  const s = fixture(); assert.equal(isLocked(s, '2026-10-18T17:59:59.999Z'), false); assert.equal(isLocked(s, lock), true);
});
test('lobby : capacité, propriétaire, participants uniques et absence de démarrage incomplet', () => {
  const s = createLeague({ id: 'l', userId: 'u', name: 'Ligue', clubName: 'Club', inviteCode: 'a'.repeat(32), seed: 's' }, day);
  assert.throws(() => startLeague(s, 'u', day), /complète/);
  assert.throws(() => joinLeague(s, 'u', { clubName: 'Autre' }, day), /déjà/);
  assert.throws(() => startLeague(s, 'other', day), /créateur/);
  const full = fixture(); assert.throws(() => joinLeague(full, 'new', { clubName: 'Tard' }, day), /commencé/);
});
test('préparation : achats et équipe persistants, annulation intégrale et état initial non muté', () => {
  const s = fixture(), before = structuredClone(s), member = s.members[0];
  assert.equal(member.club.players.length, 6); assert.equal(member.club.balance, 600);
  let prepared = editPreparation(s, 'u0', 'buy', { itemId: 'vest', playerId: member.club.players[0].id, balance: 999999 }, day);
  assert.equal(prepared.members[0].club.balance, 600); assert.equal(prepared.members[0].draft.balance, 500);
  assert.equal(prepared.members[0].draft.inventory.length, 1);
  prepared = editPreparation(prepared, 'u0', 'cancel', {}, day);
  assert.deepEqual(prepared, before); assert.deepEqual(s, before);
  assert.throws(() => editPreparation(s, 'u0', 'cancel', {}, lock), /verrouillées/);
  assert.throws(() => editPreparation(s, 'intruder', 'buy', {}, day), /participez/);
  assert.throws(() => editPreparation(s, 'u0', 'replaceState', { balance: 999999 }, day), /inconnue/);
});
test('calendrier : aller-retour complet pour 2, 4, 6 et 8 clubs, un match par club et journée', () => {
  for (const capacity of [2, 4, 6, 8]) {
    const s = fixture(capacity), pairs = new Set();
    for (s.day = 0; s.day < 2 * (capacity - 1); s.day++) {
      const fixtures = fixturesFor(s); assert.equal(new Set(fixtures.flat()).size, capacity);
      for (const [home, away] of fixtures) { const key = `${home}:${away}`; assert.equal(pairs.has(key), false); pairs.add(key); }
    }
    assert.equal(pairs.size, capacity * (capacity - 1));
  }
});
test('soirée : tous figés à 20 h, salaires uniques, revenu fixe, deux minutes de pause et résultats à l’heure', () => {
  let s = fixture(6); const initial = structuredClone(s);
  s = editPreparation(s, 'u0', 'buy', { itemId: 'vest', playerId: s.members[0].club.lineup[0] }, day);
  s = advanceLeague(s, lock); assert.equal(s.status, 'broadcast'); assert.equal(s.night.games.length, 3);
  assert.equal(s.members[0].draft, null); assert.equal(s.members[0].club.inventory.length, 1);
  for (const m of s.members) {
    const wages = m.club.transactions.filter((t) => t.label === 'Salaires de la journée'); assert.equal(wages.length, 1);
    assert.equal(wages[0].amount, -90);
    assert.equal(m.club.transactions.filter((t) => t.label === 'Revenu de ligue').length, 1);
  }
  const [first, second] = s.night.games;
  assert.equal(Date.parse(second.startsAt) - Date.parse(first.endsAt), ONLINE_RULES.breakMs);
  const again = advanceLeague(s, lock); assert.deepEqual(again, s);
  const beforeEnd = leagueProjection(s, 'u0', new Date(Date.parse(first.endsAt) - 1)); assert.equal(beforeEnd.games[0].result, null);
  const partial = advanceLeague(s, first.endsAt); assert.equal(partial.status, 'broadcast'); assert.equal(partial.history.length, 1);
  const finished = advanceLeague(partial, s.night.endsAt); assert.equal(finished.status, 'preparation'); assert.equal(finished.completedDays, 1);
  assert.equal(finished.history.length, 3);
  for (const m of finished.members) {
    const winner = finished.history.some((g) => g.winnerId === m.userId);
    assert.equal(m.club.balance, 600 - (m.userId === 'u0' ? 100 : 0) + 210 - 90 + Number(winner) * 100);
    assert.ok(m.club.players.filter((p) => m.club.lineup.includes(p.id)).every((p) => p.xp === 10));
    assert.ok(m.club.players.filter((p) => !m.club.lineup.includes(p.id)).every((p) => p.xp === 4));
  }
  assert.deepEqual(advanceLeague(finished, s.night.endsAt), finished);
  assert.equal(initial.members[0].club.balance, 600);
});
test('diffusion : pas de préparation adverse, pas de prochain round, pas de graine privée', () => {
  let s = fixture(); s = editPreparation(s, 'u0', 'sell', { playerId: s.members[0].club.players[5].id }, day);
  const other = leagueProjection(s, 'u1', day); assert.equal(other.club.players.length, 6);
  assert.equal('draft' in other.members[0], false); assert.equal('seed' in other, false);
  s = advanceLeague(s, lock); const g = s.night.games[0], p = leagueProjection(s, 'u0', g.playsAt);
  assert.equal(p.broadcast.turns[0].before.round, 1); assert.ok(p.broadcast.turns.length <= 10);
  assert.equal(p.broadcast.initial.rng, 0); assert.equal(p.broadcast.initial.seed, g.id);
  assert.equal('config' in p.games[0], false); assert.equal('broadcast' in p.games[0], false);
  assert.equal(p.games[0].result, null); assert.throws(() => leagueProjection(s, 'outsider', lock), /réservé/);
});
test('revenu fixe : couvre six salaires niveau 5, achat sans découvert, dette réduite par revenu', () => {
  let s = fixture(); const c = s.members[0].club; c.players.forEach((p) => { p.xp = 140; }); c.balance = -50;
  assert.equal(c.players.reduce((n, p) => n + salary(p), 0), ONLINE_RULES.dailyIncome);
  assert.throws(() => editPreparation(s, 'u0', 'buy', { itemId: 'vest' }, day), /impayés/);
  s = advanceLeague(s, lock); assert.equal(s.members[0].club.balance, -50);
  assert.equal(s.members[0].club.transactions.filter((t) => t.label === 'Revenu de ligue')[0].amount, 210);
});
test('deux saisons : progression conservée, fatigue remise à zéro et récupération sans avalanche de journées', () => {
  let s = fixture();
  for (let i = 0; i < 4; i++) { s = advanceLeague(s, s.nextLockAt); s = advanceLeague(s, s.night.endsAt); }
  assert.equal(s.season, 3); assert.equal(s.day, 0); assert.equal(s.completedDays, 4); assert.equal(s.history.length, 4);
  assert.ok(s.members.every((m) => m.club.players.every((p) => p.fatigue === 0 && p.xp > 0)));
  let late = advanceLeague(s, '2027-10-18T22:00:00Z'); assert.equal(late.completedDays, 4); assert.equal(late.status, 'broadcast');
  late = advanceLeague(late, late.night.endsAt); assert.equal(late.completedDays, 5); assert.equal(late.nextLockAt, '2027-10-19T18:00:00.000Z');
});

test('worker fractionné : un seul round par appel, même résultat que le calcul complet et attente explicite si retard', () => {
  const initial = fixture(6), full = advanceLeague(initial, lock);
  let sliced = advanceLeague(initial, lock, { maxRounds: 1 });
  assert.deepEqual(sliced.night.games.map((g) => g.broadcast.rounds.length), [1, 0, 0]);
  const delayed = leagueProjection(sliced, 'u0', '2026-10-18T18:01:00Z');
  assert.equal(delayed.broadcast, null); assert.equal(delayed.waitingForServer, true); assert.equal(delayed.games[0].result, null);
  let calls = 1;
  while (sliced.night.games.some((g) => !g.broadcast.final.finished)) {
    assert.ok(++calls <= 39); sliced = advanceLeague(sliced, lock, { maxRounds: 1 });
  }
  assert.deepEqual(sliced, full);
  const done = advanceLeague(sliced, sliced.night.endsAt, { maxRounds: 1 });
  assert.equal(done.history.length, 3); assert.equal(done.completedDays, 1);
});

test('service : authentification, projection, conflit réessayé et double worker sans double paiement', async () => {
  let state = fixture(), revision = 1, conflicts = 1, clock = day;
  const store = {
    async get(id) { return id === state.id ? { id, state: structuredClone(state), revision } : null; },
    async commit(id, expected, next) { if (conflicts-- > 0 || expected !== revision) throw new Error('RB_CONFLICT'); state = next; return ++revision; },
    async due() { return [{ id: state.id }]; }, async list() { return []; },
  };
  const service = createLeagueService(store, { now: () => clock });
  await assert.rejects(() => service.command(null, { action: 'get', leagueId: 'league' }), /Authentification/);
  await assert.rejects(() => service.command('other', { action: 'get', leagueId: 'league' }), /réservé/);
  const updated = await service.command('u0', { action: 'color', leagueId: 'league', payload: { color: '#abc123' } });
  assert.equal(updated.league.club.kitColor, '#abc123'); assert.equal(updated.league.hasDraft, true);
  clock = lock; await Promise.all([service.tick(), service.tick()]);
  assert.equal(state.members[0].club.transactions.filter((t) => t.label === 'Salaires de la journée').length, 1);
  let calls = 0; while (!state.night.games[0].broadcast.final.finished) { assert.ok(++calls <= 13); await service.tick(); }
  clock = state.night.endsAt; await service.tick(); await service.tick(); assert.equal(state.history.length, 1);
});
