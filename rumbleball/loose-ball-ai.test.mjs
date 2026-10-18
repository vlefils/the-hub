import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from './engine.mjs';
import { decideMovement, decideTurn, teamPlan } from './ai.mjs';
import { assertInvariants, ballDefender, distance, dropBall, legalAction, moveAlong, resolveAction } from './rules.mjs';
import { CENTER } from './deployment.mjs';

function fixture({ profile = 0, position = [1, 3], opponent = [11, 7], movement = 0, ally = false, opening = 'none' } = {}) {
  const state = createMatch({ seed: 'loose-ball-opportunity', openings: { home: opening, away: 'none' } });
  const actor = state.players[profile], enemy = state.players[5], receiver = state.players[profile === 2 ? 0 : 2];
  for (const p of state.players) { p.hp = [actor, enemy, ...(ally ? [receiver] : [])].includes(p) ? p.maxHp : 0; p.reaction = p.hp > 0; }
  actor.position = { x: position[0], y: position[1] }; actor.movement = movement;
  enemy.position = { x: opponent[0], y: opponent[1] }; receiver.position = { x: 0, y: 5 };
  state.round = 3; state.activeId = actor.id; state.ball = { carrierId: null, position: { ...actor.position } };
  state.initiative = [actor.id, ...state.initiative.filter((id) => id !== actor.id)]; state.turnIndex = 0;
  assertInvariants(state);
  return { state, actor, enemy, receiver };
}

test('balle au sol : tous les rôles ramassent immédiatement sans mouvement, action ni réaction dépensés', () => {
  for (const profile of [0, 1, 2, 3, 4]) for (const round of [1, 3, 6, 7, 10, 13]) {
    const { state, actor } = fixture({ profile, opening: 'fallback' }); state.round = round;
    const before = structuredClone(state), decision = decideTurn(state, actor);
    assert.equal(decision.action.type, 'pickup'); assert.deepEqual(decision.path, []); assert.deepEqual(state, before);
    assert.equal(resolveAction(state, actor, decision.action), true);
    assert.equal(state.ball.carrierId, actor.id); assert.equal(actor.interaction, false); assert.equal(actor.pickedUp, true);
    assert.equal(actor.action, true); assert.equal(actor.reaction, true); assert.equal(actor.movement, before.players[profile].movement);
    assert.equal(state.rng, before.rng); assertInvariants(state);
  }
});

test('balle au sol : prendre la balle libre prime sur une frappe pourtant légale au contact', () => {
  const { state, actor, enemy } = fixture({ position: [5, 3], opponent: [4, 3] });
  state.ball.position = { x: 6, y: 3 };
  assert.equal(ballDefender(state, actor), undefined); assert.ok(legalAction(state, actor, { type: 'attack', targetId: enemy.id }));
  assert.equal(decideTurn(state, actor).action.type, 'pickup');
});

test('balle au sol : le récupérateur va chercher une balle éloignée pendant les premiers rounds', () => {
  const { state, actor } = fixture({ position: [1, 3], opponent: [10, 3], movement: 9 });
  state.ball.position = { x: 4, y: 3 };
  const before = structuredClone(state), decision = decideTurn(state, actor);
  assert.equal(decision.task, 'recover'); assert.equal(decision.action.type, 'pickup'); assert.ok(decision.path.length);
  moveAlong(state, actor, decision.path, []); assert.ok(actor.movement < before.players[0].movement);
  const remaining = actor.movement; assert.equal(resolveAction(state, actor, decision.action), true);
  assert.equal(actor.movement, remaining); assert.equal(actor.action, true); assertInvariants(state);
});

test('balle au sol : un relais hors du carré d’engagement peut aussi ramasser après déplacement', () => {
  const { state, actor, receiver } = fixture({ profile: 4, position: [1, 3], opponent: [11, 3], movement: 1.5, ally: true, opening: 'fallback' });
  state.round = 1; state.ball.position = { x: 3, y: 3 }; receiver.position = { x: 3, y: 4 };
  assert.notEqual(teamPlan(state, actor).primary, actor.id);
  const decision = decideTurn(state, actor);
  assert.equal(decision.action.type, 'pickup'); assert.ok(decision.path.length);
  moveAlong(state, actor, decision.path, []); assert.ok(legalAction(state, actor, decision.action)); assertInvariants(state);
});

test('après ramassage : préparer une passe conserve le mouvement et dépense une seule action', () => {
  const { state, actor } = fixture({ ally: true }), rng = state.rng;
  assert.equal(resolveAction(state, actor, decideTurn(state, actor).action), true);
  const next = decideTurn(state, actor); assert.equal(next.task, 'carry'); assert.equal(next.action.type, 'ready-pass');
  assert.equal(resolveAction(state, actor, next.action), true);
  assert.equal(actor.action, false); assert.equal(actor.reaction, true); assert.ok(actor.readiedPass);
  assert.equal(actor.movement, 0); assert.equal(state.rng, rng); assertInvariants(state);
});

test('après ramassage : sprinter utilise l’action restante et ajoute seulement la vitesse normale', () => {
  const { state, actor } = fixture({ position: [3, 3], opponent: [0, 0] });
  resolveAction(state, actor, decideTurn(state, actor).action);
  const next = decideTurn(state, actor); assert.equal(next.action.type, 'dash'); assert.equal(next.task, 'carry');
  assert.equal(resolveAction(state, actor, next.action), true); assert.equal(actor.action, false); assert.equal(actor.movement, actor.speed);
  const path = decideMovement(state, actor); assert.ok(path.length); moveAlong(state, actor, path, []);
  assert.ok(actor.movement >= 0); assert.equal(state.ball.carrierId, actor.id); assertInvariants(state);
});

test('après ramassage : courir sur le mouvement restant puis esquiver sans sprint gratuit', () => {
  const { state, actor } = fixture({ position: [1, 3], opponent: [0, 7], movement: 1.5 });
  resolveAction(state, actor, decideTurn(state, actor).action);
  const next = decideTurn(state, actor); assert.equal(next.action.type, 'dodge'); assert.ok(next.path.length);
  moveAlong(state, actor, next.path, []); assert.equal(resolveAction(state, actor, next.action), true);
  assert.equal(actor.action, false); assert.equal(actor.dodging, true); assert.equal(actor.movement, 0); assertInvariants(state);
});

test('passe préparée tôt : les soutiens répondent au porteur dès la phase combat', () => {
  const { state, actor, receiver } = fixture({ ally: true });
  const protector = state.players[1]; protector.hp = protector.maxHp; protector.reaction = true; protector.position = { x: 0, y: 4 };
  resolveAction(state, actor, { type: 'pickup' }); resolveAction(state, actor, { type: 'ready-pass' });
  const before = structuredClone(state), decision = decideTurn(state, receiver);
  assert.equal(teamPlan(state, receiver).supports.has(receiver.id), true); assert.equal(decision.task, 'relay'); assert.deepEqual(state, before);
  assertInvariants(state);
});

test('tour complet : ramassage puis déplacement et esquive utilisent les vrais budgets du même tour', () => {
  const { state, actor } = fixture({ position: [1, 3], opponent: [0, 7] }); actor.speed = 1.5;
  const before = structuredClone(state), turn = stepMatch(state), after = turn.state.players[0];
  const actions = turn.events.filter((e) => e.resolvedAction).map((e) => e.resolvedAction.type);
  assert.deepEqual(actions, ['pickup', 'dodge']); assert.equal(after.dodging, true); assert.equal(after.action, false);
  assert.equal(after.interaction, false); assert.equal(after.reaction, true); assert.equal(after.movement, 0);
  assert.equal(turn.state.ball.carrierId, actor.id); assert.equal(distance(before.players[0].position, after.position), 1);
  assert.deepEqual(state, before); assertInvariants(turn.state);
});

test('après une frappe : ramasser la balle libérée utilise seulement l’interaction restante', () => {
  const { state, actor, enemy } = fixture({ position: [5, 3], opponent: [6, 3] });
  // Another opponent remains in play: this knockout must not end the match.
  state.players[6].hp = state.players[6].maxHp; state.players[6].position = { x: 11, y: 7 };
  state.ball = { carrierId: enemy.id, position: { ...enemy.position } }; enemy.hp = 1;
  actor.attack.bonus = 100; enemy.armor = -100; actor.speed = 0;
  // Choose a non-fumble before running the turn; the action itself still rolls.
  const before = structuredClone(state); let turn;
  for (let rng = 1; rng < 30; rng++) {
    state.rng = rng; turn = stepMatch(state);
    if (turn.state.players[5].hp === 0) break;
  }
  assert.equal(turn.state.players[5].hp, 0); assert.equal(turn.state.ball.carrierId, actor.id);
  const actions = turn.events.filter((e) => e.resolvedAction).map((e) => e.resolvedAction.type);
  assert.deepEqual(actions, ['attack', 'pickup']);
  const after = turn.state.players[0]; assert.equal(after.action, false); assert.equal(after.interaction, false); assert.equal(after.movement, 0);
  assert.equal(after.dodging, false); assert.equal(after.readiedPass, null); assert.equal(state.turns, before.turns); assertInvariants(turn.state);
});

test('coûts : aucune interaction ou seconde récupération gratuite ajoutée', () => {
  for (const field of ['interaction', 'pickedUp']) {
    const { state, actor } = fixture(); actor[field] = field === 'pickedUp';
    const before = structuredClone(state); assert.equal(legalAction(state, actor, { type: 'pickup' }), false);
    assert.notEqual(decideTurn(state, actor).action.type, 'pickup'); assert.deepEqual(state, before);
  }
  const { state, actor } = fixture(); actor.action = actor.reaction = false;
  assert.equal(decideTurn(state, actor).action.type, 'pickup'); resolveAction(state, actor, { type: 'pickup' });
  assert.equal(actor.action, false); assert.equal(actor.reaction, false); dropBall(state, actor, []);
  assert.equal(legalAction(state, actor, { type: 'pickup' }), false);
});

test('ramassage contesté : le jet opposé subsiste et l’interaction conserve l’action et la réaction', () => {
  const { state, actor, enemy } = fixture({ position: [5, 3], opponent: [6, 3] }); actor.skills.wrestling = 100;
  assert.equal(ballDefender(state, actor).id, enemy.id);
  const rng = state.rng; assert.equal(decideTurn(state, actor).action.type, 'pickup'); resolveAction(state, actor, { type: 'pickup' });
  assert.equal(actor.action, true); assert.equal(actor.reaction, true); assert.equal(actor.interaction, false);
  assert.equal(state.ball.carrierId, actor.id); assert.notEqual(state.rng, rng); assertInvariants(state);
});

test('ramassage contesté raté : aucun second essai, l’action peut encore être utilisée', () => {
  const { state, actor, enemy } = fixture({ position: [5, 3], opponent: [6, 3] }); actor.skills.wrestling = actor.skills.acrobatics = -100;
  resolveAction(state, actor, { type: 'pickup' });
  assert.equal(state.ball.carrierId, null); assert.equal(actor.action, true); assert.equal(actor.reaction, true); assert.equal(actor.interaction, false);
  assert.equal(legalAction(state, actor, { type: 'pickup' }), false);
  assert.equal(resolveAction(state, actor, { type: 'attack', targetId: enemy.id }), true); assert.equal(actor.action, false); assertInvariants(state);
});

test('versions antérieures : le ramassage contesté coûte toujours une action ; engagement central inchangé', () => {
  for (const version of [2, 3, 4]) {
    const { state, actor } = fixture({ position: [5, 3], opponent: [6, 3] }); state.version = version;
    resolveAction(state, actor, { type: 'pickup' }); assert.equal(actor.action, false); assert.equal(actor.interaction, true);
  }
  const center = createMatch(), first = center.players[1];
  assert.deepEqual(center.ball.position, CENTER);
  const decision = decideTurn(center, first); assert.doesNotMatch(decision.reason, /avec son interaction/);
  assert.equal(center.ball.carrierId, null);
});
