import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from './engine.mjs';
import { decideTurn, teamPlan } from './ai.mjs';
import { assertInvariants, beginTurn, dealDamage, dropBall, giveBall, legalAction, moveAlong, resolveAction, resolveReadiedPass } from './rules.mjs';
import { createCareer, confirmDraft, launchCareerMatch } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';
import { narrateTurn } from './narration.mjs';
import { buildCourtPlayback, buildRoundPlayback, sampleCourtPlayback, sampleRoundPlayback } from './playback.mjs';
import { environment } from './test-support/dom.mjs';

function fixture(version = 5) {
  const state = createMatch({ seed: 'ready-passes', rulesVersion: version, strategy: 'possession', openings: { home: 'none', away: 'none' } });
  const [a, b, c, enemy] = [state.players[0], state.players[2], state.players[4], state.players[5]];
  state.players.forEach((p) => { if (![a, b, c, enemy].includes(p)) { p.hp = 0; p.reaction = false; } });
  a.position = { x: 2, y: 3 }; b.position = { x: 5, y: 3 }; c.position = { x: 5, y: 6 }; enemy.position = { x: 11, y: 0 };
  a.skills.acrobatics = b.skills.acrobatics = 100;
  state.round = 7; state.activeId = a.id; giveBall(state, a, []);
  return { state, a, b, c, enemy, events: [] };
}
const ready = (state, actor, events = []) => resolveAction(state, actor, { type: 'ready-pass' }, events);

test('préparer : action dépensée, mouvement et réaction conservés, aucun jet ni esquive gratuite', () => {
  const { state, a, events } = fixture(), rng = state.rng, movement = a.movement;
  assert.equal(ready(state, a, events), true); assert.equal(a.action, false); assert.equal(a.reaction, true);
  assert.equal(a.movement, movement); assert.equal(a.interaction, true); assert.equal(a.dodging, false); assert.equal(state.rng, rng);
  assert.deepEqual(a.readiedPass, { round: 7, turn: 0 }); assertInvariants(state);
  const before = structuredClone(state); assert.equal(ready(state, a), false); assert.deepEqual(state, before);
});

test('préparer : refus sans balle, sans action, sans réaction ou dans les anciennes règles', () => {
  for (const change of [(s, a) => { a.reaction = false; }, (s, a) => { a.action = false; }, (s, a, b) => giveBall(s, b, []), (s) => { s.version = 4; }]) {
    const { state, a, b } = fixture(); change(state, a, b); const before = structuredClone(state);
    assert.equal(ready(state, a), false); assert.deepEqual(state, before);
  }
});

test('une passe ne peut pas contourner le coût de réaction avec un indicateur invalide', () => {
  const { state, a, b } = fixture(); state.activeId = b.id;
  for (const reaction of [true, 'true', 1]) {
    const before = structuredClone(state);
    assert.equal(resolveAction(state, a, { type: 'pass', targetId: b.id, reaction }), false); assert.deepEqual(state, before);
  }
  state.activeId = a.id; ready(state, a); state.activeId = b.id; a.action = true;
  const stale = structuredClone(state);
  assert.equal(legalAction(state, a, { type: 'pass', targetId: b.id, reaction: true }), false);
  assert.equal(resolveReadiedPass(state, b), false); assert.deepEqual(state, stale);
});

test('déclenchement : pas de passe avant un tour allié, ni vers un joueur marqué, à terre ou hors portée', () => {
  const { state, a, b, enemy, events } = fixture(); ready(state, a, events); const rng = state.rng;
  assert.equal(resolveReadiedPass(state, b, events), false);
  state.activeId = b.id; enemy.position = { x: 5, y: 2 }; assert.equal(resolveReadiedPass(state, b, events), false);
  enemy.position = { x: 3, y: 3 }; assert.equal(resolveReadiedPass(state, b, events), false, 'Un couloir interceptable n’est pas un démarquage sûr.');
  enemy.position = { x: 11, y: 0 }; b.prone = true; assert.equal(resolveReadiedPass(state, b, events), false);
  b.prone = false; b.position = { x: 10, y: 7 }; assert.equal(resolveReadiedPass(state, b, events), false);
  assert.equal(state.rng, rng); assert.equal(a.reaction, true); assert.ok(a.readiedPass);
});

test('passe en réaction : réception libre, aucune action du receveur dépensée, une seule réaction du passeur', () => {
  const { state, a, b, events } = fixture(); ready(state, a, events); state.activeId = b.id; b.reaction = false;
  assert.equal(resolveReadiedPass(state, b, events), true); assert.equal(state.ball.carrierId, b.id);
  assert.equal(a.reaction, false); assert.equal(a.readiedPass, null); assert.equal(b.reaction, false);
  assert.equal(b.action, true); assert.equal(b.interaction, true); assert.equal(state.stats.home.passesCompleted, 1);
  const before = structuredClone(state); assert.equal(resolveReadiedPass(state, b, events), false); assert.deepEqual(state, before);
  assert.equal(events.find((e) => e.type === 'ready-trigger').resolvedAction.playerId, a.id); assertInvariants(state);
});

test('enchaînement : le receveur prépare puis passe à un troisième allié dans le même round', () => {
  const { state, a, b, c, events } = fixture(); ready(state, a, events); state.activeId = b.id;
  assert.equal(resolveReadiedPass(state, b, events), true); assert.equal(ready(state, b, events), true);
  state.activeId = c.id; assert.equal(resolveReadiedPass(state, c, events), true);
  assert.equal(state.ball.carrierId, c.id); assert.equal(state.stats.home.passesCompleted, 2);
  assert.equal(a.reaction, false); assert.equal(b.reaction, false); assert.equal(c.reaction, true); assert.equal(c.action, true);
  assert.equal(ready(state, c, events), true); assertInvariants(state);
});

test('réception libre : ne recharge aucune action, interaction ou réaction déjà dépensée', () => {
  const { state, a, b } = fixture(); ready(state, a); state.activeId = b.id; b.action = b.interaction = b.reaction = false;
  assert.equal(resolveReadiedPass(state, b), true); assert.equal(b.action, false); assert.equal(b.interaction, false); assert.equal(b.reaction, false);
  assert.equal(ready(state, b), false); assertInvariants(state);
});

test('passe ratée : réaction consommée et préparation terminée, sans nouvelle tentative automatique', () => {
  const { state, a, b, events } = fixture(); a.skills.acrobatics = -100; ready(state, a, events); state.activeId = b.id;
  assert.equal(resolveReadiedPass(state, b, events), true); assert.equal(state.ball.carrierId, null);
  assert.equal(a.reaction, false); assert.equal(a.readiedPass, null); assert.equal(state.stats.home.passesAttempted, 1);
  assert.equal(resolveReadiedPass(state, b, events), false); assertInvariants(state);
});

test('expiration et annulation : prochain tour, perte de balle, arrachement et KO', () => {
  for (const cancel of [(s, a, b, e) => beginTurn(s, a, e), (s, a, b, e) => dropBall(s, a, e),
    (s, a, b, e) => giveBall(s, b, e), (s, a, b, e) => dealDamage(s, b, a, 999, e)]) {
    const { state, a, enemy, events } = fixture(); ready(state, a, events); cancel(state, a, enemy, events);
    assert.equal(a.readiedPass, null); assert.ok(events.some((e) => e.type === 'ready-cancel')); assertInvariants(state);
  }
});

test('démarquage : le déplacement est publié avant la passe, puis la course s’interrompt à la réception', () => {
  const { state, a, b, events } = fixture(); b.position = { x: 5, y: 2 }; ready(state, a, events); state.activeId = b.id;
  moveAlong(state, b, [{ x: 5, y: 3 }, { x: 5, y: 4 }], events);
  assert.deepEqual(b.position, { x: 5, y: 3 }); assert.equal(state.ball.carrierId, b.id);
  assert.ok(events.findIndex((e) => e.type === 'move') < events.findIndex((e) => e.type === 'ready-trigger')); assertInvariants(state);
});

test('IA : pas de démarquage coordonné avant la préparation, puis des relais pendant son attente', () => {
  const { state, a, c } = fixture(); const before = structuredClone(state);
  assert.equal(teamPlan(state, c).supports.size, 0); assert.notEqual(decideTurn(state, c).task, 'relay'); assert.deepEqual(state, before);
  ready(state, a); assert.ok(teamPlan(state, c).supports.has(c.id)); assert.equal(decideTurn(state, c).task, 'relay');
  assert.equal(decideTurn(state, a).action.type, 'wait', 'Une préparation n’ajoute pas de deuxième action.');
});

test('IA : la préparation appartient aux choix du porteur sans modifier le hasard', () => {
  const { state, a, b, c, enemy } = fixture(); a.movement = 0; a.role = 'carrier';
  c.position = { x: 5, y: 5 }; enemy.position = { x: 5, y: 4 };
  state.initiative = [a.id, b.id, c.id, enemy.id]; state.turnIndex = 0;
  const before = structuredClone(state);
  assert.equal(decideTurn(state, a).action.type, 'ready-pass'); assert.deepEqual(state, before);
});

test('moteur : réception pendant une course et réévaluation de l’action encore disponible', () => {
  const { state, a, b, c, enemy } = fixture(); enemy.position = { x: 4, y: 4 }; c.skills.acrobatics = 100;
  ready(state, a); state.initiative = [c.id, b.id, a.id, ...state.initiative.filter((id) => ![a.id, b.id, c.id].includes(id))]; state.turnIndex = 0;
  const before = structuredClone(state), next = stepMatch(state);
  assert.deepEqual(state, before); assert.ok(next.events.some((e) => e.type === 'ready-trigger' && e.playerId === a.id && e.targetId === c.id));
  assert.ok(next.events.some((e) => e.type === 'replan')); assert.equal(next.state.lastDecision.playerId, c.id);
  assert.equal(next.state.lastDecision.action, 'pass'); assertInvariants(next.state);
});

test('moteur : une passe ratée pendant le démarquage abandonne immédiatement l’ancien plan de relais', () => {
  const { state, a, c, enemy } = fixture(); a.skills.acrobatics = -100;
  c.position = { x: 5, y: 2 }; enemy.position = { x: 6, y: 2 }; enemy.reaction = false;
  ready(state, a); state.initiative = [c.id, ...state.initiative.filter((id) => id !== c.id)]; state.turnIndex = 0;
  const next = stepMatch(state), trigger = next.events.findIndex((e) => e.type === 'ready-trigger');
  assert.ok(trigger > next.events.findIndex((e) => e.type === 'move'));
  assert.ok(next.events.slice(trigger + 1).some((e) => e.type === 'replan'));
  assert.doesNotMatch(next.state.lastDecision.reason, /Se démarque/); assertInvariants(next.state);
});

test('sauvegarde : attente persistante, reprise déterministe, ancienne v4 conservée et état corrompu refusé', () => {
  let career = createCareer('Les Relais', 'ready-storage'); career = confirmDraft(career, career.market.slice(0, 5).map((p) => p.id)); career = launchCareerMatch(career);
  const state = career.current.state, actor = state.players[0]; giveBall(state, actor, []); ready(state, actor);
  const restored = importCareer(exportCareer(career)); assert.deepEqual(restored.current.state, state);
  assert.deepEqual(stepMatch(restored.current.state), stepMatch(state));
  const corrupt = structuredClone(career); corrupt.current.state.players[0].readiedPass.turn = 1000; assert.throws(() => exportCareer(corrupt));
  const old = fixture(4); assert.equal(legalAction(old.state, old.a, { type: 'ready-pass' }), false);
  old.a.action = true; assert.equal(resolveAction(old.state, old.a, { type: 'pass', targetId: old.b.id }), true); assert.equal(old.b.reaction, false);
  const legacy = structuredClone(career); legacy.current.config.rulesVersion = 4; legacy.current.state = createMatch(legacy.current.config);
  const loaded = importCareer(exportCareer(legacy)); assert.equal(loaded.current.state.version, 4); assert.deepEqual(stepMatch(loaded.current.state), stepMatch(legacy.current.state));
});

test('récit et animations : préparation visible, bon passeur hors tour et arrivée chez le receveur', () => {
  const { state, a, b, events } = fixture(), before = structuredClone(state); ready(state, a, events); state.activeId = b.id;
  assert.equal(resolveReadiedPass(state, b, events), true);
  const story = narrateTurn(events, state.players).text; assert.match(story, /Nora a préparé une passe/); assert.match(story, /Nora a passé la balle à Zip.*en réaction/);
  const plan = buildCourtPlayback(before, state, events); assert.ok(plan.effects.some((e) => e.label === 'Passe prête'));
  assert.equal(sampleCourtPlayback(plan, plan.duration).ball.carrierId, b.id);
  const round = buildRoundPlayback([{ before, after: state, events }]); assert.equal(sampleRoundPlayback(round, 12000).ball.carrierId, b.id);
});

test('interface : la préparation persistante marque le pion et la fiche, puis disparaît à l’annulation', async () => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'), view = mountMatch(e.root), { state, a } = fixture();
  ready(state, a); view.load({ config: {}, state, turns: [] });
  const pawn = e.root.querySelectorAll('.rb-pawn').find((p) => p.getAttribute('data-player') === a.id);
  assert.ok(pawn.classList.contains('is-ready')); assert.match(pawn.getAttribute('aria-label'), /passe préparée/);
  assert.ok(e.root.querySelectorAll('.rb-conditions').some((p) => p.textContent.includes('Passe prête')));
  beginTurn(state, a, []); view.load({ config: {}, state, turns: [] }); assert.equal(pawn.classList.contains('is-ready'), false); view.pause();
});
