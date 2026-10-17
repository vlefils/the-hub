import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch, simulateMatch } from './engine.mjs';
import { decideTurn, decideMovement, teamPlan } from './ai.mjs';
import { OPENING_IDS, OPENINGS, openingDeployment, openingPlan } from './openings.mjs';
import { CENTER, validDeployment, moveDeployment } from './deployment.mjs';
import { assertInvariants, beginTurn, distance, giveBall, legalAction, randomInt, resolveAction, resolveCenterEngagement, shouldTakeOpportunity } from './rules.mjs';
import { createCareer, confirmDraft, configureTeam, launchCareerMatch, saveCareerTurn } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';
import { mountCareer } from './career-ui.mjs';
import { mountMatch } from './ui.mjs';
import { environment, classNode, descendants, button } from './test-support/dom.mjs';

function dice(state, wanted) {
  for (let n = 0; n < 2000000; n++) { const probe = { rng: n }; if (wanted.every((d) => randomInt(probe, 20) + 1 === d)) { state.rng = n; return; } }
  throw new Error('Jets de test introuvables.');
}
function center(ids = ['home-1', 'home-2', 'away-1', 'away-2']) {
  const state = createMatch({ classes: false, openings: { home: 'none', away: 'none' } });
  const positions = { 'home-1': { x: 5, y: 3 }, 'home-2': { x: 5, y: 4 }, 'away-1': { x: 6, y: 3 }, 'away-2': { x: 6, y: 4 } };
  state.players.forEach((p) => { p.hp = ids.includes(p.id) ? p.maxHp : 0; p.skills = { wrestling: 0, acrobatics: 0 }; if (positions[p.id]) p.position = positions[p.id]; });
  return state;
}
function clearOpponents(state) { state.players.slice(5).forEach((p, i) => { p.position = { x: 10 + i % 2, y: i }; }); }
function club() { const c = createCareer('Les Ouvreurs'); return confirmDraft(c, c.market.slice(0, 5).map((p) => p.id)); }

test('engagement v4 : les quatre contacts réagissent en initiative, meilleur jet opposé, actions et mouvements conservés', () => {
  const state = center(), ids = ['away-2', 'home-1', 'away-1', 'home-2'];
  state.initiative = [...ids, ...state.initiative.filter((id) => !ids.includes(id))]; dice(state, [10, 12, 12, 5]);
  const events = []; assert.equal(resolveCenterEngagement(state, events), true);
  assert.deepEqual(events.filter((e) => e.type === 'center-reaction').map((e) => e.playerId), ids);
  assert.equal(state.ball.carrierId, 'home-1', 'À égalité de jet, la première initiative conserve la balle.');
  for (const p of state.players.filter((p) => ids.includes(p.id))) { assert.equal(p.reaction, false); assert.equal(p.action, true); assert.equal(p.movement, p.speed); }
  const rng = state.rng; assert.equal(resolveCenterEngagement(state, events), false); assert.equal(state.rng, rng); assertInvariants(state);
  const opposed = center(['home-1', 'away-1']); opposed.initiative = ['home-1', 'away-1']; dice(opposed, [2, 1]);
  resolveCenterEngagement(opposed); assert.equal(opposed.ball.carrierId, 'home-1', 'Aucun DD 10 ajouté au test opposé.');
});

test('réaction seule : DD 10, échec sans action dépensée, réaction non renouvelée au début du tour', () => {
  const state = center(['home-1']), actor = state.players[1]; dice(state, [9]);
  assert.equal(resolveAction(state, actor, { type: 'pickup' }), true); assert.deepEqual(state.ball.position, CENTER);
  assert.equal(actor.action, true); assert.equal(actor.interaction, true); assert.equal(actor.reaction, false);
  beginTurn(state, actor, []); assert.equal(legalAction(state, actor, { type: 'pickup' }), false);
  const rng = state.rng; assert.equal(resolveAction(state, actor, { type: 'pickup' }), false); assert.equal(state.rng, rng);
  actor.reaction = true; dice(state, [10]); assert.equal(resolveAction(state, actor, { type: 'pickup' }), true);
  assert.equal(state.ball.carrierId, actor.id); assert.equal(actor.action, true);
});

test('engagement : KO, hors des quatre cases et réactions dépensées sont exclus ; arrêt après une prise seule réussie', () => {
  const state = center(), [a, b, c] = [state.players[1], state.players[2], state.players[6]];
  b.position = { x: 4, y: 4 }; c.reaction = false; state.players[7].hp = 0; dice(state, [20]);
  const events = []; resolveCenterEngagement(state, events);
  assert.deepEqual(events.filter((e) => e.type === 'center-reaction').map((e) => e.playerId), [a.id]);
  assert.equal(b.reaction, true); assert.equal(c.action, true);
  const sameTeam = center(['home-1', 'home-2']); sameTeam.initiative = ['home-2', 'home-1']; dice(sameTeam, [20]);
  resolveCenterEngagement(sameTeam); assert.equal(sameTeam.players[1].reaction, true);
});

test('premier tour : engagement avant déplacement, passe immédiate au relais arrière avec la même action normale', () => {
  const state = createMatch({ openings: { home: 'fallback', away: 'none' } }); clearOpponents(state);
  const actor = state.players[2]; state.initiative = [actor.id, ...state.initiative.filter((id) => id !== actor.id)]; dice(state, [20, 20]);
  const before = structuredClone(state), turn = stepMatch(state);
  assert.deepEqual(state, before); assert.equal(turn.state.round, 1); assert.equal(turn.state.turns, 1);
  assert.equal(turn.state.ball.carrierId, 'home-4'); assert.equal(turn.state.players[2].reaction, false);
  assert.equal(turn.state.players[2].action, false); assert.equal(turn.state.players[4].reaction, true);
  assert.ok(turn.events.findIndex((e) => e.type === 'engagement') < turn.events.findIndex((e) => e.type === 'decision'));
  assert.equal(turn.events.find((e) => e.type === 'pass').targetId, 'home-4');
  assert.equal(turn.events.filter((e) => e.type === 'pass').length, 1); assertInvariants(turn.state);
});

test('relai arrière : reste en retrait, réserve sa réaction, libère le plan quand il reçoit ou que l’adversaire gagne', () => {
  const state = createMatch({ openings: { home: 'fallback', away: 'none' } }); clearOpponents(state);
  const rear = state.players[4]; rear.instruction = 'aggressive'; const before = structuredClone(state);
  const decision = decideTurn(state, rear); assert.deepEqual(decision.path, []); assert.notEqual(decision.action.type, 'pickup'); assert.deepEqual(state, before);
  giveBall(state, state.players[2], []); assert.equal(shouldTakeOpportunity(state, rear, state.players[5]), false);
  giveBall(state, rear, []); assert.equal(openingPlan(state, rear), null);
  giveBall(state, state.players[5], []); assert.equal(openingPlan(state, rear), null); assert.equal(shouldTakeOpportunity(state, rear, state.players[5]), true);
});

test('fuite et cage : le porteur fuit derrière les écrans ou garde ses partenaires proches', () => {
  const ends = {};
  for (const opening of ['breakaway', 'cage']) {
    const state = createMatch({ openings: { home: opening, away: 'none' } }); clearOpponents(state);
    const holder = state.players[2]; giveBall(state, holder, []); holder.action = false;
    const path = decideMovement(state, holder); ends[opening] = path.at(-1) ?? holder.position;
    if (opening === 'cage') assert.ok(Math.min(...state.players.filter((p) => p.teamId === 'home' && p.id !== holder.id).map((p) => distance(p.position, ends[opening]))) <= 1);
  }
  assert.ok(ends.breakaway.x < ends.cage.x); assert.ok(ends.breakaway.x <= 2);
});

test('écrans : menaces réparties et choix de blocage, sans modifier les jets ni l’état', () => {
  const state = createMatch(), holder = state.players[2], blocker = state.players[1]; giveBall(state, holder, []);
  const before = structuredClone(state), plan = teamPlan(state, blocker), decision = decideTurn(state, blocker);
  assert.equal(new Set(plan.marks.values()).size, plan.marks.size); assert.equal(decision.action.type, 'grapple'); assert.deepEqual(state, before);
  state.round = 3; assert.equal(openingPlan(state, holder), null);
});

test('cinq placements : valides, symétriques, indépendants et compatibles avec les ajustements manuels', () => {
  const signatures = new Set();
  for (const id of OPENING_IDS) {
    const home = openingDeployment(id), away = openingDeployment(id, 'away'); assert.ok(validDeployment(home)); assert.ok(validDeployment(away, 'away'));
    assert.ok(home.every((p, i) => p.x + away[i].x === 11 && p.y + away[i].y === 7)); signatures.add(JSON.stringify(home));
    home[0].x = 0; assert.notDeepEqual(home, openingDeployment(id));
  }
  assert.equal(signatures.size, 5);
  const custom = moveDeployment(openingDeployment('fallback'), 0, { x: 0, y: 7 });
  const state = createMatch({ openings: { home: 'fallback' }, deployments: { home: custom } }); assert.deepEqual(state.players.slice(0, 5).map((p) => p.position), custom);
  assert.throws(() => createMatch({ openings: { home: 'inconnue' } }), /Ouverture inconnue/);
});

test('carrière : ouverture sauvegardée, figée au lancement et protégée contre la corruption', () => {
  const c = club(), edited = configureTeam(c, c.lineup, {}, 'balanced', openingDeployment('wings'), 'wings');
  assert.equal(edited.balance, c.balance); const saved = importCareer(exportCareer(edited)), launched = launchCareerMatch(saved);
  assert.equal(launched.current.state.version, 5); assert.equal(launched.current.config.openings.home, 'wings'); assert.equal(launched.current.state.teams[0].opening, 'wings');
  assert.throws(() => configureTeam(launched, launched.lineup, {}, 'balanced', undefined, 'press'), /verrouillée/);
  const corrupt = structuredClone(launched); corrupt.current.state.teams[0].opening = 'cage'; assert.throws(() => exportCareer(corrupt));
  corrupt.current.state.teams[0].opening = 'wings'; corrupt.clubs[0].opening = 'inconnue'; assert.throws(() => exportCareer(corrupt));
});

test('interface : choisir une ouverture applique le placement, puis les ajustements et la sauvegarde restent stables', async () => {
  const e = environment(exportCareer(club())); mountCareer(e.root, mountMatch);
  await button(e.root, 'Préparer le match').click();
  const select = classNode(e.root, 'rb-opening-select'); select.value = 'fallback'; await select.emit('change');
  assert.equal(e.saved().clubs[0].opening, 'fallback'); assert.deepEqual(e.saved().clubs[0].deployment, openingDeployment('fallback'));
  const cell = descendants(classNode(e.root, 'rb-deployment')).find((n) => n.dataset.cell === '0,7'); await cell.click();
  const custom = e.saved().clubs[0].deployment; assert.deepEqual(custom[0], { x: 0, y: 7 });
  const strategy = classNode(e.root, 'rb-lineup-form').querySelector('select'); strategy.value = 'pressing'; await strategy.emit('change');
  assert.deepEqual(e.saved().clubs[0].deployment, custom); assert.equal(e.saved().clubs[0].opening, 'fallback');
  await button(e.root, 'Lancer la rencontre').click();
  await button(e.root, 'Retour au club · mettre en pause').click(); assert.equal(classNode(e.root, 'rb-opening-select').disabled, true);
  await button(e.root, 'Exhibition').click(); const exhibition = classNode(classNode(e.root, 'rb-setup'), 'rb-opening-select'); exhibition.value = 'cage'; await exhibition.emit('change');
  assert.match(classNode(e.root, 'rb-scoreboard').textContent, new RegExp(OPENINGS.cage.name));
  await button(e.root, 'Carrière').click(); assert.equal(e.saved().clubs[0].opening, 'fallback');
});

test('ancienne v3 : reprise sans nouvelle ouverture ni réaction d’engagement implicite', () => {
  const c = launchCareerMatch(club()); c.current.config.rulesVersion = 3; delete c.current.config.openings;
  c.current.state = createMatch(c.current.config); c.clubs.forEach((club) => delete club.opening);
  const saved = importCareer(exportCareer(c)); assert.equal(saved.current.state.version, 3); assert.equal(saved.current.state.teams[0].opening, undefined);
  const turn = stepMatch(saved.current.state); assert.equal(turn.events.some((e) => e.type === 'center-reaction'), false);
  assert.deepEqual(importCareer(exportCareer(saveCareerTurn(saved, turn.state, turn.events))).current.state, turn.state);
});

test('ouvertures : 25 confrontations déterministes terminent avec des actions légales et des ressources bornées', { timeout: 60000 }, () => {
  for (const home of OPENING_IDS) for (const away of OPENING_IDS) {
    const result = simulateMatch({ seed: `opening-${home}-${away}`, openings: { home, away } }, (state) => assertInvariants(state));
    assert.ok(result.state.finished); assert.ok(result.state.turns <= 130); assert.ok(result.state.round <= 13);
    assert.equal(result.events.filter((e) => e.type === 'engagement' && e.round === 1).length, 1);
  }
});
