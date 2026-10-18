import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from './engine.mjs';
import { deploymentEditor, PLAYER_DRAG_TYPE } from './deployment-ui.mjs';
import { environment, button } from './test-support/dom.mjs';
import { playerShop } from './player-shop.mjs';
import { portraitById } from './identity.mjs';

const transfer = id => ({ types: [PLAYER_DRAG_TYPE], getData: type => type === PLAYER_DRAG_TYPE ? id : '', setData() {} });
const cell = (root, x, y) => root.querySelectorAll('.rb-deployment-cell').find(n => n.dataset.cell === `${x},${y}`);

test('préparation : portraits en bulles, sélection sans déplacement et cinq positions uniques après dépôt', async () => {
  environment(); const players = createMatch().players.slice(0, 5), selected = [], drops = [], changes = [];
  players.forEach((player, index) => { player.portraitId = `p0${index + 1}`; });
  const editor = deploymentEditor({ players, interactivePlayers: true, onSelect: id => selected.push(id), onChange: value => changes.push(value), onDropPlayer: (id, position) => drops.push({ id, position }) });
  const initial = editor.value;
  assert.equal(editor.root.querySelectorAll('.rb-deployment-portrait').length, 5); assert.equal(editor.root.querySelector('.rb-player-portrait'), null);
  const avatar = cell(editor.root, initial[1].x, initial[1].y).querySelector('.rb-deployment-portrait');
  assert.equal(avatar.querySelector('img').src, portraitById(players[1].portraitId).thumb); assert.equal(avatar.querySelector('.rb-deployment-number').textContent, '2');
  await avatar.querySelector('img').emit('error'); assert.equal(avatar.querySelector('img').hidden, true); assert.ok(avatar.querySelector('.rb-deployment-initials').textContent);
  await cell(editor.root, initial[1].x, initial[1].y).click();
  assert.equal(selected.at(-1), players[1].id); assert.deepEqual(editor.value, initial);
  await cell(editor.root, 0, 0).emit('drop', { dataTransfer: transfer(players[1].id) });
  assert.deepEqual(editor.value[1], { x: 0, y: 0 }); assert.equal(changes.length, 1);
  assert.equal(cell(editor.root, 0, 0).querySelector('.rb-deployment-portrait').querySelector('img').src, portraitById(players[1].portraitId).thumb);
  const target = editor.value[2]; await cell(editor.root, target.x, target.y).emit('drop', { dataTransfer: transfer(players[1].id) });
  assert.deepEqual(editor.value[1], target); assert.deepEqual(editor.value[2], { x: 0, y: 0 });
  assert.equal(new Set(editor.value.map(p => `${p.x},${p.y}`)).size, 5);
  await cell(editor.root, 1, 1).emit('drop', { dataTransfer: transfer('reserve-id') });
  assert.deepEqual(drops, [{ id: 'reserve-id', position: { x: 1, y: 1 } }]);
  const frozen = editor.value; editor.update({ disabled: true });
  await cell(editor.root, 2, 2).emit('drop', { dataTransfer: transfer(players[0].id) });
  assert.deepEqual(editor.value, frozen); assert.equal(changes.length, 2);
});

test('fiche joueur : aperçu du matériel, achat au bon joueur, remplacement explicite et verrouillage', async () => {
  const e = environment(), player = { id: 'p', name: 'Nora', profile: 0, xp: 0, fatigue: 0, implant: 'legs' }, purchases = [];
  const club = { balance: 1000, inventory: [] };
  const shop = playerShop(club, player, { onBuy: (...args) => purchases.push(args) }); e.root.append(shop);
  await button(shop, 'Acheter et équiper · 100 chromas').click(); assert.deepEqual(purchases[0], ['vest', player.id, false]);
  const choice = shop.querySelector('select'); choice.value = 'fibers'; await choice.emit('change');
  const buy = button(shop, 'Acheter et équiper · 300 chromas'); assert.equal(buy.disabled, true);
  const checkbox = shop.querySelector('input'); checkbox.checked = true; await checkbox.emit('change'); await buy.click();
  assert.deepEqual(purchases[1], ['fibers', player.id, true]);
  const locked = playerShop(club, player, { locked: true, onBuy: () => assert.fail('Achat verrouillé') });
  assert.equal(button(locked, 'Acheter et équiper · 100 chromas').disabled, true);
  const equipped = playerShop({ ...club, inventory: [{ itemId: 'vest', playerId: player.id }] }, player, { onBuy: () => assert.fail('Équipement déjà porté') });
  assert.equal(button(equipped, 'Acheter et équiper · 100 chromas').disabled, true);
  assert.match(equipped.textContent, /Cet équipement est déjà porté/);
});
