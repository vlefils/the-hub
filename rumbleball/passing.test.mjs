import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from './engine.mjs';
import { initialClassState } from './classes.mjs';
import { decideClassAction, decideTurn, passCompletionChance, teamPlan } from './ai.mjs';
import { assertInvariants, beginTurn, giveBall, resolveAction, resolveClassAction, shouldTakeOpportunity } from './rules.mjs';

function fixture(ids = ['home-0', 'home-2', 'home-4', 'away-0']) {
  const state = createMatch({ seed: 'passing-decisions', strategy: 'possession', openings: { home: 'none', away: 'none' } });
  for (const p of state.players) { p.hp = ids.includes(p.id) ? p.maxHp : 0; p.reaction = p.hp > 0; }
  const captain = state.players[0], receiver = state.players[2], passer = state.players[4], enemy = state.players[5];
  captain.position = { x: 2, y: 2 }; receiver.position = { x: 0, y: 0 }; passer.position = { x: 2, y: 4 }; enemy.position = { x: 3, y: 4 };
  state.initiative = [captain.id, passer.id, receiver.id, enemy.id]; state.turnIndex = 0; state.activeId = captain.id;
  giveBall(state, passer, []); return { state, captain, receiver, passer, enemy };
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('probabilité de passe : DD, avantage, réception et absence de mutation ou de tirage', () => {
  const { state, captain, passer, receiver, enemy } = fixture(); captain.hp = 0; enemy.position = { x: 11, y: 7 };
  passer.position = { x: 1, y: 1 }; receiver.position = { x: 5, y: 1 }; passer.skills.acrobatics = 4;
  const before = structuredClone(state); close(passCompletionChance(state, passer, receiver), .75);
  close(passCompletionChance(state, passer, receiver, true), .9375); assert.deepEqual(state, before);
  state.aids.push({ helperId: captain.id, allyId: passer.id, kind: 'check' }); close(passCompletionChance(state, passer, receiver), .9375);
  receiver.reaction = false; assert.equal(passCompletionChance(state, passer, receiver), 0);
  receiver.reaction = true; receiver.hp = 0; assert.equal(passCompletionChance(state, passer, receiver), 0);
  receiver.hp = receiver.maxHp; receiver.position = { x: 11, y: 1 }; assert.equal(passCompletionChance(state, passer, receiver), 0);
});
test('interception : seul le premier adversaire éligible compte, égalité au passeur', () => {
  const { state, captain, passer, receiver, enemy } = fixture(['home-0', 'home-2', 'home-4', 'away-0', 'away-1']);
  captain.hp = 0; passer.position = { x: 1, y: 1 }; receiver.position = { x: 5, y: 1 }; enemy.position = { x: 3, y: 1 }; enemy.skills.acrobatics = 2;
  const second = state.players[6]; second.position = { x: 3, y: 2 }; second.skills.acrobatics = 100;
  let successes = 0; for (let a = 1; a <= 20; a++) for (let b = 1; b <= 20; b++) if (a + 4 >= 10 && b + 2 <= a + 4) successes++;
  close(passCompletionChance(state, passer, receiver), successes / 400);
  const chance = passCompletionChance(state, passer, receiver); second.reaction = false; close(passCompletionChance(state, passer, receiver), chance);
  second.reaction = true; enemy.reaction = false; assert.equal(passCompletionChance(state, passer, receiver), 0);
});
test('concentration adverse : avantage d’interception pris en compte, aucun coût pendant la décision', () => {
  const { state, captain, passer, receiver, enemy } = fixture(); captain.hp = 0;
  passer.position = { x: 1, y: 1 }; receiver.position = { x: 5, y: 1 }; enemy.position = { x: 3, y: 1 };
  enemy.archetype = 'passeur'; enemy.classState = initialClassState('passeur');
  const before = structuredClone(state), focused = passCompletionChance(state, passer, receiver);
  assert.deepEqual(state, before); enemy.classState.focus = 0; assert.ok(passCompletionChance(state, passer, receiver) > focused);
});
test('capitaine : appel utile au porteur immobilisé, utilisé sans dépenser la concentration', () => {
  const { state, captain, passer, receiver, enemy } = fixture();
  passer.grappledBy = enemy.id; enemy.grappling = passer.id; passer.classState.focus = 0;
  const before = structuredClone(state), action = decideClassAction(state, captain);
  assert.deepEqual(action, { type: 'call', targetId: passer.id }); assert.deepEqual(state, before);
  const events = []; assert.equal(resolveClassAction(state, captain, action, events), true);
  beginTurn(state, passer, events); state.turnIndex = 1; state.activeId = passer.id;
  passer.classState.focus = 2; const decision = decideTurn(state, passer);
  assert.equal(decision.action.type, 'pass'); assert.equal(decision.action.technique, undefined); assert.equal(decision.action.targetId, receiver.id);
  assert.equal(resolveAction(state, passer, decision.action, events), true); assert.equal(passer.classState.focus, 2); assert.equal(captain.classState.calls, 1);
  assert.ok(events.some((e) => e.type === 'class' && e.ability === 'call-used')); assertInvariants(state);
});
test('capitaine : pas d’appel sans réception possible, avec une aide ou après la dernière occasion avant sirène', () => {
  const { state, captain, passer, receiver, enemy } = fixture(); passer.grappledBy = enemy.id; enemy.grappling = passer.id;
  captain.reaction = false; receiver.reaction = false; assert.notEqual(decideClassAction(state, captain)?.type, 'call');
  receiver.reaction = true; state.aids.push({ helperId: receiver.id, allyId: passer.id, kind: 'check' }); assert.notEqual(decideClassAction(state, captain)?.type, 'call');
  state.aids = []; state.initiative = [passer.id, captain.id, receiver.id, enemy.id]; state.turnIndex = 1; state.round = 10;
  assert.notEqual(decideClassAction(state, captain)?.type, 'call');
});
test('capitaine : prépare le prochain round avec les réactions renouvelées', () => {
  const { state, captain, passer, receiver, enemy } = fixture(); passer.grappledBy = enemy.id; enemy.grappling = passer.id; passer.classState.focus = 0;
  state.initiative = [passer.id, captain.id, receiver.id, enemy.id]; state.turnIndex = 1; receiver.reaction = false; captain.reaction = false;
  enemy.skills.wrestling = -10;
  assert.equal(decideClassAction(state, captain)?.type, 'call');
});
test('capitaine : conserve ses appels si le porteur doit encore subir plusieurs contestations avant son tour', () => {
  const { state, captain, passer, receiver, enemy } = fixture(['home-0', 'home-2', 'home-4', 'away-0', 'away-1']);
  const second = state.players[6]; second.position = { x: 1, y: 4 }; second.skills.wrestling = 6; enemy.skills.wrestling = 6;
  state.initiative = [captain.id, enemy.id, second.id, passer.id, receiver.id];
  passer.grappledBy = enemy.id; enemy.grappling = passer.id;
  const before = structuredClone(state); assert.notEqual(decideClassAction(state, captain)?.type, 'call'); assert.deepEqual(state, before);
});
test('Conservation : le passeur offre un second relais et préserve sa réception sans bloquer une opportunité sur le porteur', () => {
  const state = createMatch({ strategy: 'possession', openings: { home: 'none', away: 'none' } }), holder = state.players[2], passer = state.players[4], mover = state.players[5];
  giveBall(state, holder, []); const plan = teamPlan(state, holder); assert.equal(plan.outlet, passer.id);
  assert.equal(shouldTakeOpportunity(state, passer, mover), false);
  passer.instruction = 'aggressive'; assert.equal(shouldTakeOpportunity(state, passer, mover), true);
  passer.instruction = 'normal'; state.teams[0].strategy = 'balanced'; assert.equal(teamPlan(state, holder).outlet, undefined); assert.equal(shouldTakeOpportunity(state, passer, mover), true);
  state.teams[0].strategy = 'possession'; giveBall(state, mover, []); assert.equal(shouldTakeOpportunity(state, passer, mover), true);
});
test('porteur en sécurité : aucune passe gratuite vers un équipier moins protégé', () => {
  const { state, captain, passer, receiver, enemy } = fixture(); captain.hp = 0; passer.position = { x: 0, y: 0 }; passer.movement = 0;
  receiver.position = { x: 5, y: 3 }; enemy.position = { x: 6, y: 3 }; const before = structuredClone(state);
  assert.notEqual(decideTurn(state, passer).action.type, 'pass'); assert.deepEqual(state, before);
});
test('relais : un receveur qui joue avant les poursuivants est préférable à la même réception après eux', () => {
  const { state, captain, passer, receiver, enemy } = fixture(); captain.hp = 0; passer.movement = 0;
  state.activeId = passer.id; state.initiative = [passer.id, receiver.id, enemy.id];
  const before = structuredClone(state), quick = decideTurn(state, passer), chance = passCompletionChance(state, passer, receiver, true);
  assert.equal(quick.action.type, 'pass'); assert.deepEqual(state, before);
  state.initiative = [passer.id, enemy.id, receiver.id]; const late = decideTurn(state, passer);
  assert.equal(late.action.type, 'pass'); assert.ok(quick.score > late.score); close(passCompletionChance(state, passer, receiver, true), chance);
});
