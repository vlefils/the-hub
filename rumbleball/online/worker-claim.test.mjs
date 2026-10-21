import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, addBot, startLeague } from './league.mjs';
import { createLeagueService } from './server.mjs';

function fixture() {
  const before = '2026-10-21T10:00:00Z', kickoff = '2026-10-21T18:00:00Z'; let now = Date.parse(kickoff), leasedUntil = 0, revision = 1, reads = 0, commits = 0;
  let state = startLeague(addBot(createLeague({ id: 'l', userId: 'a', name: 'Claims', clubName: 'Club', seed: 'claims', inviteCode: 'a'.repeat(32) }, before), 'a'), 'a', before, { firstMatchAt: kickoff });
  const store = { async get() { throw Error('Le worker ne doit pas relire toute la ligue après réservation'); }, async claim() {
    if (now < leasedUntil) return null;
    leasedUntil = now + 45000; reads++; return { state: structuredClone(state), revision };
  }, async commitTick(id, expected, next) { commits++; assert.equal(expected, revision); state = next; revision++; } };
  return { store, service: createLeagueService(store, { now: () => new Date(now).toISOString() }), state: () => state, reads: () => reads, commits: () => commits, elapse(ms) { now += ms; } };
}

test('worker : deux appels concurrents chargent et calculent une seule fois la ligue réservée', async () => {
  const e = fixture(), results = await Promise.all([e.service.tick('l'), e.service.tick('l')]);
  assert.equal(e.reads(), 1); assert.equal(e.commits(), 1); assert.equal(results.flat().filter(r => r.skipped).length, 1);
  assert.equal(e.state().status, 'broadcast'); assert.equal(e.state().night.games[0].broadcast.rounds.length, 1);
  assert.equal(e.state().members[0].club.transactions.filter(t => t.id === 'wages-0').length, 1);
});

test('worker : un conflit ne déclenche pas quatre recalculs supplémentaires', async () => {
  const e = fixture(); let commits = 0;
  e.store.commitTick = async () => { commits++; throw Error('RB_CONFLICT'); };
  assert.deepEqual(await e.service.tick('l'), [{ id: 'l', ok: true, skipped: true }]);
  assert.equal(commits, 1); assert.equal(e.reads(), 1);
});

test('worker : une panne conserve la ligue intacte et la réservation expire pour permettre la reprise', async () => {
  const e = fixture(), before = structuredClone(e.state()), commit = e.store.commitTick;
  e.store.commitTick = async () => { throw Error('Database timeout'); };
  assert.equal((await e.service.tick('l'))[0].ok, false); assert.deepEqual(e.state(), before);
  assert.equal((await e.service.tick('l'))[0].skipped, true); assert.equal(e.reads(), 1);
  e.elapse(45000); e.store.commitTick = commit;
  assert.equal((await e.service.tick('l'))[0].ok, true); assert.equal(e.reads(), 2); assert.equal(e.commits(), 1);
});
