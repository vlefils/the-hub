// node supabase/tests/permissions.mjs .local/multiplayer-validation/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLeague, addBot, startLeague } from '../../rumbleball/online/league.mjs';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])));
const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); alter default privileges in schema public grant all on tables to service_role;');
const sql = await readFile(new URL('../migrations/20261018090000_rumbleball.sql', import.meta.url), 'utf8');
await db.exec(sql); await db.exec(sql); // Reapplying the isolated setup preserves rows.
const owner = '00000000-0000-4000-8000-000000000001', id = '00000000-0000-4000-8000-000000000002';
await db.query('insert into auth.users(id) values($1)', [owner]);
const state = addBot(createLeague({ id, userId: owner, name: 'Ligue SQL', clubName: 'Club SQL', inviteCode: 'a'.repeat(32), seed: 'sql' }, new Date().toISOString()), owner);
const commit = (revision, s, prep = false) => db.query('select public.rb_commit_league($1,$2,$3,$4) as revision', [id, revision, s, prep]);
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(() => db.query('select state from public.rb_leagues'), /permission denied/);
  await assert.rejects(() => commit(0, state), /permission denied/);
  await db.exec('reset role');
}
await db.exec('set role service_role');
assert.equal((await commit(0, state)).rows[0].revision, 1);
assert.equal((await db.query('select * from public.rb_memberships')).rows.length, 1);
const lobby = (await db.query("select capacity, member_count, jsonb_array_length(state->'bots') as bots from public.rb_leagues")).rows[0];
assert.equal(lobby.capacity, null); assert.equal(lobby.member_count, 1); assert.equal(lobby.bots, 1, 'Le bot ne requiert aucun utilisateur Auth ni migration SQL.');
await assert.rejects(() => commit(0, state), /RB_CONFLICT/);
const locked = { ...startLeague(state, owner, new Date().toISOString()), nextLockAt: '2000-01-01T19:00:00Z' };
assert.equal((await commit(1, locked)).rows[0].revision, 2);
assert.equal((await db.query('select capacity from public.rb_leagues')).rows[0].capacity, 2, 'La capacité est figée au lancement, bots compris.');
await assert.rejects(() => commit(2, state, true), /RB_LOCKED/);
assert.equal((await db.query('select revision from public.rb_leagues')).rows[0].revision, 2);
assert.equal((await commit(2, locked, false)).rows[0].revision, 3);
await assert.rejects(() => commit(2, locked, false), /RB_CONFLICT/);
await assert.rejects(() => db.query('update public.rb_leagues set revision=100'), /permission denied/);
const recorded = (matchId, settled = true) => ({ id: matchId, settled, broadcast: { initial: { seed: 'private' }, rounds: [{ round: 1, turns: [] }] } });
let replayState = { ...locked, history: [{ id: 'old-match' }], night: { games: [recorded('old-match')] } };
assert.equal((await commit(3, replayState)).rows[0].revision, 4);
await db.exec('reset role');
const replaySql = await readFile(new URL('../migrations/20261018210000_rumbleball_replays.sql', import.meta.url), 'utf8');
await db.exec(replaySql); await db.exec(replaySql);
await db.exec('set role service_role');
assert.equal((await db.query('select * from public.rb_replays')).rows.length, 1, 'Backfill du dernier match terminé.');
const recovered = (await db.query('select revision,state from public.rb_leagues')).rows[0];
assert.equal(recovered.revision, 5, 'Le backfill change la révision une seule fois.');
assert.equal(recovered.state.history[0].replayAvailable, true, 'Le replay récupéré reste découvrable après une nouvelle soirée.');
await assert.rejects(() => commit(4, replayState), /RB_CONFLICT/);
replayState = recovered.state;
replayState.night.games.push(recorded('next-match', false));
assert.equal((await commit(5, replayState)).rows[0].revision, 6);
assert.equal((await db.query('select * from public.rb_replays')).rows.length, 1, 'Aucun archivage avant règlement.');
replayState.night.games[1].settled = true;
assert.equal((await commit(6, replayState)).rows[0].revision, 7);
assert.equal((await db.query('select * from public.rb_replays')).rows.length, 2);
replayState.night.games[0].broadcast.initial.seed = 'changed';
assert.equal((await commit(7, replayState)).rows[0].revision, 8);
assert.equal((await db.query("select replay->'initial'->>'seed' as seed from public.rb_replays where match_id='old-match'")).rows[0].seed, 'private', 'Archive immuable lors des appels suivants.');
assert.equal((await commit(8, { ...replayState, night: null })).rows[0].revision, 9);
assert.equal((await db.query('select * from public.rb_replays')).rows.length, 2, 'Les archives survivent au changement de soirée.');
assert.equal((await db.query("select state->'history'->0->>'replayAvailable' as available from public.rb_leagues")).rows[0].available, 'true');
await assert.rejects(() => db.query('delete from public.rb_replays'), /permission denied/);
await db.exec('reset role');
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(() => db.query('select * from public.rb_replays'), /permission denied/);
  await db.exec('reset role');
}
await db.close();
console.log('SQL passed: isolated migrations, permissions, membership, CAS, deadlines, replay backfill, atomic archive and retention.');
