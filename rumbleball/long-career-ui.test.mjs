import test from 'node:test';
import assert from 'node:assert/strict';
import { mountCareer } from './career-ui.mjs';
import { createCareer, confirmDraft, recruit, launchCareerMatch, saveCareerTurn } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';
import { createMatch, stepMatch } from './engine.mjs';
import { playerShop } from './player-shop.mjs';
import { soloTestService } from './test-support/solo.mjs';
import { descendants, button, environment } from './test-support/dom.mjs';
import { createLeague, addBot, editPreparation } from './online/league.mjs';
import { startReadyLeague } from './test-support/online.mjs';

function matchStub() { return { loads: 0, pause() {}, stop() {}, exhibition() {}, load() { this.loads++; } }; }
function club() {
  let c = createCareer('Les Rebuts', 'long-ui', undefined, { mode: 'long' }); c = confirmDraft(c, c.market.slice(0, 5).map(p => p.id));
  c.balance += 3000; c.transactions.push({ id: 'grant', amount: 3000, balance: c.balance, label: 'Dotation de test' }); return c;
}
test('création : choix du mode longue carrière, recrutement initial et division dans les deux écrans', async () => {
  const e = environment(), view = matchStub(); const mounted = mountCareer(e.root, () => view);
  const form = e.root.querySelector('.rb-career-create'), type = descendants(form).find(n => n.getAttribute('aria-label') === 'Type de carrière');
  type.value = 'long'; await type.emit('change'); assert.match(form.textContent, /Six niveaux de ligue/);
  form.querySelector('input').value = 'Les Chromes'; await form.emit('submit');
  const checks = descendants(e.root.querySelector('.rb-candidate-list')).filter(n => n.type === 'checkbox');
  for (const check of checks.slice(0, 5)) { check.checked = true; await check.emit('change'); }
  await button(e.root, 'Valider les contrats').click();
  assert.equal(e.saved().mode, 'long'); assert.match(e.root.textContent, /Ligue 1\/6/); assert.match(e.root.textContent, /Fatigue 0\/10/);
  await button(e.root, 'Ligue').click(); assert.match(e.root.textContent, /Les deux finalistes montent/);
  await button(e.root, 'Les six ligues').click(); assert.match(e.root.querySelector('.rb-career-management-dialog').textContent, /Ligue Singularité/);
  assert.equal(view.loads, 0); mounted.stop();
});
test('blessé sur le banc : fiche et magasin accessibles, entrée dans la composition désactivée', async () => {
  let c = club(); c = recruit(c, c.market[0].id); const reserve = c.clubs[0].players.at(-1); reserve.injuryMatches = 2;
  const e = environment(exportCareer(c)), mounted = mountCareer(e.root, () => matchStub());
  const entry = descendants(e.root).find(n => n.getAttribute('aria-label') === `Faire entrer ${reserve.name}`);
  assert.ok(entry.disabled); await button(e.root, reserve.name).click();
  assert.match(e.root.querySelector('.rb-player-inspector').textContent, /Indisponible pour les 2 prochains matchs/);
  assert.match(e.root.querySelector('.rb-player-inspector').textContent, /Singularité/);
  assert.deepEqual(e.saved().lineup, c.lineup); mounted.stop();
});
test('forfait depuis Club : bilan enregistré sans charger de terrain ni proposer de faux replay', async () => {
  const c = club(); for (const a of c.clubs) for (const p of a.players) p.injuryMatches = 2;
  const e = environment(exportCareer(c)), view = matchStub(), mounted = mountCareer(e.root, () => view);
  assert.match(e.root.textContent, /0\/5 joueurs disponibles/);
  await button(e.root, 'Déclarer forfait et avancer').click();
  assert.equal(view.loads, 0); assert.equal(e.saved().day, 1); assert.equal(e.saved().current.kind, 'forfeit');
  assert.match(e.root.querySelector('.rb-career-summary').textContent, /Double forfait/);
  assert.equal(button(e.root, 'Revoir le terrain et le fil du match · sans récompense supplémentaire'), undefined); mounted.stop();
});
test('magasin : les vingt nouveaux modèles apparaissent uniquement en carrière longue', () => {
  const c = club(), p = c.clubs[0].players[0]; environment();
  const long = playerShop({ ...c.clubs[0], mode: c.mode, inventory: c.inventory, balance: c.balance }, p);
  const classic = playerShop({ ...c.clubs[0], inventory: c.inventory, balance: c.balance }, p);
  assert.match(long.querySelector('select').textContent, /Marteau Singularité/);
  assert.doesNotMatch(classic.querySelector('select').textContent, /Prototype|Singularité/);
});
test('reprise de match : fatigue sur 10, profil et prochains jets conservés après export/import', () => {
  let c = club(); for (const p of c.clubs[0].players) p.fatigue = 10;
  c = launchCareerMatch(c); const first = stepMatch(c.current.state); c = saveCareerTurn(c, first.state, first.events);
  const loaded = importCareer(exportCareer(c)); assert.deepEqual(loaded.current, c.current);
  assert.deepEqual(stepMatch(loaded.current.state), stepMatch(c.current.state));
  assert.deepEqual(createMatch(c.current.config).initiative, createMatch(loaded.current.config).initiative);
});
test('cloud : plusieurs modes sur le même compte, résumé sans état complet et blessures conservées', async () => {
  const s = soloTestService(), c = club(); c.clubs[0].players[0].injuryMatches = 3; c.clubs[0].players[0].fatigue = 9;
  const game = (await s.command('owner', 'solo_create')).game;
  await s.command('owner', 'solo_save', { id: game.id, revision: game.revision, writeId: crypto.randomUUID(), json: exportCareer(c) });
  const loaded = (await s.command('owner', 'solo_get', { id: game.id })).game;
  assert.deepEqual(loaded.state, c); assert.equal(loaded.mode, 'long'); assert.equal(loaded.division, 1);
  const summary = (await s.command('owner', 'solo_list')).games[0]; assert.equal(summary.mode, 'long'); assert.equal(summary.division, 1); assert.equal(summary.state, undefined);
  assert.equal((await s.command('other', 'solo_list')).games.length, 0);
});
test('serveur multi : le payload ne peut pas activer les objets de carrière longue', () => {
  const now = '2026-10-20T10:00:00Z';
  let s = createLeague({ id: 'gated', userId: 'owner', name: 'Ligue', clubName: 'Club', seed: 'mode-gating', inviteCode: 'a'.repeat(32) }, now);
  s = startReadyLeague(addBot(s, 'owner'), 'owner', now);
  assert.throws(() => editPreparation(s, 'owner', 'buy', { itemId: 'maul_singularite', playerId: s.members[0].club.players[0].id, mode: 'long', price: 0 }, now), /réservé/);
  assert.equal(s.members[0].draft, null);
});
