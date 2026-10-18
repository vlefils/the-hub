import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, descendants, button } from '../test-support/dom.mjs';
import { mountOnline } from './ui.mjs';
import { createLeague, joinLeague, startLeague, editPreparation, advanceLeague } from './league.mjs';
import { createLeagueService } from './server.mjs';

async function online(t, lobby = false) {
  const e = environment(); globalThis.location = new URL('http://127.0.0.1:8767/rumbleball/multi.html');
  let clock = '2026-10-18T10:00:00Z', revision = 1, serial = 0, fail = false;
  const pending = new Map(); t.mock.method(Date, 'now', () => Date.parse(clock));
  t.mock.method(globalThis, 'setTimeout', fn => { pending.set(++serial, fn); return serial; }); t.mock.method(globalThis, 'clearTimeout', id => pending.delete(id));
  let state = createLeague({ id: 'league', userId: 'a', name: 'Ligue', clubName: 'Chromes', seed: 'broadcast-ui', inviteCode: 'a'.repeat(32), capacity: 2 }, clock);
  state = joinLeague(state, 'b', { clubName: 'Adversaires' }, clock); if (!lobby) state = startLeague(state, 'a', clock);
  const store = { async get() { return { id: state.id, revision, state: structuredClone(state) }; }, async list() { return [{ id: state.id, name: state.name, members: 2, capacity: 2 }]; }, async commit(id, expected, next) { assert.equal(expected, revision); state = next; return ++revision; } };
  const service = createLeagueService(store, { now: () => clock });
  const mounted = await mountOnline(e.root, { enabled: true }, async () => ({ auth: { async getSession() { return { data: { session: { user: { id: 'a', email: 'test@example.invalid' } } } }; }, onAuthStateChange() {} }, request(action, leagueId, payload) { if (fail && action === 'configure') { fail = false; throw Error('Connexion interrompue'); } return service.command('a', { action, leagueId, payload }); } }));
  await button(e.root, 'Ligue · 2/2 clubs').click();
  const strategy = () => descendants(e.root.querySelector('.rb-online-body')).find(n => n.tagName === 'select' && n.children.some(o => o.value === 'possession'));
  const poll = async () => { const [id, fn] = [...pending][0]; pending.delete(id); await fn(); };
  return { ...e, mounted, strategy, state: () => state, poll, remoteChange() { state = editPreparation(state, 'b', 'color', { color: '#aabbcc' }, clock); revision++; }, failNext() { fail = true; }, async lock() { clock = state.nextLockAt; await poll(); }, async finishNight() { state = advanceLeague(state, state.nextLockAt); clock = state.night.endsAt; state = advanceLeague(state, clock); revision++; await poll(); } };
}

test('broadcast : une saisie survit aux onglets, à un achat et à une erreur réseau ; annulation complète', async t => {
  const e = await online(t), base = e.state().members[0].club;
  await button(e.root, 'Tactique').click();
  e.strategy().value = 'possession'; await e.strategy().emit('input');
  assert.equal(button(e.root, 'Enregistrer la préparation').disabled, false);
  await button(e.root, 'Équipement').click(); await button(e.root, 'Acheter · 100 chromas').click(); await button(e.root, 'Équipe').click();
  assert.equal(e.strategy().value, 'possession'); assert.equal(e.state().members[0].draft.balance, base.balance - 100);
  e.failNext(); await e.root.querySelector('form').emit('submit'); assert.match(e.root.textContent, /Connexion interrompue/); assert.equal(e.strategy().value, 'possession'); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, false);
  await e.root.querySelector('form').emit('submit'); assert.equal(e.state().members[0].draft.strategy, 'possession'); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, true); assert.equal(e.root.querySelector('form').dataset.teamView, 'Tactique');
  await button(e.root, 'Annuler la préparation').click(); assert.equal(e.state().members[0].draft, null); assert.equal(e.strategy().value, base.strategy); assert.equal(e.state().members[0].club.balance, base.balance); e.mounted.stop();
});

test('broadcast : 20 h écarte la saisie non enregistrée, avertit et laisse les détails consultables', async t => {
  const e = await online(t), original = e.strategy().value;
  e.strategy().value = 'possession'; await e.strategy().emit('change'); await e.lock();
  assert.match(e.root.textContent, /modifications non enregistrées n’ont pas été retenues/); assert.equal(e.strategy().value, original); assert.equal(e.strategy().disabled, true);
  const player = e.state().members[0].club.players.find(p => p.id === e.state().members[0].club.lineup[1]);
  const details = descendants(e.root).find(n => n.getAttribute('aria-label') === `Détails de ${player.name}`); assert.equal(details.disabled, undefined); await details.click();
  assert.match(e.root.querySelector('.rb-squad-detail').textContent, new RegExp(player.name)); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, true); e.mounted.stop();
});

test('broadcast : enregistrer libère le rafraîchissement du lobby sans réactiver une ancienne saisie', async t => {
  const e = await online(t, true); e.strategy().value = 'possession'; await e.strategy().emit('change'); await e.root.querySelector('form').emit('submit');
  const savedForm = e.root.querySelector('form'); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, true);
  e.remoteChange(); await e.poll(); assert.equal(e.root.contains(savedForm), false); assert.equal(e.strategy().value, 'possession'); assert.equal(button(e.root, 'Enregistrer la préparation').disabled, true); e.mounted.stop();
});

test('équipement : joueur conservé après achat et transfert, réserve lisible et verrouillage respecté', async t => {
  const e = await online(t), target = e.state().members[0].club.players[1].id;
  await button(e.root, 'Équipement').click();
  const picker = () => e.root.querySelector('.rb-online-body').querySelector('select');
  picker().value = target; await picker().emit('change');
  await button(e.root, 'Acheter · 100 chromas').click();
  assert.equal(picker().value, target);
  const slots = e.root.querySelector('.rb-equipment-slots');
  assert.match(slots.textContent, /Plastron léger/); assert.ok(slots.querySelector('img'));
  const assignment = e.root.querySelector('.rb-inventory-row').querySelector('select');
  assert.equal(assignment.value, target); assignment.value = ''; await assignment.emit('change');
  assert.equal(picker().value, target); assert.equal(e.state().members[0].draft.inventory[0].playerId, null);
  assert.match(e.root.querySelector('.rb-equipment-slots').textContent, /Emplacement libre/);
  await e.lock();
  assert.equal(picker().disabled, undefined);
  assert.equal(e.root.querySelector('.rb-inventory-row').querySelector('select').disabled, true);
  assert.ok(descendants(e.root).filter(n => n.tagName === 'button' && n.textContent.startsWith('Acheter ·')).every(n => n.disabled));
  e.mounted.stop();
});

test('composition : tactiques directement sous le joueur choisi et accès à son équipement', async t => {
  const e = await online(t), player = e.state().members[0].club.players[2];
  const pick = descendants(e.root).find(n => n.getAttribute('aria-label') === `Détails de ${player.name}`); await pick.click();
  const tactics = e.root.querySelector('.rb-player-tactics'); assert.equal(tactics.parentNode.dataset.playerId, player.id);
  const role = tactics.querySelector('select'); role.value = 'defender'; await role.emit('change');
  await button(e.root, 'Équiper ce joueur').click();
  assert.equal(e.root.querySelector('.rb-online-body').querySelector('select').value, player.id);
  await button(e.root, 'Équipe').click(); assert.equal(e.root.querySelector('.rb-player-tactics').querySelector('select').value, 'defender');
  assert.equal(e.root.querySelector('.rb-player-tactics').parentNode.dataset.playerId, player.id);
  e.mounted.stop();
});

test('replays UI : consultation en période verrouillée, parcours et retour sans mutation de ligue', async t => {
  const e = await online(t); await e.finishNight(); await e.lock();
  const before = structuredClone(e.state());
  await button(e.root, 'Replays').click(); assert.equal(button(e.root, 'Voir le replay').disabled, undefined);
  await button(e.root, 'Voir le replay').click();
  assert.equal(e.root.querySelector('.rb-replay-area').hidden, false); assert.equal(e.root.querySelector('.rb-online-content').hidden, true);
  await button(e.root.querySelector('.rb-replay-area'), 'Round suivant').click();
  await button(e.root, 'Retour aux replays').click();
  assert.equal(e.root.querySelector('.rb-replay-area').hidden, true); assert.equal(e.root.querySelector('.rb-online-content').hidden, false);
  assert.deepEqual(e.state(), before); e.mounted.stop();
});
