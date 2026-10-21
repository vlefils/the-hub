import test from 'node:test';
import assert from 'node:assert/strict';
import { connectOnline } from './client.mjs';
import { mountOnline } from './ui.mjs';
import { createLeague } from './league.mjs';
import { createLeagueService } from './server.mjs';
import { environment } from '../test-support/dom.mjs';

test('API bloquée : délai borné, requête annulée et erreur exploitable sans perdre la session', async t => {
  const timers = new Map(); let serial = 0, signal;
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => { timers.set(++serial, { callback, delay }); return serial; });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const auth = {}, client = await connectOnline({ enabled: true, url: 'https://example.invalid', publishableKey: 'public' }, async () => ({ createClient: () => ({ auth,
    functions: { invoke(name, options) { signal = options.signal; return new Promise(() => {}); } },
  }) }));
  const result = assert.rejects(client.request('get', 'league'), error => error.code === 'BACKEND_TIMEOUT');
  assert.equal([...timers.values()][0].delay, 15000); [...timers.values()][0].callback(); await result;
  assert.equal(signal.aborted, true); assert.equal(client.auth, auth); assert.equal(timers.size, 0);
});

test('API rapide : la minuterie est supprimée et les codes d’erreur restent conservés', async t => {
  const timers = new Set(); let serial = 0, fail = false;
  t.mock.method(globalThis, 'setTimeout', () => { timers.add(++serial); return serial; }); t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const client = await connectOnline({ enabled: true }, async () => ({ createClient: () => ({ auth: {}, functions: { async invoke() {
    return fail ? { error: { message: 'Conflict', context: { async json() { return { error: 'Sauvegarde concurrente', code: 'SOLO_CONFLICT' }; } } } } : { data: { saved: true } };
  } } }) }));
  assert.deepEqual(await client.request('get', 'league'), { saved: true }); assert.equal(timers.size, 0);
  fail = true; await assert.rejects(client.request('solo_save'), error => error.code === 'SOLO_CONFLICT'); assert.equal(timers.size, 0);
});

test('polling : les pannes espacent les lectures à 8, 16 puis 30 secondes ; retour à 4 secondes après succès', async t => {
  const e = environment(), timers = new Map(); let serial = 0, fail = false;
  globalThis.location = new URL('https://vlefils.github.io/the-hub/rumbleball/index.html');
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => { timers.set(++serial, { callback, delay }); return serial; }); t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const now = '2026-10-21T10:00:00Z', state = createLeague({ id: 'l', userId: 'a', name: 'Ligue', clubName: 'Club', seed: 'backoff', inviteCode: 'a'.repeat(32) }, now);
  const service = createLeagueService({ async get() { return { state, revision: 1 }; } }, { now: () => now });
  const app = await mountOnline(e.root, { enabled: true }, async () => ({ auth: { async getSession() { return { data: { session: { user: { id: 'a' } } } }; } }, async request(action, leagueId, payload) {
    if (fail) throw Error('Database timeout'); return service.command('a', { action, leagueId, payload });
  } }), { managedSession: true, initialView: { id: 'l' } }); t.after(app.stop);
  fail = true;
  for (const delay of [8000, 16000, 30000]) {
    const [id, timer] = [...timers][0]; timers.delete(id); await timer.callback(); assert.equal([...timers.values()][0].delay, delay);
  }
  fail = false; const [id, timer] = [...timers][0]; timers.delete(id); await timer.callback(); assert.equal([...timers.values()][0].delay, 4000);
  app.stop(); assert.equal(timers.size, 0);
});
