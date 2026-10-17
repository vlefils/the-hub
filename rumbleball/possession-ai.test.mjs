import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from './engine.mjs';
import { decideMovement, decideTurn, stripSuccessChance, teamPlan } from './ai.mjs';
import { assertInvariants, beginTurn, cancelReadiedPass, dealDamage, dropBall, giveBall, legalAction, readiedPasser, resolveAction } from './rules.mjs';

function supportFixture() {
  const state = createMatch({ seed: 'support-gate', strategy: 'possession', openings: { home: 'none', away: 'none' } });
  const holder = state.players[0], protector = state.players[1], receiver = state.players[4];
  state.players.forEach((p, i) => { p.hp = [0, 1, 4, 5, 6, 7, 8].includes(i) ? p.maxHp : 0; p.reaction = p.teamId === 'home' && p.hp > 0; });
  holder.position = { x: 1, y: 3 }; protector.position = { x: 2, y: 3 }; receiver.position = { x: 5, y: 3 };
  [[4, 2], [5, 2], [6, 2], [6, 3]].forEach(([x, y], i) => { state.players[i + 5].position = { x, y }; });
  state.round = 7; state.activeId = holder.id; giveBall(state, holder, []); assertInvariants(state);
  return { state, holder, receiver };
}

test('soutien : aucun déplacement de démarquage sans passe préparée, même vers une case plus sûre', () => {
  const { state, holder, receiver } = supportFixture(), before = structuredClone(state);
  const decision = decideTurn(state, receiver);
  assert.equal(decision.task, 'standby'); assert.deepEqual(decision.path, []); assert.deepEqual(decideMovement(state, receiver), []);
  assert.equal(readiedPasser(state), null); assert.deepEqual(state, before);
  resolveAction(state, holder, { type: 'ready-pass' });
  assert.equal(teamPlan(state, receiver).supports.has(receiver.id), true); assert.equal(decideTurn(state, receiver).task, 'relay'); assertInvariants(state);
});

test('soutien : annulation, prochain tour, perte de balle et KO mettent fin au démarquage', () => {
  for (const cancel of [
    (s, h) => cancelReadiedPass(s, h, [], 'annulation'), (s, h) => beginTurn(s, h, []),
    (s, h) => dropBall(s, h, []), (s, h) => giveBall(s, s.players[1], []),
    (s, h) => giveBall(s, s.players[5], []), (s, h) => dealDamage(s, s.players[5], h, 999, []),
  ]) {
    const { state, holder, receiver } = supportFixture(); resolveAction(state, holder, { type: 'ready-pass' });
    assert.equal(decideTurn(state, receiver).task, 'relay'); cancel(state, holder);
    assert.equal(readiedPasser(state), null); assert.notEqual(decideTurn(state, receiver).task, 'relay');
    assert.equal(teamPlan(state, receiver).supports?.size ?? 0, 0); assertInvariants(state);
  }
});

test('soutien : une réaction déjà dépensée ne peut pas déclencher un nouveau démarquage', () => {
  const { state, holder, receiver } = supportFixture(); resolveAction(state, holder, { type: 'ready-pass' }); holder.reaction = false;
  // Defensive check for a stale flag: the AI must require an executable pass.
  assert.equal(readiedPasser(state), null); assert.equal(teamPlan(state, receiver).supports.size, 0);
  assert.equal(decideTurn(state, receiver).task, 'standby'); assert.deepEqual(decideMovement(state, receiver), []);
});

test('ouverture : priorité au combat, sans faux démarquage vers une ancienne ancre', () => {
  const state = createMatch({ openings: { home: 'fallback', away: 'none' } }), receiver = state.players[4];
  receiver.position = { x: 0, y: 0 }; const before = structuredClone(state), decision = decideTurn(state, receiver);
  assert.equal(decision.task, 'fight'); assert.notEqual(decision.action.type, 'pickup'); assert.deepEqual(state, before);
});

test('arrachement : probabilité exacte, égalités au défenseur et aides des deux côtés sans jet consommé', () => {
  const state = createMatch(), actor = state.players[1], holder = state.players[5];
  actor.skills.wrestling = 0; holder.skills.wrestling = holder.skills.acrobatics = 0;
  const before = structuredClone(state); assert.ok(Math.abs(stripSuccessChance(state, actor, holder) - .475) < 1e-10); assert.deepEqual(state, before);
  state.aids.push({ helperId: state.players[0].id, allyId: actor.id, kind: 'check' });
  const attackAided = stripSuccessChance(state, actor, holder); assert.ok(attackAided > .475);
  state.aids.push({ helperId: state.players[6].id, allyId: holder.id, kind: 'check' });
  let wins = 0;
  for (let a = 1; a <= 20; a++) for (let b = 1; b <= 20; b++) for (let c = 1; c <= 20; c++) for (let d = 1; d <= 20; d++) if (Math.max(a, b) > Math.max(c, d)) wins++;
  const helped = structuredClone(state); assert.ok(Math.abs(stripSuccessChance(state, actor, holder) - wins / 160000) < 1e-10); assert.deepEqual(state, helped);
});

function contestFixture() {
  const state = createMatch({ seed: 'contest-roles', openings: { home: 'none', away: 'none' } }), actor = state.players[0], blocker = state.players[1], holder = state.players[5];
  state.players.forEach((p) => { p.hp = [actor, blocker, holder].includes(p) ? p.maxHp : 0; p.reaction = p.hp > 0; });
  actor.role = 'retriever'; actor.position = { x: 5, y: 3 }; blocker.role = 'blocker'; blocker.instruction = 'aggressive'; blocker.position = { x: 5, y: 4 }; holder.position = { x: 6, y: 3 };
  actor.movement = blocker.movement = 0; state.round = 7; state.activeId = actor.id; giveBall(state, holder, []);
  return { state, actor, blocker, holder };
}

test('arrachement : le récupérateur bien placé conteste, le bloqueur soutient plutôt que voler en boucle', () => {
  const { state, actor, blocker, holder } = contestFixture(); actor.skills.wrestling = 8; holder.skills.wrestling = holder.skills.acrobatics = 2;
  const before = structuredClone(state); assert.equal(teamPlan(state, actor).primary, actor.id);
  assert.equal(decideTurn(state, actor).action.type, 'strip');
  assert.ok(legalAction(state, blocker, { type: 'strip', targetId: holder.id })); assert.notEqual(decideTurn(state, blocker).action.type, 'strip'); assert.deepEqual(state, before);
});

test('arrachement : un récupérateur sans chance de gagner choisit une autre action de contact', () => {
  const { state, actor, holder } = contestFixture(); actor.skills.wrestling = -10; holder.skills.wrestling = holder.skills.acrobatics = 20;
  const before = structuredClone(state); assert.equal(stripSuccessChance(state, actor, holder), 0);
  assert.equal(decideTurn(state, actor).action.type, 'attack'); assert.deepEqual(state, before);
});
