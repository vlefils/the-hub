import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from './engine.mjs';
import { reachableCells, movementStep, neighbors } from './rules.mjs';
import { createLeague, addBot, advanceLeague, leagueProjection } from './online/league.mjs';
import { startReadyLeague } from './test-support/online.mjs';
import { createLeagueService } from './online/server.mjs';
import { createBackgroundSimulation } from './background-simulation.mjs';
import { runSimulationJob } from './simulation-jobs.mjs';
import { createCareer, confirmDraft, launchCareerMatch, saveCareerTurn } from './career.mjs';
import { exportCareer, serializeCareer, importCareer } from './career-storage.mjs';
import { Worker as NodeWorker } from 'node:worker_threads';
import { environment, button, classNode } from './test-support/dom.mjs';
import { mountMatch } from './ui.mjs';
import { mountOnline } from './online/ui.mjs';
import { historyProjection } from './online/league.mjs';
import { mountCareer } from './career-ui.mjs';
import { CAREER_KEY } from './career-storage.mjs';

function referenceReachable(state, actor, budget) {
  const start = { position: { ...actor.position }, cost: 0, path: [] };
  if (actor.hp <= 0 || actor.grappledBy) return [start];
  const key = p => `${p.x},${p.y}`, best = new Map([[key(start.position), start]]), open = [start];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost || a.position.y - b.position.y || a.position.x - b.position.x);
    const current = open.shift(); if (current !== best.get(key(current.position))) continue;
    for (const next of neighbors(current.position)) {
      const step = movementStep(state, actor, current.position, next); if (!step) continue;
      const cost = current.cost + step.cost; if (cost > budget || (best.get(key(next))?.cost ?? Infinity) <= cost) continue;
      const entry = { position: next, cost, path: [...current.path, next] }; best.set(key(next), entry); open.push(entry);
    }
  }
  return [...best.values()];
}
test('performance : mêmes chemins et ordre sur les tours réels, cases humides, KO et prises', () => {
  let state = createMatch({ seed: 'path-performance' }); let compared = 0;
  for (let turn = 0; turn < 20 && !state.finished; turn++) {
    for (const actor of state.players) for (const budget of [0, 3, actor.speed, actor.speed * 2]) {
      assert.deepEqual(reachableCells(state, actor, budget), referenceReachable(state, actor, budget)); compared++;
    }
    state = stepMatch(state).state;
  }
  const actor = state.players[0], held = state.players[1];
  actor.hp = actor.maxHp; held.hp = held.maxHp; actor.grappledBy = null; actor.grappling = held.id; held.grappledBy = actor.id;
  actor.position = { x: 0, y: 0 }; held.position = { x: 0, y: 1 };
  for (const prone of [false, true]) { actor.prone = prone; assert.deepEqual(reachableCells(state, actor, 18), referenceReachable(state, actor, 18)); }
  assert.ok(compared >= 400);
});
test('performance : consultation légère, une lecture par commande et relecture sur conflit', async () => {
  const day = '2030-10-22T10:00:00Z', lock = '2030-10-22T18:00:00Z';
  let state = startReadyLeague(addBot(createLeague({ id: 'l', userId: 'u', name: 'Ligue', clubName: 'Club', seed: 'projection', inviteCode: 'a'.repeat(32) }, day), 'u'), 'u', day, { firstMatchAt: lock });
  let reads = 0, writes = 0;
  const service = createLeagueService({ async get() { reads++; return { state, revision: 1 }; }, async commit() { writes++; if (writes === 2) throw Error('RB_CONFLICT'); return 2; } }, { now: () => day });
  await service.command('u', { action: 'color', leagueId: 'l', payload: { color: '#35bdb3' } }); assert.equal(reads, 1);
  await service.command('u', { action: 'color', leagueId: 'l', payload: { color: '#35bdb3' } }); assert.equal(reads, 3); assert.equal(writes, 3);
  state = advanceLeague(state, lock, { maxRounds: 1 });
  const now = new Date(Date.parse(state.night.games[0].playsAt) + 1000).toISOString();
  const full = leagueProjection(state, 'u', now), light = leagueProjection(state, 'u', now, { broadcast: false });
  assert.ok(full.broadcast.turns.length); assert.equal(light.broadcast, null); assert.equal(light.closing, null);
  assert.ok(JSON.stringify(light).length < JSON.stringify(full).length / 5);
  const get = createLeagueService({ async get() { return { state, revision: 2 }; } }, { now: () => now });
  assert.equal((await get.command('u', { action: 'get', leagueId: 'l', payload: { view: 'Club' } })).league.broadcast, null);
  assert.ok((await get.command('u', { action: 'get', leagueId: 'l' })).league.broadcast);
});
test('performance : jobs de calcul identiques et sauvegarde compacte compatible', () => {
  let career = createCareer('Club', 'background-career'); career = launchCareerMatch(confirmDraft(career, career.market.slice(0, 6).map(p => p.id)));
  const original = structuredClone(career); let expected = career;
  while (!expected.current.state.finished) { const step = stepMatch(expected.current.state); expected = saveCareerTurn(expected, step.state, step.events); }
  assert.deepEqual(runSimulationJob('finish-career', { career }), expected); assert.deepEqual(career, original);
  const compact = serializeCareer(expected); assert.ok(compact.length < exportCareer(expected).length * .6); assert.deepEqual(importCareer(compact), expected);
});
test('performance : worker créé à la demande, réponses tardives ignorées et arrêt sans minuterie', async t => {
  const timers = new Map(); let serial = 0, worker, creates = 0;
  t.mock.method(globalThis, 'setTimeout', callback => { timers.set(++serial, callback); return serial; });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const runner = createBackgroundSimulation({ createWorker() { creates++; return worker = { messages: [], postMessage(data) { this.messages.push(data); }, terminate() { this.terminated = true; } }; } });
  assert.equal(creates, 0); const promise = runner.run('finish-match', { state: {} }); assert.equal(creates, 1);
  worker.onmessage({ data: { id: 999, result: 'old' } }); worker.onmessage({ data: { id: worker.messages[0].id, result: 'done' } });
  assert.equal(await promise, 'done'); assert.equal(timers.size, 0);
  const pending = runner.run('finish-match', {}), rejected = assert.rejects(pending, /fermée/); runner.stop(); await rejected;
  assert.equal(worker.terminated, true); assert.equal(timers.size, 0);
  await assert.rejects(runner.run('finish-match', {}), /fermée/);
});
test('performance : le vrai module worker calcule un résultat sans avancer le thread principal', async () => {
  const runner = createBackgroundSimulation({ createWorker() {
    const native = new NodeWorker(new URL('./test-support/simulation-worker.mjs', import.meta.url));
    const worker = { postMessage: data => native.postMessage(data), terminate: () => native.terminate() };
    native.on('message', data => worker.onmessage?.({ data })); native.on('error', error => worker.onerror?.(error)); return worker;
  } });
  try {
    const state = createMatch({ seed: 'actual-worker' }), copy = structuredClone(state);
    const promise = runner.run('finish-match', { state }); assert.deepEqual(state, copy);
    assert.deepEqual(await promise, runSimulationJob('finish-match', { state }));
  } finally { runner.stop(); }
});
test('performance : résultat immédiat asynchrone et réponse ignorée après fermeture de la vue', async () => {
  const env = environment(); let complete;
  const background = { available: true, run: () => new Promise(resolve => { complete = resolve; }), stop() {} };
  const view = mountMatch(env.root, { background });
  await classNode(env.root, 'rb-setup').emit('submit');
  const pending = button(env.root, 'Voir le résultat').click(); assert.match(classNode(env.root, 'rb-playback-status').textContent, /Calcul/);
  view.stop(); const text = env.root.textContent; complete(runSimulationJob('finish-match', { state: createMatch({ seed: 'ignored' }) })); await pending;
  assert.equal(env.root.textContent, text);
});
test('performance : règlement asynchrone sauvegardé une fois, fermeture conserve le dernier checkpoint', async () => {
  let career = createCareer('Club', 'terminal-worker'); career = launchCareerMatch(confirmDraft(career, career.market.slice(0, 6).map(p => p.id)));
  for (;;) { const step = stepMatch(career.current.state); if (step.state.finished) break; career = saveCareerTurn(career, step.state, step.events); }
  for (const stopBeforeResult of [false, true]) {
    let complete;
    const background = { available: true, run: (type, payload) => new Promise(resolve => { complete = () => resolve(runSimulationJob(type, payload)); }), stop() {} };
    const env = environment(exportCareer(career)), before = env.storage.getItem(CAREER_KEY);
    const app = mountCareer(env.root, mountMatch, { background, initialView: { screen: 'match' } });
    await button(env.root, 'Round suivant').click();
    assert.equal(env.storage.getItem(CAREER_KEY), before); assert.match(classNode(env.root, 'rb-playback-status').textContent, /Calcul/);
    if (stopBeforeResult) app.stop();
    complete(); await new Promise(resolve => setImmediate(resolve));
    if (stopBeforeResult) assert.equal(env.storage.getItem(CAREER_KEY), before);
    else { assert.equal(env.saved().current.settled, true); assert.equal(env.saved().transactions.filter(t => t.label === 'Prime de match').length, 1); app.stop(); }
  }
});
test('performance : historique paginé stable et polling inchangé conserve le classement', async t => {
  const env = environment(), timers = new Map(); let serial = 0;
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => { timers.set(++serial, { callback, delay }); return serial; });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  globalThis.location = new URL('https://example.invalid/rumbleball/index.html');
  const now = '2030-10-22T10:00:00Z';
  const state = startReadyLeague(addBot(createLeague({ id: 'l', userId: 'u', name: 'Ligue', clubName: 'Club', seed: 'history', inviteCode: 'a'.repeat(32) }, now), 'u'), 'u', now);
  state.history = Array.from({ length: 65 }, (_, n) => ({ id: `old-${n}`, season: 0, phase: 'groups', homeId: 'u', awayId: state.bots[0].userId, winnerId: null, endsAt: '2029-01-01T10:00:00Z', replayAvailable: false }));
  const first = historyProjection(state, 'u', {}, now), second = historyProjection(state, 'u', { before: first.nextCursor }, now);
  assert.equal(first.history.length, 30); assert.equal(second.history.length, 30); assert.equal(new Set([...first.history, ...second.history].map(game => game.id)).size, 60);
  assert.throws(() => historyProjection(state, 'other', {}, now), /participants/); assert.throws(() => historyProjection(state, 'u', { limit: 10000 }, now), /Taille/);
  let revision = 1;
  const service = createLeagueService({ async get() { return { state, revision: revision++ }; } }, { now: () => now });
  const app = await mountOnline(env.root, { enabled: true }, async () => ({ auth: { async getSession() { return { data: { session: { user: { id: 'u' } } } }; } },
    request: (action, leagueId, payload) => service.command('u', { action, leagueId, payload }),
  }), { managedSession: true, initialView: { id: 'l', screen: 'Ligue' } });
  try {
    const ranking = env.root.querySelector('table'), [id, timer] = [...timers].find(([, timer]) => timer.delay === 4000);
    timers.delete(id); await timer.callback(); assert.equal(env.root.querySelector('table'), ranking);
    await button(env.root, 'Replays des rencontres · 65').click(); assert.equal(env.root.querySelectorAll('.rb-replay-entry').length, 30);
    await button(env.root, 'Afficher les rencontres précédentes').click(); assert.equal(env.root.querySelectorAll('.rb-replay-entry').length, 60);
    await button(env.root, 'Afficher les rencontres précédentes').click(); assert.equal(env.root.querySelectorAll('.rb-replay-entry').length, 65);
  } finally { app.stop(); }
});
