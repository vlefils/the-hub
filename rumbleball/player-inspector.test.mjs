import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, confirmDraft, buyItem } from './career.mjs';
import { exportCareer } from './career-storage.mjs';
import { mountCareer } from './career-ui.mjs';
import { playerEquipment } from './player-equipment.mjs';
import { CATALOGUE } from './equipment.mjs';
import { environment, button, descendants } from './test-support/dom.mjs';

function screen(e, initial = true) {
  let wide = initial; const listeners = new Set();
  const media = { get matches() { return wide; }, addEventListener: (_, callback) => listeners.add(callback), removeEventListener: (_, callback) => listeners.delete(callback) };
  window.matchMedia = () => media;
  return { resize(value) { wide = value; for (const callback of [...listeners]) callback(); }, listeners };
}
const slot = (root, name) => root.querySelectorAll('.rb-body-slot').find(node => node.dataset.slot === name);
const card = (root, id, source = 'catalogue') => root.querySelectorAll('.rb-gear-card').find(node => node.dataset.itemId === id && node.dataset.source === source);
const activeTab = root => root.querySelectorAll('.rb-inspector-tabs').flatMap(node => node.querySelectorAll('button')).find(node => node.getAttribute('aria-selected') === 'true');
const player = { id: 'p', name: 'Nora', profile: 0, xp: 0, fatigue: 0, implant: 'legs' };
function career() { const c = createCareer('Les Onglets', 'inspector-tabs'); return confirmDraft(c, c.market.slice(0, 6).map(p => p.id)); }

test('fiche : trois onglets, clavier et sélection conservée entre deux joueurs', async () => {
  const c = career(); c.clubs[0].players[0].xp = 50;
  const e = environment(exportCareer(c)); screen(e); mountCareer(e.root, (await import('./ui.mjs')).mountMatch);
  const inspector = e.root.querySelector('.rb-player-inspector'), tabs = inspector.querySelector('.rb-inspector-tabs');
  const panels = inspector.querySelectorAll('.rb-inspector-panel'), overview = panels.find(panel => panel.dataset.panel === 'player'), progression = panels.find(panel => panel.dataset.panel === 'progression');
  assert.ok(overview.querySelectorAll('button').some(button => button.textContent.startsWith('Céder')));
  assert.ok(!progression.querySelectorAll('button').some(button => button.textContent.startsWith('Céder')));
  assert.equal(progression.getAttribute('tabindex'), '0');
  assert.ok(e.root.querySelectorAll('.rb-fatigue-value').every(value => value.textContent.startsWith('Fatigue ')));
  assert.equal(tabs.getAttribute('role'), 'tablist'); assert.equal(tabs.children.length, 3);
  assert.match(tabs.textContent, /Progression · 2/);
  await button(tabs, 'Équipement').click(); assert.equal(activeTab(e.root).textContent, 'Équipement');
  await button(tabs, 'Équipement').emit('keydown', { key: 'ArrowRight' });
  assert.match(activeTab(e.root).textContent, /Progression/); assert.equal(document.activeElement.getAttribute('aria-selected'), 'true');
  await e.root.querySelector('.rb-lineup-slots').children[1].click();
  assert.equal(activeTab(e.root).textContent, 'Progression');
  const current = activeTab(e.root); await current.emit('keydown', { key: 'Home' }); assert.equal(activeTab(e.root).textContent, 'Joueur');
  assert.ok(e.root.querySelector('.rb-player-tactics') ?? e.root.querySelector('.rb-tactical-player'));
});

test('bureau : survol sans achat, réserve et objet porté transférés au bon joueur', async () => {
  let c = career(); const [a, b] = c.clubs[0].players;
  c = buyItem(c, 'vest', a.id); c = buyItem(c, 'armor', b.id);
  const e = environment(exportCareer(c)), media = screen(e); mountCareer(e.root, (await import('./ui.mjs')).mountMatch);
  await button(e.root.querySelector('.rb-inspector-tabs'), 'Équipement').click(); await slot(e.root, 'torso').click();
  const dialog = e.root.querySelector('.rb-equipment-dialog'); assert.equal(dialog.open, true);
  assert.match(dialog.textContent, /Matériel du club/); assert.match(dialog.textContent, /Magasin/);
  await card(dialog, 'mesh_armor').emit('pointerenter');
  assert.match(dialog.querySelector('.rb-gear-preview').textContent, /aucune pénalité de vitesse/);
  assert.equal(button(dialog, 'Acheter et équiper · 450 chromas'), undefined); assert.equal(e.saved().balance, c.balance);
  await card(dialog, 'armor', 'owned').click();
  assert.match(dialog.querySelector('.rb-gear-preview').textContent, new RegExp(b.name));
  assert.equal(document.activeElement.textContent, 'Transférer et équiper');
  await button(dialog, 'Transférer et équiper').click();
  assert.equal(e.root.querySelector('.rb-equipment-dialog'), null); assert.equal(media.listeners.size, 0);
  const saved = e.saved(); assert.equal(saved.inventory.find(item => item.itemId === 'armor').playerId, a.id);
  assert.equal(saved.inventory.find(item => item.itemId === 'vest').playerId, null); assert.equal(saved.balance, c.balance);
  assert.equal(activeTab(e.root).textContent, 'Équipement');
});

test('bureau : achat dans la bonne main, clic répété ignoré et confirmation d’implant conservée', async () => {
  const e = environment(), media = screen(e), calls = [], root = playerEquipment({ players: [player], inventory: [], balance: 1000 }, player, { onBuy: (...args) => calls.push(args) }); e.root.append(root);
  await slot(root, 'leftHand').click(); let dialog = root.querySelector('.rb-equipment-dialog');
  await card(dialog, 'arc_tonfa').click(); const buy = button(dialog, 'Acheter et équiper · 400 chromas');
  await buy.click(); await buy.click(); assert.deepEqual(calls, [['arc_tonfa', player.id, false, 'leftHand']]); assert.equal(media.listeners.size, 0);
  await slot(root, 'implant').click(); dialog = root.querySelector('.rb-equipment-dialog'); await card(dialog, 'fibers').click();
  const implant = button(dialog, 'Acheter et équiper · 300 chromas'); assert.equal(implant.disabled, true);
  const check = dialog.querySelector('input'); check.checked = true; await check.emit('change'); await implant.click();
  assert.deepEqual(calls[1], ['fibers', player.id, true]); assert.equal(media.listeners.size, 0);
});

test('bureau verrouillé : consultation, Escape et retour du focus sans mutation', async () => {
  const e = environment(), media = screen(e), root = playerEquipment({ players: [player], inventory: [], balance: 1000 }, player, { locked: true, onBuy: () => assert.fail('Achat verrouillé') }); e.root.append(root);
  const trigger = slot(root, 'rightHand'); await trigger.click(); const dialog = root.querySelector('.rb-equipment-dialog');
  await card(dialog, 'tonfa').click(); assert.equal(button(dialog, 'Équiper gratuitement').disabled, true);
  await dialog.emit('cancel'); assert.equal(root.querySelector('.rb-equipment-dialog'), null); assert.equal(media.listeners.size, 0);
  assert.equal(document.activeElement === trigger, true);
});

test('mobile : choix en ligne conservé et fermeture propre au changement de largeur', async () => {
  const e = environment(), media = screen(e, false), calls = [], root = playerEquipment({ players: [player], inventory: [], balance: 1000 }, player, { onBuy: (...args) => calls.push(args) }); e.root.append(root);
  await slot(root, 'leftHand').click(); assert.equal(root.querySelector('.rb-equipment-dialog'), null);
  let select = root.querySelector('.rb-player-shop').querySelector('select'); select.value = 'tonfa'; await select.emit('change'); await button(root, 'Équiper gratuitement').click();
  assert.deepEqual(calls, [['tonfa', player.id, false, 'leftHand']]);
  media.resize(true); await slot(root, 'rightHand').click(); assert.equal(root.querySelector('.rb-equipment-dialog').open, true);
  media.resize(false); assert.equal(root.querySelector('.rb-equipment-dialog'), null); assert.equal(media.listeners.size, 0);
  select = root.querySelector('.rb-player-shop').querySelector('select'); assert.ok(select.children.every(option => CATALOGUE[option.value].slot === 'weapon'));
});

test('modale : fermeture si le joueur ou sa fiche est remplacé par un rafraîchissement', async t => {
  const e = environment(), media = screen(e); let refresh, disconnected = false;
  globalThis.MutationObserver = class { constructor(callback) { refresh = callback; } observe() {} disconnect() { disconnected = true; } };
  t.after(() => { delete globalThis.MutationObserver; });
  const root = playerEquipment({ players: [player], inventory: [], balance: 1000 }, player); e.root.append(root);
  const trigger = slot(root, 'torso'); await trigger.click(); assert.equal(root.querySelector('.rb-equipment-dialog').open, true);
  trigger.remove(); refresh(); assert.equal(root.querySelector('.rb-equipment-dialog'), null); assert.equal(disconnected, true); assert.equal(media.listeners.size, 0);
});
