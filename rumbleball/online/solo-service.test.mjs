import test from 'node:test';
import assert from 'node:assert/strict';
import { soloTestService } from '../test-support/solo.mjs';
import { createCareer, confirmDraft, launchCareerMatch, saveCareerTurn } from '../career.mjs';
import { stepMatch } from '../engine.mjs';
import { exportCareer } from '../career-storage.mjs';

const owner = 'owner', other = 'other';
const career = () => { const c = createCareer('Solo distant', 'cloud-solo'); return confirmDraft(c, c.market.slice(0, 6).map(p => p.id)); };
test('sauvegardes : authentification, garde du compte, plusieurs parties et isolation des lectures', async () => {
  const s = soloTestService();
  await assert.rejects(() => s.command(null, 'solo_list'), /Authentification/);
  await assert.rejects(() => s.service.command(owner, { action: 'solo_list', payload: { accountId: other } }), /compte connecté/);
  const a = (await s.command(owner, 'solo_create')).game, b = (await s.command(owner, 'solo_create')).game;
  assert.notEqual(a.id, b.id); assert.equal(a.state, null); assert.equal((await s.command(owner, 'solo_list')).games.length, 2);
  assert.equal((await s.command(other, 'solo_list')).games.length, 0);
  await assert.rejects(() => s.command(other, 'solo_get', { id: a.id }), /introuvable/);
  await assert.rejects(() => s.command(other, 'solo_save', { id: a.id, revision: 1, writeId: crypto.randomUUID(), json: exportCareer(career()) }), /introuvable/);
  assert.equal(s.rows.get(a.id).state, null);
});
test('solo : instantané complet en cours de rencontre, sans nouveau jet ni salaire au chargement', async () => {
  const s = soloTestService(), game = (await s.command(owner, 'solo_create')).game;
  let c = launchCareerMatch(career()); const step = stepMatch(c.current.state); c = saveCareerTurn(c, step.state, step.events);
  const payload = { id: game.id, revision: 1, writeId: crypto.randomUUID(), json: exportCareer(c) };
  const { saved } = await s.command(owner, 'solo_save', payload); assert.equal(saved.revision, 2);
  const loaded = (await s.command(owner, 'solo_get', { id: game.id })).game;
  assert.deepEqual(loaded.state, c); assert.equal(loaded.state.current.state.rng, c.current.state.rng);
  assert.equal(loaded.state.transactions.filter(t => t.label === 'Salaires de la journée').length, 1);
  assert.equal((await s.command(owner, 'solo_list')).games[0].state, undefined);
  await s.command(owner, 'solo_save', { id: game.id, revision: 2, writeId: crypto.randomUUID(), json: null });
  assert.equal((await s.command(owner, 'solo_get', { id: game.id })).game.state, null);
});
test('solo : écritures idempotentes, révision concurrente refusée et JSON invalide sans perte', async () => {
  const s = soloTestService(), game = (await s.command(owner, 'solo_create')).game;
  const payload = { id: game.id, revision: 1, writeId: crypto.randomUUID(), json: exportCareer(career()) };
  await s.command(owner, 'solo_save', payload); await s.command(owner, 'solo_save', payload);
  assert.equal(s.rows.get(game.id).revision, 2);
  await assert.rejects(() => s.command(owner, 'solo_save', { ...payload, writeId: crypto.randomUUID() }), { code: 'SOLO_CONFLICT' });
  for (const json of ['{}', 'bad', exportCareer(career()).replace('"balance": 600', '"balance": 999999')]) {
    await assert.rejects(() => s.command(owner, 'solo_save', { ...payload, revision: 2, json, writeId: crypto.randomUUID() }));
  }
  assert.equal(s.rows.get(game.id).revision, 2);
});
test('import automatique : dédoublonnage concurrent par compte, sans remplacer une version cloud plus récente', async () => {
  const s = soloTestService(), json = exportCareer(career());
  const [first, again] = await Promise.all([s.command(owner, 'solo_import', { json }), s.command(owner, 'solo_import', { json })]);
  assert.equal(first.game.id, again.game.id); assert.equal(s.rows.size, 1);
  const c = career(); c.clubs[0].kitColor = '#aabbcc';
  await s.command(owner, 'solo_save', { id: first.game.id, revision: 1, writeId: crypto.randomUUID(), json: exportCareer(c) });
  const retry = await s.command(owner, 'solo_import', { json });
  assert.equal(retry.alreadyImported, true); assert.equal(retry.game.revision, 2); assert.equal(retry.game.state.clubs[0].kitColor, '#aabbcc');
  await s.command(other, 'solo_import', { json }); assert.equal(s.rows.size, 2);
});
