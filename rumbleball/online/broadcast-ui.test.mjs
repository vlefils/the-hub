import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, descendants, button } from '../test-support/dom.mjs';
import { mountOnline } from './ui.mjs';
import { createLeague, joinLeague, startLeague, editPreparation, advanceLeague } from './league.mjs';
import { createLeagueService } from './server.mjs';
import { PLAYER_DRAG_TYPE } from '../deployment-ui.mjs';

async function online(t, lobby = false, capacity = 2) {
  const e = environment(); globalThis.location = new URL('http://127.0.0.1:8767/rumbleball/multi.html');
  let clock = '2026-10-18T10:00:00Z', revision = 1, serial = 0, fail = false;
  const pending = new Map(); t.mock.method(Date, 'now', () => Date.parse(clock));
  t.mock.method(globalThis, 'setTimeout', fn => { pending.set(++serial, fn); return serial; }); t.mock.method(globalThis, 'clearTimeout', id => pending.delete(id));
  let state = createLeague({ id: 'league', userId: 'a', name: 'Ligue', clubName: 'Chromes', seed: 'broadcast-ui', inviteCode: 'a'.repeat(32), capacity }, clock);
  for (let i = 1; i < capacity; i++) state = joinLeague(state, String.fromCharCode(97 + i), { clubName: `Adversaires ${i}` }, clock); if (!lobby) state = startLeague(state, 'a', clock);
  const store = { async get() { return { id: state.id, revision, state: structuredClone(state) }; }, async list() { return [{ id: state.id, name: state.name, members: capacity, capacity }]; }, async commit(id, expected, next) { assert.equal(expected, revision); state = next; return ++revision; } };
  const service = createLeagueService(store, { now: () => clock });
  const mounted = await mountOnline(e.root, { enabled: true }, async () => ({ auth: { async getSession() { return { data: { session: { user: { id: 'a', email: 'test@example.invalid' } } } }; }, onAuthStateChange() {} }, request(action, leagueId, payload) { if (fail && action === 'configure') { fail = false; throw Error('Connexion interrompue'); } return service.command('a', { action, leagueId, payload }); } }));
  await button(e.root, `Ligue · ${capacity}/${capacity} clubs`).click();
  const strategy = () => descendants(e.root.querySelector('.rb-online-body')).find(n => n.tagName === 'select' && n.children.some(o => o.value === 'possession'));
  const poll = async () => { const [id, fn] = [...pending][0]; pending.delete(id); await fn(); };
  return { ...e, mounted, strategy, state: () => state, poll, remoteChange() { state = editPreparation(state, 'b', 'color', { color: '#aabbcc' }, clock); revision++; }, failNext() { fail = true; }, async lock() { clock = state.nextLockAt; await poll(); }, async finishNight() { state = advanceLeague(state, state.nextLockAt); clock = state.night.endsAt; state = advanceLeague(state, clock); revision++; await poll(); } };
}

test('broadcast : une saisie survit aux onglets, à un achat et à une erreur réseau ; annulation complète', async t => {
  const e = await online(t), base = e.state().members[0].club;
  assert.deepEqual(e.root.querySelector('.rb-workspace-navigation').children.map(n => n.textContent), ['Club', 'Ligue']);
  e.strategy().value = 'possession'; await e.strategy().emit('input');
  assert.equal(button(e.root, 'Enregistrer la préparation').disabled, false);
  await button(e.root, 'Ligue').click(); await button(e.root, 'Club').click();
  await button(e.root.querySelector('.rb-player-inspector'), 'Acheter et équiper · 100 chromas').click();
  assert.equal(e.strategy().value, 'possession'); assert.equal(e.state().members[0].draft.balance, base.balance - 100);
  e.failNext(); await e.root.querySelector('form').emit('submit'); assert.match(e.root.textContent, /Connexion interrompue/); assert.equal(e.strategy().value, 'possession'); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, false);
  await e.root.querySelector('form').emit('submit'); assert.equal(e.state().members[0].draft.strategy, 'possession'); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, true);
  await button(e.root, 'Annuler la préparation').click(); assert.equal(e.state().members[0].draft, null); assert.equal(e.strategy().value, base.strategy); assert.equal(e.state().members[0].club.balance, base.balance); e.mounted.stop();
});

test('classement : quatre places signalées sur six et légende sous la table dans Ligue', async t => {
  const e = await online(t, false, 6);
  await button(e.root, 'Ligue').click(); assert.equal(e.root.querySelectorAll('.rb-playoff-qualifier').length, 4);
  const legend = e.root.querySelector('.rb-qualification-legend'); assert.equal(legend.textContent, 'Les 4 premières équipes se qualifient pour les playoffs.');
  const siblings = legend.parentNode.children; assert.equal(siblings[siblings.indexOf(legend) - 1].classList.contains('rb-table-scroll'), true); e.mounted.stop();
});

test('playoffs UI : finale après le groupe puis champion et arbre conservés à la nouvelle saison', async t => {
  const e = await online(t); await e.finishNight(); await e.finishNight();
  await button(e.root, 'Ligue').click(); assert.match(e.root.textContent, /Finale/); assert.ok(e.root.querySelector('.rb-playoff-tree'));
  assert.equal(e.state().season, 1); assert.equal(e.state().phase, 'playoffs');
  await e.finishNight(); assert.equal(e.state().season, 2); assert.match(e.root.textContent, /Champion de la saison 1/);
  assert.ok(e.root.querySelector('.rb-playoff-tree')); e.mounted.stop();
});

test('broadcast : 20 h écarte la saisie non enregistrée, avertit et laisse les détails consultables', async t => {
  const e = await online(t), original = e.strategy().value;
  e.strategy().value = 'possession'; await e.strategy().emit('change'); await e.lock();
  assert.match(e.root.textContent, /modifications non enregistrées n’ont pas été retenues/); assert.equal(e.strategy().value, original); assert.equal(e.strategy().disabled, true);
  const player = e.state().members[0].club.players.find(p => p.id === e.state().members[0].club.lineup[1]);
  const details = descendants(e.root).find(n => n.getAttribute('aria-label') === `Détails de ${player.name}`); assert.equal(details.disabled, undefined); await details.parentNode.click();
  assert.match(e.root.querySelector('.rb-squad-detail').textContent, new RegExp(player.name)); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, true); e.mounted.stop();
});

test('broadcast : enregistrer libère le rafraîchissement du lobby sans réactiver une ancienne saisie', async t => {
  const e = await online(t, true); e.strategy().value = 'possession'; await e.strategy().emit('change'); await e.root.querySelector('form').emit('submit');
  const savedForm = e.root.querySelector('form'); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, true);
  e.remoteChange(); await e.poll(); assert.equal(e.root.contains(savedForm), false); assert.equal(e.strategy().value, 'possession'); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, true); e.mounted.stop();
});

test('équipement : joueur conservé après achat et transfert, réserve lisible et verrouillage respecté', async t => {
  const e = await online(t), target = e.state().members[0].club.players[1].id;
  await descendants(e.root).find(n => n.getAttribute('aria-label') === `Détails de ${e.state().members[0].club.players[1].name}`).click();
  await button(e.root.querySelector('.rb-player-inspector'), 'Acheter et équiper · 100 chromas').click();
  assert.match(e.root.querySelector('.rb-player-inspector').querySelector('.rb-player-shop').querySelector('select').getAttribute('aria-label'), new RegExp(e.state().members[0].club.players[1].name));
  const slots = e.root.querySelector('.rb-body-slots');
  assert.match(slots.textContent, /Plastron léger/); assert.ok(slots.querySelector('img'));
  const assignment = descendants(e.root).find(n => n.dataset.focusKey === 'player-protection');
  assert.equal(assignment.value, e.state().members[0].draft.inventory[0].id); assignment.value = ''; await assignment.emit('change');
  assert.equal(e.state().members[0].draft.inventory[0].playerId, null);
  assert.match(e.root.querySelector('.rb-body-slots').textContent, /Libre/);
  await e.lock();
  assert.equal(descendants(e.root).find(n => n.dataset.focusKey === 'player-protection').disabled, true);
  assert.equal(button(e.root.querySelector('.rb-player-inspector'), 'Acheter et équiper · 100 chromas').disabled, true);
  e.mounted.stop();
});

test('Club : rôle et consigne dans la fiche à droite avec l’équipement', async t => {
  const e = await online(t), player = e.state().members[0].club.players[2];
  const pick = descendants(e.root).find(n => n.getAttribute('aria-label') === `Détails de ${player.name}`); await pick.parentNode.querySelector('.rb-fatigue').click();
  const tactics = e.root.querySelector('.rb-player-tactics'); assert.ok(e.root.querySelector('.rb-player-inspector').contains(tactics));
  assert.doesNotMatch(e.root.querySelector('.rb-player-inspector').textContent, /Remplacer ce titulaire/);
  assert.equal(e.root.querySelector('.rb-broadcast-squad').querySelector('.rb-player-tactics'), null);
  const role = tactics.querySelector('select'); role.value = 'defender'; await role.emit('change');
  const inspector = e.root.querySelector('.rb-player-inspector');
  assert.equal(inspector.hidden, false);
  assert.match(inspector.querySelector('.rb-player-shop').querySelector('select').getAttribute('aria-label'), new RegExp(player.name));
  await button(e.root, 'Club').click(); assert.equal(e.root.querySelector('.rb-player-tactics').querySelector('select').value, 'defender');
  assert.ok(e.root.querySelector('.rb-player-inspector').contains(e.root.querySelector('.rb-player-tactics')));
  e.mounted.stop();
});

test('replays UI : consultation en période verrouillée, parcours et retour sans mutation de ligue', async t => {
  const e = await online(t); await e.finishNight(); await e.lock();
  const before = structuredClone(e.state());
  await button(e.root, 'Ligue').click(); assert.equal(button(e.root, 'Voir le replay').disabled, undefined);
  await button(e.root, 'Voir le replay').click();
  assert.equal(e.root.querySelector('.rb-replay-area').hidden, false); assert.equal(e.root.querySelector('.rb-online-content').hidden, true);
  await button(e.root.querySelector('.rb-replay-area'), 'Round suivant').click();
  await button(e.root, 'Retour aux replays').click();
  assert.equal(e.root.querySelector('.rb-replay-area').hidden, true); assert.equal(e.root.querySelector('.rb-online-content').hidden, false);
  assert.deepEqual(e.state(), before); e.mounted.stop();
});

test('terrain : un joueur du banc remplace un titulaire par dépôt, sauvegarde puis verrouillage respectés', async t => {
  const e = await online(t), club = e.state().members[0].club, reserve = club.players.find(p => !club.lineup.includes(p.id));
  const index = 1, position = club.deployment[index], previous = club.lineup[index];
  const target = () => descendants(e.root).find(n => n.dataset.cell === `${position.x},${position.y}`);
  const dataTransfer = { types: [PLAYER_DRAG_TYPE], getData: () => reserve.id };
  await target().emit('drop', { dataTransfer });
  assert.equal(button(e.root, 'Enregistrer la préparation').disabled, false);
  await e.root.querySelector('form').emit('submit');
  const draft = e.state().members[0].draft; assert.equal(draft.lineup[index], reserve.id); assert.equal(draft.lineup.includes(previous), false);
  assert.equal(new Set(draft.lineup).size, 5); assert.deepEqual(draft.deployment[index], position);
  await e.lock(); const before = structuredClone(e.state()); await target().emit('drop', { dataTransfer }); assert.deepEqual(e.state(), before); e.mounted.stop();
});

test('fiche en préparation : achat du matériel pour un remplaçant sans quitter le terrain', async t => {
  const e = await online(t), club = e.state().members[0].club, reserve = club.players.find(p => !club.lineup.includes(p.id));
  const position = club.deployment[2];
  await descendants(e.root).find(n => n.dataset.cell === `${position.x},${position.y}`).click();
  await button(e.root, reserve.name).click();
  const inspector = e.root.querySelector('.rb-player-inspector'); assert.equal(inspector.hidden, false);
  await button(inspector, 'Acheter et équiper · 100 chromas').click();
  const next = e.state().members[0].draft; assert.equal(next.inventory[0].playerId, reserve.id); assert.equal(next.balance, club.balance - 100);
  assert.deepEqual(next.lineup, club.lineup); assert.equal(e.root.querySelector('.rb-broadcast-preparation') !== null, true);
  assert.equal(button(e.root.querySelector('.rb-player-inspector'), 'Acheter et équiper · 100 chromas').disabled, true);
  await button(e.root, `Faire entrer ${reserve.name}`).click(); await e.root.querySelector('form').emit('submit');
  assert.equal(e.state().members[0].draft.lineup[2], reserve.id);
  assert.deepEqual(e.state().members[0].draft.deployment[2], position); e.mounted.stop();
});

test('body en ligne : armer les deux mains du remplaçant préserve les tactiques, puis annulation restitue le matériel', async t => {
  const e = await online(t), club = e.state().members[0].club, reserve = club.players.find(p => !club.lineup.includes(p.id));
  const slot = id => e.root.querySelectorAll('.rb-body-slot').find(node => node.dataset.slot === id);
  e.strategy().value = 'possession'; await e.strategy().emit('change'); await button(e.root, reserve.name).click();
  await slot('leftHand').click();
  let choice = e.root.querySelector('.rb-player-shop').querySelector('select'); choice.value = 'tonfa'; await choice.emit('change'); await button(e.root, 'Équiper gratuitement').click();
  assert.equal(slot('leftHand').getAttribute('aria-pressed'), 'true'); assert.match(slot('leftHand').textContent, /Tonfa/);
  await slot('rightHand').click(); choice = e.root.querySelector('.rb-player-shop').querySelector('select'); choice.value = 'knuckles'; await choice.emit('change'); await button(e.root, 'Équiper gratuitement').click();
  const draft = e.state().members[0].draft;
  assert.deepEqual(draft.inventory.map(item => [item.itemId, item.location, item.playerId]), [['tonfa', 'leftHand', reserve.id], ['knuckles', 'rightHand', reserve.id]]);
  assert.equal(draft.balance, club.balance);
  assert.equal(e.strategy().value, 'possession'); assert.deepEqual(draft.lineup, club.lineup); assert.match(e.root.querySelector('.rb-player-inspector').textContent, /Seconde arme/);
  await button(e.root, 'Annuler la préparation').click(); assert.equal(e.state().members[0].draft, null); assert.equal(e.state().members[0].club.balance, club.balance); assert.equal(e.state().members[0].club.inventory.length, 0);
  await e.lock(); assert.equal(e.root.querySelectorAll('.rb-body-slot').every(node => !node.disabled), true); await slot('leftHand').click();
  assert.equal(e.root.querySelector('.rb-player-shop').querySelector('select').disabled, true); e.mounted.stop();
});

test('recrutement en ligne : modale, banc, saisie préservée et annulation de la préparation', async t => {
  const e = await online(t), base = e.state().members[0].club, offer = base.market[0];
  e.strategy().value = 'possession'; await e.strategy().emit('change');
  await button(e.root, 'Recruter un joueur').click();
  const dialog = e.root.querySelector('.rb-management-dialog'); assert.equal(dialog.hidden, false);
  assert.equal(dialog.querySelectorAll('.rb-ability-scores').length, base.market.length);
  await button(dialog, 'Recruter · 300 chromas').click();
  const next = e.state().members[0].draft; assert.equal(next.players.length, base.players.length + 1); assert.equal(next.balance, base.balance - 300); assert.deepEqual(next.lineup, base.lineup);
  assert.equal(e.strategy().value, 'possession'); assert.match(e.root.querySelector('.rb-broadcast-bench').textContent, new RegExp(offer.name));
  assert.equal(e.root.querySelector('.rb-broadcast-bench').parentNode, e.root.querySelector('.rb-court-workspace'));
  await button(dialog, 'Fermer').click(); assert.equal(dialog.hidden, true);
  await button(e.root, 'Annuler la préparation').click(); assert.equal(e.state().members[0].draft, null); assert.equal(e.strategy().value, base.strategy); e.mounted.stop();
});

test('amélioration en ligne : points sur le banc, choix conservés avec les tactiques non enregistrées, annulation', async t => {
  const e = await online(t, true), club = e.state().members[0].club, reserve = club.players.find(p => !club.lineup.includes(p.id));
  reserve.xp = 50; e.remoteChange(); await e.poll();
  e.strategy().value = 'possession'; await e.strategy().emit('change');
  await button(e.root, reserve.name).click();
  const inspector = e.root.querySelector('.rb-player-inspector'), advancement = inspector.querySelector('.rb-player-advancement'), choices = advancement.querySelectorAll('select');
  assert.equal(inspector.querySelector('.rb-ability-scores').children.length, 5);
  choices[0].value = 'mind'; await choices[0].emit('change'); choices[1].value = 'charisma'; await choices[1].emit('change');
  await button(advancement, 'Valider les 2 points').click();
  const next = e.state().members[0].draft;
  assert.deepEqual(next.players.find(p => p.id === reserve.id).advancements, [{ level: 3, changes: { mind: 1, charisma: 1 } }]);
  assert.deepEqual(next.lineup, club.lineup); assert.equal(e.strategy().value, 'possession');
  assert.match(e.root.querySelector('.rb-player-inspector').textContent, new RegExp(reserve.name));
  await button(e.root, 'Annuler la préparation').click();
  assert.equal(e.state().members[0].draft, null); assert.deepEqual(e.state().members[0].club.players.find(p => p.id === reserve.id).advancements, []);
  e.mounted.stop();
});

test('dix joueurs en ligne : cinquième remplaçant consultable et configurable, onzième contrat bloqué', async t => {
  const e = await online(t), club = e.state().members[0].club;
  club.balance += 1200; club.transactions.push({ id: 'test-budget', amount: 1200, balance: club.balance, label: 'Dotation de test' });
  await button(e.root, 'Club').click(); await button(e.root, 'Recruter un joueur').click();
  for (let i = 0; i < 4; i++) await button(e.root.querySelector('.rb-management-dialog'), 'Recruter · 300 chromas').click();
  const dialog = e.root.querySelector('.rb-management-dialog'), prepared = e.state().members[0].draft;
  assert.equal(prepared.players.length, 10); assert.match(dialog.textContent, /10\/10 places/);
  assert.ok(descendants(dialog).filter(n => n.tagName === 'button' && n.textContent === 'Recruter · 300 chromas').every(n => n.disabled));
  await button(dialog, 'Fermer').click(); const reserve = prepared.players[9], bench = e.root.querySelector('.rb-broadcast-bench');
  assert.equal(bench.querySelectorAll('.rb-bench-name').length, 5); await button(bench, reserve.name).click();
  assert.equal(button(bench, reserve.name).getAttribute('aria-pressed'), 'true');
  const controls = e.root.querySelector('.rb-player-tactics').querySelectorAll('select'); controls[0].value = 'defender'; await controls[0].emit('change'); controls[1].value = 'cautious'; await controls[1].emit('change');
  await button(e.root.querySelector('.rb-player-inspector'), 'Acheter et équiper · 100 chromas').click(); await e.root.querySelector('form').emit('submit');
  const next = e.state().members[0].draft, p = next.players.find(p => p.id === reserve.id);
  assert.equal(p.role, 'defender'); assert.equal(p.instruction, 'cautious'); assert.equal(next.inventory[0].playerId, p.id); assert.deepEqual(next.lineup, club.lineup);
  assert.throws(() => editPreparation(e.state(), 'a', 'recruit', { playerId: next.market[0].id }, '2026-10-18T10:00:00Z'), /dix joueurs/);
  e.mounted.stop();
});
