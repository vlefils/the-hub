import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { environment, descendants, button } from '../test-support/dom.mjs';
import { createLeague, joinLeague, startLeague, addBot, advanceLeague, editPreparation } from './league.mjs';
import { createLeagueService } from './server.mjs';
import { connectOnline } from './client.mjs';
import { mountOnline } from './ui.mjs';
import { mountMatch } from '../ui.mjs';
import { createMatch, stepMatch } from '../engine.mjs';
import { createCourtPlayback } from '../playback.mjs';

function setup(t) {
  const e = environment(); globalThis.location = new URL('http://127.0.0.1:8765/rumbleball/multi.html');
  e.pending = [];
  t.mock.method(globalThis, 'setTimeout', (callback) => { e.pending.push(callback); return e.pending.length; }); t.mock.method(globalThis, 'clearTimeout', () => {});
  return e;
}
test('multi désactivé : parcours lisible, retour au solo et aucune création de compte ni requête', async (t) => {
  const e = setup(t); let calls = 0;
  await mountOnline(e.root, { enabled: false }, () => { calls++; });
  assert.equal(calls, 0); assert.match(e.root.textContent, /20 h/); assert.match(e.root.textContent, /210/);
  assert.match(e.root.textContent, /activation du serveur/);
  assert.ok(descendants(e.root).some((n) => n.tagName === 'a' && n.href === './index.html'));
});
test('client : session isolée, identité jamais fournie par le navigateur et erreur API lisible', async () => {
  await assert.rejects(() => connectOnline({ enabled: false }), /activée/);
  let request, options;
  const client = await connectOnline({ enabled: true, url: 'https://example.supabase.co', publishableKey: 'public' }, async () => ({ createClient(url, key, opts) {
    options = opts; return { auth: {}, functions: { async invoke(name, { body }) { request = { name, body }; return { data: { ok: true } }; } } };
  } }));
  assert.equal(options.auth.storageKey, 'rumbleball.auth.v1');
  await client.request('get', 'league'); assert.deepEqual(request, { name: 'rumbleball-api', body: { action: 'get', leagueId: 'league', payload: {} } });
});
test('interface : équipe préparée côté serveur puis annulation, et gestion entière verrouillée à 20 h', async (t) => {
  const e = setup(t), now = '2026-10-18T10:00:00Z'; let clock = now, revision = 1;
  let state = createLeague({ id: 'league', userId: 'u0', name: 'Une ligue au nom très long qui reste lisible', clubName: 'Les Rebuts', inviteCode: 'a'.repeat(32), seed: 'ui-online', capacity: 2 }, now);
  state = startLeague(joinLeague(state, 'u1', { clubName: 'Adversaires' }, now), 'u0', now);
  const store = { async get() { return { id: state.id, revision, state: structuredClone(state) }; },
    async commit(id, expected, next) { assert.equal(expected, revision); state = next; return ++revision; },
    async list() { return [{ id: state.id, name: state.name, members: 2, capacity: 2 }]; } };
  const service = createLeagueService(store, { now: () => clock });
  const api = { auth: { async getSession() { return { data: { session: { user: { id: 'u0', email: 'joueur@example.com' } } } }; }, onAuthStateChange() {} }, request: (action, leagueId, payload) => service.command('u0', { action, leagueId, payload }) };
  const mounted = await mountOnline(e.root, { enabled: true }, async () => api);
  await button(e.root, `${state.name} · 2 clubs`).click();
  const form = descendants(e.root).find((n) => n.tagName === 'form');
  const panels = form.querySelectorAll('.rb-inspector-panel'), overview = panels.find(panel => panel.dataset.panel === 'player'), progression = panels.find(panel => panel.dataset.panel === 'progression');
  assert.ok(overview.querySelectorAll('button').some(button => button.textContent.startsWith('Céder')));
  assert.ok(!progression.querySelectorAll('button').some(button => button.textContent.startsWith('Céder')));
  assert.equal(progression.getAttribute('tabindex'), '0');
  assert.ok(form.querySelectorAll('.rb-fatigue-value').every(value => value.textContent.startsWith('Fatigue ')));
  const strategy = descendants(form).find((n) => n.tagName === 'select' && n.children.some((o) => o.value === 'possession'));
  strategy.value = 'possession'; await form.emit('submit');
  assert.equal(state.members[0].draft.strategy, 'possession'); assert.match(e.root.textContent, /Préparation enregistrée/);
  await button(e.root, 'Annuler la préparation').click(); assert.equal(state.members[0].draft, null);
  clock = state.nextLockAt; await button(e.root, 'Ligue').click();
  // A get uses authoritative time even if the scheduled worker has not fired yet.
  await button(e.root, 'Changer de ligue').click(); await button(e.root, `${state.name} · 2 clubs`).click();
  await button(e.root, 'Club').click();
  assert.match(e.root.textContent, /Équipes verrouillées/);
  const body = e.root.querySelector('.rb-online-body');
  assert.ok(descendants(body).filter((n) => n.tagName === 'select').length > 5);
  assert.ok(descendants(body).filter((n) => ['input', 'select', 'button'].includes(n.tagName) && n.getAttribute('data-readonly-control') !== 'true').every((n) => n.disabled));
  state = advanceLeague(state, clock); assert.equal(state.status, 'broadcast'); mounted.stop();
});
test('spectateur : affiche un round fourni sans résoudre de tour ni offrir un résultat immédiat', (t) => {
  const e = setup(t), state = createMatch({ seed: 'online-view' }), step = stepMatch(state); let saves = 0;
  const view = mountMatch(e.root, { onTurn() { saves++; } });
  const before = structuredClone(step.state);
  view.broadcast({ initial: state, turns: [{ before: state, after: step.state, events: step.events }] }, 6000);
  assert.equal(saves, 0); assert.deepEqual(step.state, before);
  const finish = button(e.root, 'Résultat immédiat'); if (finish) finish.click();
  assert.equal(saves, 0); assert.ok(e.root.querySelector('.rb-toolbar').hidden); view.pause();
});
test('lobby : les arrivées se mettent à jour sans reconstruire un formulaire inchangé ou en cours de saisie', async (t) => {
  const e = setup(t), clock = '2026-10-18T10:00:00Z'; let revision = 1;
  let state = createLeague({ id: 'league', userId: 'u0', name: 'Ligue des amis', clubName: 'Club', inviteCode: 'a'.repeat(32), seed: 'lobby-ui', capacity: 2 }, clock);
  const store = { async get() { return { id: state.id, revision, state: structuredClone(state) }; },
    async commit(id, expected, next) { assert.equal(expected, revision); state = next; return ++revision; },
    async list() { return [{ id: state.id, name: state.name, members: state.members.length, capacity: 2 }]; } };
  const service = createLeagueService(store, { now: () => clock });
  const api = { auth: { async getSession() { return { data: { session: { user: { id: 'u0' } } } }; }, onAuthStateChange() {} }, request: (action, leagueId, payload) => service.command('u0', { action, leagueId, payload }) };
  const mounted = await mountOnline(e.root, { enabled: true }, async () => api);
  await button(e.root, 'Ligue des amis · 1 club').click();
  const first = descendants(e.root).find((n) => n.tagName === 'form');
  await e.pending.shift()(); assert.ok(e.root.contains(first), 'Un sondage inchangé préserve le formulaire et son focus.');
  state = joinLeague(state, 'u1', { clubName: 'Ami' }, clock); revision++;
  await e.pending.shift()(); assert.match(e.root.textContent, /2 clubs inscrits/); assert.equal(button(e.root, 'Lancer la saison').disabled, false);
  const editing = descendants(e.root).find((n) => n.tagName === 'form');
  const strategy = descendants(editing).find(n => n.tagName === 'select' && n.children.some(o => o.value === 'possession')); strategy.value = 'possession'; await strategy.emit('input');
  state = editPreparation(state, 'u1', 'color', { color: '#aabbcc' }, clock); revision++;
  state = addBot(state, 'u0'); revision++;
  await e.pending.shift()(); assert.ok(e.root.contains(editing), 'Une arrivée ou modification distante ne doit pas effacer la saisie locale.');
  assert.equal(strategy.value, 'possession'); assert.match(e.root.querySelector('.rb-waiting-room').textContent, /3 clubs inscrits/);
  assert.match(e.root.querySelector('.rb-waiting-room').textContent, /Bot · gestion automatique/);
  mounted.stop();
});

test('salle d’attente : création sans capacité, ajout et retrait de bots sans perdre la préparation, lancement libre', async t => {
  const e = setup(t), clock = '2026-10-18T10:00:00Z'; let state, revision = 0, serial = 0;
  const store = { async get() { return { id: state.id, revision, state: structuredClone(state) }; },
    async commit(id, expected, next) { assert.equal(expected, revision); state = next; return ++revision; }, async list() { return []; } };
  const service = createLeagueService(store, { now: () => clock, uuid: () => (++serial).toString(16).padStart(32, 'a') });
  const api = { auth: { async getSession() { return { data: { session: { user: { id: 'owner' } } } }; }, onAuthStateChange() {} }, request: (action, leagueId, payload) => service.command('owner', { action, leagueId, payload }) };
  const mounted = await mountOnline(e.root, { enabled: true }, async () => api);
  const create = e.root.querySelector('form');
  assert.doesNotMatch(create.textContent, /Nombre de clubs/);
  const names = create.querySelectorAll('input').filter(input => input.type === 'text'); names[0].value = 'Ligue ouverte'; names[1].value = 'Club';
  await create.emit('submit'); assert.equal(state.capacity, null); assert.equal(button(e.root, 'Lancer la saison').disabled, true);
  const editor = e.root.querySelector('form'), strategy = editor.querySelectorAll('select').find(select => select.children.some(option => option.value === 'possession'));
  strategy.value = 'possession'; await strategy.emit('input'); strategy.focus();
  await button(e.root, 'Ajouter un bot').click();
  assert.ok(e.root.contains(editor)); assert.equal(document.activeElement, strategy); assert.equal(strategy.value, 'possession');
  assert.equal(button(e.root, 'Lancer la saison').disabled, false); assert.equal(state.bots.length, 1);
  await button(e.root, 'Retirer').click(); assert.equal(state.bots.length, 0); assert.ok(e.root.contains(editor));
  assert.equal(button(e.root, 'Lancer la saison').disabled, true);
  await button(e.root, 'Ajouter un bot').click(); await button(e.root, 'Ajouter un bot').click();
  await button(e.root, 'Lancer la saison').click(); assert.equal(state.capacity, 3); assert.equal(state.status, 'preparation');
  assert.equal(e.root.querySelector('.rb-waiting-room'), null);
  const prepared = e.root.querySelectorAll('select').find(select => select.children.some(option => option.value === 'possession'));
  assert.equal(prepared.value, 'possession'); mounted.stop();
});

test('salle d’attente invitée : clubs et bots visibles, gestion réservée au créateur', async t => {
  const e = setup(t), clock = '2026-10-18T10:00:00Z';
  let state = createLeague({ id: 'l', userId: 'owner', name: 'Ligue', clubName: 'Club', seed: 's', inviteCode: 'a'.repeat(32) }, clock);
  state = joinLeague(addBot(state, 'owner'), 'friend', { clubName: 'Ami' }, clock);
  const service = createLeagueService({ async get() { return { id: state.id, revision: 1, state }; }, async list() { return [{ id: 'l', name: 'Ligue', members: 3, status: 'lobby' }]; } }, { now: () => clock });
  const api = { auth: { async getSession() { return { data: { session: { user: { id: 'friend' } } } }; }, onAuthStateChange() {} }, request: (action, leagueId, payload) => service.command('friend', { action, leagueId, payload }) };
  const mounted = await mountOnline(e.root, { enabled: true }, async () => api);
  await button(e.root, 'Ligue · 3 clubs · Salle d’attente').click();
  assert.match(e.root.textContent, /Bot · gestion automatique/); assert.match(e.root.textContent, /Le créateur lancera/);
  for (const label of ['Ajouter un bot', 'Retirer', 'Lancer la saison']) assert.equal(button(e.root, label), undefined);
  mounted.stop();
});
test('spectateur en retard : rejoint à six secondes du round et ne rejoue pas son début', () => {
  const before = createMatch({ seed: 'late-view' }), step = stepMatch(before); let frame, tick;
  const playback = createCourtPlayback((value) => { frame = value; }, { now: () => 1000, request: (cb) => { tick = cb; return 1; }, cancel() {}, reducedMotion: () => false });
  playback.playRound([{ before, after: step.state, events: step.events }], { speed: 1, elapsed: 6000 });
  assert.equal(frame.roundProgress, .5); assert.equal(playback.remaining(), 6000);
  tick(7000); assert.equal(playback.remaining(), 0); assert.equal(frame.players.length, 10);
});
test('configuration publique : contient uniquement URL, clé publique et indicateur d’activation', async () => {
  const config = await readFile(new URL('./config.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(config, /sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY/);
  const { ONLINE_CONFIG } = await import('./config.mjs');
  assert.deepEqual(Object.keys(ONLINE_CONFIG).sort(), ['enabled', 'publishableKey', 'url']);
  assert.ok(ONLINE_CONFIG.publishableKey.startsWith('sb_publishable_')); assert.equal(typeof ONLINE_CONFIG.enabled, 'boolean');
});
