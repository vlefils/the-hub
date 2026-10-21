// One-off, serial migration. Defaults to backup + verification only.
// node --env-file=.local/rumbleball-supabase.env tools/compact-rumbleball-replays.mjs
//   --project-ref=PROJECT --backup-dir=.local/replay-backup [--apply]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setPriority, constants } from 'node:os';
import { encodeReplayArchive, decodeReplayArchive, decodeRound, ARCHIVE_FORMAT } from '../rumbleball/online/replay-codec.mjs';

try { setPriority(process.pid, constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
const args = process.argv.slice(2), option = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
assert.ok(args.every(a => ['--project-ref=', '--backup-dir='].some(prefix => a.startsWith(prefix)) || a === '--apply'), 'Unknown argument');
const project = option('project-ref'), directory = option('backup-dir'), apply = args.includes('--apply');
assert.match(project ?? '', /^[a-z0-9]{20}$/);
assert.ok(directory && !directory.split(/[\\/]/).includes('..'), 'A dedicated backup directory is required');
const base = new URL(process.env.SUPABASE_URL);
assert.equal(base.hostname, `${project}.supabase.co`);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; assert.ok(key, 'Service role key required');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const hash = text => createHash('sha256').update(text).digest('hex');
const expanded = replay => ({ ...replay, rounds: replay.rounds.map(decodeRound) });
async function read(table, params) {
  const url = new URL(`/rest/v1/${table}`, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = await fetch(url, { headers: { ...headers, Prefer: 'count=exact', Range: '0-999' }, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `${table}: HTTP ${response.status}`);
  const rows = await response.json(); assert.ok(Array.isArray(rows));
  assert.equal(rows.length, Number(response.headers.get('content-range')?.split('/').at(-1)), 'Incomplete response; narrow the migration scope before continuing');
  return rows;
}
async function businessSnapshot() {
  return {
    leagues: await read('rb_leagues', { select: 'id,revision,next_tick_at,updated_at', order: 'id' }),
    solo: await read('rb_solo_saves', { select: 'id,revision,last_write_id,updated_at', order: 'id' }),
  };
}
async function loadReplay(leagueId, matchId) {
  const rows = await read('rb_replays', { select: '*', league_id: `eq.${leagueId}`, match_id: `eq.${matchId}` });
  assert.equal(rows.length, 1); return rows[0];
}
async function writeManifest(manifest) {
  await fs.writeFile(`${directory}/manifest.next.json`, JSON.stringify(manifest, null, 2));
  await fs.rename(`${directory}/manifest.next.json`, `${directory}/manifest.json`);
}

if (!apply) {
  await fs.mkdir(directory, { recursive: false });
  const business = await businessSnapshot();
  const leagues = await read('rb_leagues', { select: '*', order: 'id' });
  await fs.writeFile(`${directory}/leagues.json`, JSON.stringify(leagues));
  const ids = await read('rb_replays', { select: 'league_id,match_id', order: 'league_id,match_id' });
  const manifest = { project, preparedAt: new Date().toISOString(), business, entries: [] };
  for (const [index, id] of ids.entries()) {
    const row = await loadReplay(id.league_id, id.match_id);
    if (row.replay.format === ARCHIVE_FORMAT) { await decodeReplayArchive(row.replay, id.match_id); continue; }
    const original = JSON.stringify(row.replay), archive = await encodeReplayArchive(row.replay, id.match_id);
    assert.deepEqual(expanded(await decodeReplayArchive(archive, id.match_id)), expanded(row.replay));
    const encoded = JSON.stringify(archive), source = `replay-${index}.json`, packed = `archive-${index}.json`;
    await fs.writeFile(`${directory}/${source}`, original);
    await fs.writeFile(`${directory}/${packed}`, encoded);
    assert.equal(hash(await fs.readFile(`${directory}/${source}`)), hash(original));
    assert.equal(hash(await fs.readFile(`${directory}/${packed}`)), hash(encoded));
    manifest.entries.push({ leagueId: id.league_id, matchId: id.match_id, source, packed, originalHash: hash(original), archiveHash: hash(encoded), originalBytes: Buffer.byteLength(original), archiveBytes: Buffer.byteLength(encoded), converted: false });
    await writeManifest(manifest);
  }
  await writeManifest(manifest);
  console.log(JSON.stringify({ mode: 'backup-and-verify', backup: directory, archives: manifest.entries.length,
    originalBytes: manifest.entries.reduce((n, e) => n + e.originalBytes, 0), archiveBytes: manifest.entries.reduce((n, e) => n + e.archiveBytes, 0) }));
} else {
  const manifest = JSON.parse(await fs.readFile(`${directory}/manifest.json`, 'utf8'));
  assert.equal(manifest.project, project);
  // Verify every backup before changing the first row. Keep all original files.
  for (const entry of manifest.entries) {
    assert.match(entry.source, /^replay-\d+\.json$/); assert.match(entry.packed, /^archive-\d+\.json$/);
    const original = await fs.readFile(`${directory}/${entry.source}`), encoded = await fs.readFile(`${directory}/${entry.packed}`);
    assert.equal(hash(original), entry.originalHash); assert.equal(hash(encoded), entry.archiveHash);
    assert.deepEqual(expanded(await decodeReplayArchive(JSON.parse(encoded), entry.matchId)), expanded(JSON.parse(original)));
  }
  const before = await businessSnapshot();
  for (const entry of manifest.entries) {
    const expected = JSON.parse(await fs.readFile(`${directory}/${entry.source}`, 'utf8'));
    const archive = JSON.parse(await fs.readFile(`${directory}/${entry.packed}`, 'utf8'));
    const response = await fetch(new URL('/rest/v1/rpc/rb_compress_replay', base), {
      method: 'POST', headers, body: JSON.stringify({ p_league_id: entry.leagueId, p_match_id: entry.matchId, p_expected: expected, p_archive: archive }), signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200, `Archive conversion: HTTP ${response.status}`);
    const stored = await loadReplay(entry.leagueId, entry.matchId);
    assert.deepEqual(stored.replay, archive);
    assert.deepEqual(expanded(await decodeReplayArchive(stored.replay, entry.matchId)), expanded(expected));
    entry.converted = true; await writeManifest(manifest);
  }
  manifest.completedAt = new Date().toISOString(); manifest.businessUnchanged = JSON.stringify(before) === JSON.stringify(await businessSnapshot());
  await writeManifest(manifest);
  console.log(JSON.stringify({ mode: 'applied-and-verified', converted: manifest.entries.filter(e => e.converted).length, businessUnchanged: manifest.businessUnchanged, backup: directory }));
}
