import test from 'node:test';
import assert from 'node:assert/strict';
import { mountCareer } from './career-ui.mjs';
import { CAREER_KEY, importCareer } from './career-storage.mjs';
import { createCareer, confirmDraft, buyItem, launchCareerMatch, saveCareerTurn } from './career.mjs';
import { simulateMatch } from './engine.mjs';
import { exportCareer } from './career-storage.mjs';
import { xpProgress } from './career-components.mjs';
import { PLAYER_DRAG_TYPE } from './deployment-ui.mjs';

import { descendants, button, classNode, environment } from './test-support/dom.mjs';

async function foundClub(root) {
  const form = classNode(root, 'rb-career-create'); form.querySelector('input').value = 'Un nom de club très long pour tester la vraie composition de gestion'; await form.emit('submit');
  const checks = descendants(classNode(root, 'rb-candidate-list')).filter((n) => n.type === 'checkbox');
  for (const check of checks.slice(0, 5)) { check.checked = true; await check.emit('change'); }
  await button(root, 'Valider les contrats').click();
}

test('parcours UI : création, échange de titulaires, consignes, équipement et lecture seule en match', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch); await foundClub(e.root);
  let c = e.saved(); assert.equal(c.balance, 900); assert.equal(c.lineup.length, 5);
  assert.ok(classNode(e.root, 'rb-fixture-hero')); assert.equal(classNode(e.root, 'rb-lineup-form'), null);
  await button(e.root, 'Préparer le match').click();
  const form = classNode(e.root, 'rb-lineup-form');
  await classNode(e.root, 'rb-lineup-slots').children[0].querySelector('button').click();
  const replacement = descendants(classNode(e.root, 'rb-player-inspector')).find(n => n.dataset.focusKey === 'lineup-0');
  const [first, second] = c.lineup; replacement.value = second; await replacement.emit('change');
  c = e.saved(); assert.deepEqual(c.lineup.slice(0, 2), [second, first]);
  const strategy = descendants(form).find(n => n.dataset.focusKey === 'strategy'); strategy.value = 'pressing'; await strategy.emit('change'); assert.equal(e.saved().clubs[0].strategy, 'pressing');
  await button(e.root, 'Équipement').click();
  const buyVest = descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Acheter et équiper') && n.textContent.endsWith('100 chromas'));
  await buyVest.click(); assert.equal(e.saved().inventory.length, 1); assert.equal(e.saved().balance, 800);
  await button(e.root, 'Préparer le match').click(); await button(e.root, 'Lancer la rencontre').click();
  assert.equal(e.saved().balance, 725); assert.equal(e.saved().current.state.turns, 0);
  // The real match reader receives the club names and compiled stats.
  assert.match(classNode(e.root, 'rb-scoreboard').textContent, /Un nom de club/);
  const reading = classNode(e.root, 'rb-reading-mode'); reading.value = 'turn'; await reading.emit('change');
  await button(e.root, 'Tour suivant').click(); assert.equal(e.saved().current.state.turns, 1);
  await button(e.root, 'Retour au club · mettre en pause').click();
  assert.match(classNode(e.root, 'rb-next-match').textContent, /lecture seule/);
  await button(e.root, 'Équipement').click();
  assert.ok(descendants(e.root).filter((n) => n.tagName === 'button' && n.textContent.startsWith('Acheter et équiper')).every((n) => n.disabled));
  await button(e.root, 'Reprendre la rencontre').click(); assert.equal(e.saved().balance, 725);
  assert.match(classNode(e.root, 'rb-playback-status').textContent, /Pause/);
  await button(e.root, 'Voir le résultat').click(); c = e.saved(); assert.equal(c.current.settled, true); assert.equal(c.day, 1);
  const rewarded = c.balance; await button(e.root, 'Voir le bilan de la journée').click();
  assert.ok(classNode(e.root, 'rb-career-summary'));
  await button(e.root, 'Revoir le terrain et le fil du match · sans récompense supplémentaire').click(); assert.equal(e.saved().balance, rewarded);
  await button(e.root, 'Voir le bilan de la journée').click(); await button(e.root, 'Exhibition').click();
  assert.equal(classNode(e.root, 'rb-setup').hidden, false); assert.equal(e.saved().balance, rewarded);
  await button(e.root, 'Carrière').click(); assert.equal(e.saved().day, 1);
});

test('UI : échec de sauvegarde visible, reprise en pause et remplacement JSON explicite', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch); await foundClub(e.root);
  await button(e.root, 'Préparer le match').click(); await button(e.root, 'Lancer la rencontre').click();
  const valid = e.storage.getItem(CAREER_KEY); e.storage.failing = true;
  await button(e.root, 'Round suivant').click(); assert.equal(e.storage.getItem(CAREER_KEY), valid);
  assert.match(classNode(e.root, 'rb-career-notice').textContent, /Progression non enregistrée/); assert.match(classNode(e.root, 'rb-error').textContent, /non enregistrée/);
  await button(e.root, 'Retour au club · mettre en pause').click(); e.storage.failing = false; await button(e.root, 'Réessayer la sauvegarde').click();
  assert.equal(e.saved().current.state.turns, 1); assert.equal(e.saved().transactions.filter((t) => t.label === 'Salaires de la journée').length, 1);
  const save = e.storage.getItem(CAREER_KEY); const restored = environment(save); mountCareer(restored.root, mountMatch);
  await button(restored.root, 'Reprendre la rencontre').click(); assert.match(classNode(restored.root, 'rb-playback-status').textContent, /Pause/);
  await button(restored.root, 'Voir le résultat').click(); await button(restored.root, 'Voir le bilan de la journée').click();
  const fileInput = descendants(restored.root).find((n) => n.type === 'file'), before = restored.storage.getItem(CAREER_KEY);
  fileInput.files = [{ size: before.length, text: async () => before }]; await fileInput.emit('change');
  assert.equal(classNode(restored.root, 'rb-career-import').hidden, false); assert.equal(restored.storage.getItem(CAREER_KEY), before);
  await button(restored.root, 'Annuler').click(); assert.equal(restored.storage.getItem(CAREER_KEY), before);
  fileInput.files = [{ size: before.length, text: async () => before }]; await fileInput.emit('change'); await button(restored.root, 'Confirmer le remplacement').click();
  assert.equal(restored.saved().balance, importCareer(before).balance); assert.equal(classNode(restored.root, 'rb-career-import').hidden, true);
  fileInput.files = [{ size: 2, text: async () => '{}' }]; await fileInput.emit('change'); assert.match(classNode(restored.root, 'rb-career-notice').textContent, /Import refusé/);
});

test('redémarrage : confirmation annulable, rencontre abandonnée et nouvelle campagne persistante', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  assert.equal(button(e.root, 'Redémarrer la campagne').disabled, true);
  await foundClub(e.root);
  await button(e.root, 'Préparer le match').click(); await button(e.root, 'Lancer la rencontre').click();
  const before = e.storage.getItem(CAREER_KEY); e.storage.setItem('other-save', 'conservée');
  const restart = button(e.root, 'Redémarrer la campagne'); restart.focus(); await restart.click();
  const dialog = classNode(e.root, 'rb-career-dialog');
  assert.match(dialog.textContent, /progression seront supprimés/); assert.match(dialog.textContent, /Exportez/);
  assert.match(classNode(e.root, 'rb-playback-status').textContent, /Pause/);
  assert.equal(document.activeElement, button(dialog, 'Annuler'));
  await button(dialog, 'Annuler').click();
  assert.equal(e.storage.getItem(CAREER_KEY), before); assert.equal(document.activeElement, restart);
  await restart.click(); await classNode(e.root, 'rb-career-dialog').emit('cancel');
  assert.equal(e.storage.getItem(CAREER_KEY), before); assert.equal(classNode(e.root, 'rb-career-dialog'), null);
  await restart.click(); await button(classNode(e.root, 'rb-career-dialog'), 'Redémarrer').click();
  assert.equal(e.storage.getItem(CAREER_KEY), null); assert.equal(e.storage.getItem('other-save'), 'conservée');
  assert.equal(classNode(e.root, 'rb-match-area').hidden, true); assert.equal(classNode(e.root, 'rb-career').hidden, false);
  const form = classNode(e.root, 'rb-career-create');
  assert.ok(form); assert.equal(document.activeElement, form.querySelector('input'));
  assert.equal(descendants(form).some((n) => n.type === 'checkbox'), false);
  assert.equal(button(e.root, 'Exporter').disabled, true); assert.equal(button(e.root, 'Importer').disabled, false);
  const fresh = environment(); mountCareer(fresh.root, mountMatch); assert.ok(classNode(fresh.root, 'rb-career-create'));
  await foundClub(fresh.root);
  const c = fresh.saved(); assert.equal(c.day, 0); assert.equal(c.season, 1); assert.equal(c.current, null); assert.equal(c.balance, 900);
  assert.notEqual(c.seed, importCareer(before).seed);
  const restored = environment(fresh.storage.getItem(CAREER_KEY)); mountCareer(restored.root, mountMatch);
  assert.equal(classNode(restored.root, 'rb-career-create'), null); assert.ok(classNode(restored.root, 'rb-fixture-hero'));
});

test('redémarrage : refus du stockage conserve la carrière et permet de réessayer', async () => {
  const c = createCareer('Les Persistants', 'restart-storage'), before = exportCareer(c);
  const e = environment(before); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  e.storage.failing = true;
  await button(e.root, 'Redémarrer la campagne').click(); await button(classNode(e.root, 'rb-career-dialog'), 'Redémarrer').click();
  assert.equal(e.storage.getItem(CAREER_KEY), before); assert.equal(classNode(e.root, 'rb-career-create'), null);
  assert.match(classNode(e.root, 'rb-career-notice').textContent, /Redémarrage impossible.*campagne est conservée/);
  assert.equal(classNode(e.root, 'rb-career-notice').hidden, false); assert.equal(button(e.root, 'Exporter').disabled, false);
  e.storage.failing = false;
  await button(e.root, 'Redémarrer la campagne').click(); await button(classNode(e.root, 'rb-career-dialog'), 'Redémarrer').click();
  assert.equal(e.storage.getItem(CAREER_KEY), null); assert.ok(classNode(e.root, 'rb-career-create'));
  assert.equal(classNode(e.root, 'rb-career-notice').hidden, true);
});

test('redémarrage : brouillon, import en attente et mode exhibition reviennent à une création vierge', async () => {
  const c = createCareer('Les Brouillons', 'restart-draft'), before = exportCareer(c);
  const e = environment(before); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  const check = descendants(classNode(e.root, 'rb-candidate-list')).find((n) => n.type === 'checkbox'); check.checked = true; await check.emit('change');
  const file = descendants(e.root).find((n) => n.type === 'file'); file.files = [{ size: before.length, text: async () => before }]; await file.emit('change');
  assert.equal(classNode(e.root, 'rb-career-import').hidden, false);
  let finishReading; file.files = [{ size: before.length, text: () => new Promise((resolve) => { finishReading = resolve; }) }]; const reading = file.emit('change');
  await button(e.root, 'Exhibition').click(); await button(e.root, 'Redémarrer la campagne').click();
  await button(classNode(e.root, 'rb-career-dialog'), 'Redémarrer').click();
  finishReading(before); await reading;
  assert.equal(button(e.root, 'Carrière').getAttribute('aria-pressed'), 'true');
  assert.equal(classNode(e.root, 'rb-career-import').hidden, true); assert.equal(classNode(e.root, 'rb-career-import').textContent, '');
  const form = classNode(e.root, 'rb-career-create'); form.querySelector('input').value = 'Les Nouveaux'; await form.emit('submit');
  assert.equal(descendants(classNode(e.root, 'rb-candidate-list')).some((n) => n.type === 'checkbox' && n.checked), false);
  assert.equal(button(e.root, 'Valider les contrats').disabled, true); assert.equal(e.saved().balance, 2400);
});

test('UI : couleur du club de la création au terrain, sauvegarde et lecture seule pendant la rencontre', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  const creation = classNode(e.root, 'rb-career-create'), color = creation.querySelector('.rb-kit-color');
  color.value = '#b83050'; await color.emit('input');
  assert.equal(creation.querySelector('.rb-person-jersey').getAttribute('fill'), '#b83050');
  await foundClub(e.root); assert.equal(e.saved().clubs[0].kitColor, '#b83050');
  const input = classNode(e.root, 'rb-kit-color'); input.parentNode.parentNode.open = true;
  input.focus(); input.value = '#2255bb'; await input.emit('change');
  assert.equal(e.saved().clubs[0].kitColor, '#2255bb'); assert.equal(document.activeElement, classNode(e.root, 'rb-kit-color'));
  assert.ok(classNode(e.root, 'rb-fixture-hero').querySelectorAll('.rb-person-jersey').every((n) => n.getAttribute('fill') === '#2255bb'));
  await button(e.root, 'Préparer le match').click(); await button(e.root, 'Lancer la rencontre').click();
  assert.equal(e.saved().current.state.teams[0].kitColor, '#2255bb');
  await button(e.root, 'Retour au club · mettre en pause').click();
  await button(e.root, 'Club').click(); assert.equal(classNode(e.root, 'rb-kit-color').disabled, true);
  const restored = environment(e.storage.getItem(CAREER_KEY)); mountCareer(restored.root, mountMatch);
  assert.equal(classNode(restored.root, 'rb-kit-color').value, '#2255bb');
});

test('effectif : comparaison sans formulaire, fiche liée à l’équipement et XP par palier', async () => {
  let c = createCareer('Les Cartographes', 'ui-roster'); c = confirmDraft(c, c.market.slice(0, 7).map((p) => p.id));
  c.clubs[0].players[1].xp = 20; c.clubs[0].players[1].fatigue = 5;
  const e = environment(exportCareer(c)); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  await button(e.root, 'Effectif').click();
  assert.ok(classNode(e.root, 'rb-roster-table')); assert.equal(classNode(e.root, 'rb-lineup-form'), null);
  assert.match(classNode(e.root, 'rb-roster-table').textContent, /compétences physiques/);
  const pick = descendants(e.root).find((n) => n.dataset.focusKey === `player-${c.clubs[0].players[1].id}`); await pick.click();
  const detail = classNode(e.root, 'rb-player-detail'), xp = detail.querySelector('progress'); assert.equal(xp.value, '0'); assert.equal(xp.max, 30);
  await button(e.root, 'Gérer son équipement').click(); assert.equal(descendants(e.root).find((n) => n.dataset.focusKey === 'equipment-player').value, c.clubs[0].players[1].id);
  const max = xpProgress({ name: 'Maximum', xp: 200, fatigue: 0 }); assert.equal(max.querySelector('progress').value, '1'); assert.match(max.textContent, /Maximum/);
});

test('préparation : sélection liée au terrain, rotation, retour sur une ouverture et focus conservé', async () => {
  let c = createCareer('Les Tacticiens', 'ui-tactics'); c = confirmDraft(c, c.market.slice(0, 7).map((p) => p.id));
  const e = environment(exportCareer(c)); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch); await button(e.root, 'Préparer le match').click();
  const formation = structuredClone(e.saved().clubs[0].deployment), opening = classNode(e.root, 'rb-opening-select'); opening.value = 'wings'; await opening.emit('change');
  await button(e.root, 'Rétablir le placement précédent').click(); assert.deepEqual(e.saved().clubs[0].deployment, formation); assert.equal(e.saved().clubs[0].opening, c.clubs[0].opening);
  const selector = classNode(e.root, 'rb-deployment-player'); selector.value = '2'; await selector.emit('change');
  assert.match(classNode(e.root, 'rb-tactical-player').textContent, new RegExp(c.clubs[0].players[2].name));
  const role = descendants(e.root).find((n) => n.dataset.focusKey === 'active-role'); role.focus(); role.value = 'defender'; await role.emit('change');
  assert.equal(classNode(e.root, 'rb-tactical-player').parentNode, descendants(e.root).find(n => n.classList.contains('rb-lineup-slot') && n.classList.contains('is-selected')));
  assert.equal(e.saved().clubs[0].players[2].role, 'defender'); assert.equal(document.activeElement, role);
  const substitute = c.clubs[0].players[5], balance = e.saved().balance;
  await button(e.root, substitute.name).click();
  await button(classNode(e.root, 'rb-player-inspector'), 'Acheter et équiper · 100 chromas').click();
  assert.equal(e.saved().balance, balance - 100); assert.equal(e.saved().inventory[0].playerId, substitute.id); assert.deepEqual(e.saved().lineup, c.lineup);
  await button(e.root, `Faire entrer ${substitute.name}`).click(); assert.equal(e.saved().lineup[2], substitute.id); assert.deepEqual(e.saved().clubs[0].deployment, formation);
  assert.equal(classNode(e.root, 'rb-deployment-player').value, '2');
});

test('préparation solo : glisser depuis le banc remplace la bonne place et conserve cinq positions uniques', async () => {
  let c = createCareer('Les Mobiles', 'ui-drag'); c = confirmDraft(c, c.market.slice(0, 6).map(p => p.id));
  const e = environment(exportCareer(c)), { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  await button(e.root, 'Équipe').click();
  const reserve = c.clubs[0].players[5], position = c.clubs[0].deployment[3];
  const target = descendants(classNode(e.root, 'rb-deployment')).find(n => n.dataset.cell === `${position.x},${position.y}`);
  await target.emit('drop', { dataTransfer: { types: [PLAYER_DRAG_TYPE], getData: () => reserve.id } });
  assert.equal(e.saved().lineup[3], reserve.id); assert.equal(new Set(e.saved().lineup).size, 5);
  assert.deepEqual(e.saved().clubs[0].deployment[3], position);
  assert.equal(new Set(e.saved().clubs[0].deployment.map(p => `${p.x},${p.y}`)).size, 5);
  assert.match(classNode(e.root, 'rb-player-inspector').textContent, new RegExp(reserve.name));
});

test('équipement : matériel possédé avant magasin, transfert sans argent et comparaison de fatigue', async () => {
  let c = createCareer('Les Équipés', 'ui-gear'); c = confirmDraft(c, c.market.slice(0, 7).map((p) => p.id));
  c = buyItem(c, 'armor', c.lineup[0]); c = buyItem(c, 'vest', c.lineup[1]); assert.equal(c.balance, 50);
  const e = environment(exportCareer(c)); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch); await button(e.root, 'Équipement').click();
  const manager = classNode(e.root, 'rb-career'); assert.ok(manager.textContent.indexOf('Protections du club') < manager.textContent.indexOf('Magasin'));
  assert.match(manager.textContent, /Fatigue de participation/);
  const assignment = descendants(e.root).find((n) => n.dataset.focusKey === `gear-${c.inventory[0].id}`); assignment.focus(); assignment.value = c.lineup[1]; await assignment.emit('change');
  assert.equal(e.saved().balance, 50); assert.equal(e.saved().inventory[0].playerId, c.lineup[1]); assert.equal(e.saved().inventory[1].playerId, null);
  assert.equal(document.activeElement.dataset.focusKey, assignment.dataset.focusKey);
  assert.ok(descendants(e.root).filter((n) => n.tagName === 'button' && n.textContent.startsWith('Acheter et équiper')).every((n) => n.disabled));
});

test('journées : bilan dédié, résumé compact et nouvelle préparation sans double paiement', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch); await foundClub(e.root);
  for (let day = 1; day <= 2; day++) {
    await button(e.root, day === 1 ? 'Préparer le match' : 'Préparer la prochaine rencontre').click(); await button(e.root, 'Lancer la rencontre').click();
    await button(e.root, 'Voir le résultat').click(); await button(e.root, 'Voir le bilan de la journée').click();
    assert.equal(e.saved().day, day); assert.ok(classNode(e.root, 'rb-career-summary'));
    const balance = e.saved().balance, mobileNav = descendants(e.root).find((n) => n.dataset.focusKey === 'mobile-section'); assert.equal(mobileNav.value, 'Bilan'); mobileNav.value = 'Club'; await mobileNav.emit('change');
    assert.equal(classNode(e.root, 'rb-career-summary'), null); assert.ok(classNode(e.root, 'rb-last-result'));
    await button(e.root, 'Voir le bilan').click(); assert.equal(e.saved().balance, balance);
  }
  assert.equal(e.saved().transactions.filter((t) => t.label === 'Salaires de la journée').length, 2);
});

test('impayés : achats bloqués, préparation accessible et cession qui rembourse la dette', async () => {
  let c = createCareer('Les Endettés', 'ui-debt'); c = confirmDraft(c, c.market.slice(0, 8).map((p) => p.id));
  for (const p of c.clubs[0].players) p.xp = 140;
  c = launchCareerMatch(c); const game = simulateMatch(c.current.config); game.state.result.winnerId = 'away'; c = saveCareerTurn(c, game.state, game.events); assert.equal(c.balance, -80);
  const e = environment(exportCareer(c)); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  assert.match(classNode(e.root, 'rb-career-debt').textContent, /Vous pouvez jouer/);
  await button(e.root, 'Recrutement').click(); assert.ok(descendants(e.root).filter((n) => n.tagName === 'button' && n.textContent.startsWith('Recruter ·')).every((n) => n.disabled));
  await button(e.root, 'Préparer le match').click(); assert.equal(button(e.root, 'Lancer la rencontre').disabled, false);
  await button(e.root, 'Effectif').click(); await button(e.root, 'Céder · 450 chromas').click(); await button(e.root, 'Confirmer').click();
  assert.equal(e.saved().balance, 370); assert.equal(e.saved().clubs[0].players.length, 7); assert.equal(classNode(e.root, 'rb-career-debt'), null);
});
