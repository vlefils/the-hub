import test from 'node:test';
import assert from 'node:assert/strict';
import { mountCareer } from './career-ui.mjs';
import { CAREER_KEY, importCareer } from './career-storage.mjs';

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
  const form = classNode(e.root, 'rb-lineup-form'), slots = descendants(classNode(e.root, 'rb-lineup-slots')).filter((n) => n.tagName === 'select');
  const [first, second] = c.lineup; slots[0].value = second; await slots[0].emit('change');
  c = e.saved(); assert.deepEqual(c.lineup.slice(0, 2), [second, first]);
  const strategy = form.querySelector('select'); strategy.value = 'pressing'; await strategy.emit('change'); assert.equal(e.saved().clubs[0].strategy, 'pressing');
  await button(e.root, 'Équipement').click();
  const buyVest = descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Acheter pour') && n.textContent.endsWith('100 chromas'));
  await buyVest.click(); assert.equal(e.saved().inventory.length, 1); assert.equal(e.saved().balance, 800);
  const play = descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Jouer ·')); await play.click();
  assert.equal(e.saved().balance, 725); assert.equal(e.saved().current.state.turns, 0);
  // The real match reader receives the club names and compiled stats.
  assert.match(classNode(e.root, 'rb-scoreboard').textContent, /Un nom de club/);
  await button(e.root, 'Tour suivant').click(); assert.equal(e.saved().current.state.turns, 1);
  await button(e.root, 'Retour au club · mettre en pause').click();
  assert.match(classNode(e.root, 'rb-next-match').textContent, /lecture seule/);
  assert.ok(descendants(classNode(e.root, 'rb-shop')).filter((n) => n.tagName === 'button').every((n) => n.disabled));
  await button(e.root, 'Reprendre la rencontre').click(); assert.equal(e.saved().balance, 725);
  assert.match(classNode(e.root, 'rb-playback-status').textContent, /Pause/);
  await button(e.root, 'Voir le résultat').click(); c = e.saved(); assert.equal(c.current.settled, true); assert.equal(c.day, 1);
  const rewarded = c.balance; await button(e.root, 'Voir le bilan de la journée').click();
  await button(e.root, 'Revoir le terrain et le fil du match · sans récompense supplémentaire').click(); assert.equal(e.saved().balance, rewarded);
  await button(e.root, 'Voir le bilan de la journée').click(); await button(e.root, 'Exhibition').click();
  assert.equal(classNode(e.root, 'rb-setup').hidden, false); assert.equal(e.saved().balance, rewarded);
  await button(e.root, 'Carrière').click(); assert.equal(e.saved().day, 1);
});

test('UI : échec de sauvegarde visible, reprise en pause et remplacement JSON explicite', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch); await foundClub(e.root);
  let play = descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Jouer ·')); await play.click();
  const valid = e.storage.getItem(CAREER_KEY); e.storage.failing = true;
  await button(e.root, 'Tour suivant').click(); assert.equal(e.storage.getItem(CAREER_KEY), valid);
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

test('UI : couleur du club de la création au terrain, sauvegarde et lecture seule pendant la rencontre', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  const creation = classNode(e.root, 'rb-career-create'), color = creation.querySelector('.rb-kit-color');
  color.value = '#b83050'; await color.emit('input');
  assert.equal(creation.querySelector('.rb-person-jersey').getAttribute('fill'), '#b83050');
  await foundClub(e.root); assert.equal(e.saved().clubs[0].kitColor, '#b83050');
  const form = classNode(e.root, 'rb-lineup-form'), input = form.querySelector('.rb-kit-color');
  input.focus(); input.value = '#2255bb'; await input.emit('change');
  assert.equal(e.saved().clubs[0].kitColor, '#2255bb'); assert.equal(document.activeElement, input);
  assert.ok(form.querySelectorAll('.rb-person-jersey').every((n) => n.getAttribute('fill') === '#2255bb'));
  await descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Jouer ·')).click();
  assert.equal(e.saved().current.state.teams[0].kitColor, '#2255bb');
  await button(e.root, 'Retour au club · mettre en pause').click();
  assert.equal(classNode(e.root, 'rb-lineup-form').querySelector('.rb-kit-color').disabled, true);
  const restored = environment(e.storage.getItem(CAREER_KEY)); mountCareer(restored.root, mountMatch);
  assert.equal(classNode(restored.root, 'rb-lineup-form').querySelector('.rb-kit-color').value, '#2255bb');
});
