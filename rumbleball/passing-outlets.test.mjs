import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from './engine.mjs';
import { decideTurn, teamPlan } from './ai.mjs';
import { assertInvariants, distance, giveBall, legalAction, opponents, resolveAction } from './rules.mjs';

function fixture() {
  const state = createMatch({ seed: 'passing-regression', strategy: 'possession', openings: { home: 'none', away: 'none' } });
  const passer = state.players[4], receiver = state.players[2], enemy = state.players[5];
  for (const p of state.players) { p.hp = [passer, receiver, enemy].includes(p) ? p.maxHp : 0; p.reaction = p.hp > 0; }
  passer.position = { x: 2, y: 3 }; receiver.position = { x: 3, y: 3 }; enemy.position = { x: 4, y: 3 };
  passer.movement = 0; state.round = 7; state.activeId = passer.id;
  state.initiative = [passer.id, receiver.id, ...state.initiative.filter((id) => ![passer.id, receiver.id].includes(id))];
  state.turnIndex = 0; giveBall(state, passer, []); assertInvariants(state);
  return { state, passer, receiver, enemy };
}

test('passe directe : un receveur marqué reste refusé même si la passe serait légale et favorisée par son rôle', () => {
  const { state, passer, receiver, enemy } = fixture(), second = state.players[6];
  second.hp = second.maxHp; second.reaction = true;
  passer.position = { x: 5, y: 5 }; receiver.position = { x: 6, y: 3 };
  enemy.position = { x: 5, y: 4 }; second.position = { x: 6, y: 5 }; giveBall(state, passer, []);
  const before = structuredClone(state);
  assert.ok(legalAction(state, passer, { type: 'pass', targetId: receiver.id }));
  assert.notEqual(decideTurn(state, passer).action.type, 'pass'); assert.deepEqual(state, before);
});

test('passe directe : une passe courte vers un partenaire libre reste possible sans préparation', () => {
  const { state, passer, receiver, enemy } = fixture(); enemy.position = { x: 0, y: 3 };
  // With the reaction spent, waiting is unavailable; the adjacent free receiver
  // must still be usable by a direct pass with the normal action.
  passer.reaction = false;
  const before = structuredClone(state), decision = decideTurn(state, passer);
  assert.equal(distance(passer.position, receiver.position), 1);
  assert.equal(decision.action.type, 'pass'); assert.equal(decision.action.targetId, receiver.id);
  assert.deepEqual(decision.path, []); assert.equal(passer.readiedPass, null); assert.deepEqual(state, before);
});

test('passe directe : un partenaire à terre ou immobilisé ne constitue pas un relais démarqué', () => {
  for (const condition of ['prone', 'grappledBy']) {
    const { state, passer, receiver, enemy } = fixture(); enemy.position = { x: 0, y: 3 };
    if (condition === 'prone') receiver.prone = true;
    else { receiver.grappledBy = enemy.id; enemy.grappling = receiver.id; enemy.position = { x: 4, y: 3 }; }
    assert.notEqual(decideTurn(state, passer).action.type, 'pass');
  }
});

test('passeur mobile : se déplace hors du contact avant une passe quand le trajet ne provoque aucune opportunité', () => {
  const { state, passer, receiver, enemy } = fixture();
  passer.position = { x: 5, y: 3 }; passer.movement = passer.speed;
  receiver.position = { x: 1, y: 3 }; enemy.position = { x: 6, y: 3 }; enemy.reaction = false;
  giveBall(state, passer, []); const before = structuredClone(state), decision = decideTurn(state, passer);
  assert.equal(decision.action.type, 'pass'); assert.equal(decision.action.targetId, receiver.id); assert.ok(decision.path.length);
  assert.ok(opponents(state, passer).every((p) => distance(p.position, decision.path.at(-1)) > 1));
  assert.deepEqual(state, before);
  const turn = stepMatch(state), pass = turn.events.find((e) => e.type === 'pass');
  assert.ok(pass); assert.ok(turn.events.findIndex((e) => e.type === 'move') < turn.events.indexOf(pass));
  assert.ok(distance(pass.from, enemy.position) > 1); assertInvariants(turn.state);
});

test('démarquage : le dernier partenaire disponible se libère et reçoit en réaction après une préparation', () => {
  const { state, passer, receiver } = fixture(), before = structuredClone(state), decision = decideTurn(state, passer);
  assert.equal(decision.action.type, 'ready-pass'); assert.deepEqual(state, before);
  assert.equal(resolveAction(state, passer, decision.action), true);
  assert.equal(teamPlan(state, receiver).protector, undefined);
  assert.ok(teamPlan(state, receiver).supports.has(receiver.id));
  state.turnIndex = 1; const turn = stepMatch(state);
  assert.equal(turn.events.find((e) => e.type === 'decision').task, 'relay');
  const movement = turn.events.findIndex((e) => e.type === 'move' && e.playerId === receiver.id);
  const trigger = turn.events.findIndex((e) => e.type === 'ready-trigger' && e.targetId === receiver.id);
  assert.ok(movement >= 0 && trigger > movement);
  const pass = turn.events.find((e) => e.type === 'pass');
  assert.ok(opponents(state, receiver).every((p) => distance(p.position, pass.position) > 1));
  assert.equal(turn.state.players[4].reaction, false); assert.equal(turn.state.players[4].readiedPass, null);
  assertInvariants(turn.state);
});

test('préparation : ne compte pas un protecteur non affecté au démarquage comme un futur receveur', () => {
  const { state, passer, receiver, enemy } = fixture(), protector = state.players[1];
  protector.hp = protector.maxHp; protector.reaction = true; protector.position = { x: 1, y: 3 };
  receiver.grappledBy = enemy.id; enemy.grappling = receiver.id;
  // The only mobile teammate has to protect; the assigned receiver cannot run.
  const before = structuredClone(state);
  assert.notEqual(decideTurn(state, passer).action.type, 'ready-pass'); assert.deepEqual(state, before);
});
