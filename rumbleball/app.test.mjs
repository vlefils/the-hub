import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createCareer, confirmDraft } from './career.mjs';
import { exportCareer } from './career-storage.mjs';
import { environment, TestNode, descendants, classNode, button } from './test-support/dom.mjs';
import { mountApp } from './app.mjs';
import { stepMatch } from './engine.mjs';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');
function club() {
  const c = createCareer('Le très long nom des Rebuts de l’intersection', 'dedicated-page');
  return confirmDraft(c, c.market.slice(0, 5).map((p) => p.id));
}
function standalone(saved) {
  const e = environment(saved), main = new TestNode('main'), root = new TestNode('div'); main.append(root);
  return { ...e, root };
}
function timers(t) {
  let id = 0; const pending = new Map();
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => { pending.set(++id, { callback, delay }); return id; });
  t.mock.method(globalThis, 'clearTimeout', (id) => pending.delete(id));
  return { pending, until(check) { let count = 0; while (!check()) { assert.ok(++count < 20 && pending.size); const [id, timer] = [...pending][0]; pending.delete(id); timer.callback(); } } };
}

test('pages séparées : présentation statique, lancement et retour compatibles avec un sous-répertoire GitHub Pages', async () => {
  const [hub, app] = await Promise.all([source('../index.html'), source('index.html')]);
  const landing = hub.slice(hub.indexOf('id="outils-rumbleball"'), hub.indexOf('id="outils-pretires"'));
  assert.match(landing, /Lancer Rumbleball Manager/);
  assert.doesNotMatch(landing, /data-rumbleball|Chargement du terrain/);
  assert.doesNotMatch(hub, /src="rumbleball\/(ui|app)\.mjs"|href="rumbleball\/rumbleball\.css"/);
  const launch = landing.match(/class="rb-launch" href="([^"]+)"/)[1];
  const back = app.match(/class="rb-hub-link" href="([^"]+)"/)[1];
  for (const origin of ['http://127.0.0.1:8765/', 'https://vlefils.github.io/the-hub/']) {
    const game = new URL(launch, origin), home = new URL(back, game);
    assert.equal(game.origin, new URL(origin).origin, 'La carrière reste sur la même origine.');
    assert.equal(game.href, `${origin}rumbleball/index.html`);
    assert.equal(home.href, `${origin}#outils-rumbleball`);
  }
  assert.match(app, /<html lang="fr">/); assert.match(app, /name="viewport"/);
  assert.match(app, /<main[^>]*id="jeu"/); assert.match(app, /data-rumbleball/);
  assert.doesNotMatch(app, /src="\.\.\/script\.js"|href="\.\.\/(styles|ui-refresh)\.css"|data-section/);
});

test('page autonome : toutes les ressources locales HTML, CSS et les imports JavaScript existent', async () => {
  const seen = new Set();
  async function check(url) {
    if (seen.has(url.href)) return; seen.add(url.href); await access(url);
    if (!/\.(html|mjs|css)$/.test(url.pathname)) return;
    const text = await readFile(url, 'utf8'), paths = [];
    if (url.pathname.endsWith('.html')) for (const m of text.matchAll(/(?:src|href)="([^"]+)"/g)) if (!m[1].startsWith('../')) paths.push(m[1]);
    if (url.pathname.endsWith('.css')) for (const m of text.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) paths.push(m[1]);
    if (url.pathname.endsWith('.mjs')) for (const m of text.matchAll(/(?:from\s+|import\s*)['"](\.\/[^'"]+)['"]/g)) paths.push(m[1]);
    await Promise.all(paths.filter((path) => !/^(https?:|#|data:)/.test(path)).map((path) => check(new URL(path, url))));
  }
  await check(new URL('index.html', import.meta.url));
  assert.ok(seen.has(new URL('assets/arena-banner.webp', import.meta.url).href));
  assert.ok(seen.has(new URL('engine.mjs', import.meta.url).href));
});

test('page autonome : carrière existante, lecture automatique sans section du livre, pause au départ et reprise', async (t) => {
  const c = club(), e = standalone(exportCareer(c)), clock = timers(t), pageEvents = new Map();
  window.addEventListener = (type, callback) => pageEvents.set(type, callback);
  mountApp(e.root);
  assert.equal(e.root.closest('[data-section]'), null);
  assert.match(classNode(e.root, 'rb-club-header').textContent, /Rebuts de l’intersection/);
  assert.deepEqual(e.saved(), c, 'Ouvrir la nouvelle page ne modifie pas la sauvegarde.');
  await button(e.root, 'Préparer le match').click(); await button(e.root, 'Lancer la rencontre').click();
  assert.equal(clock.pending.size, 1, 'La lecture démarre sans is-active du livre.');
  clock.until(() => e.saved().current.state.turns > 0);
  assert.equal(e.saved().current.state.turns, 10);
  assert.equal(e.saved().transactions.filter((t) => t.label === 'Salaires de la journée').length, 1);
  const layout = classNode(e.root, 'rb-match-layout');
  for (const name of ['rb-field-column', 'rb-journal-panel', 'rb-rosters']) assert.ok(layout.children.includes(classNode(e.root, name)));
  assert.equal(classNode(e.root, 'rb-rosters').tabIndex, 0);
  pageEvents.get('pagehide')(); assert.equal(clock.pending.size, 0);
  assert.match(classNode(e.root, 'rb-playback-status').textContent, /Pause/);
  const loaded = standalone(exportCareer(e.saved())); mountApp(loaded.root);
  await button(loaded.root, 'Reprendre la rencontre').click();
  assert.equal(clock.pending.size, 0, 'Une reprise reste en pause.');
  assert.equal(loaded.saved().current.state.turns, 10);
  assert.equal(loaded.saved().transactions.filter((t) => t.label === 'Salaires de la journée').length, 1);
  let expected = loaded.saved().current.state;
  const round = expected.round;
  while (!expected.finished && expected.round === round) expected = stepMatch(expected, { stopAtRoundEnd: true }).state;
  await button(loaded.root, 'Round suivant').click();
  assert.deepEqual(loaded.saved().current.state, expected, 'La reprise joue exactement le round suivant, y compris les créneaux KO sautés.');
  await button(loaded.root, 'Retour au club · mettre en pause').click();
  assert.equal(classNode(loaded.root, 'rb-match-area').hidden, true);
});

test('page autonome : lancement d’Exhibition en haut du vestiaire et après les réglages, sans carrière', async (t) => {
  const e = standalone(), clock = timers(t); mountApp(e.root);
  assert.ok(classNode(e.root, 'rb-career-welcome')); assert.ok(classNode(e.root, 'rb-career-create'));
  await button(e.root, 'Exhibition').click();
  const setup = classNode(e.root, 'rb-setup'), quickStart = button(setup, 'Lancer le match'), order = descendants(setup);
  assert.equal(setup.hidden, false); assert.equal(quickStart.type, 'submit'); assert.equal(quickStart.closest('form'), setup);
  assert.ok(classNode(setup, 'rb-setup-head').contains(quickStart));
  assert.ok(order.indexOf(quickStart) < order.indexOf(classNode(setup, 'rb-preparation')), 'Le lancement précède les fiches et le déploiement.');
  const bottomStart = button(classNode(setup, 'rb-setup-foot'), 'Lancer le match');
  assert.equal(bottomStart.type, 'submit'); assert.equal(bottomStart.closest('form'), setup, 'Les deux boutons partagent le même formulaire et la même validation.');
  await setup.emit('submit', { submitter: quickStart }); clock.until(() => classNode(e.root, 'rb-journal').children.length > 1);
  assert.equal(classNode(e.root, 'rb-setup').hidden, true);
  assert.ok(classNode(e.root, 'rb-journal').children.length > 1);
  await button(e.root, 'Carrière').click(); assert.equal(clock.pending.size, 0);
  assert.ok(classNode(e.root, 'rb-career-create')); assert.equal(e.storage.getItem('the-hub.rumbleball.career.v1'), null);
});
