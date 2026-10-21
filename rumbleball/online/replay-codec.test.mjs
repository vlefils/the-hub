import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from '../engine.mjs';
import { createLeague, addBot, advanceLeague, leagueProjection, replayProjection } from './league.mjs';
import { startReadyLeague } from '../test-support/online.mjs';
import { encodeRound, decodeRound, encodeReplayArchive, decodeReplayArchive, prepareLeagueCommit, ROUND_FORMAT, MAX_ARCHIVE_BYTES } from './replay-codec.mjs';

const normalized = value => JSON.parse(JSON.stringify(value));
function sample() {
  const initial = { players: [{ name: 'Nora « Écho »', hp: 12, position: { x: 1, y: 2 } }], calls: [], optional: 'remove', flag: false };
  const after = { players: [{ name: 'Nora « Écho »', hp: 8, position: { x: 2, y: 2 } }], calls: [1, 2], flag: true, newField: { value: null } };
  const before2 = { ...after, externalCorrection: 3 };
  return { round: 1, extra: 'preserved', turns: [
    { before: initial, after, events: [{ message: 'Déplacement', type: 'move' }], metadata: 5 },
    { before: before2, after: { ...before2, players: [], calls: [] }, events: [] },
  ] };
}

test('codec : références numériques, suppressions, tableaux, discontinuité et JSON exact sans mutation', () => {
  const original = sample(), before = structuredClone(original), packed = encodeRound(original);
  assert.equal(packed.format, ROUND_FORMAT); assert.ok(packed.turns[1].b.length);
  assert.ok(packed.turns.every(t => t.d.every(op => Number.isInteger(op[0]))));
  assert.deepEqual(decodeRound(normalized(packed)), original);
  assert.deepEqual(original, before); assert.equal(decodeRound(original), original);
  assert.deepEqual(decodeRound(encodeRound({ round: 2, turns: [] })), { round: 2, turns: [] });
  assert.throws(() => decodeRound({ ...packed, format: 'future-version' }), /Archive/);
});

test('codec : données invalides, chemins dangereux et indices hors limites refusés', () => {
  const packed = encodeRound(sample());
  for (const path of [['__proto__', 'polluted'], ['constructor', 'prototype'], ['players', -1]]) {
    const corrupt = structuredClone(packed); corrupt.paths[0] = path;
    assert.throws(() => decodeRound(corrupt), /Archive/);
  }
  for (const patch of [[999999, 3], [-1, 2], [0, 1, 2]]) {
    const corrupt = structuredClone(packed); corrupt.turns[0].d = [patch];
    assert.throws(() => decodeRound(corrupt), /Archive/);
  }
  assert.equal({}.polluted, undefined);
});

test('archive : gzip versionné, intégrité, identité et taille décompressée contrôlées ; ancien format lisible', async () => {
  const replay = { initial: sample().turns[0].before, rounds: [sample()] }, before = structuredClone(replay);
  const archive = await encodeReplayArchive(replay, 'match:1');
  const decoded = await decodeReplayArchive(normalized(archive), 'match:1');
  assert.deepEqual({ ...decoded, rounds: decoded.rounds.map(decodeRound) }, replay);
  assert.deepEqual(replay, before); assert.equal(await decodeReplayArchive(replay, 'match:1'), replay);
  assert.equal(await decodeReplayArchive(null, 'match:1'), null);
  await assert.rejects(decodeReplayArchive(archive, 'match:2'), /Archive/);
  await assert.rejects(decodeReplayArchive({ ...archive, sha256: '0'.repeat(64) }, 'match:1'), /Archive/);
  await assert.rejects(decodeReplayArchive({ ...archive, rawBytes: 1 }, 'match:1'), /Archive/);
  await assert.rejects(decodeReplayArchive({ ...archive, rawBytes: MAX_ARCHIVE_BYTES + 1 }, 'match:1'), /Archive/);
  await assert.rejects(decodeReplayArchive({ ...archive, data: '*invalid*' }, 'match:1'), /Archive/);
});

test('codec : deux rondes réelles restituées sans rejouer le moteur et sans modifier son RNG', () => {
  let state = createMatch({ seed: 'codec-round-bounded' });
  for (let count = 0; count < 2 && !state.finished; count++) {
    const round = state.round, turns = []; let safety = 0;
    do {
      assert.ok(++safety <= 16);
      const before = state, step = stepMatch(state, { stopAtRoundEnd: true }); state = step.state;
      turns.push({ before, after: state, events: step.events });
    } while (!state.finished && state.round === round);
    const source = { round, turns }, packed = encodeRound(source);
    assert.deepEqual(decodeRound(normalized(packed)), normalized(source));
    assert.ok(JSON.stringify(packed).length < JSON.stringify(source).length * 0.5);
  }
});

test('intégration : reprise depuis une ronde historique, direct identique et archive atomique sans données futures', async () => {
  const now = '2026-10-21T10:00:00Z';
  let state = startReadyLeague(addBot(createLeague({ id: 'l', userId: 'a', name: 'Codec', clubName: 'Club', seed: 'compacted', inviteCode: 'a'.repeat(32) }, now), 'a'), 'a', now);
  state = advanceLeague(state, state.nextLockAt, { maxRounds: 1 });
  const legacy = structuredClone(state);
  legacy.night.games[0].broadcast.rounds = legacy.night.games[0].broadcast.rounds.map(decodeRound);
  const resumed = advanceLeague(state, state.nextLockAt), resumedLegacy = advanceLeague(legacy, legacy.nextLockAt);
  const game = resumed.night.games[0];
  assert.deepEqual(game.broadcast.final, resumedLegacy.night.games[0].broadcast.final);
  for (let index = 0; index < game.broadcast.rounds.length; index++) {
    const at = new Date(Date.parse(game.playsAt) + 12000 * index).toISOString();
    assert.deepEqual(leagueProjection(resumed, 'a', at), leagueProjection(resumedLegacy, 'a', at));
    const view = leagueProjection(resumed, 'a', at);
    assert.equal(view.games[0].result, null);
    assert.ok(!JSON.stringify(view).includes('rb-round-delta'));
    assert.ok(!JSON.stringify(view).includes('"seed":"compacted"'));
    assert.ok(view.broadcast.turns.every(t => t.before.rng === 0 && t.after.rng === 0));
  }
  const settled = advanceLeague(resumed, game.endsAt), before = structuredClone(settled);
  const prepared = await prepareLeagueCommit(settled), archived = prepared.night.games[0].broadcast.archive;
  assert.deepEqual(settled, before); assert.deepEqual(prepared.night.games[0].broadcast.rounds, []);
  assert.deepEqual(prepared.members, settled.members); assert.deepEqual(prepared.history, settled.history);
  const replay = await decodeReplayArchive(archived, game.id);
  assert.deepEqual(replayProjection(settled, 'a', game.id, replay, game.endsAt), replayProjection(settled, 'a', game.id, null, game.endsAt));
  assert.throws(() => replayProjection(settled, 'a', game.id, replay, game.playsAt), /après la fin/);
  assert.throws(() => replayProjection(settled, 'intruder', game.id, replay, game.endsAt), /participants/);
  assert.equal(await prepareLeagueCommit(state), state);
});
