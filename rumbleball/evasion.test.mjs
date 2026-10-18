import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch, stepMatch } from './engine.mjs';
import { decideTurn } from './ai.mjs';
import { defensiveForecast } from './evasion.mjs';
import { assertInvariants, distance, giveBall, resolveAction, resolveReadiedPass } from './rules.mjs';

function fixture() {
  const state = createMatch({ strategy: 'possession', openings: { home: 'none', away: 'none' } });
  const actor = state.players[2], enemy = state.players[5], ally = state.players[4];
  state.players.forEach((p) => { p.hp = [actor, enemy, ally].includes(p) ? p.maxHp : 0; p.reaction = p.hp > 0; });
  actor.position = { x: 3, y: 3 }; enemy.position = { x: 6, y: 3 }; ally.position = { x: 0, y: 0 };
  state.initiative = [actor.id, ally.id, enemy.id]; state.turnIndex = 0; state.round = 3; state.activeId = actor.id;
  giveBall(state, actor, []); assertInvariants(state);
  return { state, actor, ally, enemy };
}

test('évitement : prévoit une attaque accessible même sans contact actuel, sans modifier le hasard', () => {
  const { state, actor, enemy } = fixture(); const before = structuredClone(state);
  assert.ok(distance(actor.position, enemy.position) > 1);
  assert.ok(defensiveForecast(state, actor).risk(actor, actor.position).damage > 0);
  assert.deepEqual(state, before);
});

test('évitement : une prise d’écran retire la poursuite, mais pas la menace au contact', () => {
  const { state, actor, ally, enemy } = fixture();
  ally.position = { x: 7, y: 3 }; ally.grappling = enemy.id; enemy.grappledBy = ally.id;
  assertInvariants(state);
  const forecast = defensiveForecast(state, actor);
  assert.equal(forecast.risk(actor, actor.position).damage, 0);
  assert.ok(forecast.risk(actor, { x: 5, y: 3 }).damage > 0);
});

test('évitement : compare les tours avant réception et arrête la prévision à la sirène', () => {
  const { state, actor, ally, enemy } = fixture(); ally.position = { x: 3, y: 0 };
  assert.equal(defensiveForecast(state, actor).risk(ally, ally.position, false, undefined, true).damage, 0);
  state.initiative = [actor.id, enemy.id, ally.id];
  assert.ok(defensiveForecast(state, actor).risk(ally, ally.position, false, undefined, true).damage > 0);
  state.initiative = [ally.id, enemy.id, actor.id]; state.turnIndex = 2; state.round = 10;
  assert.equal(defensiveForecast(state, actor).risk(actor, actor.position).damage, 0);
  state.round = 9;
  assert.ok(defensiveForecast(state, actor).risk(actor, actor.position).damage > 0);
});

test('évitement : tient compte de l’esquive et des réactions déjà utilisées sur le trajet', () => {
  const { state, actor, enemy } = fixture(); actor.position = { x: 5, y: 3 };
  const forecast = defensiveForecast(state, actor), route = [{ x: 4, y: 3 }];
  assert.ok(forecast.risk(actor, actor.position, true).damage < forecast.risk(actor, actor.position).damage);
  assert.ok(forecast.routeRisk(route) > forecast.routeRisk(route, true));
  assert.equal(forecast.routeRisk(route, false, true), 0);
  enemy.reaction = false; assert.equal(defensiveForecast(state, actor).routeRisk(route), 0);
});

test('évitement : se désengage avant la course, sans opportunité ni mouvement gratuit', () => {
  const { state, actor, ally, enemy } = fixture(); ally.hp = 0; ally.reaction = false;
  actor.position = { x: 5, y: 3 }; enemy.speed = 3; enemy.position = { x: 6, y: 3 };
  const before = structuredClone(state), decision = decideTurn(state, actor);
  assert.equal(decision.action.type, 'disengage'); assert.deepEqual(decision.path, []);
  const turn = stepMatch(state), moves = turn.events.filter((e) => e.type === 'move' && e.playerId === actor.id);
  assert.ok(turn.events.findIndex((e) => e.type === 'disengage') < turn.events.findIndex((e) => e.type === 'move'));
  assert.ok(moves.length > 0); assert.equal(turn.events.some((e) => e.type === 'opportunity'), false);
  assert.ok(moves.reduce((n, e) => n + e.path.length, 0) * 1.5 <= actor.speed);
  assert.equal(turn.state.players[2].action, false); assert.deepEqual(state, before); assertInvariants(turn.state);
});

test('évitement : une frappe ciblée est suivie d’un repli lorsque la réaction adverse est dépensée', () => {
  const { state, actor, enemy, ally } = fixture(); ally.hp = 0; ally.reaction = false;
  actor.position = { x: 4, y: 3 }; enemy.position = { x: 5, y: 3 }; enemy.reaction = false;
  giveBall(state, enemy, []);
  const turn = stepMatch(state), attack = turn.events.findIndex((e) => e.type === 'attack' && e.playerId === actor.id);
  const move = turn.events.findIndex((e, i) => i > attack && e.type === 'move' && e.playerId === actor.id);
  assert.ok(attack >= 0 && move > attack); assert.equal(turn.events.some((e) => e.type === 'opportunity'), false);
  assert.ok(distance(turn.state.players[2].position, turn.state.players[5].position) > 1);
  assertInvariants(turn.state);
});

test('relais fiable : la concentration améliore une réaction libre sans doubler un appel de jeu', () => {
  for (const called of [false, true]) {
    const { state, actor, ally, enemy } = fixture(); giveBall(state, ally, []);
    actor.position = { x: 3, y: 0 }; enemy.position = { x: 11, y: 7 }; state.activeId = actor.id;
    if (called) {
      const captain = state.players[0]; captain.hp = captain.maxHp; captain.reaction = true; captain.position = { x: 1, y: 1 };
      state.calls.push({ sourceId: captain.id, targetId: ally.id });
    }
    resolveAction(state, ally, { type: 'ready-pass' }); const focus = ally.classState.focus;
    assert.equal(resolveReadiedPass(state, actor, []), true);
    assert.equal(ally.classState.focus, focus - Number(!called));
    assert.equal(ally.reaction, false); assert.equal(ally.readiedPass, null); assert.equal(actor.action, true);
    assertInvariants(state);
  }
});

test('réception en course : exécute le nouveau déplacement avant l’action, dans le budget restant', () => {
  const state = JSON.parse(readFileSync(new URL('./test-support/reception-movement.json', import.meta.url)));
  const before = structuredClone(state), actor = state.players.find((p) => p.id === state.initiative[state.turnIndex]);
  const turn = stepMatch(state), receipt = turn.events.findIndex((e) => e.type === 'possession' && e.playerId === actor.id);
  const action = turn.events.findIndex((e, i) => i > receipt && e.resolvedAction?.playerId === actor.id && !e.resolvedAction.reaction);
  const movement = turn.events.findIndex((e, i) => i > receipt && i < action && e.type === 'move' && e.playerId === actor.id);
  assert.ok(receipt >= 0 && movement > receipt && action > movement);
  const moves = turn.events.filter((e) => e.type === 'move' && e.playerId === actor.id);
  assert.ok(moves.reduce((n, e) => n + e.path.length, 0) * 1.5 <= actor.speed);
  const actions = turn.events.filter((e) => e.resolvedAction?.playerId === actor.id
    && !e.resolvedAction.reaction && !['pickup', 'drop', 'release'].includes(e.resolvedAction.type));
  assert.equal(actions.length, 1); assert.deepEqual(state, before); assertInvariants(turn.state);
});
