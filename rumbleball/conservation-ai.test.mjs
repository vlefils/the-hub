import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from './engine.mjs';
import { decideTurn, teamPlan } from './ai.mjs';
import { assertInvariants, distance, giveBall, resolveAction } from './rules.mjs';

function circulationFixture(strategy = 'possession') {
  const state = createMatch({ strategy, openings: { home: 'none', away: 'none' } });
  const holder = state.players[0], receiver = state.players[4], enemy = state.players[6];
  state.players.forEach((p) => { p.hp = [holder, receiver, enemy].includes(p) ? p.maxHp : 0; p.reaction = p.hp > 0; });
  holder.position = { x: 1, y: 0 }; receiver.position = { x: 4, y: 0 }; enemy.position = { x: 5, y: 7 };
  holder.movement = 0; state.round = 3; state.activeId = holder.id;
  state.initiative = [holder.id, receiver.id, enemy.id, ...state.initiative.filter((id) => ![holder.id, receiver.id, enemy.id].includes(id))];
  state.turnIndex = 0; giveBall(state, holder, []); assertInvariants(state);
  return { state, holder, receiver, enemy };
}

test('Conservation : fait circuler vers un partenaire libre qui a encore son tour, sans exiger une fuite individuelle', () => {
  for (const strategy of ['possession', 'balanced', 'pressing']) {
    const { state, holder, receiver } = circulationFixture(strategy), before = structuredClone(state), decision = decideTurn(state, holder);
    if (strategy === 'possession') {
      assert.equal(decision.action.type, 'pass'); assert.equal(decision.action.targetId, receiver.id);
    } else assert.notEqual(decision.action.type, 'pass');
    assert.deepEqual(state, before);
  }
});

test('Conservation : ne récompense pas un retour vers un joueur déjà passé qui sera rattrapé avant son prochain tour', () => {
  const { state, holder, receiver, enemy } = circulationFixture();
  state.initiative = [receiver.id, holder.id, enemy.id, ...state.initiative.filter((id) => ![holder.id, receiver.id, enemy.id].includes(id))];
  enemy.speed = 9;
  state.turnIndex = 1; assert.notEqual(decideTurn(state, holder).action.type, 'pass');
});

test('Conservation : peut confier le ballon au relais qui jouera en sécurité au début du round suivant', () => {
  const { state, holder, receiver, enemy } = circulationFixture();
  state.initiative = [receiver.id, holder.id, enemy.id, ...state.initiative.filter((id) => ![holder.id, receiver.id, enemy.id].includes(id))];
  state.turnIndex = 1;
  assert.equal(decideTurn(state, holder).action.targetId, receiver.id);
  assert.equal(decideTurn(state, holder).action.type, 'pass');
});

test('Conservation : un bloqueur en sécurité attend une aide avant une remise peu fiable', () => {
  const { state, holder, receiver } = circulationFixture(), blocker = state.players[1];
  holder.hp = 0; holder.reaction = false; blocker.hp = blocker.maxHp; blocker.reaction = true;
  blocker.position = { x: 1, y: 0 }; blocker.movement = 0;
  state.activeId = blocker.id; state.initiative = [blocker.id, receiver.id, ...state.initiative.filter((id) => ![blocker.id, receiver.id].includes(id))];
  giveBall(state, blocker, []);
  assert.notEqual(decideTurn(state, blocker).action.type, 'pass', 'Une remise à 55 % ne justifie pas de perdre une possession sûre.');
  state.aids.push({ helperId: receiver.id, allyId: blocker.id, kind: 'check' });
  const before = structuredClone(state), decision = decideTurn(state, blocker);
  assert.equal(decision.action.type, 'pass'); assert.equal(decision.action.targetId, receiver.id);
  assert.deepEqual(state, before); assertInvariants(state);
});

test('Conservation : conserve la balle à la sirène plutôt que faire une circulation sans gain', () => {
  const { state, holder } = circulationFixture(); state.round = 10;
  assert.notEqual(decideTurn(state, holder).action.type, 'pass');
});

test('Conservation : aucun relais vers une cible marquée même avec la nouvelle priorité de passe', () => {
  const { state, holder, enemy } = circulationFixture(); enemy.position = { x: 5, y: 0 };
  assert.notEqual(decideTurn(state, holder).action.type, 'pass');
});

function supportFixture(strategy = 'possession') {
  const state = createMatch({ strategy, openings: { home: 'none', away: 'none' } });
  const holder = state.players[4];
  [[2, 2], [1, 3], [3, 3], [3, 4], [2, 3]].forEach(([x, y], i) => { state.players[i].position = { x, y }; });
  state.round = 3; state.activeId = holder.id; giveBall(state, holder, []); assertInvariants(state);
  return { state, holder, receiver: state.players[0] };
}

test('Conservation : trois soutiens après la préparation, deux en Équilibrée et un en Pressing', () => {
  for (const [strategy, count] of [['possession', 3], ['balanced', 2], ['pressing', 1]]) {
    const { state, holder, receiver } = supportFixture(strategy);
    assert.equal(teamPlan(state, receiver).supports.size, 0);
    assert.notEqual(decideTurn(state, receiver).task, 'relay');
    assert.equal(resolveAction(state, holder, { type: 'ready-pass' }), true);
    const before = structuredClone(state), plan = teamPlan(state, receiver);
    assert.equal(plan.supports.size, count);
    for (const id of plan.supports.keys()) assert.equal(decideTurn(state, state.players.find((p) => p.id === id)).task, 'relay');
    assert.deepEqual(state, before); assertInvariants(state);
  }
});

test('Conservation : le relais quitte réellement le groupe et reçoit la passe après son mouvement', () => {
  const { state, holder, receiver } = supportFixture(); holder.skills.acrobatics = 100;
  assert.equal(resolveAction(state, holder, { type: 'ready-pass' }), true);
  state.initiative = [holder.id, receiver.id, ...state.initiative.filter((id) => ![holder.id, receiver.id].includes(id))]; state.turnIndex = 1;
  const before = structuredClone(state), turn = stepMatch(state);
  const movement = turn.events.findIndex((e) => e.type === 'move' && e.playerId === receiver.id);
  const trigger = turn.events.findIndex((e) => e.type === 'ready-trigger' && e.playerId === holder.id && e.targetId === receiver.id);
  assert.equal(turn.events.find((e) => e.type === 'decision').task, 'relay');
  assert.ok(movement >= 0 && trigger > movement);
  const pass = turn.events.find((e) => e.type === 'pass' && e.playerId === holder.id);
  assert.ok(distance(pass.from, pass.position) >= 2); assert.equal(turn.state.players[4].reaction, false);
  assert.equal(turn.state.players[4].readiedPass, null); assert.deepEqual(state, before); assertInvariants(turn.state);
});

test('Conservation : la sortie de pression garde un partenaire à portée de passe', () => {
  const { state } = supportFixture();
  [[7, 5], [3, 3], [4, 3], [6, 5], [7, 6], [8, 0], [9, 0], [10, 0], [10, 1], [11, 0]]
    .forEach(([x, y], i) => { state.players[i].position = { x, y }; });
  const holder = state.players[2]; giveBall(state, holder, []); state.activeId = holder.id;
  state.initiative = [holder.id, ...state.initiative.filter((id) => id !== holder.id)]; state.turnIndex = 0;
  const before = structuredClone(state), turn = stepMatch(state), next = turn.state.players[2];
  assert.ok(Math.min(...turn.state.players.filter((p) => p.teamId === holder.teamId && p.id !== holder.id && p.hp > 0)
    .map((p) => distance(p.position, next.position))) <= 6);
  assert.deepEqual(state, before); assertInvariants(state);
});

test('Conservation : les anciennes versions gardent leur décision de circulation', () => {
  const { state, holder } = circulationFixture(); state.version = 4;
  assert.notEqual(decideTurn(state, holder).action.type, 'pass');
});
