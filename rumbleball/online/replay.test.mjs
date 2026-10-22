import { startReadyLeague as startLeague } from '../test-support/online.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, joinLeague, advanceLeague, leagueProjection } from './league.mjs';
import { createLeagueService } from './server.mjs';
import { mountReplay } from '../replay-ui.mjs';
import { createMatch, stepMatch } from '../engine.mjs';
import { mountMatch } from '../ui.mjs';
import { ENTRY_DURATION, OPENING_DURATION, EXIT_DURATION } from '../match-ceremony.mjs';
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
  t.mock.method(performance, 'now', () => 0);
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
  const count = frames.length;
  await button(e.root, 'Mettre le replay en pause').click(); assert.equal(timers.size, 0); assert.equal(frames.length, count, 'La pause conserve l’image courante.');
  await button(e.root, 'Revenir au début').click(); assert.equal(frames.at(-1).frame.turns.length, 0);
  const cursor = descendants(e.root).find(n => n.type === 'range'); cursor.value = '1'; await cursor.emit('input');
  assert.deepEqual(frames.at(-1).frame.turns, replay.rounds[1].turns);
  reader.stop(); assert.ok(pauses > 0); assert.equal(timers.size, 0); assert.deepEqual(replay, original);
});

function replayClock(t) {
  let time = 0, serial = 0; const timers = new Map(), frames = new Map();
  t.mock.method(performance, 'now', () => time);
  t.mock.method(globalThis, 'setTimeout', (cb, delay) => { timers.set(++serial, { cb, at: time + delay }); return serial; });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  for (const [name, fn] of Object.entries({ requestAnimationFrame: cb => { frames.set(++serial, cb); return serial; }, cancelAnimationFrame: id => frames.delete(id) })) {
    const previous = globalThis[name]; globalThis[name] = fn;
    t.after(() => { if (previous === undefined) delete globalThis[name]; else globalThis[name] = previous; });
  }
  const draw = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(time)); };
  return { timers, frames, elapse(ms) {
    const end = time + ms; let due, count = 0;
    while ((due = [...timers].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= end))) {
      assert.ok(++count < 200, 'La lecture doit laisser avancer le temps.');
      time = due[1].at; draw(); timers.delete(due[0]); due[1].cb();
    }
    time = end; draw();
  } };
}

function recordedReplay() {
  const initial = createMatch(), rounds = []; let state = initial;
  for (let i = 0; i < 2; i++) {
    const round = state.round, turns = [];
    while (state.round === round && !state.finished) {
      const step = stepMatch(state, { stopAtRoundEnd: true });
      turns.push({ before: state, after: step.state, events: step.events }); state = step.state;
    }
    rounds.push({ round, turns });
  }
  return { initial, rounds };
}

test('replay animé : entrée, décompte, ballon, actions, sortie et soigneurs ; vitesse continue dans chaque phase', async t => {
  const e = environment(), c = replayClock(t), replay = recordedReplay();
  globalThis.matchMedia = () => ({ matches: false });
  replay.rounds.at(-1).turns.at(-1).after.players[0].hp = 0;
  const original = structuredClone(replay), reader = mountReplay(e.root, replay, mountMatch); t.after(reader.stop);
  const match = e.root.querySelector('.rb-replay-match'), pawn = () => match.querySelector('.rb-pawn').getAttribute('transform');
  const speed = descendants(e.root).find(n => n.getAttribute('aria-label') === 'Vitesse du replay');
  const rate = async value => { speed.value = String(value); await speed.emit('change'); assert.ok(button(e.root, 'Mettre le replay en pause')); };
  await button(e.root, 'Lire le replay').click(); assert.equal(match.dataset.presentation, 'entrance');
  c.elapse(500); const entering = pawn(); await rate(2); assert.equal(pawn(), entering);
  c.elapse((ENTRY_DURATION - 500) / 2); assert.equal(match.querySelector('.rb-kickoff-number').textContent, '3');
  c.elapse(500); assert.equal(match.querySelector('.rb-kickoff-number').textContent, '2');
  await rate(4); c.elapse(250); assert.equal(match.querySelector('.rb-kickoff-number').textContent, '1');
  c.elapse(250); assert.equal(match.querySelector('.rb-kickoff-number').textContent, 'START');
  assert.equal(match.querySelector('.rb-ball-layer').getAttribute('display'), 'inline');
  assert.equal(match.querySelector('.rb-ball-drop').classList.contains('is-arriving'), true);
  c.elapse(125); assert.equal(match.dataset.presentation, 'playing');
  c.elapse(500); const during = pawn(); await rate(8); assert.equal(pawn(), during);
  c.elapse(1250); assert.match(e.root.querySelector('.rb-form-status').textContent, /Round 2/);
  c.elapse(1500); assert.equal(match.dataset.presentation, 'exit');
  c.elapse(300); assert.ok(match.querySelector('.rb-medical-layer').children.length > 0);
  const leaving = pawn(); await rate(1); assert.equal(pawn(), leaving);
  c.elapse(EXIT_DURATION - 2400); assert.equal(match.dataset.presentation, 'idle');
  assert.ok(match.querySelectorAll('.rb-pawn').every(n => n.getAttribute('visibility') === 'hidden'));
  assert.match(e.root.querySelector('.rb-form-status').textContent, /Replay terminé/);
  assert.equal(c.timers.size, 0); assert.equal(c.frames.size, 0); assert.deepEqual(replay, original);
});

test('replay : pause et reprise au même instant, vitesse en pause, parcours et arrêt annulent les rappels', async t => {
  const e = environment(), c = replayClock(t), frames = [], rates = [], replay = recordedReplay(); let pauses = 0;
  const reader = mountReplay(e.root, replay, () => ({ broadcast(frame, elapsed, options) { frames.push({ frame, elapsed, options }); }, pausePlayback() { pauses++; }, pause() {}, setPlaybackSpeed(value) { rates.push(value); } }));
  await button(e.root, 'Lire le replay').click(); c.elapse(OPENING_DURATION + 2000);
  const speed = e.root.querySelector('select'); speed.value = '2'; await speed.emit('change');
  assert.deepEqual(rates, [2]); c.elapse(1000);
  await button(e.root, 'Mettre le replay en pause').click(); const count = frames.length;
  assert.equal(c.timers.size, 0); c.elapse(5000);
  speed.value = '4'; await speed.emit('change'); assert.equal(frames.length, count); assert.equal(c.timers.size, 0);
  await button(e.root, 'Lire le replay').click(); assert.equal(frames.at(-1).elapsed, 1000);
  assert.equal(frames.at(-1).options.speed, 4); assert.equal(frames.at(-1).frame.turns, replay.rounds[0].turns);
  c.elapse(1999); assert.equal(frames.at(-1).frame.turns, replay.rounds[0].turns);
  c.elapse(1); assert.equal(frames.at(-1).frame.turns, replay.rounds[1].turns);
  const cursor = descendants(e.root).find(n => n.type === 'range'); cursor.value = '-1'; await cursor.emit('input');
  assert.equal(c.timers.size, 0); assert.equal(frames.at(-1).frame.turns.length, 0);
  await button(e.root, 'Lire le replay').click(); assert.ok(c.timers.size);
  reader.stop(); c.elapse(100000); assert.equal(c.timers.size, 0); assert.ok(pauses > 0);
});

test('replay en mouvement réduit : décompte complet à ×4 sans animation planifiée', async t => {
  const e = environment(), c = replayClock(t), reader = mountReplay(e.root, recordedReplay(), mountMatch); t.after(reader.stop);
  const speed = descendants(e.root).find(n => n.getAttribute('aria-label') === 'Vitesse du replay'); speed.value = '4'; await speed.emit('change');
  await button(e.root, 'Lire le replay').click(); c.elapse(ENTRY_DURATION / 4);
  assert.equal(e.root.querySelector('.rb-kickoff-number').textContent, '3');
  for (const cue of ['2', '1', 'START']) { c.elapse(250); assert.equal(e.root.querySelector('.rb-kickoff-number').textContent, cue); }
  c.elapse(125); assert.equal(e.root.querySelector('.rb-kickoff').hidden, true);
  assert.equal(c.frames.size, 0); assert.ok(button(e.root, 'Mettre le replay en pause'));
});
