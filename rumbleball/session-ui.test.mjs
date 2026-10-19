import test from 'node:test';
import assert from 'node:assert/strict';
import { mountApp } from './app.mjs';
import { mountSession } from './session-ui.mjs';
import { mountCareer } from './career-ui.mjs';
import { createCareer, confirmDraft } from './career.mjs';
import { exportCareer, CAREER_KEY } from './career-storage.mjs';
import { environment, button, descendants } from './test-support/dom.mjs';
import { MemoryStorage, soloTestService } from './test-support/solo.mjs';

const account = id => ({ id, email: `${id}@example.invalid` });
const career = () => { const c = createCareer('Club à retrouver', 'session-test'); return confirmDraft(c, c.market.slice(0, 6).map(p => p.id)); };
function setup(initialUser = null) {
  const e = environment(), backend = soloTestService(), storage = new MemoryStorage(), listeners = new Set();
  globalThis.location = new URL('https://vlefils.github.io/the-hub/rumbleball/index.html');
  let current = initialUser;
  const emit = (event, user) => { current = user; for (const listener of listeners) listener(event, user ? { user } : null); };
  const api = { auth: {
    async getSession() { return { data: { session: current ? { user: current } : null } }; },
    onAuthStateChange(listener) { listeners.add(listener); return { data: { subscription: { unsubscribe() { listeners.delete(listener); } } } }; },
    async signInWithPassword() { emit('SIGNED_IN', account('owner')); return { data: { user: current } }; },
    async signOut() { emit('SIGNED_OUT', null); return {}; },
    async updateUser() { return { data: { user: current } }; },
  }, request: (action, leagueId, payload) => backend.service.command(current?.id, { action, payload }) };
  return { ...e, backend, storage, api, emit, options: { config: { enabled: true }, storage, connect: async () => api } };
}

test('tout le jeu est derrière la connexion, sans lire ni montrer la partie locale avant authentification', async t => {
  const e = setup(); e.storage.setItem(CAREER_KEY, exportCareer(career())); let reads = 0, mounts = 0;
  const get = e.storage.getItem.bind(e.storage); e.storage.getItem = key => { reads++; return get(key); };
  const app = await mountApp(e.root, { ...e.options, careerView() { mounts++; }, matchView() { mounts++; }, onlineView() { mounts++; } }); t.after(app.stop);
  assert.equal(reads, 0); assert.equal(mounts, 0); assert.match(e.root.textContent, /Se connecter/);
  assert.doesNotMatch(e.root.textContent, /Club à retrouver/);
  for (const label of ['Exhibition', 'Carrière', 'Nouvelle partie solo', 'Ligues multijoueurs']) assert.equal(button(e.root, label), undefined);
  assert.equal(e.root.querySelector('.rb-setup'), null);
});
test('connexion : ancienne carrière importée avant la liste, puis reprise de cette même partie', async t => {
  const e = setup(), c = career(); e.storage.setItem(CAREER_KEY, exportCareer(c)); let options;
  const app = await mountApp(e.root, { ...e.options, careerView(root, match, opts) { options = opts; return { stop() {} }; } }); t.after(app.stop);
  const form = e.root.querySelector('form'), inputs = form.querySelectorAll('input'); inputs[0].value = 'owner@example.invalid'; inputs[1].value = 'temporary-password';
  await form.emit('submit'); assert.match(e.root.textContent, /Mes parties/); assert.equal(e.storage.getItem(CAREER_KEY), null);
  assert.equal(e.backend.rows.size, 1); assert.match(e.root.textContent, /Club à retrouver/);
  await button(e.root, 'Ouvrir la partie Club à retrouver').click();
  assert.deepEqual(JSON.parse(options.sync.storage.getItem(CAREER_KEY)).career, c); assert.equal(e.root.querySelector('.rb-online-auth'), null);
});
test('plusieurs parties : créer une seconde partie, revenir à la liste et conserver la première', async t => {
  const e = setup(account('owner')); await e.backend.command('owner', 'solo_import', { json: exportCareer(career()) }); let sync;
  const app = await mountApp(e.root, { ...e.options, careerView(root, match, opts) { sync = opts.sync; return { stop() {} }; } }); t.after(app.stop);
  await button(e.root, 'Nouvelle partie solo').click(); assert.equal(e.backend.rows.size, 2);
  const c = createCareer('Deuxième club', 'second-cloud'); sync.storage.setItem(CAREER_KEY, exportCareer(c)); await sync.flush();
  await button(e.root, 'Mes parties').click();
  assert.ok(button(e.root, 'Ouvrir la partie Club à retrouver')); assert.ok(button(e.root, 'Ouvrir la partie Deuxième club'));
});
test('une mutation du vrai panneau solo est synchronisée et la déconnexion retire terrain, menus et animations', async t => {
  const e = setup(account('owner')); const original = (await e.backend.command('owner', 'solo_import', { json: exportCareer(career()) })).game;
  let sync, stopped = false;
  const app = await mountApp(e.root, { ...e.options, careerView(root, match, opts) { sync = opts.sync; const view = mountCareer(root, match, opts); return { stop() { stopped = true; view.stop(); } }; } }); t.after(app.stop);
  await button(e.root, 'Ouvrir la partie Club à retrouver').click();
  const strategy = e.root.querySelectorAll('select').find(select => select.children.some(option => option.value === 'possession'));
  strategy.value = 'possession'; await strategy.emit('change'); await sync.flush();
  assert.equal(e.backend.rows.get(original.id).state.clubs[0].strategy, 'possession');
  assert.match(e.root.querySelector('.rb-save-status').textContent, /Sauvegardé sur votre compte/);
  await button(e.root, 'Exhibition').click(); assert.ok(e.root.querySelector('.rb-setup'));
  await button(e.root, 'Déconnexion').click(); assert.equal(stopped, true); assert.equal(e.root.querySelector('.rb-setup'), null);
  assert.equal(e.root.querySelector('.rb-player-inspector'), null); assert.match(e.root.textContent, /Se connecter/);
  assert.throws(() => sync.storage.setItem(CAREER_KEY, exportCareer(career())), /fermée/);
});
test('le lien multi passe par la même connexion et importe aussi la carrière locale avant les ligues', async t => {
  const e = setup(); e.storage.setItem(CAREER_KEY, exportCareer(career())); let called = false;
  const app = await mountSession(e.root, { ...e.options, initialMode: 'multi', async onlineView(root, config, connect, options) {
    called = true; assert.equal(e.backend.rows.size, 1); assert.equal(options.managedSession, true); assert.equal((await connect()).auth, e.api.auth); return { stop() {} };
  } }); t.after(app.stop);
  assert.equal(called, false); const form = e.root.querySelector('form'); await form.emit('submit'); assert.equal(called, true);
});
test('l’expiration de session et le changement de compte ne montrent jamais les parties précédentes', async t => {
  const e = setup(account('owner')); await e.backend.command('owner', 'solo_import', { json: exportCareer(career()) });
  const app = await mountApp(e.root, e.options); t.after(app.stop); assert.match(e.root.textContent, /Club à retrouver/);
  e.emit('SIGNED_OUT', null); assert.doesNotMatch(e.root.textContent, /Club à retrouver/);
  e.api.auth.signInWithPassword = async () => { e.emit('SIGNED_IN', account('other')); return { data: { user: account('other') } }; };
  await e.root.querySelector('form').emit('submit');
  assert.doesNotMatch(e.root.textContent, /Club à retrouver/); assert.match(e.root.textContent, /Votre première carrière/);
});
test('récupération de mot de passe : le jeu reste masqué jusqu’à la fin de la récupération', async t => {
  const e = setup(account('owner')); globalThis.location = new URL('https://vlefils.github.io/the-hub/rumbleball/multi.html?recovery=1');
  let mounted = false;
  const app = await mountApp(e.root, { ...e.options, careerView() { mounted = true; } }); t.after(app.stop);
  assert.match(e.root.textContent, /Nouveau mot de passe/); assert.equal(mounted, false); assert.equal(button(e.root, 'Nouvelle partie solo'), undefined);
  await e.root.querySelector('form').emit('submit'); assert.ok(button(e.root, 'Nouvelle partie solo'));
});

test('un rappel de connexion différé ne rouvre pas le compte après la déconnexion', async t => {
  const e = setup(), callbacks = [];
  t.mock.method(globalThis, 'setTimeout', callback => { callbacks.push(callback); return callbacks.length; });
  const app = await mountApp(e.root, e.options); t.after(app.stop);
  e.emit('SIGNED_IN', account('owner')); e.emit('SIGNED_OUT', null);
  for (const callback of callbacks) await callback();
  assert.equal(app.user, null); assert.match(e.root.textContent, /Se connecter/); assert.equal(button(e.root, 'Nouvelle partie solo'), undefined);
});
test('la réponse d’un ancien formulaire ne remonte pas une session déjà fermée', async t => {
  const e = setup(); let complete;
  e.api.auth.signInWithPassword = () => new Promise(resolve => { complete = resolve; });
  const app = await mountApp(e.root, e.options); t.after(app.stop);
  const pending = e.root.querySelector('form').emit('submit');
  e.emit('SIGNED_OUT', null); complete({ data: { user: account('owner') } }); await pending;
  assert.equal(app.user, null); assert.match(e.root.textContent, /Se connecter/);
});
test('retour navigateur : la session est revérifiée et les vues arrêtées sont remontées proprement', async t => {
  const e = setup(account('owner')), events = new Map(); let stops = 0;
  window.addEventListener = (type, callback) => { const list = events.get(type) ?? new Set(); list.add(callback); events.set(type, list); };
  window.removeEventListener = (type, callback) => events.get(type)?.delete(callback);
  await e.backend.command('owner', 'solo_import', { json: exportCareer(career()) });
  const app = await mountApp(e.root, { ...e.options, careerView() { return { stop() { stops++; } }; } }); t.after(app.stop);
  await button(e.root, 'Ouvrir la partie Club à retrouver').click();
  for (const callback of events.get('pagehide')) callback(); assert.equal(stops, 1);
  for (const callback of events.get('pageshow')) await callback({ persisted: true });
  assert.ok(button(e.root, 'Ouvrir la partie Club à retrouver'));
  e.emit('SIGNED_OUT', null); for (const callback of events.get('pageshow')) await callback({ persisted: true });
  assert.match(e.root.textContent, /Se connecter/); assert.doesNotMatch(e.root.textContent, /Club à retrouver/);
});
