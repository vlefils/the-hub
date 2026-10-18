// node supabase/tests/permissions.mjs .local/multiplayer-validation/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLeague } from '../../rumbleball/online/league.mjs';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])));
const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); alter default privileges in schema public grant all on tables to service_role;');
const sql = await readFile(new URL('../migrations/20261018090000_rumbleball.sql', import.meta.url), 'utf8');
await db.exec(sql); await db.exec(sql); // Reapplying the isolated setup preserves rows.
const owner = '00000000-0000-4000-8000-000000000001', id = '00000000-0000-4000-8000-000000000002';
await db.query('insert into auth.users(id) values($1)', [owner]);
const state = createLeague({ id, userId: owner, name: 'Ligue SQL', clubName: 'Club SQL', inviteCode: 'a'.repeat(32), seed: 'sql' }, new Date().toISOString());
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
await assert.rejects(() => commit(0, state), /RB_CONFLICT/);
const locked = { ...state, status: 'preparation', nextLockAt: '2000-01-01T19:00:00Z' };
assert.equal((await commit(1, locked)).rows[0].revision, 2);
await assert.rejects(() => commit(2, state, true), /RB_LOCKED/);
assert.equal((await db.query('select revision from public.rb_leagues')).rows[0].revision, 2);
assert.equal((await commit(2, locked, false)).rows[0].revision, 3);
await assert.rejects(() => commit(2, locked, false), /RB_CONFLICT/);
await assert.rejects(() => db.query('update public.rb_leagues set revision=100'), /permission denied/);
await db.close();
console.log('SQL passed: isolated migration, permissions, membership, CAS, authoritative deadline and worker retry.');
