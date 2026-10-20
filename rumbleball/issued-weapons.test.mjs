import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, confirmDraft, recruit, buyItem, assignProtection, launchCareerMatch } from './career.mjs';
import { CATALOGUE, equipmentAt, equippedItems, previewEquipment, isIssuedWeapon } from './equipment.mjs';
import { compilePlayer } from './progression.mjs';
import { exportCareer, importCareer, validateCareer } from './career-storage.mjs';
import { createLeague, joinLeague, editPreparation, leagueProjection } from './online/league.mjs';
import { startReadyLeague } from './test-support/online.mjs';
import { equipmentDialog } from './equipment-dialog.mjs';
import { environment, button } from './test-support/dom.mjs';

function club() {
  const base = createCareer('Les Armuriers', 'issued-weapons');
  const c = confirmDraft(base, base.market.slice(0, 8).map(p => p.id));
  c.balance += 3000; c.transactions.push({ id: 'grant', amount: 3000, balance: c.balance, label: 'Dotation de test' }); return c;
}
const current = (c, id) => c.clubs[0].players.find(p => p.id === id);

test('dotation par défaut : candidats, titulaires, banc, nouvelles recrues et bots', () => {
  let c = club(); c = recruit(c, c.market[0].id);
  for (const p of [...c.clubs.flatMap(club => club.players), ...c.market]) {
    const compiled = compilePlayer(p), main = equipmentAt(p, [], 'rightHand');
    assert.equal(main.itemId, compiled.archetype === 'belier' ? 'maul' : 'tonfa');
    assert.equal(compiled.weapon.id, main.itemId); assert.equal(compiled.visualGear.rightHand, main.itemId);
  }
  assert.deepEqual(c.inventory, []); assert.deepEqual(importCareer(exportCareer(c)), c);
});

test('vingt tonfas simultanés : même modèle aux deux mains de dix joueurs, aucun stock consommé', () => {
  let c = club(); c = recruit(c, c.market[0].id); c = recruit(c, c.market[0].id);
  const before = structuredClone(c);
  for (const p of before.clubs[0].players) for (const hand of ['rightHand', 'leftHand']) c = buyItem(c, 'tonfa', p.id, false, hand);
  for (const p of c.clubs[0].players) {
    assert.deepEqual(p.issuedWeapons, { rightHand: 'tonfa', leftHand: 'tonfa' });
    assert.equal(compilePlayer(p).offhandAttack.die, 6);
  }
  const otherPlayers = structuredClone(c.clubs[0].players.slice(1));
  c = buyItem(c, 'maul', c.lineup[0]);
  assert.deepEqual(c.clubs[0].players.slice(1), otherPlayers);
  assert.deepEqual(c.inventory, []); assert.equal(c.balance, before.balance); assert.deepEqual(c.transactions, before.transactions);
  assert.deepEqual(importCareer(exportCareer(c)), c);
});

test('main choisie : aucun transfert entre joueurs, choix identique idempotent et gestion verrouillée', () => {
  let c = club(); const [a, b] = c.clubs[0].players;
  c = buyItem(c, 'knuckles', a.id); const free = equipmentAt(current(c, a.id), c.inventory, 'rightHand');
  c = assignProtection(c, free.id, b.id, 'leftHand');
  assert.equal(equipmentAt(current(c, a.id), c.inventory, 'rightHand').itemId, 'knuckles');
  assert.equal(equipmentAt(current(c, b.id), c.inventory, 'leftHand').itemId, 'knuckles');
  const before = structuredClone(c); assert.deepEqual(buyItem(c, 'knuckles', b.id, false, 'leftHand'), before);
  assert.throws(() => assignProtection(c, free.id, null, 'feet'), /incompatible/);
  c = launchCareerMatch(c); assert.throws(() => buyItem(c, 'tonfa', a.id), /verrouillée/);
});

test('remplacement : les objets payants restent en réserve, la dotation ne donne jamais de chromas', () => {
  let c = club(); const id = c.lineup[0]; c = buyItem(c, 'arc_tonfa', id); c = buyItem(c, 'aegis_shield', id, false, 'leftHand');
  const balance = c.balance, transactions = structuredClone(c.transactions);
  c = buyItem(c, 'maul', id);
  assert.ok(c.inventory.every(item => item.playerId === null));
  assert.deepEqual(equippedItems(current(c, id), c.inventory).map(item => item.itemId), ['maul']);
  c = assignProtection(c, c.inventory[0].id, id, 'leftHand');
  assert.equal(equipmentAt(current(c, id), c.inventory, 'rightHand'), null);
  assert.equal(equipmentAt(current(c, id), c.inventory, 'leftHand').itemId, 'arc_tonfa');
  assert.equal(c.balance, balance); assert.deepEqual(c.transactions, transactions); validateCareer(c);
});

test('prévision : mains, CA et dégâts identiques à l’équipement effectivement choisi', () => {
  let c = club(); const id = c.lineup[0]; c = buyItem(c, 'maul', id);
  for (const [itemId, hand] of [['shield', 'leftHand'], ['tonfa', 'rightHand'], ['gravity_maul', 'leftHand']]) {
    const before = structuredClone(c), p = current(c, id), preview = previewEquipment(p, c.inventory, itemId, hand);
    const after = buyItem(c, itemId, id, false, hand), a = compilePlayer(preview.player, preview.inventory), b = compilePlayer(current(after, id), after.inventory);
    for (const key of ['weapon', 'attack', 'offhandAttack', 'armor', 'visualGear']) assert.deepEqual(a[key], b[key]);
    assert.deepEqual(c, before); c = after;
  }
});

test('bouclier seul : le marteau à deux mains est retiré et ne donne plus ses dégâts', () => {
  let c = club(); const p = c.clubs[0].players.find(p => p.profile === 1), base = compilePlayer(p);
  c = buyItem(c, 'shield', p.id, false, 'leftHand');
  const compiled = compilePlayer(current(c, p.id));
  assert.equal(compiled.visualGear.rightHand, null); assert.equal(compiled.visualGear.leftHand, 'shield');
  assert.equal(compiled.attack.die, 4); assert.equal(compiled.attack.count, undefined); assert.equal(compiled.armor, base.armor + 2);
  c = buyItem(c, 'maul', p.id); assert.equal(compilePlayer(current(c, p.id)).attack.count, 2);
  assert.equal(compilePlayer(current(c, p.id)).armor, base.armor);
});

test('ancienne sauvegarde : copies gratuites converties, réserve nettoyée et match figé conservé', () => {
  let c = launchCareerMatch(club()); const id = c.lineup[0], frozen = structuredClone(c.current);
  for (const p of [...c.clubs.flatMap(club => club.players), ...c.market]) delete p.issuedWeapons;
  c.inventory.push({ id: 'old-left', itemId: 'tonfa', playerId: id, location: 'leftHand' }, { id: 'old-right', itemId: 'shield', playerId: id, location: 'rightHand' }, { id: 'unused', itemId: 'maul', playerId: null });
  const json = exportCareer(c), loaded = importCareer(json);
  assert.deepEqual(current(loaded, id).issuedWeapons, { rightHand: 'shield', leftHand: 'tonfa' });
  assert.deepEqual(loaded.inventory, []); assert.deepEqual(loaded.current, frozen); assert.equal(exportCareer(c), json);
  assert.deepEqual(importCareer(exportCareer(loaded)), loaded);
});

test('validation : dotations falsifiées et collisions avec un objet acheté refusées', () => {
  const c = club(), id = c.lineup[0];
  for (const weapons of [null, [], { rightHand: 'gravity_maul', leftHand: null }, { rightHand: '__proto__', leftHand: null }, { rightHand: 'maul', leftHand: 'tonfa' }, { rightHand: 'shield', leftHand: 'shield' }, { rightHand: 'tonfa', leftHand: null, feet: 'tonfa' }]) {
    const bad = structuredClone(c); current(bad, id).issuedWeapons = weapons; assert.throws(() => validateCareer(bad), /invalide/);
  }
  const bad = structuredClone(c); bad.inventory.push({ id: 'collision', itemId: 'arc_tonfa', playerId: id, location: 'rightHand' });
  assert.throws(() => validateCareer(bad), /invalide/); validateCareer(c);
});

test('modale : dotation illimitée distincte du stock et choix équipé affiché dès l’ouverture', async () => {
  const e = environment(), c = club(), p = c.clubs[0].players[0], calls = [];
  const modal = equipmentDialog(e.root, { ...c.clubs[0], inventory: c.inventory, balance: c.balance }, p, 'rightHand', { onBuy: (...args) => calls.push(args) });
  const cards = e.root.querySelectorAll('.rb-gear-card');
  assert.equal(cards.filter(card => isIssuedWeapon(card.dataset.itemId)).length, 5);
  assert.ok(cards.filter(card => card.dataset.source === 'owned').every(card => CATALOGUE[card.dataset.itemId].price > 0));
  assert.match(e.root.textContent, /Dotation gratuite · illimitée/);
  assert.equal(button(e.root, 'Équiper gratuitement').disabled, true);
  await cards.find(card => card.dataset.itemId === 'maul').click();
  assert.equal(button(e.root, 'Équiper gratuitement').disabled, false);
  assert.match(e.root.textContent, /Aucun transfert nécessaire/);
  await button(e.root, 'Équiper gratuitement').click(); assert.deepEqual(calls, [['maul', p.id, false, 'rightHand']]); assert.equal(modal.visible, false);
});

test('multi : dotation personnelle par défaut, choix privés et annulation sans modifier les coéquipiers', () => {
  const now = '2026-10-20T10:00:00Z';
  let s = createLeague({ id: 'issued', userId: 'a', name: 'Ligue', clubName: 'Club A', seed: 'issued-online', inviteCode: 'a'.repeat(32) }, now);
  s = startReadyLeague(joinLeague(s, 'b', { clubName: 'Club B' }, now), 'a', now);
  const before = structuredClone(s), club = s.members[0].club, p = club.players[0];
  s = editPreparation(s, 'a', 'buy', { itemId: 'tonfa', playerId: p.id, location: 'leftHand' }, now);
  assert.deepEqual(s.members[0].draft.inventory, []); assert.deepEqual(s.members[0].draft.players.slice(1), club.players.slice(1));
  assert.deepEqual(s.members[0].draft.transactions, club.transactions); assert.equal(s.members[0].draft.balance, club.balance);
  const projected = leagueProjection(s, 'a', now).club;
  assert.equal(projected.players[0].issuedWeapons.leftHand, 'tonfa');
  assert.deepEqual(editPreparation(s, 'a', 'cancel', {}, now), before);
});
