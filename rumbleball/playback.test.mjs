import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, simulateMatch } from './engine.mjs';
import { moveAlong, resolveAction } from './rules.mjs';
import { buildCourtPlayback, courtPoint, createCourtPlayback, sampleCourtPlayback } from './playback.mjs';

const p = (frame, id) => frame.players.find((p) => p.id === id);
const event = (type, data = {}) => ({ type, ...data });
function fixture() {
  const before = createMatch();
  for (const p of before.players) p.hp = 0;
  const a = before.players[0], b = before.players[5];
  a.hp = a.maxHp; b.hp = b.maxHp;
  a.position = { x: 2, y: 2 }; b.position = { x: 3, y: 2 };
  before.ball = { carrierId: null, position: { x: 5, y: 3 } };
  before.activeId = a.id;
  return { before, after: structuredClone(before), a, b };
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);

test('glissement : suit chaque segment réel du trajet, sans couper le virage', () => {
  const { before, after, a } = fixture();
  const path = [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }];
  p(after, a.id).position = path.at(-1);
  const plan = buildCourtPlayback(before, after, [event('move', { playerId: a.id, from: a.position, path })]);
  close(p(sampleCourtPlayback(plan, plan.stages[0].end / 2), a.id).position.x, 2);
  close(p(sampleCourtPlayback(plan, plan.stages[0].end / 2), a.id).position.y, 2.5);
  assert.deepEqual(p(sampleCourtPlayback(plan, plan.stages[1].end), a.id).position, path[1]);
  assert.deepEqual(p(sampleCourtPlayback(plan, plan.duration), a.id).position, path.at(-1));
});

test('lutte : les deux pions et la balle glissent ensemble en gardant leur écart', () => {
  const { before, a, b } = fixture();
  a.position = { x: 2, y: 0 }; b.position = { x: 3, y: 0 };
  a.grappling = b.id; b.grappledBy = a.id;
  before.ball = { carrierId: b.id, position: { ...b.position } };
  const after = structuredClone(before), events = [];
  moveAlong(after, p(after, a.id), [{ x: 1, y: 0 }, { x: 0, y: 0 }], events);
  const plan = buildCourtPlayback(before, after, events);
  for (let t = 0; t <= plan.duration; t += plan.duration / 16) {
    const frame = sampleCourtPlayback(plan, t), holder = p(frame, a.id), held = p(frame, b.id);
    close(held.position.x - holder.position.x, 1); close(held.position.y, holder.position.y);
    close(frame.ballPoint.x, courtPoint(held.position).x + 17);
    close(frame.ballPoint.y, courtPoint(held.position).y - 17);
  }
});

test('frappe après déplacement : l’impact est ancré au contact réel et au bon moment', () => {
  const { before, after, a, b } = fixture();
  b.position = { x: 5, y: 3 }; p(after, b.id).position = { ...b.position };
  p(after, a.id).position = { x: 4, y: 3 }; p(after, b.id).hp -= 5;
  const events = [event('move', { playerId: a.id, path: [{ x: 3, y: 3 }, { x: 4, y: 3 }] }),
    event('attack', { playerId: a.id, targetId: b.id }), event('damage', { playerId: b.id, amount: 5 })];
  const plan = buildCourtPlayback(before, after, events);
  const hit = plan.effects.find((e) => e.kind === 'damage');
  assert.ok(hit.start >= plan.stages[1].end);
  assert.deepEqual(hit.position, b.position);
  assert.deepEqual(p(sampleCourtPlayback(plan, hit.start), a.id).position, { x: 4, y: 3 });
  assert.equal(p(sampleCourtPlayback(plan, hit.start), b.id).hp, b.hp - 5);
});

test('KO sur opportunité : aucun glissement vers la sortie qui n’a pas eu lieu', () => {
  const { before, after, a, b } = fixture(); p(after, a.id).hp = 0;
  const events = [event('opportunity', { playerId: b.id, targetId: a.id }),
    event('damage', { playerId: a.id, amount: 99 }), event('ko', { playerId: a.id }),
    event('movement-stopped', { playerId: a.id, attemptedTo: { x: 1, y: 2 } })];
  const plan = buildCourtPlayback(before, after, events);
  for (let t = 0; t <= plan.duration; t += 10) assert.deepEqual(p(sampleCourtPlayback(plan, t), a.id).position, a.position);
  assert.equal(plan.effects.find((e) => e.kind === 'damage').label, '−99');
  assert.ok(plan.effects.some((e) => e.kind === 'ko'));
});

test('prise et libération : le lien suit les événements, sans apparaître avant la prise', () => {
  const { before, after, a, b } = fixture();
  const events = [];
  p(after, a.id).skills.wrestling = 100;
  resolveAction(after, p(after, a.id), { type: 'grapple', targetId: b.id }, events);
  const plan = buildCourtPlayback(before, after, events);
  assert.equal(plan.initial.players.find((p) => p.id === b.id).grappledBy, null);
  assert.equal(p(sampleCourtPlayback(plan, plan.duration), b.id).grappledBy, a.id);
  const released = structuredClone(after), releaseEvents = [];
  resolveAction(released, p(released, a.id), { type: 'release' }, releaseEvents);
  const releasePlan = buildCourtPlayback(after, released, releaseEvents);
  assert.equal(p(sampleCourtPlayback(releasePlan, releasePlan.duration), b.id).grappledBy, null);
});

test('passe interceptée : la balle vole vers l’intercepteur, pas vers le destinataire prévu', () => {
  const { before, after, a, b } = fixture();
  before.ball = { carrierId: a.id, position: { ...a.position } };
  after.ball = { carrierId: b.id, position: { ...b.position } };
  const events = [event('pass', { playerId: a.id, targetId: 'home-1' }), event('roll'),
    event('possession', { playerId: b.id, reason: 'intercepte' })];
  const plan = buildCourtPlayback(before, after, events);
  const flight = plan.stages.find((s) => s.flight);
  const midway = sampleCourtPlayback(plan, flight.end / 2);
  close(midway.ballPoint.x, (courtPoint(a.position).x + courtPoint(b.position).x) / 2 + 17);
  assert.equal(sampleCourtPlayback(plan, flight.end).ball.carrierId, b.id);
  assert.ok(plan.effects.some((e) => e.label === 'Intercept.'));
});

test('perte de balle : la balle rejoint la case de chute puis reste libre', () => {
  const { before, after, a } = fixture();
  before.ball = { carrierId: a.id, position: { ...a.position } };
  after.ball = { carrierId: null, position: { x: 1, y: 2 } };
  const plan = buildCourtPlayback(before, after, [event('drop', { playerId: a.id, position: { x: 1, y: 2 } })]);
  assert.ok(sampleCourtPlayback(plan, plan.duration / 2).flying);
  assert.equal(sampleCourtPlayback(plan, plan.duration).ball.carrierId, null);
  assert.deepEqual(sampleCourtPlayback(plan, plan.duration).ballPoint, courtPoint(after.ball.position));
});

test('vitesse x8 : la chronologie tient avant le prochain tour et conserve les positions finales', () => {
  const { before, after, a, b } = fixture();
  const events = [event('move', { playerId: a.id, path: [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }] }),
    event('attack', { playerId: a.id, targetId: b.id }), event('damage', { playerId: b.id, amount: 4 })];
  const slow = buildCourtPlayback(before, after, events, 560), fast = buildCourtPlayback(before, after, events, 195);
  assert.ok(fast.duration <= 195); assert.ok(slow.duration > fast.duration);
  const s = sampleCourtPlayback(slow, slow.duration * .3), f = sampleCourtPlayback(fast, fast.duration * .3);
  close(p(s, a.id).position.x, p(f, a.id).position.x); close(p(s, a.id).position.y, p(f, a.id).position.y);
  assert.deepEqual(sampleCourtPlayback(slow, slow.duration), sampleCourtPlayback(fast, fast.duration));
});

test('un dernier engagement replace immédiatement les pions, sans traverser le terrain', () => {
  const { before, after, a } = fixture(); p(after, a.id).position = { x: 1, y: 1 };
  const plan = buildCourtPlayback(before, after, [event('restart')]);
  assert.equal(plan.duration, 0); assert.deepEqual(sampleCourtPlayback(plan, 0).players, plan.final.players);
});

function clock() {
  let time = 0, id = 0;
  const pending = new Map();
  return { pending, now: () => time,
    request: (callback) => { pending.set(++id, callback); return id; }, cancel: (id) => pending.delete(id),
    step: (value) => { time = value; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach((cb) => cb(time)); } };
}
test('pause : termine le glissement à la bonne case et retire tous les effets', () => {
  const { before, after, a } = fixture(); p(after, a.id).position = { x: 2, y: 3 };
  const c = clock(), frames = [], playback = createCourtPlayback((f) => frames.push(f), { ...c, reducedMotion: () => false });
  playback.play(before, after, [event('move', { playerId: a.id, path: [{ x: 2, y: 3 }] })], 560);
  c.step(25); assert.notDeepEqual(p(frames.at(-1), a.id).position, p(after, a.id).position);
  playback.settle(); assert.equal(c.pending.size, 0);
  assert.deepEqual(p(frames.at(-1), a.id).position, p(after, a.id).position); assert.deepEqual(frames.at(-1).effects, []);
});

test('rejouer / résultat immédiat : un ancien rappel ne ressuscite aucune animation', () => {
  const { before, after, a } = fixture(); p(after, a.id).position = { x: 2, y: 3 };
  const c = clock(), frames = [], playback = createCourtPlayback((f) => frames.push(f), { ...c, reducedMotion: () => false });
  playback.play(before, after, [event('move', { playerId: a.id, path: [{ x: 2, y: 3 }] })], 560);
  const oldCallback = [...c.pending.values()][0]; playback.show(before);
  const count = frames.length; oldCallback(500);
  assert.equal(frames.length, count); assert.equal(c.pending.size, 0);
  assert.deepEqual(p(frames.at(-1), a.id).position, a.position);
});

test('animations réduites : aucune image planifiée ni effet flottant', () => {
  const { before, after, a } = fixture();
  const c = clock(), frames = [], playback = createCourtPlayback((f) => frames.push(f), { ...c, reducedMotion: () => true });
  playback.play(before, after, [event('damage', { playerId: a.id, amount: 4 })], 560);
  assert.equal(c.pending.size, 0); assert.deepEqual(frames.at(-1).effects, []);
});

test('match complet : animations bornées, balle et états finaux exacts, entrées inchangées', () => {
  const config = { seed: 'arche-01', strategy: 'pressing', players: Array.from({ length: 5 }, () => ({ role: 'blocker', instruction: 'aggressive' })) };
  let before = createMatch(config), count = 0;
  simulateMatch(config, (after, events) => {
    const unchanged = structuredClone({ before, after, events });
    const plan = buildCourtPlayback(before, after, events, 195);
    assert.ok(plan.duration <= 195 + 1e-8);
    for (const fraction of [0, .25, .5, .75, 1]) {
      const frame = sampleCourtPlayback(plan, plan.duration * fraction);
      for (const p of frame.players) {
        assert.ok(p.position.x >= 0 && p.position.x < 12 && p.position.y >= 0 && p.position.y < 8);
      }
      assert.ok(Number.isFinite(frame.ballPoint.x) && Number.isFinite(frame.ballPoint.y));
    }
    const final = sampleCourtPlayback(plan, plan.duration);
    for (const p of after.players) { assert.deepEqual(playerPosition(final, p.id), p.position); assert.equal(p.hp, final.players.find((q) => q.id === p.id).hp); }
    assert.equal(final.ball.carrierId, after.ball.carrierId);
    assert.deepEqual({ before, after, events }, unchanged);
    before = structuredClone(after); count++;
  });
  assert.ok(count > 40);
});
function playerPosition(frame, id) { return frame.players.find((p) => p.id === id).position; }
