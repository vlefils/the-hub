import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, joinLeague, startLeague, advanceLeague, fixturesFor, leagueTable, leagueProjection, editPreparation, replayProjection } from './league.mjs';
import { validPlayoffs, currentPlayoffRound } from '../playoffs.mjs';

const day = '2026-10-18T10:00:00Z';
function fixture(capacity = 6) {
  let s = createLeague({ id: 'playoff-league', userId: 'u0', name: 'Ligue', clubName: 'Chromés', inviteCode: 'a'.repeat(32), seed: 'online-playoffs', capacity }, day);
  for (let i = 1; i < capacity; i++) s = joinLeague(s, `u${i}`, { clubName: `Club ${i}` }, day);
  return startLeague(s, 'u0', day);
}
function evening(s) { s = advanceLeague(s, s.nextLockAt); return advanceLeague(s, s.night.endsAt); }
let group;
test.before(() => { group = fixture(); for (let i = 0; i < 10; i++) group = evening(group); });

test('ligue : groupe terminé, classement inchangé, quatre qualifiés et fatigue retirée pour tous', () => {
  assert.equal(group.season, 1); assert.equal(group.day, 10); assert.equal(group.phase, 'playoffs'); assert.equal(group.history.length, 30);
  assert.ok(group.members.every(member => member.club.players.every(p => p.fatigue === 0)));
  const table = leagueTable(group); assert.ok(table.every(row => row.played === 10));
  assert.deepEqual(group.playoffs.seeds, table.slice(0, 4).map(row => row.id));
  const [a, b, c, d] = group.playoffs.seeds; assert.deepEqual(fixturesFor(group), [[a, d], [b, c]]);
  assert.equal(validPlayoffs(group.playoffs, table.map(row => row.id), 'playoff-league:s1:playoffs'), true);
  assert.deepEqual(evening(fixture()).phase, 'groups');
});

test('ancienne ligue : sans métadonnées de phase, rejoint les playoffs à la fin du groupe', () => {
  let old = fixture(2); delete old.phase; delete old.playoffs; delete old.playoffHistory;
  old = evening(old); for (const result of old.history) delete result.phase;
  assert.equal(leagueTable(old).every(row => row.played === 1), true);
  old = evening(old); assert.equal(old.phase, 'playoffs'); assert.equal(old.season, 1); assert.equal(old.playoffs.seeds.length, 2);
  assert.ok(old.members.every(member => member.club.players.every(p => p.fatigue === 0)));
  old = evening(old); assert.equal(old.season, 2); assert.equal(old.playoffHistory.length, 1);
});

test('serveur : demi-finales fractionnées, résultats cachés avant diffusion et règlement unique', () => {
  const before = structuredClone(group), table = leagueTable(group), firstSeed = group.playoffs.seeds[0];
  let state = advanceLeague(group, group.nextLockAt, { maxRounds: 1 });
  assert.equal(state.night.games.length, 2); assert.deepEqual(state.night.games.map(game => game.broadcast.rounds.length), [1, 0]);
  const projected = leagueProjection(state, firstSeed, state.night.games[0].playsAt);
  assert.equal(projected.playoffs.championId, null); assert.ok(projected.playoffs.rounds[0].matches.every(match => !match.winnerId));
  assert.equal('seed' in projected, false); assert.equal('config' in projected.games[0], false);
  assert.throws(() => editPreparation(state, firstSeed, 'cancel', {}, state.nextLockAt), /verrouillées/);
  state = advanceLeague(state, state.nextLockAt); const first = state.night.games[0];
  const partial = advanceLeague(state, first.endsAt); assert.equal(partial.history.length, 31);
  assert.equal(partial.playoffs.rounds[0].matches.filter(match => match.winnerId).length, 1);
  assert.equal(leagueProjection(partial, firstSeed, first.endsAt).upcoming.length, 2);
  const finished = advanceLeague(partial, state.night.endsAt);
  assert.equal(finished.phase, 'playoffs'); assert.equal(finished.day, 11); assert.equal(finished.season, 1);
  assert.equal(currentPlayoffRound(finished.playoffs).name, 'Finale'); assert.equal(fixturesFor(finished).length, 1);
  assert.deepEqual(leagueTable(finished), table); assert.deepEqual(advanceLeague(finished, state.night.endsAt), finished);
  assert.deepEqual(group, before);
});

test('finale : champion archivé, nouvelle saison, replays durables et aucune XP pour les non-qualifiés', () => {
  let state = evening(group); const outsider = group.members.find(member => !group.playoffs.seeds.includes(member.userId));
  assert.deepEqual(state.members.find(member => member.userId === outsider.userId).club.players.map(p => p.xp), outsider.club.players.map(p => p.xp));
  assert.ok(state.members.filter(member => group.playoffs.seeds.includes(member.userId)).some(member => member.club.players.some(p => p.fatigue > 0)));
  state = advanceLeague(state, state.nextLockAt); const final = state.night.games[0];
  assert.equal(state.night.games.length, 1); assert.equal(state.playoffs.championId, null);
  assert.equal(leagueProjection(state, 'u0', final.playsAt).playoffs.championId, null);
  state = advanceLeague(state, state.night.endsAt);
  assert.equal(state.season, 2); assert.equal(state.day, 0); assert.equal(state.phase, 'groups'); assert.equal(state.playoffs, null);
  assert.equal(state.history.length, 33); assert.equal(state.playoffHistory.length, 1);
  const archive = state.playoffHistory[0]; assert.ok(archive.bracket.championId); assert.equal(archive.season, 1);
  assert.ok(state.members.every(member => member.club.players.every(p => p.fatigue === 0)));
  assert.ok(leagueTable(state).every(row => row.played === 0));
  const projection = leagueProjection(state, 'u0', state.night.endsAt); assert.equal(projection.playoffHistory[0].bracket.championId, archive.bracket.championId);
  assert.deepEqual(state.members.find(member => member.userId === outsider.userId).club.players.map(p => p.xp), outsider.club.players.map(p => p.xp));
  const replay = replayProjection(state, 'u0', final.id, null, state.night.endsAt);
  assert.equal(replay.phase, 'playoffs'); assert.equal(replay.initial.rng, 0); assert.ok(replay.rounds.length);
  assert.deepEqual(advanceLeague(state, state.night.endsAt), state);
});
