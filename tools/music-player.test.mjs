import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeStorage } from '../vendor/pekly/hub-bridge.js';

test('player preferences stay usable when storage is denied or full', () => {
  globalThis.window = { localStorage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } };
  const denied = createSafeStorage();
  assert.equal(denied.getItem('oss_music_player_volume'), null);
  denied.setItem('oss_music_player_volume', 0);
  assert.equal(denied.getItem('oss_music_player_volume'), '0');
  globalThis.window = { localStorage: { getItem() { return null; }, setItem() { throw new Error('quota'); } } };
  const full = createSafeStorage();
  full.setItem('oss_music_player_theme', 'cyberpunk');
  assert.equal(full.getItem('oss_music_player_theme'), 'cyberpunk');
});

test('corrupt saved playlist/favorites/counts cannot break player initialization', () => {
  const saved = new Map();
  globalThis.window = { localStorage: { getItem: key => saved.get(key) ?? null } };
  const storage = createSafeStorage();
  for (const value of ['{broken', 'null', '12', '{}', '[null]']) {
    saved.set('the-hub-oss_music_player_favorites', value);
    saved.set('the-hub-oss_music_player_order', value);
    assert.equal(storage.getItem('oss_music_player_favorites'), null);
    assert.equal(storage.getItem('oss_music_player_order'), null);
  }
  for (const value of ['{broken', 'null', '12', '[]']) {
    saved.set('the-hub-oss_play_counts', value);
    assert.equal(storage.getItem('oss_play_counts'), null);
  }
  saved.set('the-hub-oss_music_player_favorites', '["song.mp3"]');
  saved.set('the-hub-oss_play_counts', '{"song.mp3":4}');
  assert.deepEqual(JSON.parse(storage.getItem('oss_music_player_favorites')), ['song.mp3']);
  assert.deepEqual(JSON.parse(storage.getItem('oss_play_counts')), { 'song.mp3': 4 });
});

test('preferences are namespaced and preserve a saved zero volume', () => {
  const saved = new Map([['oss_music_player_volume', '0.9'], ['the-hub-oss_music_player_volume', '0']]);
  globalThis.window = { localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } };
  const storage = createSafeStorage();
  assert.equal(storage.getItem('oss_music_player_volume'), '0');
  storage.setItem('oss_music_player_volume', 0.5);
  assert.equal(saved.get('the-hub-oss_music_player_volume'), '0.5');
  assert.equal(saved.get('oss_music_player_volume'), '0.9');
});
