import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, addBot, advanceLeague, leagueProjection, replayProjection } from './league.mjs';
import { startReadyLeague } from '../test-support/online.mjs';

test('archive : compacter une rencontre terminée conserve le replay intégral et la progression', () => {
  const now = '2026-10-21T10:00:00Z';
  let state = startReadyLeague(addBot(createLeague({ id: 'l', userId: 'a', name: 'Archives', clubName: 'Club', seed: 'compacted', inviteCode: 'a'.repeat(32) }, now), 'a'), 'a', now);
  state = advanceLeague(state, state.nextLockAt);
  const end = state.night.endsAt; state = advanceLeague(state, end);
  const game = state.night.games[0], archive = structuredClone({ initial: game.broadcast.initial, rounds: game.broadcast.rounds });
  const expected = replayProjection(state, 'a', game.id, null, end), before = leagueProjection(state, 'a', end);
  assert.equal(game.settled, true); assert.ok(archive.rounds.length > 0);
  game.broadcast.rounds = [];
  assert.deepEqual(replayProjection(state, 'a', game.id, archive, end), expected);
  assert.deepEqual(leagueProjection(state, 'a', end), before);
  assert.ok(leagueProjection(state, 'a', end).history.every(match => match.replayAvailable));
});
