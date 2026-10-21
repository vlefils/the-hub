import test from 'node:test';
import assert from 'node:assert/strict';
import { navigation, readNavigation, saveNavigation } from './navigation.mjs';
import { MemoryStorage } from './test-support/solo.mjs';

test('navigation : état réduit, valeurs validées et comptes séparés', () => {
  const storage = new MemoryStorage();
  saveNavigation(storage, 'a', { mode: 'solo', id: 'save-a', screen: 'Ligue', secret: 'ignored' });
  saveNavigation(storage, 'b', { mode: 'multi', id: 'league-b', screen: 'Club' });
  assert.deepEqual(readNavigation(storage, 'a'), { mode: 'solo', id: 'save-a', screen: 'Ligue' });
  assert.deepEqual(readNavigation(storage, 'b'), { mode: 'multi', id: 'league-b', screen: 'Club' });
  assert.equal(readNavigation(storage, 'c'), null);
  assert.equal(navigation({ mode: 'solo' }), null);
  assert.equal(navigation({ mode: 'unknown' }), null);
  assert.equal(navigation({ mode: 'multi', id: 'l', screen: 'Direct' }).screen, 'Direct');
  assert.equal(navigation({ mode: 'solo', id: 's', screen: 'Direct' }).screen, 'Club');
  assert.deepEqual(navigation({ mode: 'multi', id: 'l', screen: 'unknown', replayId: 'game' }), { mode: 'multi', id: 'l', screen: 'Ligue', replayId: 'game' });
});

test('navigation : stockage corrompu ou indisponible sans bloquer le jeu', () => {
  const storage = new MemoryStorage(); storage.setItem('rumbleball.navigation.v1:a', '{broken');
  assert.equal(readNavigation(storage, 'a'), null);
  const unavailable = { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); } };
  assert.equal(readNavigation(unavailable, 'a'), null);
  assert.doesNotThrow(() => saveNavigation(unavailable, 'a', { mode: 'home' }));
});
