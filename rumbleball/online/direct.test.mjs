import test from 'node:test';
import assert from 'node:assert/strict';
import { directState, countdown } from './direct.mjs';
import { createDirectDesk } from './direct-ui.mjs';
import { environment } from '../test-support/dom.mjs';
import { createLeague, addBot, startLeague, advanceLeague, leagueProjection } from './league.mjs';

const at = value => Date.parse(`2026-10-21T18:${value}Z`);
const game = { id: 'one', homeId: 'a', awayId: 'b', startsAt: '2026-10-21T18:00:00Z', playsAt: '2026-10-21T18:00:08Z', endsAt: '2026-10-21T18:05:00Z' };
const next = { id: 'two', homeId: 'c', awayId: 'd', startsAt: '2026-10-21T18:07:00Z', playsAt: '2026-10-21T18:07:08Z' };
const league = () => ({ name: 'Le direct', status: 'broadcast', members: ['a', 'b', 'c', 'd'].map(userId => ({ userId, name: `Club ${userId}` })), games: [structuredClone(game), structuredClone(next)], broadcast: { id: 'one', initial: {}, startsAt: game.startsAt, playsAt: game.playsAt, roundStartsAt: game.playsAt, turns: [] } });

test('direct : avant-match, entrée, match, pause exacte de deux minutes et rencontre suivante', () => {
  const l = league(), before = { ...l, status: 'preparation', nextLockAt: game.startsAt, upcoming: [{ homeId: 'a', awayId: 'b' }] };
  assert.equal(directState(before, at('00:00') - 1).phase, 'before');
  assert.equal(directState(before, at('00:00')).phase, 'delayed');
  assert.equal(directState(l, at('00:00')).phase, 'entrance');
  assert.equal(directState(l, at('00:04.500')).phase, 'countdown');
  assert.equal(directState(l, at('00:08')).phase, 'delayed');
  l.broadcast.turns = [{}]; assert.equal(directState(l, at('00:08')).phase, 'live');
  assert.equal(directState(l, at('05:00')).phase, 'break');
  assert.equal(countdown(directState(l, at('05:00')).deadline, at('05:00')), '02:00');
  assert.equal(directState(l, at('07:00')).match.id, 'two'); assert.equal(directState(l, at('07:00')).phase, 'entrance');
  l.waitingForServer = true; assert.equal(directState(l, at('07:08')).phase, 'delayed');
});

test('direct : sortie publiée après la fin, reprise tardive et terrain vide pendant la pause', () => {
  const l = { ...league(), broadcast: null, closing: { id: 'one', endsAt: game.endsAt, duration: 7000, state: {} } };
  assert.equal(directState(l, at('05:00')).phase, 'exit');
  assert.equal(directState(l, at('05:06.999')).phase, 'exit');
  assert.equal(directState(l, at('05:07')).phase, 'break');
  assert.equal(directState(l, at('07:00')).phase, 'entrance');
});

test('direct serveur : état final réservé à la sortie, privé avant le résultat et absent après sept secondes', () => {
  const now = '2026-10-21T10:00:00Z';
  const lobby = addBot(createLeague({ id: 'l', userId: 'a', name: 'Sortie', clubName: 'Club', seed: 'compacted', inviteCode: 'a'.repeat(32) }, now), 'a');
  let state = advanceLeague(startLeague(lobby, 'a', now, { firstMatchAt: game.startsAt }), game.startsAt);
  const end = state.night.endsAt;
  assert.equal(leagueProjection(state, 'a', new Date(Date.parse(end) - 1)).closing, null);
  state = advanceLeague(state, end);
  const final = structuredClone(state.night.games[0].broadcast.final), view = leagueProjection(state, 'a', end);
  assert.ok(view.closing); assert.equal(view.closing.state.finished, true); assert.equal(view.closing.state.rng, 0);
  assert.equal(view.closing.state.seed, state.night.games[0].id);
  assert.deepEqual(state.night.games[0].broadcast.final, final);
  assert.equal(leagueProjection(state, 'a', new Date(Date.parse(end) + 7000)).closing, null);
});

test('direct : ancienne soirée ne remplace pas le programme suivant, compte à rebours sans valeur négative', () => {
  const l = { ...league(), status: 'preparation', nextLockAt: '2026-10-22T18:00:00Z', upcoming: [{ homeId: 'b', awayId: 'c' }] };
  assert.equal(directState(l, at('10:00')).match.homeId, 'b'); assert.equal(directState(l, at('10:00')).phase, 'before');
  assert.equal(countdown(game.startsAt, at('00:01')), '00:00'); assert.equal(countdown(null, at('00:00')), '—');
  assert.equal(countdown('2026-10-21T19:00:01Z', at('00:00')), '1:00:01');
});

test('direct serveur : huit secondes d’entrée, aucun tour futur exposé, anciennes dates conservées', () => {
  const now = '2026-10-21T10:00:00Z';
  const lobby = addBot(createLeague({ id: 'l', userId: 'a', name: 'Direct', clubName: 'Club', seed: 'entrance', inviteCode: 'a'.repeat(32) }, now), 'a');
  const state = advanceLeague(startLeague(lobby, 'a', now, { firstMatchAt: game.startsAt }), game.startsAt, { maxRounds: 0 });
  const view = leagueProjection(state, 'a', game.startsAt);
  assert.equal(Date.parse(view.broadcast.playsAt) - Date.parse(view.broadcast.startsAt), 8000); assert.equal(view.broadcast.turns.length, 0);
  assert.equal(view.broadcast.initial.rng, 0); assert.equal(view.broadcast.initial.seed, view.broadcast.id);
  state.night.games[0].playsAt = '2026-10-21T18:00:03.500Z';
  assert.equal(leagueProjection(state, 'a', game.startsAt).broadcast.playsAt, '2026-10-21T18:00:03.500Z');
});

test('bureau du direct : horloge serveur, scène conservée, arrivée tardive et arrêt des minuteries', t => {
  const e = environment(), pending = new Map(), frames = []; let serial = 0, now = at('00:02');
  t.mock.method(globalThis, 'setTimeout', fn => { pending.set(++serial, fn); return serial; }); t.mock.method(globalThis, 'clearTimeout', id => pending.delete(id));
  const live = document.createElement('div'), desk = createDirectDesk(live, { clock: () => now, onFrame: (...args) => frames.push(args) }), l = league(); e.root.append(desk.root);
  desk.update(l); assert.equal(desk.root.dataset.phase, 'entrance'); assert.equal(frames[0][2].elapsed, 2000);
  const stage = e.root.querySelector('.rb-direct-stage'), programme = e.root.querySelector('.rb-direct-programme'), first = programme.children[0];
  programme.scrollLeft = 100; desk.update(l); assert.equal(e.root.querySelector('.rb-direct-stage') === stage, true); assert.equal(frames.length, 1);
  assert.equal(programme.children[0] === first, true); assert.equal(programme.scrollLeft, 100);
  now = at('05:00'); desk.update({ ...l, broadcast: null }); assert.equal(desk.root.dataset.phase, 'break'); assert.equal(e.root.querySelector('.rb-direct-clock').textContent, '02:00');
  assert.match(e.root.querySelector('.rb-direct-recap').textContent, /Résultat en cours de confirmation/);
  desk.update({ ...l, broadcast: null, games: [{ ...game, result: { winnerId: 'a' } }, next] }); assert.match(e.root.querySelector('.rb-direct-recap').textContent, /Victoire : Club a/);
  desk.stop(); assert.equal(pending.size, 0);
  const lateFrames = [], late = createDirectDesk(live, { clock: () => at('01:00'), onFrame: (...args) => lateFrames.push(args) });
  late.update({ ...l, broadcast: { ...l.broadcast, turns: [{}], roundStartsAt: '2026-10-21T18:00:56Z' } });
  assert.equal(lateFrames[0][1], 4000); assert.equal(lateFrames[0][2], null); late.stop();
});
