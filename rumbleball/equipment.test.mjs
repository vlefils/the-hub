import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CATALOGUE, EQUIPMENT_SLOTS, equipmentAt, validEquipmentInventory } from './equipment.mjs';
import { compilePlayer } from './progression.mjs';
import { createCareer, confirmDraft, buyItem, assignProtection, sellProtection, sellPlayer, launchCareerMatch, saveCareerTurn } from './career.mjs';
import { exportCareer, importCareer, validateCareer } from './career-storage.mjs';
import { createMatch, stepMatch, simulateMatch } from './engine.mjs';
import { performAttack, beginTurn } from './rules.mjs';
import { defensiveForecast } from './evasion.mjs';
import { playerEquipment } from './player-equipment.mjs';
import { mountCareer } from './career-ui.mjs';
import { environment, button, descendants } from './test-support/dom.mjs';
import { pawnArtwork } from './visuals.mjs';

function club() {
  let c = createCareer('Les Armuriers', 'equipment-tests'); c = confirmDraft(c, c.market.slice(0, 6).map(p => p.id));
  c.balance += 3000; c.transactions.push({ id: 'test-budget', amount: 3000, label: 'Dotation de test', balance: c.balance }); return c;
}
const player = (profile = 1) => ({ id: 'p', name: 'Chrome', profile, xp: 0, fatigue: 0, role: 'blocker', instruction: 'aggressive', implant: null,
  abilities: { strength: 15, dexterity: 13, constitution: 14, mind: 8, charisma: 9 }, advancements: [] });
const gear = (itemId, location = undefined, id = itemId) => ({ id, itemId, playerId: 'p', ...(location ? { location } : {}) });
const slotButton = (root, slot) => root.querySelectorAll('.rb-body-slot').find(node => node.dataset.slot === slot);

test('pièces : torse, tête, gants, bottes et implant coexistent sans ajouter de PV', () => {
  let c = club(); const p = c.clubs[0].players[0], base = compilePlayer(p);
  for (const id of ['armor', 'helmet', 'gloves', 'soles', 'legs']) c = buyItem(c, id, p.id);
  const compiled = compilePlayer(c.clubs[0].players[0], c.inventory);
  assert.equal(compiled.maxHp, base.maxHp); assert.equal(compiled.armor, base.armor + 3); assert.equal(compiled.speed, base.speed);
  assert.equal(compiled.skills.wrestling, base.skills.wrestling + 1); assert.equal(compiled.skills.acrobatics, base.skills.acrobatics + 1);
  assert.equal(c.inventory.filter(item => item.playerId === p.id).length, 4); assert.equal(compiled.visualGear.head, 'helmet'); assert.equal(compiled.visualGear.feet, 'soles');
  c = buyItem(c, 'vest', p.id); assert.equal(c.inventory[0].playerId, null);
  assert.equal(equipmentAt(p, c.inventory, 'gloves').itemId, 'gloves'); assert.equal(equipmentAt(p, c.inventory, 'feet').itemId, 'soles');
  assert.equal(compilePlayer(p, c.inventory).armor, base.armor + 2); validateCareer(c);
});

test('armes : main gauche ou droite, finesse et Force, dés propres et polyvalence', () => {
  const p = player(), base = compilePlayer(p), tonfa = compilePlayer(p, [gear('tonfa', 'leftHand')]);
  assert.deepEqual(tonfa.attack, { bonus: 4, die: 6, flat: 2 }); assert.equal(tonfa.weapon.location, 'leftHand'); assert.equal(tonfa.weapon.name, 'Tonfa d’arène');
  const bat = compilePlayer(p, [gear('bat', 'rightHand')]); assert.equal(bat.attack.die, 10);
  const guarded = compilePlayer(p, [gear('bat', 'rightHand'), gear('shield', 'leftHand')]); assert.equal(guarded.attack.die, 8); assert.equal(guarded.armor, base.armor + 1);
  const runner = { ...player(2), abilities: { strength: 8, dexterity: 15, constitution: 13, mind: 14, charisma: 9 } };
  assert.deepEqual(compilePlayer(runner, [gear('tonfa')]).attack, { bonus: 4, die: 6, flat: 2 });
  assert.deepEqual(compilePlayer(runner, [gear('maul')]).attack, { bonus: 1, die: 10, flat: -1 });
  assert.deepEqual(compilePlayer(p), base);
});

test('dotation : cinq armes gratuites, réutilisation des réserves et aucune création de chromas', () => {
  let c = club(); const p = c.clubs[0].players[0], before = structuredClone(c), balance = c.balance;
  for (const id of ['knuckles', 'tonfa', 'bat', 'maul', 'shield']) { c = buyItem(c, id, p.id); assert.equal(c.balance, balance); }
  for (let i = 0; i < 8; i++) for (const id of ['tonfa', 'maul', 'shield']) c = buyItem(c, id, p.id);
  assert.equal(c.inventory.length, 5); assert.deepEqual(before.inventory, []);
  c = buyItem(c, 'tonfa', p.id, false, 'leftHand');
  const count = c.inventory.length; c = buyItem(c, 'tonfa', p.id, false, 'leftHand'); assert.equal(c.inventory.length, count);
  c = buyItem(c, 'tonfa', p.id, false, 'rightHand');
  assert.equal(c.inventory.filter(item => item.playerId === p.id && item.itemId === 'tonfa').length, 2);
  for (const item of [...c.inventory]) c = sellProtection(c, item.id);
  assert.equal(c.balance, balance); assert.deepEqual(importCareer(exportCareer(c)), c);
  const debt = { ...c, balance: -25 }, free = buyItem(debt, 'tonfa', p.id);
  assert.equal(free.balance, -25); assert.throws(() => buyItem(debt, 'arc_tonfa', p.id), /impayés/);
  assert.throws(() => buyItem(c, 'tonfa'), /joueur/); assert.deepEqual(c.lineup, before.lineup);
});

test('armes avancées : bonus propres à chaque main, polyvalence et marteau à deux mains', () => {
  const p = player(), base = compilePlayer(p, [gear('tonfa')]);
  const dual = compilePlayer(p, [gear('arc_tonfa', 'rightHand'), gear('ghost_baton', 'leftHand')]);
  assert.deepEqual(dual.attack, { bonus: base.attack.bonus + 1, die: 6, flat: base.attack.flat + 1 });
  assert.deepEqual(dual.offhandAttack, { bonus: base.attack.bonus + 2, die: 6, flat: 2 });
  const weak = { ...p, abilities: { strength: 8, dexterity: 8, constitution: 15, mind: 15, charisma: 13 } };
  assert.deepEqual(compilePlayer(weak, [gear('arc_tonfa', 'rightHand'), gear('ghost_baton', 'leftHand')]).offhandAttack, { bonus: 3, die: 6, flat: 1 });
  const bat = compilePlayer(p, [gear('shock_bat')]), shielded = compilePlayer(p, [gear('shock_bat'), gear('aegis_shield', 'leftHand')]);
  assert.equal(bat.attack.die, 10); assert.equal(shielded.attack.die, 8); assert.equal(shielded.armor, base.armor + 2);
  let c = club(); const id = c.lineup[0]; c = buyItem(c, 'aegis_shield', id, false, 'leftHand'); c = buyItem(c, 'gravity_maul', id);
  const heavy = compilePlayer(c.clubs[0].players[0], c.inventory); assert.equal(heavy.attack.die, 12); assert.equal(heavy.offhandAttack, null);
  assert.equal(equipmentAt({ id }, c.inventory, 'leftHand').itemId, 'gravity_maul'); assert.equal(heavy.armor, compilePlayer(c.clubs[0].players[0]).armor);
  validateCareer(c); assert.deepEqual(importCareer(exportCareer(c)), c);
});

test('protections avancées : CA sans PV, compromis de mobilité et implant remplaçable', () => {
  let c = club(); const p = c.clubs[0].players[0], base = compilePlayer(p);
  for (const id of ['optic_visor', 'bulwark_armor', 'grapple_gloves', 'sprint_boots', 'kinetic_implant']) c = buyItem(c, id, p.id);
  const geared = compilePlayer(c.clubs[0].players[0], c.inventory);
  assert.equal(geared.maxHp, base.maxHp); assert.equal(geared.armor, base.armor + 4); assert.equal(geared.speed, base.speed + 1.5);
  assert.equal(geared.skills.wrestling, base.skills.wrestling + 3); assert.equal(geared.skills.acrobatics, base.skills.acrobatics + 1);
  assert.throws(() => buyItem(c, 'reflex_implant', p.id), /détruit/);
  c = buyItem(c, 'reflex_implant', p.id, true); const reflex = compilePlayer(c.clubs[0].players[0], c.inventory);
  assert.equal(reflex.armor, geared.armor + 1); assert.equal(reflex.speed, base.speed); assert.equal(reflex.skills.wrestling, geared.skills.wrestling - 1);
  const boots = c.inventory.find(item => item.itemId === 'sprint_boots'), balance = c.balance;
  c = sellProtection(c, boots.id); assert.equal(c.balance, balance + 200); assert.deepEqual(importCareer(exportCareer(c)), c);
  validateCareer(c);
});

test('magasin : dotation accessible sans budget, aperçu du modèle avancé et achat à la bonne main', async () => {
  const e = environment(), p = player(), calls = [], root = playerEquipment({ players: [p], inventory: [], balance: -20 }, p, { onBuy: (...args) => calls.push(args) }); e.root.append(root);
  await slotButton(root, 'leftHand').click();
  const choice = root.querySelector('.rb-player-shop').querySelector('select'); choice.value = 'tonfa'; await choice.emit('change');
  assert.equal(button(root, 'Équiper gratuitement').disabled, false); assert.match(root.textContent, /Contondant · non létal/);
  await button(root, 'Équiper gratuitement').click(); assert.deepEqual(calls, [['tonfa', p.id, false, 'leftHand']]);
  choice.value = 'arc_tonfa'; await choice.emit('change');
  assert.equal(button(root, 'Acheter et équiper · 400 chromas').disabled, true); assert.match(root.textContent, /salaires impayés/);
  assert.match(root.textContent, /Tonfa Arc/); assert.match(root.querySelector('.rb-stat-comparison').textContent, /Attaque/);
});

test('deux armes : attaque secondaire uniquement avec deux armes légères, sans modificateur positif aux dégâts', () => {
  const p = player();
  const dual = compilePlayer(p, [gear('tonfa', 'rightHand'), gear('knuckles', 'leftHand')]);
  assert.deepEqual(dual.offhandAttack, { bonus: 4, die: 4, flat: 0 });
  assert.equal(compilePlayer(p, [gear('bat', 'rightHand'), gear('tonfa', 'leftHand')]).offhandAttack, null);
  assert.equal(compilePlayer(p, [gear('tonfa', 'rightHand'), gear('shield', 'leftHand')]).offhandAttack, null);
  assert.equal(compilePlayer(p, [gear('tonfa', 'leftHand')]).offhandAttack, null);
});

test('deux mains : remplacement et retrait libèrent les deux mains sans détruire le matériel', () => {
  let c = club(); const p = c.clubs[0].players[0]; c = buyItem(c, 'tonfa', p.id, false, 'rightHand'); c = buyItem(c, 'shield', p.id, false, 'leftHand');
  const first = structuredClone(c); c = buyItem(c, 'maul', p.id, false, 'leftHand');
  assert.equal(c.inventory[0].playerId, null); assert.equal(c.inventory[1].playerId, null);
  assert.equal(equipmentAt(p, c.inventory, 'rightHand').itemId, 'maul'); assert.equal(equipmentAt(p, c.inventory, 'leftHand').itemId, 'maul');
  assert.equal(compilePlayer(p, c.inventory).attack.die, 10); assert.equal(c.inventory.filter(item => item.playerId === p.id).length, 1);
  c = assignProtection(c, c.inventory[0].id, p.id, 'rightHand'); assert.equal(c.inventory[2].playerId, null);
  assert.equal(equipmentAt(p, c.inventory, 'leftHand'), null); assert.equal(equipmentAt(p, c.inventory, 'rightHand').itemId, 'tonfa');
  assert.equal(first.inventory[0].playerId, p.id); assert.equal(first.inventory[1].playerId, p.id); validateCareer(c);
});

test('transferts : déplacer une arme entre mains ou joueurs ne duplique pas ses bonus ; bouclier unique', () => {
  let c = club(); const [a, b] = c.clubs[0].players; c = buyItem(c, 'tonfa', a.id, false, 'rightHand'); const id = c.inventory[0].id, balance = c.balance;
  c = assignProtection(c, id, a.id, 'leftHand'); assert.equal(equipmentAt(a, c.inventory, 'rightHand'), null); assert.equal(equipmentAt(a, c.inventory, 'leftHand').id, id);
  c = assignProtection(c, id, b.id, 'rightHand'); assert.equal(equipmentAt(a, c.inventory, 'leftHand'), null); assert.equal(equipmentAt(b, c.inventory, 'rightHand').id, id); assert.equal(c.balance, balance);
  c = buyItem(c, 'shield', b.id, false, 'leftHand'); c = buyItem(c, 'shield', b.id, false, 'rightHand');
  assert.equal(c.inventory.filter(item => item.playerId === b.id && item.itemId === 'shield').length, 1);
  const equipped = c.inventory.find(item => item.playerId === b.id), before = c.balance;
  c = sellProtection(c, equipped.id); assert.equal(c.balance, before + CATALOGUE[equipped.itemId].price / 2);
  c = sellPlayer(c, b.id); assert.ok(c.inventory.every(item => item.playerId !== b.id)); validateCareer(c);
});

test('validation : refuse collisions de slots, deux boucliers, objets inconnus et emplacements incompatibles', () => {
  for (const inventory of [[gear('armor'), gear('vest')], [gear('maul'), gear('tonfa', 'leftHand')], [gear('shield', 'rightHand'), gear('shield', 'leftHand', 'second')], [gear('helmet', 'leftHand')], [gear('tonfa', 'feet')], [gear('legs')], [gear('unknown')], [gear('__proto__')], [gear('constructor')], [gear(['vest'])], [{ ...gear('tonfa'), playerId: 'intruder' }]]) assert.equal(validEquipmentInventory(inventory, ['p']), false);
  assert.equal(validEquipmentInventory([gear('vest'), gear('gloves'), gear('soles'), gear('helmet'), gear('tonfa', 'rightHand'), gear('knuckles', 'leftHand')], ['p']), true);
  const c = club(), p = c.clubs[0].players[0], original = structuredClone(c);
  assert.throws(() => buyItem(c, 'tonfa', p.id, false, 'head'), /incompatible/); assert.throws(() => buyItem(c, 'helmet', p.id, false, 'leftHand'), /incompatible/);
  assert.throws(() => buyItem(c, 'tonfa', 'intruder'), /inconnu/); assert.deepEqual(c, original);
  for (const id of ['__proto__', 'constructor', ['vest'], null]) assert.throws(() => buyItem(c, id, p.id), /inconnu/);
});

test('sauvegardes : ancien matériel localisé sans modification, double arme figée et reprise identique', () => {
  let c = club(), p = c.clubs[0].players[0]; c = buyItem(c, 'gloves', p.id); const old = structuredClone(c);
  assert.deepEqual(importCareer(exportCareer(old)), old); assert.equal(equipmentAt(p, c.inventory, 'gloves').itemId, 'gloves');
  c = buyItem(c, 'tonfa', p.id, false, 'rightHand'); c = buyItem(c, 'knuckles', p.id, false, 'leftHand'); c = launchCareerMatch(c);
  assert.ok(c.current.config.rosters.home[0].offhandAttack); const step = stepMatch(c.current.state); c = saveCareerTurn(c, step.state, step.events);
  const saved = importCareer(exportCareer(c)); assert.deepEqual(saved, c); assert.deepEqual(stepMatch(saved.current.state), stepMatch(c.current.state));
  const bad = structuredClone(c); bad.inventory.push({ id: 'collision', itemId: 'maul', playerId: p.id, location: 'leftHand' }); assert.throws(() => validateCareer(bad), /invalide/);
});

test('combat : une seule attaque secondaire en action bonus, jamais après une simple réaction', () => {
  const p = compilePlayer(player(), [gear('tonfa', 'rightHand'), gear('knuckles', 'leftHand')]), state = createMatch({ rosters: { home: Array(5).fill(p) } });
  for (const [i, other] of state.players.entries()) other.position = { x: i < 5 ? 0 : 11, y: i % 5 };
  const actor = state.players[0], target = state.players[5], events = []; actor.position = { x: 3, y: 3 }; target.position = { x: 4, y: 3 }; target.maxHp = target.hp = 100; target.armor = 0;
  assert.equal(performAttack(state, actor, target, events, null, null, true), false);
  assert.equal(performAttack(state, actor, target, events), true); assert.equal(actor.offhandReady, true);
  assert.equal(performAttack(state, actor, target, events, null, null, true), true); assert.equal(actor.bonusAction, false); assert.equal(actor.offhandReady, false);
  assert.equal(performAttack(state, actor, target, events, null, null, true), false); assert.equal(events.filter(event => event.type === 'attack').length, 2);
  assert.equal(events.filter(event => event.offhand).length, 1);
  beginTurn(state, actor, []); actor.reaction = true; target.movement = target.speed;
  assert.equal(performAttack(state, actor, target, [], { from: { x: 4, y: 3 }, to: { x: 5, y: 3 } }), true);
  assert.equal(actor.offhandReady, false); assert.equal(performAttack(state, actor, target, [], null, null, true), false);
});

test('bots : deux armes légères utilisent réellement le bonus et le danger prévisionnel inclut les deux', () => {
  const p = compilePlayer({ ...player(2), role: 'blocker' }, [gear('tonfa', 'rightHand'), gear('knuckles', 'leftHand')]);
  const state = createMatch({ seed: 'dual-bot', rosters: { home: [p, ...Array(4).fill(compilePlayer(player()))] } }), actor = state.players[0], target = state.players[5];
  state.initiative = [actor.id, ...state.initiative.filter(id => id !== actor.id)]; state.turnIndex = 0;
  for (const [i, other] of state.players.entries()) other.position = { x: i < 5 ? 0 : 11, y: i % 5 };
  actor.position = { x: 3, y: 3 }; target.position = { x: 4, y: 3 }; target.maxHp = target.hp = 100;
  state.ball.carrierId = target.id; state.ball.position = { ...target.position };
  const step = stepMatch(state); assert.equal(step.events.filter(event => event.type === 'attack' && event.playerId === actor.id).length, 2);
  const dualRisk = defensiveForecast(state, target).risk(target, target.position, false, 11, true);
  const single = structuredClone(state); single.players[0].offhandAttack = null;
  assert.ok(dualRisk.damage > defensiveForecast(single, single.players[5]).risk(single.players[5], target.position, false, 11, true).damage);
});

test('écran : même corps pour tous, sept slots accessibles et magasin filtré par emplacement', async () => {
  const e = environment(), p = player(), c = { players: [p], inventory: [], balance: 1000 }, calls = [];
  const panel = playerEquipment(c, p, { onBuy: (...args) => calls.push(args) }); e.root.append(panel);
  assert.equal(panel.querySelectorAll('.rb-body-slot').length, 7); assert.deepEqual(panel.querySelectorAll('.rb-body-slot').map(node => node.dataset.slot), Object.keys(EQUIPMENT_SLOTS));
  const another = playerEquipment(c, { ...p, name: 'Autre', portraitId: 'p02' }); assert.equal(panel.querySelector('.rb-equipment-body').src, another.querySelector('.rb-equipment-body').src);
  assert.match(await readFile(new URL(panel.querySelector('.rb-equipment-body').src), 'utf8'), /viewBox="0 0 240 520"/);
  await slotButton(panel, 'leftHand').click(); assert.equal(document.activeElement, slotButton(panel, 'leftHand'));
  const choice = panel.querySelector('.rb-player-shop').querySelector('select'); assert.ok(choice.children.every(option => CATALOGUE[option.value].slot === 'weapon'));
  choice.value = 'tonfa'; await choice.emit('change'); await button(panel, 'Équiper gratuitement').click(); assert.deepEqual(calls, [['tonfa', p.id, false, 'leftHand']]);
  await slotButton(panel, 'feet').click(); assert.ok(panel.querySelector('.rb-player-shop').querySelector('select').children.every(option => CATALOGUE[option.value].location === 'feet'));
  const context = panel.querySelector('.rb-equipment-context'); assert.ok(context.children.indexOf(context.querySelector('.rb-player-inventory')) < context.children.indexOf(context.querySelector('.rb-player-shop')));
});

test('UI solo : armer un remplaçant à gauche conserve la sélection, les titulaires et la sauvegarde', async () => {
  const c = club(), reserve = c.clubs[0].players[5], e = environment(exportCareer(c)), { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  await button(e.root, reserve.name).click(); await slotButton(e.root, 'leftHand').click();
  const choice = e.root.querySelector('.rb-player-shop').querySelector('select'); choice.value = 'tonfa'; await choice.emit('change'); await button(e.root, 'Équiper gratuitement').click();
  assert.equal(slotButton(e.root, 'leftHand').getAttribute('aria-pressed'), 'true'); assert.equal(e.saved().inventory[0].location, 'leftHand'); assert.equal(e.saved().inventory[0].playerId, reserve.id);
  assert.deepEqual(e.saved().lineup, c.lineup); assert.match(e.root.querySelector('.rb-player-inspector').textContent, new RegExp(reserve.name));
  const restored = environment(e.storage.getItem('the-hub.rumbleball.career.v1')); mountCareer(restored.root, mountMatch); await button(restored.root, reserve.name).click(); assert.match(slotButton(restored.root, 'leftHand').textContent, /Tonfa/);
});

test('lecture seule : les slots restent consultables, achats et transferts bloqués', async () => {
  const e = environment(), p = player(), inventory = [gear('vest')], root = playerEquipment({ players: [p], inventory, balance: 1000 }, p, { locked: true, onBuy: () => assert.fail('Achat verrouillé'), onAssign: () => assert.fail('Transfert verrouillé') }); e.root.append(root);
  assert.equal(root.querySelectorAll('.rb-body-slot').every(node => !node.disabled), true);
  assert.equal(root.querySelectorAll('select').every(node => node.disabled), true); assert.equal(button(root, 'Acheter et équiper · 100 chromas').disabled, true);
  await slotButton(root, 'rightHand').click(); assert.equal(root.querySelectorAll('select').every(node => node.disabled), true);
  assert.equal(descendants(root).filter(node => node.tagName === 'button' && node.textContent.startsWith('Acheter et équiper')).every(node => node.disabled), true);
  const art = pawnArtwork(compilePlayer(p, [gear('helmet'), gear('tonfa', 'rightHand'), gear('shield', 'leftHand')])); assert.ok(art.querySelectorAll('.rb-person-weapon').some(node => node.getAttribute('data-weapon') === 'shield'));
});
