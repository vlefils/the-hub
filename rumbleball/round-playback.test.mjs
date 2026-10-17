import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch, simulateMatch } from './engine.mjs';
import { moveAlong, resolveAction } from './rules.mjs';
import { buildRoundPlayback, sampleRoundPlayback, createCourtPlayback } from './playback.mjs';

const p = (state, id) => state.players.find((p) => p.id === id);
const e = (type, data = {}) => ({ type, ...data });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≠ ${b}`);
function fixture() {
  const state = createMatch(); state.players.forEach((p) => { p.hp = 0; });
  for (const [id, x, y] of [['home-0', 1, 1], ['away-0', 9, 6], ['home-1', 4, 1]]) { const q = p(state, id); q.hp = q.maxHp; q.position = { x, y }; }
  state.ball = { carrierId: null, position: { x: 5, y: 3 } }; return state;
}
function moved(before, id, path) {
  const after = structuredClone(before); p(after, id).position = path.at(-1); after.activeId = id; after.turns++;
  if (after.ball.carrierId === id) after.ball.position = { ...path.at(-1) };
  return { before, after, events: [e('move', { playerId: id, from: p(before, id).position, path })] };
}
function round(before) {
  const number = before.round, turns = []; let state = before;
  do { const next = stepMatch(state, { stopAtRoundEnd: true }); turns.push({ before: state, after: next.state, events: next.events }); state = next.state; }
  while (!state.finished && state.round === number);
  return turns;
}

test('round simultané : deux courses indépendantes se chevauchent dans une fenêtre exacte de douze secondes', () => {
  const a = moved(fixture(), 'home-0', [{ x: 2, y: 1 }]), b = moved(a.after, 'away-0', [{ x: 8, y: 6 }]);
  const original = structuredClone([a, b]), plan = buildRoundPlayback([a, b]);
  assert.equal(plan.duration, 12000); assert.equal(plan.turns[0].start, 0); assert.equal(plan.turns[1].start, 0);
  const frame = sampleRoundPlayback(plan, 6000); assert.ok(p(frame, 'home-0').position.x > 1 && p(frame, 'home-0').position.x < 2);
  close(p(frame, 'home-0').position.x - 1, 9 - p(frame, 'away-0').position.x);
  assert.deepEqual(frame.activeIds, ['home-0', 'away-0']); assert.ok(p(frame, 'home-0').walking && p(frame, 'away-0').walking);
  assert.deepEqual([a, b], original);
});

test('contact : la cible reste en place pendant la frappe, puis son propre tour commence', () => {
  const before = fixture(); p(before, 'away-0').position = { x: 2, y: 1 };
  const after = structuredClone(before); after.activeId = 'home-0'; after.turns++; p(after, 'away-0').hp -= 4;
  const a = { before, after, events: [e('attack', { playerId: 'home-0', targetId: 'away-0' }), e('damage', { playerId: 'away-0', amount: 4 })] };
  const b = moved(after, 'away-0', [{ x: 3, y: 1 }]), plan = buildRoundPlayback([a, b]);
  assert.ok(plan.turns[1].start >= plan.turns[0].end);
  for (const time of [0, plan.turns[0].end / 2]) assert.deepEqual(p(sampleRoundPlayback(plan, time), 'away-0').position, { x: 2, y: 1 });
  assert.equal(p(sampleRoundPlayback(plan, 12000), 'away-0').hp, p(after, 'away-0').hp);
});

test('oppositions ratées : le défenseur et l’intercepteur restent identifiés et attendent la fin de la tentative', () => {
  for (const action of ['pickup', 'pass']) {
    const before = fixture(), a = p(before, 'home-0'), defender = p(before, 'away-0');
    defender.position = { x: 2, y: 1 }; before.activeId = a.id;
    before.ball = { carrierId: action === 'pass' ? a.id : null, position: action === 'pass' ? { ...a.position } : { x: 1, y: 2 } };
    a.skills.acrobatics = a.skills.wrestling = action === 'pass' ? 100 : -100;
    defender.skills.acrobatics = defender.skills.wrestling = action === 'pass' ? -100 : 100;
    const after = structuredClone(before), events = [];
    assert.equal(resolveAction(after, p(after, a.id), { type: action, ...(action === 'pass' ? { targetId: 'home-1' } : {}) }, events), true);
    assert.ok(events.some((e) => e.type === 'roll' && e.playerId === defender.id));
    after.turns++;
    const other = moved(after, defender.id, [{ x: 3, y: 1 }]), plan = buildRoundPlayback([{ before, after, events }, other]);
    assert.ok(plan.turns[0].participants.includes(defender.id)); assert.ok(plan.turns[1].start >= plan.turns[0].end);
  }
});

test('passages : attendre la libération d’une case, y compris le croisement de deux diagonales', () => {
  for (const diagonal of [false, true]) {
    const before = fixture(); p(before, 'away-0').position = diagonal ? { x: 2, y: 1 } : { x: 0, y: 1 };
    const a = moved(before, 'home-0', [diagonal ? { x: 2, y: 2 } : { x: 2, y: 1 }]);
    const b = moved(a.after, 'away-0', [diagonal ? { x: 1, y: 2 } : { x: 1, y: 1 }]);
    const plan = buildRoundPlayback([a, b]); assert.ok(plan.turns[1].start >= plan.turns[0].end);
  }
});

test('ballon : passe, réception puis course du receveur ; un troisième joueur peut courir en parallèle', () => {
  const before = fixture(); before.ball = { carrierId: 'home-0', position: { ...p(before, 'home-0').position } };
  const after = structuredClone(before); after.ball = { carrierId: 'home-1', position: { ...p(before, 'home-1').position } }; after.activeId = 'home-0'; after.turns++;
  const a = { before, after, events: [e('pass', { playerId: 'home-0', targetId: 'home-1' }), e('possession', { playerId: 'home-1', reason: 'reçoit' })] };
  const b = moved(after, 'away-0', [{ x: 8, y: 6 }]), c = moved(b.after, 'home-1', [{ x: 5, y: 1 }]);
  const plan = buildRoundPlayback([a, b, c]); assert.equal(plan.turns[1].start, 0); assert.ok(plan.turns[2].start >= plan.turns[0].end);
  assert.equal(sampleRoundPlayback(plan, 0).ball.carrierId, null); // No possession is displayed before the ball arrives.
  assert.ok(sampleRoundPlayback(plan, plan.turns[0].scale * 75).flying);
  const final = sampleRoundPlayback(plan, 12000); assert.equal(final.ball.carrierId, 'home-1'); close(final.ballPoint.x, 5 * 60 + 30 + 24);
});

test('trajectoire du ballon : une course traversant le couloir de passe attend sa réception', () => {
  const before = fixture(); before.ball = { carrierId: 'home-0', position: { x: 1, y: 1 } }; p(before, 'away-0').position = { x: 3, y: 3 };
  const after = structuredClone(before); after.ball = { carrierId: 'home-1', position: { x: 4, y: 1 } }; after.activeId = 'home-0'; after.turns++;
  const events = [e('pass', { playerId: 'home-0', targetId: 'home-1' }), e('possession', { playerId: 'home-1', reason: 'reçoit' })];
  const runner = moved(after, 'away-0', [{ x: 3, y: 2 }, { x: 3, y: 1 }, { x: 3, y: 0 }]);
  const plan = buildRoundPlayback([{ before, after, events }, runner]); assert.ok(plan.turns[1].start >= plan.turns[0].end);
});

test('lutte : les deux corps restent couplés, la balle suit le joueur entraîné', () => {
  const before = fixture(), a = p(before, 'home-0'), b = p(before, 'home-1'); a.position = { x: 2, y: 0 }; b.position = { x: 3, y: 0 };
  a.grappling = b.id; b.grappledBy = a.id; before.ball = { carrierId: b.id, position: { ...b.position } };
  const after = structuredClone(before), events = []; moveAlong(after, p(after, a.id), [{ x: 1, y: 0 }, { x: 0, y: 0 }], events); after.activeId = a.id; after.turns++;
  const other = moved(after, 'away-0', [{ x: 8, y: 6 }]), plan = buildRoundPlayback([{ before, after, events }, other]);
  for (let t = 0; t <= 12000; t += 200) {
    const frame = sampleRoundPlayback(plan, t); close(p(frame, b.id).position.x - p(frame, a.id).position.x, 1);
    close(frame.ballPoint.x, p(frame, b.id).position.x * 60 + 54); assert.ok(!p(frame, b.id).walking);
  }
});

test('opportunité et KO : le déplacement interrompu n’est pas inventé ; aucune action suivante avant la réaction', () => {
  const before = fixture(), after = structuredClone(before); p(before, 'away-0').position = { x: 2, y: 1 }; p(after, 'away-0').position = { x: 2, y: 1 };
  p(after, 'home-0').hp = 0; after.activeId = 'home-0'; after.turns++;
  const events = [e('opportunity', { playerId: 'away-0', targetId: 'home-0' }), e('damage', { playerId: 'home-0', amount: 99 }), e('ko', { playerId: 'home-0' }), e('movement-stopped', { playerId: 'home-0', attemptedTo: { x: 0, y: 1 } })];
  const b = moved(after, 'away-0', [{ x: 3, y: 1 }]), plan = buildRoundPlayback([{ before, after, events }, b]);
  assert.ok(plan.turns[1].start >= plan.turns[0].end);
  for (let t = 0; t <= 12000; t += 200) assert.deepEqual(p(sampleRoundPlayback(plan, t), 'home-0').position, { x: 1, y: 1 });
});

test('dernier engagement : le dernier tour reste animé, puis le placement est réinitialisé à la fin', () => {
  const turn = moved(fixture(), 'home-0', [{ x: 2, y: 1 }]); turn.after.round = 13; turn.after.phase = 'final';
  p(turn.after, 'home-0').position = { x: 1, y: 1 }; turn.events.push(e('restart'));
  const plan = buildRoundPlayback([turn]); assert.equal(sampleRoundPlayback(plan, 6000).round, 1);
  assert.ok(p(sampleRoundPlayback(plan, 6000), 'home-0').position.x > 1);
  assert.deepEqual(p(sampleRoundPlayback(plan, 12000), 'home-0').position, { x: 1, y: 1 }); assert.equal(sampleRoundPlayback(plan, 12000).round, 13);
});

test('vitesses : même chorégraphie en 12 / 6 / 3 / 1,5 secondes', () => {
  const turns = round(createMatch()), normal = buildRoundPlayback(turns);
  for (const speed of [1, 2, 4, 8]) {
    const fast = buildRoundPlayback(turns, { speed }); assert.equal(fast.duration, 12000 / speed);
    for (const fraction of [0, .2, .5, .8, 1]) {
      const a = sampleRoundPlayback(normal, 12000 * fraction), b = sampleRoundPlayback(fast, fast.duration * fraction);
      assert.equal(a.ball.carrierId, b.ball.carrierId); assert.deepEqual(a.activeIds, b.activeIds);
      for (const q of a.players) { close(q.position.x, p(b, q.id).position.x); close(q.position.y, p(b, q.id).position.y); assert.equal(q.hp, p(b, q.id).hp); }
    }
  }
});

test('frontière de round : les créneaux KO sont sautés sans exécuter le premier tour suivant', () => {
  const state = createMatch(); state.turnIndex = 9; p(state, state.initiative[9]).hp = 0;
  const direct = stepMatch(state), boundary = stepMatch(state, { stopAtRoundEnd: true });
  assert.equal(boundary.state.round, 2); assert.equal(boundary.state.turns, 0); assert.equal(boundary.state.turnIndex, 0);
  const resumed = stepMatch(boundary.state, { stopAtRoundEnd: true });
  assert.deepEqual(resumed.state, direct.state); assert.deepEqual([...boundary.events, ...resumed.events], direct.events);
});

test('tous KO : chaque round reste borné, jusqu’au même nul et au même journal', () => {
  const initial = createMatch(); initial.players.forEach((p) => { p.hp = 0; });
  let state = initial, rounds = 0; const events = [];
  while (!state.finished) { const turns = round(state); assert.ok(++rounds <= 13); events.push(...turns.flatMap((t) => t.events)); state = turns.at(-1).after; }
  const direct = stepMatch(initial); assert.deepEqual(state, direct.state); assert.deepEqual(events, direct.events); assert.equal(rounds, 13);
});

for (const config of [
  { seed: 'arche-01' },
  { seed: 'round-mix-02', strategy: 'possession' },
  { seed: 'round-mix-03', strategy: 'pressing', players: Array.from({ length: 5 }, () => ({ role: 'blocker', instruction: 'aggressive' })) },
]) test(`match complet ${config.seed} : mêmes jets et événements qu’en séquentiel ; aucun chevauchement de corps actifs`, () => {
  const events = []; let state = createMatch(config), overlap = false;
  while (!state.finished) {
    const turns = round(state), original = structuredClone(turns), plan = buildRoundPlayback(turns);
    overlap ||= plan.turns.some((t, i) => plan.turns.slice(i + 1).some((u) => t.start < u.end && u.start < t.end));
    for (let t = 0; t < 12000; t += 80) {
      const frame = sampleRoundPlayback(plan, t), active = frame.players.filter((p) => p.hp > 0);
      for (let i = 0; i < active.length; i++) for (const q of active.slice(i + 1)) assert.ok(Math.hypot(active[i].position.x - q.position.x, active[i].position.y - q.position.y) > .25, `Collision à R${state.round}, ${t} ms : ${active[i].id}/${q.id}`);
    }
    const final = sampleRoundPlayback(plan, 12000); state = turns.at(-1).after;
    for (const q of state.players) { assert.deepEqual(p(final, q.id).position, q.position); assert.equal(p(final, q.id).hp, q.hp); }
    assert.equal(final.ball.carrierId, state.ball.carrierId); assert.deepEqual(turns, original); events.push(...turns.flatMap((t) => t.events));
  }
  const sequential = simulateMatch(config); assert.deepEqual(state, sequential.state); assert.deepEqual(events, sequential.events); assert.ok(overlap);
});

test('lecteur : pause, annulation et animations réduites terminent exactement le round calculé', () => {
  const turns = round(createMatch()), pending = new Map(), frames = []; let time = 0, id = 0;
  const clock = { now: () => time, request: (cb) => { pending.set(++id, cb); return id; }, cancel: (id) => pending.delete(id), reducedMotion: () => false };
  const reader = createCourtPlayback((frame) => frames.push(frame), clock);
  assert.equal(reader.playRound(turns), 12000); const callback = [...pending.values()][0]; time = 6000; pending.clear(); callback(time);
  assert.equal(reader.remaining(), 6000); assert.equal(frames.at(-1).animating, true);
  reader.settle(); assert.equal(pending.size, 0); assert.deepEqual(frames.at(-1).effects, []); assert.equal(frames.at(-1).animating, undefined);
  for (const q of turns.at(-1).after.players) assert.deepEqual(p(frames.at(-1), q.id).position, q.position);
  const count = frames.length; callback(5000); assert.equal(frames.length, count);
  const reduced = createCourtPlayback((frame) => frames.push(frame), { ...clock, reducedMotion: () => true });
  assert.equal(reduced.playRound(turns), 0); assert.equal(pending.size, 0);
});
