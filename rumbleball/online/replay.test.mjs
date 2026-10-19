import { startReadyLeague as startLeague } from '../test-support/online.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, joinLeague, advanceLeague, leagueProjection } from './league.mjs';
import { createLeagueService } from './server.mjs';
import { mountReplay } from '../replay-ui.mjs';
import { createMatch, stepMatch } from '../engine.mjs';
import { environment, button, descendants } from '../test-support/dom.mjs';

test('replay serveur : archives après changement de soirée, appartenance et aucune fuite privée', async () => {
  const now = '2026-10-18T10:00:00Z';
  let state = createLeague({ id: 'league', userId: 'a', name: 'Ligue', clubName: 'Club A', seed: 'private-secret-seed', inviteCode: 'a'.repeat(32), capacity: 2 }, now);
  state = startLeague(joinLeague(state, 'b', { clubName: 'Club B' }, now), 'a', now);
  state = advanceLeague(state, state.nextLockAt);
  const game = state.night.games[0], archive = structuredClone(game.broadcast); let clock = game.endsAt, reads = 0;
  state = advanceLeague(state, clock); const firstId = game.id;
  state = advanceLeague(state, state.nextLockAt); clock = state.night.startsAt;
  const unchanged = structuredClone(state);
  const service = createLeagueService({ async get() { return { state, revision: 2 }; }, async replay(leagueId, matchId) { reads++; assert.equal(leagueId, 'league'); assert.equal(matchId, firstId); return archive; }, async commit() { assert.fail('Lire un replay ne doit rien écrire.'); } }, { now: () => clock });
  const { replay } = await service.command('a', { action: 'replay', leagueId: 'league', payload: { matchId: firstId } });
  assert.equal(replay.id, firstId); assert.equal(replay.rounds.length, game.broadcast.rounds.length);
  for (const frame of [replay.initial, ...replay.rounds.flatMap(r => r.turns.flatMap(t => [t.before, t.after]))]) { assert.equal(frame.seed, firstId); assert.equal(frame.rng, 0); }
  assert.equal(JSON.stringify(replay).includes('private-secret-seed'), false); assert.deepEqual(state, unchanged);
  await assert.rejects(() => service.command('outsider', { action: 'replay', leagueId: 'league', payload: { matchId: firstId } }), /réservé/);
  await assert.rejects(() => service.command('a', { action: 'replay', leagueId: 'league', payload: { matchId: state.night.games[0].id } }), /après la fin/);
  assert.equal(reads, 1); assert.equal(leagueProjection(state, 'b', clock).history[0].replayAvailable, true);
});

test('lecteur : parcours, vitesses, pause et navigation utilisent exclusivement les images enregistrées', async t => {
  const e = environment(), timers = new Map(); let serial = 0, frames = [], pauses = 0;
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => { timers.set(++serial, { fn, delay }); return serial; });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const initial = createMatch(), first = stepMatch(initial), second = stepMatch(first.state);
  const replay = { initial, rounds: [{ round: 1, turns: [{ before: initial, after: first.state, events: first.events }] }, { round: 2, turns: [{ before: first.state, after: second.state, events: second.events }] }] };
  const original = structuredClone(replay);
  const reader = mountReplay(e.root, replay, () => ({ pause() { pauses++; }, broadcast(frame, elapsed, options) { frames.push({ frame, elapsed, options }); } }));
  assert.equal(frames.at(-1).frame.turns.length, 0);
  await button(e.root, 'Round suivant').click(); assert.deepEqual(frames.at(-1).frame.turns, replay.rounds[0].turns);
  const speed = e.root.querySelector('select'); speed.value = '4'; await speed.emit('change');
  await button(e.root, 'Lire le replay').click(); assert.equal([...timers.values()][0].delay, 3000);
  assert.deepEqual(frames.at(-1).frame.turns, replay.rounds[1].turns); assert.equal(frames.at(-1).frame.previousEvents.length, 1);
  await button(e.root, 'Mettre le replay en pause').click(); assert.equal(timers.size, 0); assert.equal(frames.at(-1).options.animate, false);
  await button(e.root, 'Revenir au début').click(); assert.equal(frames.at(-1).frame.turns.length, 0);
  const cursor = descendants(e.root).find(n => n.type === 'range'); cursor.value = '1'; await cursor.emit('input');
  assert.deepEqual(frames.at(-1).frame.turns, replay.rounds[1].turns);
  reader.stop(); assert.ok(pauses > 0); assert.equal(timers.size, 0); assert.deepEqual(replay, original);
});
