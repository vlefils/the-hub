// Offline PostgreSQL integration. Install @electric-sql/pglite in a scratch
// folder and pass its dist/index.js path, or make the package resolvable here.
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLeague, addBot, startLeague, advanceLeague, leagueProjection, replayProjection } from '../../rumbleball/online/league.mjs';
import { encodeReplayArchive, decodeReplayArchive, prepareLeagueCommit } from '../../rumbleball/online/replay-codec.mjs';

const { PGlite } = await import(process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : '@electric-sql/pglite');
const db = new PGlite(), clean = value => JSON.parse(JSON.stringify(value));
const owner = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
const before = '2030-10-22T10:00:00Z', kickoff = '2030-10-22T18:00:00Z';
const capacity = Number(process.argv[4] ?? 4);
assert.ok(Number.isSafeInteger(capacity) && capacity >= 2 && capacity <= 16);
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.result;
const read = (now, mode = 'view', frames = true) => scalar('select public.rb_read_league($1,$2,$3,$4) as result', [id, now, mode, frames]);
const commit = (revision, state, legacy = false) => scalar(`select public.${legacy ? 'rb_commit_league' : 'rb_commit_league_v2'}($1,$2,$3,false) as result`, [id, revision, JSON.stringify(state)]);
let checks = 0;
try {
  await db.exec('create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;');
  await db.query('insert into auth.users(id) values($1)', [owner]);
  for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  checks++; console.log('PASS: all migrations apply to local PostgreSQL');
  let state = createLeague({ id, userId: owner, name: 'Stockage local', clubName: 'Club local', seed: 'split-storage', inviteCode: 'a'.repeat(32) }, before);
  for (let n = 1; n < capacity; n++) state = addBot(state, owner);
  let revision = await commit(0, state, true);
  state = startLeague(state, owner, before, { firstMatchAt: kickoff }); revision = await commit(revision, state);
  assert.equal((await read(before)).state.matchStorage, 2);
  checks++;
  let reference = state, time = Date.parse(kickoff), ticks = 0, readBytes = 0, writeBytes = 0, maxStoredBytes = 0, legacyReadBytes = 0, legacyWriteBytes = 0;
  const referenceReplays = new Map();
  do {
    const now = new Date(time).toISOString();
    await db.query("update public.rb_leagues set next_tick_at=clock_timestamp()-interval '1 second' where id=$1", [id]);
    const row = await scalar('select public.rb_claim_tick_v2($1) as result', [id]);
    assert.equal(await scalar('select public.rb_claim_tick_v2($1) as result', [id]), null);
    assert.ok(row.claimedAt);
    // Claim hydration uses the SQL wall clock. Request the same selective worker
    // view at the simulated evening clock for due-settlement comparisons.
    const input = await read(now, 'worker', false);
    readBytes += Buffer.byteLength(JSON.stringify(input.state)); legacyReadBytes += Buffer.byteLength(JSON.stringify(reference));
    const next = advanceLeague(input.state, now, { maxRounds: 1 });
    reference = advanceLeague(reference, now, { maxRounds: 1 });
    for (const game of reference.night.games) if (game.settled && game.broadcast.rounds.length) referenceReplays.set(game.id, { initial: game.broadcast.initial, rounds: structuredClone(game.broadcast.rounds) });
    reference = await prepareLeagueCommit(reference); legacyWriteBytes += Buffer.byteLength(JSON.stringify(reference));
    for (const game of reference.night.games) delete game.broadcast.archive;
    writeBytes += Buffer.byteLength(JSON.stringify(next));
    const expectedRevision = revision; revision = await commit(revision, next);
    await assert.rejects(commit(expectedRevision, next), /RB_CONFLICT/);
    const raw = await scalar('select state as result from public.rb_leagues where id=$1', [id]);
    maxStoredBytes = Math.max(maxStoredBytes, Buffer.byteLength(JSON.stringify(raw)));
    for (const game of raw.night.games) {
      assert.equal(game.broadcast.initial, undefined); assert.equal(game.config.seed, undefined); assert.deepEqual(game.broadcast.rounds, []);
      const stored = await scalar('select checkpoint as result from public.rb_matches where league_id=$1 and match_id=$2', [id, game.id]);
      assert.deepEqual(stored, clean(reference.night.games.find(g => g.id === game.id).broadcast.final));
    }
    const publicRow = await read(now, 'view', true);
    assert.deepEqual(clean(leagueProjection(publicRow.state, owner, now)), clean(leagueProjection(reference, owner, now)));
    const light = await read(now, 'view', false);
    assert.equal(leagueProjection(light.state, owner, now, { broadcast: false }).broadcast, null);
    state = next; ticks++;
    const pending = state.night.games.filter(game => !game.settled);
    const deadline = state.status === 'broadcast' && pending.length && state.night.games.every(game => game.broadcast.final.finished)
      ? Math.min(...pending.map(game => Date.parse(game.endsAt))) : time + 10000;
    time = Math.max(time + 10000, Date.parse(kickoff) + Math.ceil((deadline - Date.parse(kickoff)) / 10000) * 10000);
    if (ticks > 250) throw new Error('Evening did not terminate');
  } while (state.status !== 'preparation');
  checks++; console.log('PASS: selective checkpoints, public frames, CAS conflicts and complete evening match the legacy state');

  const now = new Date(time).toISOString(), latest = await read(now, 'worker', false);
  for (const game of reference.night.games) {
    const data = await scalar('select public.rb_read_match_replay($1,$2) as result', [id, game.id]);
    assert.deepEqual(clean(replayProjection(latest.state, owner, game.id, data, now)), clean(replayProjection(reference, owner, game.id, referenceReplays.get(game.id), now)));
  }
  checks++; console.log('PASS: every completed replay is identical');
  const game = reference.night.games[0], replay = referenceReplays.get(game.id);
  const archive = await encodeReplayArchive(replay, game.id); assert.deepEqual(await decodeReplayArchive(clean(archive), game.id), clean(replay));
  checks++;

  const originalReplay = await scalar('select public.rb_read_match_replay($1,$2) as result', [id, game.id]);
  const bad = structuredClone(latest.state), target = bad.night.games[0];
  target.config = game.config; target.broadcast = { initial: originalReplay.initial, final: game.broadcast.final, rounds: structuredClone(originalReplay.rounds) }; target.broadcast.rounds[0].auditCorruption = true;
  await assert.rejects(commit(revision, bad), /RB_ROUND_CONFLICT/);
  assert.equal((await read(now)).revision, revision);
  const persisted = await scalar('select public.rb_read_match_replay($1,$2) as result', [id, game.id]);
  assert.deepEqual(persisted, originalReplay);
  checks++; console.log('PASS: conflicting immutable round rolls back checkpoint and league together');

  for (const role of ['anon', 'authenticated']) {
    assert.equal(await scalar("select has_table_privilege($1,'public.rb_matches','select') as result", [role]), false);
    assert.equal(await scalar("select has_table_privilege($1,'public.rb_match_rounds','select') as result", [role]), false);
    assert.equal(await scalar("select has_function_privilege($1,'public.rb_read_league(uuid,timestamptz,text,boolean)','execute') as result", [role]), false);
  }
  checks++; console.log('PASS: private checkpoints and functions are inaccessible to browser roles');
  await db.query('delete from public.rb_leagues where id=$1', [id]);
  assert.equal(await scalar('select count(*)::integer as result from public.rb_matches'), 0);
  assert.equal(await scalar('select count(*)::integer as result from public.rb_match_rounds'), 0);
  checks++; console.log('PASS: league deletion cascades to checkpoints and rounds');

  // Conversion is also exercised after rounds have been computed by the
  // legacy writer, including a completed replay already compacted by SQL.
  for (const completed of [false, true]) {
    let legacy = createLeague({ id, userId: owner, name: 'Ancien stockage', clubName: 'Club', seed: 'legacy-storage', inviteCode: 'b'.repeat(32) }, before);
    legacy = addBot(legacy, owner); let rev = await commit(0, legacy, true);
    legacy = startLeague(legacy, owner, before, { firstMatchAt: kickoff }); rev = await commit(rev, legacy, true);
    legacy = advanceLeague(legacy, kickoff, { maxRounds: completed ? Infinity : 1 });
    if (completed) legacy = advanceLeague(legacy, legacy.night.endsAt);
    rev = await commit(rev, legacy, true);
    const previous = await read(completed ? legacy.night.endsAt : kickoff);
    assert.equal(previous.state.matchStorage, undefined);
    const oldArchive = await scalar('select replay as result from public.rb_replays where league_id=$1 and match_id=$2', [id, legacy.night.games[0].id]);
    rev = await commit(rev, previous.state);
    const at = completed ? new Date(Date.parse(legacy.night.endsAt) + 10000).toISOString() : new Date(Date.parse(legacy.night.games[0].playsAt) + 1000).toISOString();
    const migrated = await read(at);
    assert.deepEqual(clean(leagueProjection(migrated.state, owner, at)), clean(leagueProjection(previous.state, owner, at)));
    if (completed) {
      assert.ok(oldArchive);
      assert.deepEqual(await scalar('select replay as result from public.rb_replays where league_id=$1 and match_id=$2', [id, legacy.night.games[0].id]), oldArchive);
      assert.ok(replayProjection(migrated.state, owner, legacy.night.games[0].id, oldArchive, at).rounds.length);
    } else {
      assert.equal(await scalar('select round_count as result from public.rb_matches where league_id=$1', [id]), legacy.night.games[0].broadcast.rounds.length);
    }
    await db.query('delete from public.rb_leagues where id=$1', [id]); checks++;
  }
  console.log('PASS: active legacy rounds and compacted completed archives survive conversion');
  const report = { checks, ticks, clubs: capacity, maxStoredBytes, readBytes, writeBytes, legacyReadBytes, legacyWriteBytes, database: 'local PGlite PostgreSQL; no remote access' };
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.close(); }
