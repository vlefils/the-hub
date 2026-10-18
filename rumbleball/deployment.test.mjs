import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from './engine.mjs';
import { CENTER, CENTER_CELLS, clubDeployment, defaultDeployment, inHalf, isCenterBall, moveDeployment, validDeployment } from './deployment.mjs';
import { assertInvariants, beginTurn, legalAction, randomInt, resolveAction, trajectory } from './rules.mjs';
import { createCareer, configureTeam, confirmDraft, launchCareerMatch, saveCareerTurn } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';
import { narrateTurn } from './narration.mjs';
import { buildRoundPlayback, courtPoint, sampleRoundPlayback } from './playback.mjs';
import { mountCareer } from './career-ui.mjs';
import { deploymentEditor } from './deployment-ui.mjs';
import { environment, descendants, button, classNode } from './test-support/dom.mjs';

const p = (state, id) => state.players.find((p) => p.id === id);
const club = () => { const c = createCareer('Les Centristes'); return confirmDraft(c, c.market.slice(0, 5).map((p) => p.id)); };
function fixture(contested = false) {
  const state = createMatch({ classes: false, rulesVersion: 3 });
  state.players.forEach((p) => { p.hp = 0; }); const a = state.players[0], b = state.players[5];
  a.hp = a.maxHp; a.position = { x: 5, y: 3 }; a.skills = { wrestling: 0, acrobatics: 0 }; state.activeId = a.id;
  b.hp = contested ? b.maxHp : 0; b.position = { x: 6, y: 4 }; b.skills = { wrestling: 0, acrobatics: 0 };
  return { state, a, b, events: [] };
}
function dice(state, wanted) {
  for (let n = 0; n < 300000; n++) { const probe = { rng: n }; if (wanted.every((d) => randomInt(probe, 20) + 1 === d)) { state.rng = n; return; } }
  throw new Error('Jet de test introuvable');
}
const cell = (root, x, y) => descendants(root).find((n) => n.dataset.cell === `${x},${y}`);

test('engagement : intersection exacte, indépendante de la graine, et quatre cases éligibles seulement', () => {
  for (const seed of ['a', 'b', 'c']) { const s = createMatch({ seed }); assert.deepEqual(s.ball.position, CENTER); assert.deepEqual(courtPoint(s.ball.position), { x: 360, y: 240 }); assertInvariants(s); }
  const { state, a } = fixture(), eligible = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) { a.position = { x, y }; if (legalAction(state, a, { type: 'pickup' })) eligible.push({ x, y }); }
  assert.deepEqual(eligible, CENTER_CELLS);
  state.ball.position = { x: 4.5, y: 3.5 }; assert.throws(() => assertInvariants(state), /Balle hors/);
  state.ball.position = { ...CENTER }; a.position = { ...CENTER }; assert.throws(() => assertInvariants(state), /État invalide/);
});

test('ancienne règle v3 : prise seule DD 10, action dépensée et aucun ramassage gratuit', () => {
  const { state, a, events } = fixture(); dice(state, [9]);
  assert.equal(resolveAction(state, a, { type: 'pickup' }, events), true); assert.ok(isCenterBall(state));
  assert.equal(a.action, false); assert.equal(a.interaction, true); assert.equal(a.pickedUp, true); assert.equal(state.stats.home.recoveries, 0);
  const rng = state.rng; assert.equal(resolveAction(state, a, { type: 'pickup' }, []), false); assert.equal(state.rng, rng);
  beginTurn(state, a, []); a.interaction = false; dice(state, [10]);
  assert.equal(resolveAction(state, a, { type: 'pickup' }, []), true); assert.equal(state.ball.carrierId, a.id); assert.equal(a.action, false);
  assert.equal(state.stats.home.recoveries, 1); assertInvariants(state);
});

test('ancienne règle v3 : prise contestée, égalité au défenseur, sans DD 10 ajouté', () => {
  const { state, a, b, events } = fixture(true); dice(state, [10, 10]);
  resolveAction(state, a, { type: 'pickup' }, events); assert.ok(isCenterBall(state)); assert.equal(a.action, false);
  beginTurn(state, a, []); a.skills = { wrestling: 4, acrobatics: 6 }; b.skills = { wrestling: 3, acrobatics: 2 }; dice(state, [2, 1]);
  const next = []; resolveAction(state, a, { type: 'pickup' }, next);
  assert.deepEqual(next.filter((e) => e.type === 'roll').map((e) => e.total), [8, 4]); assert.equal(state.ball.carrierId, a.id);
  assert.equal(b.action, true); assert.equal(b.reaction, true); assertInvariants(state);
});

test('opposition : seuls les adversaires vivants dans le carré central contestent', () => {
  const { state, a, b, events } = fixture(true); b.position = { x: 4, y: 3 }; b.skills.wrestling = 100; dice(state, [10]);
  resolveAction(state, a, { type: 'pickup' }, events); assert.equal(state.ball.carrierId, a.id); assert.equal(events.filter((e) => e.type === 'roll').length, 1);
});

test('initiative : après une première tentative ratée, le suivant peut prendre la balle avec son action', () => {
  const { state, a, b } = fixture(true); state.initiative = [b.id, a.id]; state.activeId = null; dice(state, [1, 10]);
  const original = structuredClone(state), first = stepMatch(state); assert.deepEqual(state, original);
  assert.equal(first.state.activeId, b.id); assert.ok(isCenterBall(first.state)); assert.equal(p(first.state, b.id).action, false);
  dice(first.state, [20, 1]); const second = stepMatch(first.state);
  assert.equal(second.state.activeId, a.id); assert.equal(second.state.ball.carrierId, a.id);
  assert.equal(second.events.find((e) => e.resolvedAction?.type === 'pickup').resolvedAction.atCenter, true);
  const plan = buildRoundPlayback([{ before: state, after: first.state, events: first.events }, { before: first.state, after: second.state, events: second.events }]);
  assert.ok(plan.turns[1].start >= plan.turns[0].end);
});

test('prise ratée : récit fidèle, effet sur le bon joueur et ballon toujours à l’intersection', () => {
  const { state, a, events } = fixture(); const before = structuredClone(state); dice(state, [1]); resolveAction(state, a, { type: 'pickup' }, events);
  state.turns++; const plan = buildRoundPlayback([{ before, after: state, events }]);
  assert.match(narrateTurn(events, state.players).text, /attraper le ballon au centre, sans succès/);
  assert.ok(plan.turns[0].plan.effects.some((e) => e.kind === 'miss' && e.playerId === a.id));
  for (const time of [0, 3000, 6000, 12000]) assert.deepEqual(sampleRoundPlayback(plan, time).ballPoint, { x: 360, y: 240 });
  assert.ok(trajectory(CENTER, a.position).every((p) => Number.isInteger(p.x) && Number.isInteger(p.y)));
});

test('déploiements : cinq positions libres, distinctes et dans la moitié de chaque équipe, sans alias', () => {
  const home = [{ x: 0, y: 0 }, { x: 5, y: 7 }, { x: 2, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }], away = defaultDeployment('pressing', 'away');
  const config = { deployments: { home, away } }, original = structuredClone(config), state = createMatch(config);
  assert.deepEqual(state.players.slice(0, 5).map((p) => p.position), home); assert.deepEqual(state.players.slice(5).map((p) => p.position), away); assert.deepEqual(config, original);
  home[0].x = 1; assert.equal(state.players[0].position.x, 0); state.players[0].position.x = 2; assert.equal(state.players[0].startPosition.x, 0);
  for (const strategy of ['balanced', 'pressing', 'possession']) for (const side of ['home', 'away']) assert.ok(validDeployment(defaultDeployment(strategy, side), side));
  for (const invalid of [[], Array(5).fill({ x: 0, y: 0 }), [{ x: 6, y: 0 }, ...original.deployments.home.slice(1)], [{ x: 5.5, y: 3.5 }, ...original.deployments.home.slice(1)]]) assert.throws(() => createMatch({ deployments: { home: invalid } }), /Déploiement invalide/);
  assert.throws(() => createMatch({ deployments: { away: defaultDeployment() } }), /Déploiement invalide/);
});

test('échange et dernier engagement : aucune superposition, retour aux positions choisies avec les PV conservés', () => {
  const initial = defaultDeployment(), swapped = moveDeployment(initial, 0, initial[1]);
  assert.deepEqual(swapped[1], initial[0]); assert.deepEqual(swapped[0], initial[1]); assert.ok(validDeployment(swapped)); assert.notDeepEqual(initial, swapped);
  assert.throws(() => moveDeployment(initial, 0, { x: 6, y: 3 }));
  const state = createMatch({ rulesVersion: 5, deployments: { home: swapped } }), a = state.players[0]; state.players.forEach((p) => { p.hp = p.id === a.id ? 9 : 0; });
  state.round = 12; state.phase = 'overtime'; state.initiative = [a.id]; a.speed = 0; a.movement = 0; a.position = { x: 0, y: 0 };
  const next = stepMatch(state).state; assert.equal(next.round, 13); assert.ok(isCenterBall(next)); assert.equal(next.players[0].hp, 9);
  assert.deepEqual(next.players.map((p) => p.position), state.players.map((p) => p.startPosition));
});

test('carrière : placement sauvegardé et figé, adversaires dans leur moitié et refus des placements corrompus', () => {
  const initial = club(), deployment = moveDeployment(defaultDeployment(), 0, { x: 0, y: 0 });
  const c = configureTeam(initial, initial.lineup, {}, 'balanced', deployment), saved = importCareer(exportCareer(c)), launched = launchCareerMatch(saved);
  assert.deepEqual(clubDeployment(saved.clubs[0]), deployment); assert.equal(c.balance, initial.balance); assert.deepEqual(c.transactions, initial.transactions);
  assert.deepEqual(launched.current.state.players.slice(0, 5).map((p) => p.position), deployment);
  assert.ok(launched.current.state.players.slice(5).every((p) => inHalf(p.position, 'away')));
  assert.throws(() => configureTeam(launched, launched.lineup, {}, 'balanced', defaultDeployment()), /verrouillée/);
  const corrupt = structuredClone(c); corrupt.clubs[0].deployment[0] = { x: 6, y: 0 }; assert.throws(() => exportCareer(corrupt));
});

test('ancienne rencontre : import et reprise gardent version, initiative, placement et hasard antérieurs', () => {
  const c = launchCareerMatch(club()); delete c.current.config.rulesVersion; delete c.current.config.deployments;
  c.clubs.forEach((club) => delete club.deployment); c.current.state = createMatch({ ...c.current.config, rulesVersion: 2 });
  const loaded = importCareer(exportCareer(c)); assert.equal(loaded.current.state.version, 2); assert.deepEqual(loaded.current.state.players[0].position, { x: 1, y: 1 });
  assert.ok(Number.isInteger(loaded.current.state.ball.position.x));
  const turn = stepMatch(loaded.current.state), saved = saveCareerTurn(loaded, turn.state, turn.events);
  assert.deepEqual(importCareer(exportCareer(saved)).current.state, turn.state);
  assert.deepEqual(createMatch({ ...loaded.current.config, rulesVersion: 2 }), loaded.current.state);
});

test('éditeur : clic, échange, clavier, contenu variable et lecture seule conservent cinq cases valides', async () => {
  environment(); const state = createMatch(), changes = [], editor = deploymentEditor({ players: state.players.slice(0, 5), onChange: (value) => changes.push(value) });
  assert.equal(editor.root.querySelectorAll('.rb-deployment-cell').length, 48);
  assert.equal(editor.root.querySelectorAll('.rb-deployment-opponent').length, 48);
  assert.ok(editor.root.querySelectorAll('.rb-deployment-opponent').every((n) => n.tagName === 'span' && n.getAttribute('aria-hidden') === 'true'));
  assert.match(cell(editor.root, 5, 3).getAttribute('aria-label'), /zone d’engagement/);
  assert.match(cell(editor.root, 5, 4).getAttribute('aria-label'), /zone d’engagement/);
  assert.doesNotMatch(cell(editor.root, 4, 3).getAttribute('aria-label'), /zone d’engagement/);
  assert.ok(editor.root.querySelectorAll('.rb-person-facing').every((n) => n.getAttribute('transform') === 'rotate(90)'));
  await cell(editor.root, 5, 3).emit('keydown', { key: 'ArrowRight' }); assert.equal(document.activeElement, cell(editor.root, 5, 3));
  await cell(editor.root, 0, 0).click(); assert.deepEqual(editor.value[0], { x: 0, y: 0 });
  await cell(editor.root, 5, 3).click(); assert.deepEqual(editor.value[1], { x: 0, y: 0 }); assert.ok(validDeployment(editor.value));
  await cell(editor.root, 5, 3).emit('keydown', { key: 'ArrowDown' }); assert.equal(document.activeElement, cell(editor.root, 5, 4));
  const players = state.players.slice(0, 5).map((p) => ({ ...p, name: `${p.name} avec un nom beaucoup plus long` }));
  editor.update({ players, color: '#992244' }); assert.match(editor.root.querySelector('select').textContent, /beaucoup plus long/); assert.ok(validDeployment(editor.value));
  assert.ok(editor.root.querySelectorAll('.rb-person-facing').every((n) => n.getAttribute('transform') === 'rotate(90)'));
  const before = editor.value; editor.update({ disabled: true }); await cell(editor.root, 0, 1).click(); assert.deepEqual(editor.value, before); assert.equal(changes.length, 2);
  assert.ok(editor.root.querySelectorAll('.rb-deployment-cell').every((b) => b.disabled));
});

test('UI de carrière : placement et titulaires s’enregistrent ensemble ; le terrain et la reprise sont cohérents', async () => {
  const e = environment(exportCareer(club())), { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  await button(e.root, 'Préparer le match').click();
  const form = classNode(e.root, 'rb-lineup-form'), editor = classNode(form, 'rb-deployment');
  await cell(editor, 0, 0).click(); assert.deepEqual(e.saved().clubs[0].deployment[0], { x: 0, y: 0 });
  const slots = classNode(form, 'rb-lineup-slots').children.map(row => row.children[0].querySelector('select')); slots[0].value = slots[1].value; await slots[0].emit('change');
  assert.deepEqual(e.saved().clubs[0].deployment[0], { x: 0, y: 0 }); assert.match(editor.querySelector('select').children[0].textContent, /Brique/);
  await button(e.root, 'Lancer la rencontre').click();
  assert.deepEqual(e.saved().current.state.players[0].position, { x: 0, y: 0 }); assert.equal(classNode(e.root, 'rb-center-zone').getAttribute('visibility'), 'hidden');
  assert.match(classNode(e.root, 'rb-possession').textContent, /Ballon attendu au centre/);
  await button(e.root, 'Retour au club · mettre en pause').click();
  assert.ok(classNode(e.root, 'rb-deployment').querySelectorAll('.rb-deployment-cell').every((b) => b.disabled));
  const restored = environment(exportCareer(e.saved())); mountCareer(restored.root, mountMatch); await button(restored.root, 'Reprendre la rencontre').click();
  assert.deepEqual(restored.saved().current.state.players[0].position, { x: 0, y: 0 }); assert.match(classNode(restored.root, 'rb-playback-status').textContent, /Pause/);
});

test('exhibition : déploiement libre dans le vestiaire ; ballon masqué avant le coup d’envoi', async () => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'), view = mountMatch(e.root);
  await cell(classNode(e.root, 'rb-setup'), 0, 7).click();
  const pawn = descendants(e.root).find((n) => n.getAttribute('data-player') === 'home-0'); assert.equal(pawn.getAttribute('transform'), 'translate(30 450)');
  assert.equal(classNode(classNode(e.root, 'rb-ball-layer'), 'rb-ball').parentNode.getAttribute('transform'), 'translate(360 240)');
  assert.equal(classNode(e.root, 'rb-ball-layer').getAttribute('display'), 'none');
  await classNode(e.root, 'rb-setup').emit('submit'); view.pause();
  assert.equal(pawn.getAttribute('transform'), 'translate(30 450)'); assert.equal(classNode(e.root, 'rb-setup').hidden, true);
});
