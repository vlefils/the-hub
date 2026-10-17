import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from './engine.mjs';
import { decideMovement, decideTurn, matchPriority } from './ai.mjs';
import { assertInvariants, giveBall, legalAction } from './rules.mjs';

function contest() {
  const state = createMatch({ seed: 'combat-then-ball', openings: { home: 'none', away: 'none' } });
  const actor = state.players[1], enemy = state.players[5];
  for (const p of state.players) { p.hp = [actor, enemy].includes(p) ? p.maxHp : 0; p.reaction = p.hp > 0; }
  actor.role = 'retriever'; actor.skills.wrestling = 8; actor.position = { x: 5, y: 3 }; actor.movement = 0;
  enemy.skills.wrestling = enemy.skills.acrobatics = 2; enemy.position = { x: 6, y: 3 };
  state.activeId = actor.id; giveBall(state, enemy, []); assertInvariants(state);
  return { state, actor, enemy };
}

test('tempo : combat jusqu’au round 6 inclus, ballon dès le 7 et pendant les prolongations', () => {
  const { state, actor } = contest();
  for (const round of [1, 5, 6, 7, 10, 11, 12, 13]) {
    state.round = round; const before = structuredClone(state), decision = decideTurn(state, actor);
    assert.equal(matchPriority(state), round <= 6 ? 'combat' : 'ball');
    assert.equal(decision.action.type, round <= 6 ? 'attack' : 'strip');
    assert.equal(decision.task, round <= 6 ? 'fight' : 'recover');
    assert.ok(legalAction(state, actor, decision.action)); assert.deepEqual(state, before);
  }
});

test('tempo : le porteur sécurise sa balle pendant que ses partenaires combattent', () => {
  const { state, actor } = contest(); state.round = 6; giveBall(state, actor, []);
  const before = structuredClone(state), decision = decideTurn(state, actor);
  assert.equal(decision.task, 'carry'); assert.equal(decision.action.type, 'dodge');
  assert.equal(state.ball.carrierId, actor.id); assert.deepEqual(state, before);
});

test('tempo : frapper le porteur adverse prime sur achever un autre adversaire au contact', () => {
  const { state, actor, enemy } = contest(); state.round = 6;
  const distraction = state.players[6]; distraction.hp = 1; distraction.reaction = true; distraction.position = { x: 5, y: 4 };
  const before = structuredClone(state), decision = decideTurn(state, actor);
  assert.equal(decision.action.type, 'attack'); assert.equal(decision.action.targetId, enemy.id); assert.deepEqual(state, before);
});

test('tempo : le déplacement de combat converge vers le porteur plutôt que vers un adversaire isolé', () => {
  const { state, actor, enemy } = contest(); state.round = 4;
  actor.position = { x: 1, y: 3 }; actor.movement = actor.speed; enemy.position = { x: 5, y: 3 };
  giveBall(state, enemy, []);
  const distraction = state.players[6]; distraction.hp = distraction.maxHp; distraction.position = { x: 2, y: 1 }; distraction.reaction = false;
  const decision = decideTurn(state, actor);
  assert.equal(decision.action.type, 'attack'); assert.equal(decision.action.targetId, enemy.id);
  assert.ok(decision.path.length); assertInvariants(state);
});

test('tempo : un coéquipier rejoint le combat sans simuler un démarquage sans passe', () => {
  const { state, actor, enemy } = contest(); state.round = 6;
  const holder = state.players[0]; holder.hp = holder.maxHp; holder.reaction = true; holder.position = { x: 0, y: 0 };
  actor.position = { x: 2, y: 3 }; actor.movement = actor.speed; giveBall(state, holder, []);
  const before = structuredClone(state), decision = decideTurn(state, actor);
  assert.equal(decision.task, 'fight'); assert.equal(decision.action.type, 'attack'); assert.ok(decision.path.length);
  assert.deepEqual(state, before); assert.equal(holder.readiedPass, null);
  state.round = 7;
  const waiting = decideTurn(state, actor);
  assert.equal(waiting.task, 'protect'); assert.notEqual(waiting.task, 'relay');
  assert.ok(enemy.hp > 0); assertInvariants(state);
});

test('tempo : sans adversaire debout, la balle peut être récupérée avant le round 7', () => {
  const { state, actor, enemy } = contest(); enemy.hp = 0; enemy.reaction = false;
  state.ball = { carrierId: null, position: { x: 5, y: 4 } }; state.round = 2;
  assert.equal(decideTurn(state, actor).action.type, 'pickup'); assertInvariants(state);
});

test('tempo : les anciennes versions et le maintien d’une lutte conservent leurs règles', () => {
  for (const version of [2, 3, 4]) for (const round of [1, 6, 7, 13]) assert.equal(matchPriority({ version, round }), null);
  const { state, actor, enemy } = contest(); actor.grappling = enemy.id; enemy.grappledBy = actor.id; actor.movement = actor.speed;
  for (const round of [6, 7]) { state.round = round; assert.deepEqual(decideMovement(state, actor), []); }
});
