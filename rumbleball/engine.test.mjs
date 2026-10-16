import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, simulateMatch, stepMatch } from './engine.mjs';
import { decideMovement, decideTurn, teamPlan } from './ai.mjs';
import {
  assertInvariants, beginTurn, check, dealDamage, distance, giveBall, interceptionCandidates,
  legalAction, moveAlong, movementCost, movementView, neighbors, performAttack, provokesOpportunity, randomInt, reachableCells, resolveAction, trajectory,
} from './rules.mjs';

function fixture(ids = ['home-0', 'away-0']) {
  const state = createMatch({ seed: 'rules' });
  for (const p of state.players) {
    p.hp = ids.includes(p.id) ? p.maxHp : 0;
    p.reaction = p.hp > 0;
  }
  const a = state.players[0], b = state.players[5];
  a.position = { x: 5, y: 3 }; b.position = { x: 6, y: 3 };
  state.ball = { carrierId: null, position: { x: 5, y: 4 } };
  return { state, a, b, events: [] };
}
function forceD20(state, wanted) {
  for (let n = 0; n < 300000; n++) {
    const probe = { rng: n };
    if (wanted.every((want) => randomInt(probe, 20) + 1 === want)) { state.rng = n; return; }
  }
  throw new Error('Jet de test introuvable');
}
function finishFrom(state) {
  let current = state;
  const events = [];
  for (let n = 0; !current.finished && n < 140; n++) {
    const turn = stepMatch(current); current = turn.state; events.push(...turn.events);
  }
  assert.ok(current.finished);
  return { state: current, events };
}

test('profils symétriques, sans capacités ni effets de charge', () => {
  const state = createMatch();
  for (let i = 0; i < 5; i++) {
    const a = state.players[i], b = state.players[i + 5];
    for (const key of ['armor', 'maxHp', 'speed', 'attack', 'abilities', 'skills']) assert.deepEqual(a[key], b[key]);
    assert.equal(a.position.x + b.position.x, 11); assert.equal(a.position.y + b.position.y, 7);
  }
  assert.equal(state.players[1].attack.die, 8);
  assertInvariants(state);
});
test('configuration bornée et initialisation sans mutation des profils', () => {
  const first = createMatch({ strategy: 'possession', players: [{ role: 'blocker', instruction: 'cautious' }] });
  const next = createMatch({ strategy: 'invalide', players: [{ role: 'invalide' }] });
  assert.equal(first.players[0].role, 'blocker'); assert.equal(next.players[0].role, 'relay');
  assert.equal(next.teams[0].strategy, 'balanced');
});
test('mouvement : terrain humide, budget et cases occupées', () => {
  const { state, a, b, events } = fixture();
  a.position = { x: 2, y: 1 }; b.position = { x: 2, y: 2 }; a.movement = 3;
  assert.equal(movementCost(a, { x: 3, y: 1 }), 3);
  const cells = reachableCells(state, a);
  assert.ok(!cells.some((c) => c.position.x === 2 && c.position.y === 2));
  moveAlong(state, a, [{ x: 3, y: 1 }, { x: 4, y: 1 }], events);
  assert.deepEqual(a.position, { x: 3, y: 1 }); assert.equal(a.movement, 0);
  assertInvariants(state);
});
test('diagonale bloquée entre deux joueurs, déplacement impossible hors terrain', () => {
  const { state, a, b } = fixture(['home-0', 'away-0', 'away-1']);
  a.position = { x: 0, y: 0 }; b.position = { x: 1, y: 0 };
  state.players[6].position = { x: 0, y: 1 };
  assert.equal(reachableCells(state, a).length, 1);
});
test('ramassage libre : interaction, une fois par tour', () => {
  const { state, a, b, events } = fixture(); b.position = { x: 10, y: 7 };
  assert.ok(resolveAction(state, a, { type: 'pickup' }, events));
  assert.equal(state.ball.carrierId, a.id); assert.ok(a.action); assert.equal(a.interaction, false);
  resolveAction(state, a, { type: 'drop' }, events);
  assert.equal(legalAction(state, a, { type: 'pickup' }), false);
});
test('ramassage contesté : action et égalité au défenseur', () => {
  const { state, a, b, events } = fixture();
  a.skills = { wrestling: 0, acrobatics: 0 }; b.skills = { wrestling: 0, acrobatics: 0 };
  forceD20(state, [10, 10]);
  assert.ok(resolveAction(state, a, { type: 'pickup' }, events));
  assert.equal(a.action, false); assert.ok(a.interaction); assert.equal(state.ball.carrierId, null);
});
test('Lutte pour arracher, Athlétisme pour défendre un agrippement', () => {
  const { state, a, b, events } = fixture(); giveBall(state, b, events);
  a.skills.wrestling = 100; b.skills = { wrestling: 21, athletics: 44, acrobatics: 0 };
  resolveAction(state, a, { type: 'strip', targetId: b.id }, events);
  assert.equal(events.filter((e) => e.type === 'roll').at(-1).bonus, 21);
  a.action = true; events.length = 0;
  resolveAction(state, a, { type: 'grapple', targetId: b.id }, events);
  assert.equal(events.filter((e) => e.type === 'roll').at(-1).bonus, 44);
  assert.equal(b.grappledBy, a.id);
});
test('une égalité d’arrachement laisse la balle au porteur', () => {
  const { state, a, b, events } = fixture(); giveBall(state, b, events);
  a.skills.wrestling = 0; b.skills = { wrestling: 0, acrobatics: 0 }; forceD20(state, [10, 10]);
  resolveAction(state, a, { type: 'strip', targetId: b.id }, events);
  assert.equal(state.ball.carrierId, b.id);
});
test('passe réussie sans réaction : balle aux pieds du receveur', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  b.position = { x: 11, y: 7 }; const receiver = state.players[1]; receiver.position = { x: 3, y: 3 }; receiver.reaction = false;
  a.skills.acrobatics = 100; giveBall(state, a, events);
  assert.ok(resolveAction(state, a, { type: 'pass', targetId: receiver.id }, events));
  assert.equal(state.ball.carrierId, null); assert.deepEqual(state.ball.position, receiver.position);
  assert.equal(state.stats.home.passesCompleted, 0);
});
test('réception dépense la réaction ; pression impose DD 15', () => {
  const { state, a, events } = fixture(['home-0', 'home-1', 'away-0']);
  const receiver = state.players[1]; receiver.position = { x: 3, y: 3 };
  state.players[5].reaction = false;
  a.skills.acrobatics = 100; giveBall(state, a, events);
  resolveAction(state, a, { type: 'pass', targetId: receiver.id }, events);
  assert.equal(receiver.reaction, false); assert.equal(state.ball.carrierId, receiver.id);
  assert.ok(events.some((e) => e.type === 'pass' && e.message.includes('DD 15')));
  assert.equal(state.stats.home.passesCompleted, 1);
});
test('passe manquée : balle au milieu du trajet', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  b.position = { x: 11, y: 7 }; const receiver = state.players[1]; receiver.position = { x: 1, y: 3 };
  a.skills.acrobatics = -100; giveBall(state, a, events);
  resolveAction(state, a, { type: 'pass', targetId: receiver.id }, events);
  assert.deepEqual(state.ball.position, { x: 3, y: 3 }); assert.equal(state.ball.carrierId, null);
});
test('interception unique par le mieux placé, supérieur strict au passeur', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0', 'away-1']);
  const receiver = state.players[1], other = state.players[6];
  a.position = { x: 1, y: 3 }; receiver.position = { x: 7, y: 3 }; b.position = { x: 4, y: 3 }; other.position = { x: 4, y: 4 };
  a.skills.acrobatics = 20; b.skills.acrobatics = 100; other.skills.acrobatics = 200;
  assert.equal(interceptionCandidates(state, a, receiver.position)[0].id, b.id);
  giveBall(state, a, events); resolveAction(state, a, { type: 'pass', targetId: receiver.id }, events);
  assert.equal(state.ball.carrierId, b.id); assert.equal(b.reaction, false); assert.ok(other.reaction);
  assert.ok(receiver.reaction);
});
test('trajectoires symétriques et contenues dans le terrain', () => {
  for (const to of [{ x: 8, y: 6 }, { x: 7, y: 3 }, { x: 4, y: 7 }]) {
    const from = { x: 1, y: 2 };
    assert.deepEqual(trajectory(from, to), trajectory(to, from).reverse());
  }
});
test('interception : égalité conserve la passe et dépense une seule réaction', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  a.position = { x: 1, y: 3 }; b.position = { x: 4, y: 3 };
  const receiver = state.players[1]; receiver.position = { x: 7, y: 3 };
  a.skills.acrobatics = 5; b.skills.acrobatics = 5;
  forceD20(state, [10, 10]); giveBall(state, a, events);
  resolveAction(state, a, { type: 'pass', targetId: receiver.id }, events);
  assert.equal(state.ball.carrierId, receiver.id); assert.equal(b.reaction, false); assert.equal(receiver.reaction, false);
});
test('dégâts : DD minimum 10, Constitution et perte sans dégâts supplémentaires', () => {
  const { state, a, b, events } = fixture(); giveBall(state, b, events);
  b.abilities.constitution = -200;
  dealDamage(state, a, b, 2, events);
  assert.equal(b.hp, b.maxHp - 2); assert.equal(state.ball.carrierId, null);
  assert.equal(distance(state.ball.position, b.position), 1);
  assert.ok(events.some((e) => e.type === 'roll' && e.message.includes('DD 10')));
});
test('KO sportif : balle aux pieds, agrippements libérés, aucune cible KO', () => {
  const { state, a, b, events } = fixture(); giveBall(state, b, events);
  b.grappling = a.id; a.grappledBy = b.id;
  dealDamage(state, a, b, 500, events);
  assert.equal(b.hp, 0); assert.equal(b.reaction, false); assert.equal(a.grappledBy, null);
  assert.deepEqual(state.ball.position, b.position); assert.equal(state.ball.carrierId, null);
  assert.equal(legalAction(state, a, { type: 'attack', targetId: b.id }), false);
  assert.equal(state.stats.home.knockouts, 1); assertInvariants(state);
});
test('20 naturel double les dés, 1 naturel échoue malgré le bonus', () => {
  const { state, a, b, events } = fixture(); a.attack.bonus = 100;
  forceD20(state, [1]); resolveAction(state, a, { type: 'attack', targetId: b.id }, events);
  assert.equal(b.hp, b.maxHp);
  a.action = true; forceD20(state, [20]); resolveAction(state, a, { type: 'attack', targetId: b.id }, events);
  const damage = events.find((e) => e.critical);
  assert.equal(damage.dice.length, 2);
  assert.equal(b.maxHp - b.hp, damage.dice.reduce((x, y) => x + y, a.attack.flat));
});
test('avantage/désavantage s’annulent ; l’aide est consommée une seule fois', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  const helper = state.players[1]; helper.position = { x: 4, y: 3 };
  resolveAction(state, helper, { type: 'help', targetId: a.id, enemyId: b.id }, events);
  // Helper must be adjacent to the enemy for attack help.
  assert.equal(state.aids.length, 0);
  helper.position = { x: 6, y: 4 }; helper.action = true;
  assert.ok(resolveAction(state, helper, { type: 'help', targetId: a.id, enemyId: b.id }, events));
  a.prone = true; b.prone = true;
  resolveAction(state, a, { type: 'attack', targetId: b.id }, events);
  assert.equal(events.findLast((e) => e.type === 'roll' && e.message.includes('attaque contre')).dice.length, 1);
  assert.equal(state.aids.length, 0);
});
test('agrippement interdit le mouvement ; se libérer permet de repartir', () => {
  const { state, a, b, events } = fixture(); a.grappledBy = b.id; b.grappling = a.id;
  assert.equal(reachableCells(state, a).length, 1);
  a.skills.acrobatics = 100; resolveAction(state, a, { type: 'escape' }, events);
  assert.equal(a.grappledBy, null); assert.ok(reachableCells(state, a).length > 1);
});
test('lutte : déplacement couplé à demi-vitesse, prise et balle conservées', () => {
  const { state, a, b, events } = fixture(); a.grappling = b.id; b.grappledBy = a.id;
  a.movement = 6; giveBall(state, b, events);
  moveAlong(state, a, [{ x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }], events);
  assert.deepEqual(a.position, { x: 3, y: 3 }); assert.deepEqual(b.position, { x: 4, y: 3 });
  assert.equal(a.movement, 0); assert.equal(a.grappling, b.id); assert.equal(b.grappledBy, a.id);
  assert.deepEqual(state.ball.position, b.position); assert.equal(state.ball.carrierId, b.id);
  assert.equal(events.some((e) => e.type === 'opportunity'), false); assert.ok(b.reaction);
  assert.ok(events.some((e) => e.type === 'drag' && e.path.length === 2)); assertInvariants(state);
});
test('lutte : aucune opportunité du joueur entraîné dans le cas Étau / Frigo', () => {
  const { state, a, b, events } = fixture();
  a.position = { x: 2, y: 4 }; b.position = { x: 3, y: 3 }; a.hp = 9; a.movement = 4.5;
  a.grappling = b.id; b.grappledBy = a.id;
  moveAlong(state, a, [{ x: 1, y: 5 }], events);
  assert.deepEqual(a.position, { x: 1, y: 5 }); assert.deepEqual(b.position, { x: 2, y: 4 });
  assert.equal(a.hp, 9); assert.equal(a.grappling, b.id); assert.equal(b.grappledBy, a.id);
  assert.ok(b.reaction); assert.equal(events.some((e) => e.type === 'opportunity'), false); assertInvariants(state);
});
test('lutte : un obstacle ou la paroi du côté de la cible bloque les deux joueurs', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  const obstacle = state.players[1]; obstacle.position = { x: 6, y: 2 };
  a.grappling = b.id; b.grappledBy = a.id;
  moveAlong(state, a, [{ x: 5, y: 2 }], events);
  assert.deepEqual(a.position, { x: 5, y: 3 }); assert.equal(a.movement, a.speed);
  a.position = { x: 5, y: 6 }; b.position = { x: 5, y: 7 };
  moveAlong(state, a, [{ x: 5, y: 7 }], events);
  assert.deepEqual(a.position, { x: 5, y: 6 }); assert.deepEqual(b.position, { x: 5, y: 7 }); assertInvariants(state);
});
test('lutte : terrain difficile de la cible inclus dans le coût du trajet', () => {
  const { state, a, b, events } = fixture();
  a.position = { x: 2, y: 0 }; b.position = { x: 3, y: 0 }; a.grappling = b.id; b.grappledBy = a.id;
  a.movement = 3;
  assert.ok(!reachableCells(state, a).some((c) => c.position.x === 2 && c.position.y === 1));
  moveAlong(state, a, [{ x: 2, y: 1 }], events); assert.deepEqual(a.position, { x: 2, y: 0 });
  a.movement = 6; moveAlong(state, a, [{ x: 2, y: 1 }], events);
  assert.equal(a.movement, 0); assert.deepEqual(b.position, { x: 3, y: 1 }); assertInvariants(state);
});
test('lutte : la cible déplacée de force ne provoque aucune opportunité extérieure', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  const observer = state.players[1]; observer.position = { x: 7, y: 2 };
  a.grappling = b.id; b.grappledBy = a.id;
  moveAlong(state, a, [{ x: 4, y: 3 }], events);
  assert.equal(distance(observer.position, b.position), 2); assert.ok(observer.reaction);
  assert.equal(events.some((e) => e.type === 'opportunity'), false); assertInvariants(state);
});
test('lutte : le lutteur reste exposé aux opportunités des autres adversaires', () => {
  const { state, a, b, events } = fixture(['home-0', 'away-0', 'away-1']);
  const opponent = state.players[6]; opponent.position = { x: 6, y: 4 };
  a.grappling = b.id; b.grappledBy = a.id; a.armor = 100; forceD20(state, [10]);
  moveAlong(state, a, [{ x: 4, y: 3 }], events);
  assert.equal(events.filter((e) => e.type === 'opportunity').length, 1);
  assert.equal(events.find((e) => e.type === 'opportunity').playerId, opponent.id);
  assert.ok(b.reaction); assert.equal(opponent.reaction, false); assertInvariants(state);
});
test('lutte : projection des actions et de la balle sur la position entraînée', () => {
  const { state, a, b, events } = fixture(); a.grappling = b.id; b.grappledBy = a.id; giveBall(state, b, events);
  const view = movementView(state, a, { x: 2, y: 3 });
  assert.deepEqual(view.state.players.find((p) => p.id === b.id).position, { x: 3, y: 3 });
  assert.deepEqual(view.state.ball.position, { x: 3, y: 3 });
  assert.ok(legalAction(view.state, view.actor, { type: 'strip', targetId: b.id }));
  assert.deepEqual(b.position, { x: 6, y: 3 });
});
test('lutte : relâcher est volontaire et gratuit ; aucun mouvement automatique après prise', () => {
  const { state, a, b, events } = fixture(); a.grappling = b.id; b.grappledBy = a.id;
  assert.deepEqual(decideMovement(state, a), []);
  assert.ok(resolveAction(state, a, { type: 'release' }, events));
  assert.equal(a.grappling, null); assert.equal(b.grappledBy, null); assert.ok(a.action);
});
test('bot : une prise réussie est maintenue malgré du mouvement disponible', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  const holder = state.players[1]; holder.position = { x: 5, y: 4 }; giveBall(state, holder, events);
  a.role = 'blocker'; a.instruction = 'cautious'; a.skills.wrestling = 100;
  state.initiative = [a.id, b.id, holder.id]; state.turnIndex = 0;
  const result = stepMatch(state);
  const grappleIndex = result.events.findIndex((e) => e.type === 'grapple');
  assert.ok(grappleIndex >= 0); assert.ok(result.state.players[0].movement > 0);
  assert.equal(result.state.players[0].grappling, b.id);
  assert.equal(result.events.slice(grappleIndex + 1).some((e) => ['move', 'drag', 'release'].includes(e.type)), false);
  assert.ok(result.events.some((e) => e.type === 'hold-position'));
});
test('bot : garder une prise ne gaspille pas une action de mobilité sans déplacement', () => {
  const { state, a, b } = fixture(['home-0', 'away-0', 'away-1']);
  const holder = state.players[6]; holder.position = { x: 10, y: 6 };
  a.position = { x: 1, y: 1 }; b.position = { x: 2, y: 1 };
  a.grappling = b.id; b.grappledBy = a.id;
  a.role = 'retriever'; a.instruction = 'cautious'; a.movement = a.speed;
  state.ball = { carrierId: holder.id, position: { ...holder.position } };
  const choice = decideTurn(state, a);
  assert.equal(['dash', 'disengage'].includes(choice.action.type), false);
  const view = movementView(state, a, choice.path.at(-1) ?? a.position);
  assert.ok(legalAction(view.state, view.actor, choice.action));
});
test('pousser le lutteur libère sa cible sans opportunité ni perte automatique', () => {
  const { state, a, b, events } = fixture(['home-0', 'away-0', 'away-1']);
  const held = state.players[6]; held.position = { x: 6, y: 2 };
  a.grappling = held.id; held.grappledBy = a.id;
  b.skills.wrestling = 100; giveBall(state, a, events);
  resolveAction(state, b, { type: 'shove', mode: 'push', targetId: a.id }, events);
  assert.equal(a.grappling, null); assert.equal(held.grappledBy, null);
  assert.equal(state.ball.carrierId, a.id); assert.equal(events.some((e) => e.type === 'opportunity'), false);
  assertInvariants(state);
});
test('aide expirée au prochain tour de l’aidant ; esquive non cumulée', () => {
  const { state, a, events } = fixture(['home-0', 'home-1']);
  const ally = state.players[1]; ally.position = { x: 4, y: 3 };
  resolveAction(state, a, { type: 'help', targetId: ally.id }, events);
  assert.equal(state.aids.length, 1); beginTurn(state, a, events); assert.equal(state.aids.length, 0);
  const roll = check(state, 0, events, 'Annulation', { advantage: true, disadvantage: true });
  assert.ok(roll.total >= 1 && roll.total <= 20); assert.equal(events.at(-1).dice.length, 1);
});
test('dernier engagement : conserve les PV et permet une victoire au round 13', () => {
  const { state, a } = fixture(['home-0']);
  state.round = 12; state.phase = 'overtime'; state.initiative = [a.id];
  // No movement on the last overtime turn; the restart must preserve injuries and reposition.
  a.hp = 9; a.speed = 0; a.movement = 0; a.position = { x: 0, y: 0 };
  state.ball.position = { x: 11, y: 7 };
  const restart = stepMatch(state).state;
  assert.equal(restart.round, 13); assert.equal(restart.players[0].hp, 9);
  assert.equal(restart.ball.carrierId, null); assert.deepEqual(restart.players[0].position, { x: 1, y: 1 });
  giveBall(restart, restart.players[0], []);
  const result = finishFrom(restart).state;
  assert.equal(result.result.winnerId, 'home'); assert.equal(result.round, 13);
});
test('plaquer ne retire pas la balle et se relever coûte la moitié de la vitesse', () => {
  const { state, a, b, events } = fixture(); a.skills.wrestling = 100; giveBall(state, b, events);
  resolveAction(state, a, { type: 'shove', targetId: b.id }, events);
  assert.ok(b.prone); assert.equal(state.ball.carrierId, b.id);
  beginTurn(state, b, events); assert.equal(b.prone, false); assert.equal(b.movement, b.speed / 2);
});
test('opportunité : une réaction, interruption avant déplacement en cas de KO', () => {
  const { state, a, b, events } = fixture(); b.role = 'blocker'; a.hp = 1; b.attack.bonus = 100;
  forceD20(state, [10]); giveBall(state, a, events);
  moveAlong(state, a, [{ x: 4, y: 3 }, { x: 3, y: 3 }], events);
  assert.equal(a.hp, 0); assert.deepEqual(a.position, { x: 5, y: 3 }); assert.equal(b.reaction, false);
  assert.equal(events.filter((e) => e.type === 'opportunity').length, 1); assertInvariants(state);
  assert.deepEqual(events.find((e) => e.type === 'opportunity').trigger, {
    from: { x: 5, y: 3 }, to: { x: 4, y: 3 }, attackerPosition: { x: 6, y: 3 }, reach: 1,
  });
  assert.ok(events.some((e) => e.type === 'movement-stopped'));
});
test('opportunité : aucun déplacement entre cases adjacentes ne la provoque', () => {
  let checked = 0;
  for (const from of neighbors({ x: 6, y: 3 })) {
    for (const to of neighbors({ x: 6, y: 3 })) {
      if (distance(from, to) !== 1) continue;
      const { state, a, b, events } = fixture(); a.position = { ...from }; b.role = 'blocker';
      assert.equal(provokesOpportunity(b, a, from, to), false);
      moveAlong(state, a, [to], events);
      assert.deepEqual(a.position, to); assert.ok(b.reaction);
      assert.equal(events.some((e) => e.type === 'opportunity'), false); checked++;
    }
  }
  assert.ok(checked >= 20);
});
test('opportunité : entrer dans l’allonge ne dépense pas la réaction', () => {
  const { state, a, b, events } = fixture(); a.position = { x: 4, y: 3 };
  moveAlong(state, a, [{ x: 5, y: 3 }], events);
  assert.deepEqual(a.position, { x: 5, y: 3 }); assert.ok(b.reaction);
  assert.equal(events.some((e) => e.type === 'opportunity'), false);
});
test('opportunité : sortir puis revenir au contact conserve le vrai pas déclencheur', () => {
  const { state, a, b, events } = fixture(); a.armor = 100; b.role = 'blocker';
  moveAlong(state, a, [{ x: 4, y: 3 }, { x: 5, y: 3 }], events);
  assert.equal(distance(a.position, b.position), 1);
  const reactions = events.filter((e) => e.type === 'opportunity');
  assert.equal(reactions.length, 1); assert.equal(b.reaction, false);
  assert.deepEqual(reactions[0].trigger.from, { x: 5, y: 3 }); assert.deepEqual(reactions[0].trigger.to, { x: 4, y: 3 });
  assert.deepEqual(events.find((e) => e.type === 'move').path, [{ x: 4, y: 3 }, { x: 5, y: 3 }]);
});
test('opportunité : les pas accomplis sont journalisés avant la réaction', () => {
  const { state, a, b, events } = fixture(); a.position = { x: 5, y: 2 }; a.armor = 100; b.role = 'blocker';
  moveAlong(state, a, [{ x: 5, y: 3 }, { x: 4, y: 3 }], events);
  const reactionIndex = events.findIndex((e) => e.type === 'opportunity');
  const movements = events.filter((e) => e.type === 'move');
  assert.equal(events[0].type, 'move'); assert.ok(reactionIndex > 0); assert.equal(movements.length, 2);
  assert.deepEqual(movements[0].position, { x: 5, y: 3 });
  assert.deepEqual(movements[1].from, { x: 5, y: 3 });
});
test('opportunité : un appel direct sans sortie réelle est refusé sans effet', () => {
  const { state, a, b, events } = fixture(); const before = structuredClone(state);
  assert.equal(performAttack(state, b, a, events, { from: { ...a.position }, to: { x: 5, y: 2 } }), false);
  assert.equal(performAttack(state, b, a, events, true), false);
  assert.deepEqual(state, before); assert.equal(events.length, 0);
});
test('régression signalée : dernier tour, pressing et cinq bloqueurs agressifs', () => {
  let maintained = 0;
  const { state } = simulateMatch({ seed: 'arche-01', strategy: 'pressing',
    players: Array.from({ length: 5 }, () => ({ role: 'blocker', instruction: 'aggressive' })) }, (s, events) => {
    const index = events.findIndex((e) => e.type === 'grapple');
    if (index >= 0) {
      maintained++;
      assert.ok(events.some((e) => e.type === 'hold-position'));
      assert.equal(events.slice(index + 1).some((e) => e.type === 'move' || e.type === 'drag'), false);
    }
    assertInvariants(s);
  });
  assert.ok(state.finished && state.round <= 13); assert.ok(maintained > 0);
});
test('désengagement et déplacement forcé ne provoquent pas d’opportunité', () => {
  const { state, a, b, events } = fixture(); resolveAction(state, a, { type: 'disengage' }, events);
  moveAlong(state, a, [{ x: 4, y: 3 }], events); assert.ok(b.reaction);
  a.position = { x: 5, y: 3 }; a.action = true; a.skills.wrestling = 100;
  resolveAction(state, a, { type: 'shove', mode: 'push', targetId: b.id }, events);
  assert.ok(b.reaction); assert.equal(events.filter((e) => e.type === 'opportunity').length, 0);
});
test('une nouvelle action ne recharge pas la réaction ; début de round oui', () => {
  const { state, a, events } = fixture(['home-0']); a.reaction = false;
  beginTurn(state, a, events); assert.equal(a.reaction, false);
  state.initiative = [a.id]; state.turnIndex = 0;
  const next = stepMatch(state).state;
  assert.equal(next.round, 2); assert.ok(next.players[0].reaction);
});
test('action illégale : aucun effet ni consommation de hasard', () => {
  const { state, a, events } = fixture(); const before = structuredClone(state);
  assert.equal(resolveAction(state, a, { type: 'attack', targetId: a.id }, events), false);
  assert.deepEqual(state, before); assert.equal(events.length, 0);
});
test('victoire à la fin du round 10, jamais aux KO seuls', () => {
  const { state, a, events } = fixture(['home-0']); giveBall(state, a, events);
  state.round = 10; state.initiative = [a.id];
  const result = finishFrom(state).state;
  assert.equal(result.result.winnerId, 'home'); assert.equal(result.round, 10);
});
test('prolongation : possession contrôlée en fin de round 11', () => {
  const { state, a, events } = fixture(['home-0']); giveBall(state, a, events);
  state.round = 11; state.phase = 'overtime'; state.initiative = [a.id];
  const result = finishFrom(state).state;
  assert.equal(result.round, 11); assert.equal(result.result.winnerId, 'home');
});
test('tous KO : prolongations, dernier engagement et nul borné au round 13', () => {
  const { state } = fixture([]); const result = finishFrom(state);
  assert.equal(result.state.round, 13); assert.equal(result.state.result.winnerId, null);
  assert.ok(result.events.some((e) => e.type === 'overtime')); assert.ok(result.events.some((e) => e.type === 'restart'));
});
test('pas à pas sans mutation et simulation complète : mêmes événements et résultat', () => {
  const config = { seed: 'replay-17', strategy: 'pressing' };
  const input = createMatch(config), before = structuredClone(input);
  stepMatch(input); assert.deepEqual(input, before);
  const stepped = finishFrom(input), full = simulateMatch(config);
  assert.deepEqual(stepped, full);
  assert.deepEqual(full, simulateMatch(config));
});
test('coordination : un récupérateur prioritaire et rôles réaffectables', () => {
  const state = createMatch({ players: Array.from({ length: 5 }, () => ({ role: 'retriever' })) });
  const plans = state.players.slice(0, 5).map((p) => teamPlan(state, p));
  assert.equal(new Set(plans.map((p) => p.primary)).size, 1);
  assert.ok(state.players.slice(0, 5).every((p) => p.role === 'retriever'));
});
test('bot : refuse la passe vers un relais sans réaction', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  giveBall(state, a, events); state.players[1].position = { x: 1, y: 1 }; state.players[1].reaction = false;
  const decision = decideTurn(state, a);
  assert.notEqual(decision.action.type, 'pass');
});
test('réévaluation sur place : action légale après perte de possession en mouvement', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  const relay = state.players[1]; relay.position = { x: 0, y: 0 };
  a.position = { x: 8, y: 3 }; b.position = { x: 9, y: 3 };
  a.role = 'carrier'; a.skills.acrobatics = 100; a.abilities.constitution = -200;
  a.armor = 1; b.attack.bonus = 100;
  state.initiative = [a.id, b.id, relay.id]; state.turnIndex = 0;
  giveBall(state, a, events); forceD20(state, [10]);
  const planned = decideTurn(state, a);
  assert.equal(planned.action.type, 'pass'); assert.ok(planned.path.length > 0);
  const match = stepMatch(state); assertInvariants(match.state);
  assert.ok(match.events.some((e) => e.type === 'opportunity'));
  assert.ok(match.events.some((e) => e.type === 'drop'));
  assert.ok(match.events.some((e) => e.type === 'replan'));
  assert.equal(match.events.some((e) => e.type === 'pass'), false);
});
test('consignes : décisions différentes dans une même mêlée défensive', () => {
  const { state, a, b, events } = fixture(['home-0', 'home-1', 'away-0']);
  const holder = state.players[1]; holder.position = { x: 5, y: 4 }; giveBall(state, holder, events);
  a.movement = 0; a.role = 'blocker'; b.hp = 4; a.instruction = 'cautious'; state.teams[0].strategy = 'possession';
  const cautious = decideTurn(state, a);
  a.instruction = 'aggressive'; state.teams[0].strategy = 'pressing';
  const aggressive = decideTurn(state, a);
  assert.notEqual(cautious.action.type, aggressive.action.type);
});
test('500 matchs : actions légales, invariants et terminaison ; rapport de biais', { timeout: 240000 }, () => {
  const report = { home: 0, away: 0, draws: 0, overtime: 0, actions: {}, strategies: {} };
  const strategies = ['balanced', 'possession', 'pressing'];
  for (let n = 0; n < 500; n++) {
    const strategy = strategies[n % strategies.length];
    const config = { seed: `batch-${Math.floor(n / 3)}`, strategy,
      players: Array.from({ length: 5 }, () => ({ instruction: n % 2 ? 'cautious' : 'aggressive' })) };
    const { state, events } = simulateMatch(config, (s, turnEvents) => {
      assertInvariants(s);
      for (const event of turnEvents.filter((e) => e.type === 'opportunity')) {
        assert.equal(distance(event.trigger.attackerPosition, event.trigger.from), 1);
        assert.ok(distance(event.trigger.attackerPosition, event.trigger.to) > event.trigger.reach);
        assert.equal(distance(event.trigger.from, event.trigger.to), 1);
      }
    });
    assert.ok(state.round <= 13 && state.turns <= 130);
    report[state.result.winnerId ?? 'draws']++;
    report.overtime += Number(state.round > 10);
    report.strategies[strategy] ??= { matches: 0, wins: 0 };
    report.strategies[strategy].matches++; report.strategies[strategy].wins += Number(state.result.winnerId === 'home');
    for (const e of events.filter((e) => e.type === 'decision')) report.actions[e.action] = (report.actions[e.action] ?? 0) + 1;
  }
  assert.ok(report.home > 0 && report.away > 0);
  console.log('Rumbleball — 500 matchs :', JSON.stringify(report));
});
