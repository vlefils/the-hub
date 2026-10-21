import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, joinLeague, addBot, startLeague, editPreparation, advanceLeague, leagueProjection, makeClub } from './league.mjs';
import { scheduledInstant, parisDateTime } from './schedule.mjs';
import { PROFILES } from '../data.mjs';
import { salary, compilePlayer } from '../progression.mjs';
import { createLeagueService } from './server.mjs';

const now = '2026-10-20T10:00:00Z', kickoff = '2026-10-20T19:15:00Z';
const lobby = () => createLeague({ id: 'l', userId: 'a', name: 'Ligue', clubName: 'Club A', seed: 'initial-recruitment', inviteCode: 'a'.repeat(32) }, now);
const confirm = (state, id, count = 6, time = now) => editPreparation(state, id, 'initialRecruit', { playerIds: state.members.find(m => m.userId === id).club.market.slice(0, count).map(p => p.id) }, time);

test('nouveau lobby : aucun effectif attribué et recrutement fermé avant le lancement', () => {
  const s = joinLeague(lobby(), 'b', { clubName: 'Club B' }, now);
  for (const m of s.members) { assert.equal(m.club.players.length, 0); assert.equal(m.club.balance, 2400); assert.equal(m.club.lineup.length, 0); }
  assert.throws(() => confirm(s, 'a'), /lancement/);
  assert.throws(() => editPreparation(s, 'a', 'buy', { itemId: 'vest' }, now), /lancement/);
});

test('le créateur choisit un horaire futur ; le lancement ouvre le recrutement et ferme les inscriptions', () => {
  const s = addBot(lobby(), 'a');
  assert.throws(() => startLeague(s, 'b', now, { firstMatchAt: kickoff }), /créateur/);
  for (const value of [undefined, 'invalide', '2026-10-19T10:00:00Z', '2026-10-20T21:15']) assert.throws(() => startLeague(s, 'a', now, { firstMatchAt: value }));
  const launched = startLeague(s, 'a', now, { firstMatchAt: kickoff });
  assert.equal(launched.status, 'recruitment'); assert.equal(launched.nextLockAt, '2026-10-20T19:15:00.000Z');
  assert.throws(() => joinLeague(launched, 'b', { clubName: 'Tard' }, now), /commencé/);
  const view = leagueProjection(launched, 'a', now); assert.equal(view.needsRecruitment, true); assert.equal(view.members.find(m => m.isBot).ready, true);
});

test('contrats initiaux : statistiques des candidats, sélection payée une fois et première composition choisie', () => {
  const s = startLeague(addBot(lobby(), 'a'), 'a', now, { firstMatchAt: kickoff }), before = structuredClone(s);
  const ids = s.members[0].club.market.slice(2, 8).map(p => p.id);
  for (const playerIds of [ids.slice(0, 4), [...ids, ids[0]], ['inconnu', ...ids.slice(0, 4)], s.members[0].club.market.slice(0, 9).map(p => p.id)]) assert.throws(() => editPreparation(s, 'a', 'initialRecruit', { playerIds }, now));
  assert.deepEqual(s, before);
  const ready = editPreparation(s, 'a', 'initialRecruit', { playerIds: ids }, now);
  assert.deepEqual(ready.members[0].club.lineup, ids.slice(0, 5)); assert.equal(ready.members[0].club.balance, 600);
  assert.equal(ready.status, 'preparation'); assert.equal(leagueProjection(ready, 'a', now).needsRecruitment, false);
  assert.throws(() => confirm(ready, 'a'), /déjà recruté/);
  assert.equal(advanceLeague(ready, '2026-10-20T19:14:59Z', { maxRounds: 0 }).night, null);
  assert.equal(advanceLeague(ready, kickoff, { maxRounds: 0 }).status, 'broadcast');
});

test('échéance : six recrues complémentaires pour le manager absent, effectif validé conservé', () => {
  let s = startLeague(joinLeague(lobby(), 'b', { clubName: 'Club B' }, now), 'a', now, { firstMatchAt: kickoff });
  s = confirm(s, 'a');
  const before = structuredClone(s), waiting = advanceLeague(s, '2026-10-20T19:14:59Z', { maxRounds: 0 });
  assert.deepEqual(waiting, s);
  const started = advanceLeague(s, kickoff, { maxRounds: 0 }), [ready, absent] = started.members;
  assert.deepEqual(s, before); assert.equal(started.status, 'broadcast'); assert.equal(started.night.startsAt, '2026-10-20T19:15:00.000Z');
  assert.deepEqual(ready.club.players, s.members[0].club.players); assert.equal(ready.autoRecruitedAt, undefined);
  assert.equal(absent.initialRecruitment, false); assert.equal(absent.club.players.length, 6); assert.equal(absent.club.lineup.length, 5);
  assert.equal(absent.autoRecruitedAt, '2026-10-20T19:15:00.000Z');
  assert.deepEqual(absent.club.players.map(p => PROFILES[p.profile].archetype), ['capitaine', 'belier', 'escamoteur', 'passeur', 'belier', 'escamoteur']);
  assert.equal(absent.club.balance, 600 + 210 - absent.club.players.reduce((sum, p) => sum + salary(p), 0));
  assert.ok(absent.club.players.every(p => ['maul', 'tonfa'].includes(compilePlayer(p, absent.club.inventory).weapon.id)));
  assert.deepEqual(advanceLeague(started, kickoff, { maxRounds: 0 }), started);
  assert.equal(leagueProjection(started, 'b', kickoff).autoRecruitedAt, absent.autoRecruitedAt);
});

test('retard du worker : le recrutement démarre une seule soirée à son passage, sans rattrapage de saisons', () => {
  const s = startLeague(joinLeague(lobby(), 'b', { clubName: 'Club B' }, now), 'a', now, { firstMatchAt: kickoff });
  const late = '2026-10-22T21:00:00Z', started = advanceLeague(s, late, { maxRounds: 0 });
  assert.equal(started.night.startsAt, '2026-10-22T21:00:00.000Z'); assert.equal(started.day, 0); assert.equal(started.season, 1);
  assert.ok(started.members.every(m => !m.initialRecruitment && m.club.players.length === 6));
  for (const command of ['initialRecruit', 'buy', 'cancel']) assert.throws(() => editPreparation(s, 'b', command, { playerIds: s.members[1].club.market.slice(0, 5).map(p => p.id) }, kickoff), /verrouillées/);
  assert.equal(leagueProjection(s, 'b', kickoff).locked, true);
});

test('worker concurrent : réessai CAS sans contrats ni salaires doublés et sans écraser une validation', async () => {
  let s = startLeague(joinLeague(lobby(), 'b', { clubName: 'Club B' }, now), 'a', now, { firstMatchAt: kickoff }), revision = 1, commits = 0;
  const store = { async get() { return { id: 'l', state: structuredClone(s), revision }; }, async commit(id, expected, next) {
    if (++commits === 1) { s = confirm(s, 'a', 5); revision++; throw Error('RB_CONFLICT'); }
    assert.equal(expected, revision); s = next; return ++revision;
  } };
  const service = createLeagueService(store, { now: () => kickoff });
  assert.deepEqual(await service.tick('l'), [{ id: 'l', ok: true }]);
  assert.equal(s.members[0].club.players.length, 5); assert.equal(s.members[0].autoRecruitedAt, undefined);
  assert.equal(s.members[1].club.players.length, 6);
  for (const member of s.members) {
    assert.equal(member.club.transactions.filter(t => t.id === 'wages-0').length, 1);
    assert.equal(member.club.transactions.filter(t => t.id === 'income-0').length, 1);
  }
});

test('ancien lobby : les contrats automatiques sont remis au choix du manager au lancement', () => {
  const s = lobby(); s.version = 1; delete s.members[0].initialRecruitment;
  s.members[0].club = makeClub('a', 'Club existant', 'old-club');
  const launched = startLeague(addBot(s, 'a'), 'a', now, { firstMatchAt: kickoff });
  assert.equal(launched.status, 'recruitment'); assert.equal(launched.members[0].club.players.length, 0); assert.equal(launched.members[0].club.balance, 2400);
  assert.equal(launched.members[0].club.name, 'Club existant'); assert.equal(s.members[0].club.players.length, 6);
});

test('ancienne saison déjà lancée : les joueurs et leur progression sont conservés', () => {
  let s = addBot(lobby(), 'a'); s.version = 1; delete s.members[0].initialRecruitment;
  s.members[0].club = makeClub('a', 'Club existant', 'old-club'); s.members[0].club.players[0].xp = 50;
  s.status = 'preparation'; s.capacity = 2; s.nextLockAt = kickoff;
  const started = advanceLeague(s, kickoff, { maxRounds: 0 });
  assert.equal(started.status, 'broadcast'); assert.equal(started.members[0].club.players[0].xp, 50); assert.equal(started.members[0].club.players.length, 6);
});

test('horaire parisien : été, hiver, changement d’heure et saisie invalide', () => {
  assert.equal(scheduledInstant('2026-10-20T21:15'), '2026-10-20T19:15:00.000Z');
  assert.equal(scheduledInstant('2026-12-20T21:15'), '2026-12-20T20:15:00.000Z');
  assert.equal(parisDateTime(kickoff), '2026-10-20T21:15');
  assert.throws(() => scheduledInstant('2027-03-28T02:30'), /n’existe pas/);
  assert.throws(() => scheduledInstant('2026-02-30T20:00'));
});
