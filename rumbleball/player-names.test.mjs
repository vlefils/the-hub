import test from 'node:test';
import assert from 'node:assert/strict';
import { playerName, PLAYER_NAME_POOL_SIZE } from './player-names.mjs';
import { createCareer, confirmDraft } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';

test('noms : 4096 combinaisons sans numéros, déterministes et sans doublon dans un pool occupé', () => {
  assert.equal(PLAYER_NAME_POOL_SIZE, 4096);
  const used = new Set();
  for (let i = 0; i < 2048; i++) { const name = playerName(`player-${i}`, used); assert.ok(!/\d/.test(name)); assert.ok(!used.has(name)); used.add(name); }
  assert.equal(playerName('same'), playerName('same'));
  assert.notEqual(playerName('same', new Set([playerName('same')])), playerName('same'));
  const c = createCareer('Noms', 'names');
  const names = [...c.clubs.flatMap(club => club.players), ...c.market].map(p => p.name);
  assert.equal(new Set(names).size, names.length); assert.ok(names.every(name => !/\d/.test(name)));
});

test('noms : les anciennes sauvegardes perdent les suffixes numériques sans changer identifiants, portraits ni noms personnels', () => {
  let c = createCareer('Archives', 'old-names'); c = confirmDraft(c, c.market.slice(0, 6).map(p => p.id));
  c.clubs[0].players[5].name = 'Boussole 1'; c.market[0].name = 'Echo 2'; c.clubs[1].players[0].name = 'Le Frigo 3';
  c.clubs[0].players[0].name = 'Agent 47';
  const before = structuredClone(c), json = exportCareer(c), loaded = importCareer(json), again = importCareer(json);
  assert.deepEqual(loaded, again); assert.equal(loaded.clubs[0].players[0].name, 'Agent 47');
  for (const [a, b] of [[loaded.clubs[0].players[5], before.clubs[0].players[5]], [loaded.market[0], before.market[0]], [loaded.clubs[1].players[0], before.clubs[1].players[0]]]) {
    assert.ok(!/\d/.test(a.name)); assert.deepEqual({ ...a, name: b.name }, b);
  }
  assert.deepEqual(importCareer(exportCareer(loaded)), loaded);
});
