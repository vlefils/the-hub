import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoloSync, recoverSoloGames, localSoloGames } from './solo-sync.mjs';
import { CAREER_KEY, exportCareer, importCareer } from './career-storage.mjs';
import { createCareer, confirmDraft } from './career.mjs';
import { MemoryStorage, soloTestService } from './test-support/solo.mjs';

const owner = 'owner';
const career = color => { const c = createCareer('Migration locale', 'migration'); return confirmDraft(c, c.market.slice(0, 6).map(p => p.id)); };
async function fixture(t) {
  const s = soloTestService(), storage = new MemoryStorage(), game = (await s.command(owner, 'solo_import', { json: exportCareer(career()) })).game;
  const sync = createSoloSync(s.client(owner), owner, storage, game); t.after(() => sync.stop());
  return { ...s, storage, game, sync };
}
const recolor = (json, color) => { const c = importCareer(json); c.clubs[0].kitColor = color; return exportCareer(c); };

test('cloud : copie locale immédiate puis enregistrement distant et nettoyage après acquittement', async t => {
  const e = await fixture(t), json = recolor(exportCareer(e.game.state), '#aabbcc');
  e.sync.storage.setItem(CAREER_KEY, json);
  assert.equal(e.rows.get(e.game.id).revision, 1); assert.equal(localSoloGames(e.storage, owner)[0].game.pending, true);
  await e.sync.flush(); assert.equal(e.rows.get(e.game.id).revision, 2);
  assert.equal(localSoloGames(e.storage, owner)[0].game.pending, false); assert.equal(e.sync.status().kind, 'saved');
});
test('cloud : une nouvelle modification pendant l’envoi ne disparaît pas au premier acquittement', async t => {
  const e = await fixture(t), client = e.client(owner); let release, first = true;
  const request = client.request; client.request = async (...args) => { if (first) { first = false; await new Promise(resolve => { release = resolve; }); } return request(...args); };
  const sync = createSoloSync(client, owner, e.storage, e.game); t.after(() => sync.stop());
  const a = recolor(exportCareer(e.game.state), '#aabbcc'), b = recolor(a, '#bbccdd');
  sync.storage.setItem(CAREER_KEY, a); const uploading = sync.flush();
  while (!release) await Promise.resolve();
  sync.storage.setItem(CAREER_KEY, b); release(); await uploading;
  assert.equal(e.rows.get(e.game.id).state.clubs[0].kitColor, '#bbccdd'); assert.equal(e.rows.get(e.game.id).revision, 3);
});
test('cloud : deux appareils divergents conservent deux parties sans écraser la première', async t => {
  const e = await fixture(t), other = createSoloSync(e.client(owner), owner, new MemoryStorage(), e.game); t.after(() => other.stop());
  e.sync.storage.setItem(CAREER_KEY, recolor(exportCareer(e.game.state), '#aabbcc')); await e.sync.flush();
  other.storage.setItem(CAREER_KEY, recolor(exportCareer(e.game.state), '#bbccdd')); await other.flush();
  assert.equal(e.rows.size, 2); assert.equal(e.rows.get(e.game.id).state.clubs[0].kitColor, '#aabbcc');
  assert.notEqual(other.record().id, e.game.id); assert.match(other.status().message, /copie/);
  assert.equal(e.rows.get(other.record().id).state.clubs[0].kitColor, '#bbccdd');
});
test('cloud : réponse perdue après écriture, réessai du même identifiant sans doublon', async t => {
  const e = await fixture(t), client = e.client(owner), request = client.request; let lost = true;
  client.request = async (...args) => { const result = await request(...args); if (lost) { lost = false; throw new Error('Réponse perdue'); } return result; };
  const sync = createSoloSync(client, owner, e.storage, e.game); t.after(() => sync.stop());
  sync.storage.setItem(CAREER_KEY, recolor(exportCareer(e.game.state), '#aabbcc'));
  assert.equal(await sync.flush(), false); assert.equal(sync.status().kind, 'error');
  await sync.flush(); assert.equal(e.rows.size, 1); assert.equal(e.rows.get(e.game.id).revision, 2);
});
test('cloud : deux onglets hors ligne ont des files distinctes, toutes récupérées à la connexion', async t => {
  const e = await fixture(t), client = e.client(owner); client.request = async () => { throw Error('Hors ligne'); };
  const a = createSoloSync(client, owner, e.storage, e.game), b = createSoloSync(client, owner, e.storage, e.game);
  a.storage.setItem(CAREER_KEY, recolor(exportCareer(e.game.state), '#aabbcc'));
  b.storage.setItem(CAREER_KEY, recolor(exportCareer(e.game.state), '#bbccdd'));
  await a.flush(); await b.flush(); a.stop(); b.stop();
  assert.equal([...e.storage.map.keys()].filter(key => key.includes('solo-pending')).length, 2);
  await recoverSoloGames(e.client(owner), owner, e.storage);
  assert.equal(e.rows.size, 2); assert.equal([...e.storage.map.keys()].filter(key => key.includes('solo-pending')).length, 0);
  assert.deepEqual(new Set([...e.rows.values()].map(row => row.state.clubs[0].kitColor)), new Set(['#aabbcc', '#bbccdd']));
});
test('cloud : quota local refusé conserve l’instantané précédent et ne lance aucune écriture', async t => {
  const e = await fixture(t), before = e.sync.storage.getItem(CAREER_KEY); e.storage.failing = true;
  assert.throws(() => e.sync.storage.setItem(CAREER_KEY, recolor(before, '#aabbcc')), /Quota/);
  assert.equal(e.sync.storage.getItem(CAREER_KEY), before); assert.equal(e.rows.get(e.game.id).revision, 1);
});
test('migration : import automatique une fois, redémarrage sans doublon et isolation après changement de compte', async () => {
  const e = soloTestService(), storage = new MemoryStorage(), json = exportCareer(career()); storage.setItem(CAREER_KEY, json);
  await recoverSoloGames(e.client(owner), owner, storage); assert.equal(storage.getItem(CAREER_KEY), null); assert.equal(e.rows.size, 1);
  await recoverSoloGames(e.client(owner), owner, storage); assert.equal(e.rows.size, 1);
  storage.setItem(CAREER_KEY, json); await recoverSoloGames(e.client(owner), owner, storage); assert.equal(e.rows.size, 1);
  storage.setItem(CAREER_KEY, json); const notice = await recoverSoloGames(e.client('other'), 'other', storage);
  assert.equal(storage.getItem(CAREER_KEY), json); assert.match(notice[0], /autre compte/);
  assert.equal(localSoloGames(storage, 'other').length, 0); assert.equal((await e.command('other', 'solo_list')).games.length, 0);
});
test('migration : réseau indisponible conserve l’original et le réessai complète sa sauvegarde', async () => {
  const e = soloTestService(), storage = new MemoryStorage(), json = exportCareer(career()); storage.setItem(CAREER_KEY, json);
  const client = e.client(owner); client.request = async () => { throw Error('Réseau indisponible'); };
  await assert.rejects(() => recoverSoloGames(client, owner, storage), /Réseau/); assert.equal(storage.getItem(CAREER_KEY), json);
  await recoverSoloGames(e.client(owner), owner, storage); assert.equal(storage.getItem(CAREER_KEY), null); assert.equal(e.rows.size, 1);
});
test('changement de compte pendant une requête : le serveur refuse le transfert et garde la copie locale', async t => {
  const e = await fixture(t), client = e.client(owner);
  client.request = (action, id, payload) => e.service.command('other', { action, payload });
  const sync = createSoloSync(client, owner, e.storage, e.game); t.after(() => sync.stop());
  sync.storage.setItem(CAREER_KEY, recolor(exportCareer(e.game.state), '#aabbcc')); assert.equal(await sync.flush(), false);
  assert.equal(e.rows.get(e.game.id).revision, 1); assert.equal((await e.command('other', 'solo_list')).games.length, 0);
  assert.ok(localSoloGames(e.storage, owner).some(entry => entry.game.pending));
});
