import test from 'node:test';
import assert from 'node:assert/strict';
import { playerName, playerNameMatchesGender, normalisePlayerNames, PLAYER_NAME_POOL_SIZE } from './player-names.mjs';
import { createCareer, confirmDraft, launchCareerMatch } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';
import { PORTRAITS, playerGender } from './identity.mjs';
import { readFile } from 'node:fs/promises';
import { createLeague, joinLeague, startLeague, advanceLeague, leagueProjection } from './online/league.mjs';

test('noms : prénom "pseudo" nom, accords féminins, masculins et neutres dans 196608 combinaisons', () => {
  assert.equal(PLAYER_NAME_POOL_SIZE, 196608);
  assert.equal(playerNameMatchesGender('Nora "La Rusée" Voss', 'female'), true);
  assert.equal(playerNameMatchesGender('Nora "Le Rusé" Voss', 'female'), false);
  assert.equal(playerNameMatchesGender('Idris "Le Rusé" Voss', 'male'), true);
  assert.equal(playerNameMatchesGender('Nora "La Rusée" Voss', 'male'), false);
  assert.equal(playerNameMatchesGender('Camille "Écho" Voss', 'neutral'), true);
  assert.equal(playerNameMatchesGender('Camille "La Rusée" Voss', 'neutral'), false);
  const used = new Set();
  for (const gender of ['female', 'male', 'neutral']) for (let i = 0; i < 2048; i++) {
    const name = playerName(`player-${i}`, used, gender); assert.ok(!/\d/.test(name)); assert.ok(name.length <= 80); assert.ok(playerNameMatchesGender(name, gender)); assert.ok(!used.has(name)); used.add(name);
  }
  assert.equal(playerName('same'), playerName('same'));
  assert.notEqual(playerName('same', new Set([playerName('same')])), playerName('same'));
  const c = createCareer('Noms', 'names');
  const players = [...c.clubs.flatMap(club => club.players), ...c.market], names = players.map(p => p.name);
  assert.equal(new Set(names).size, names.length); assert.ok(names.every(name => !/\d/.test(name)));
  assert.ok(players.every(p => playerNameMatchesGender(p.name, playerGender(p))));
});

test('noms : tous les anciens formats sont normalisés sans changer identifiants, portraits ni progression', () => {
  let c = createCareer('Archives', 'old-names'); c = confirmDraft(c, c.market.slice(0, 6).map(p => p.id));
  c.clubs[0].players[5].name = 'Boussole 1'; c.market[0].name = 'Echo 2'; c.clubs[1].players[0].name = 'Le Frigo 3';
  c.clubs[0].players[0].name = 'Agent 47';
  const before = structuredClone(c), json = exportCareer(c), loaded = importCareer(json), again = importCareer(json);
  assert.deepEqual(loaded, again); assert.notEqual(loaded.clubs[0].players[0].name, 'Agent 47');
  for (const [a, b] of [[loaded.clubs[0].players[0], before.clubs[0].players[0]], [loaded.clubs[0].players[5], before.clubs[0].players[5]], [loaded.market[0], before.market[0]], [loaded.clubs[1].players[0], before.clubs[1].players[0]]]) {
    assert.ok(playerNameMatchesGender(a.name, playerGender(a))); assert.deepEqual({ ...a, name: b.name }, b);
  }
  assert.deepEqual(importCareer(exportCareer(loaded)), loaded);
});

test('portraits : les genres déclarés correspondent aux descriptions des images effectivement livrées', async () => {
  const generation = JSON.parse(await readFile(new URL('./assets/broadcast/generation.json', import.meta.url)));
  for (const portrait of PORTRAITS) {
    const revised = generation.revisions.flatMap(r => r.portraits).find(p => p.key === portrait.id);
    const description = revised?.prompt.split('Character: ')[1] ?? generation.portraits.find(p => p.id === portrait.id).description;
    const gender = /\bwoman\b/.test(description) ? 'female' : /\bman\b/.test(description) ? 'male' : 'neutral';
    assert.equal(portrait.gender, gender, portrait.id);
    const p = { id: portrait.id, portraitId: portrait.id, name: 'Ancien nom' }; normalisePlayerNames([p], 'portrait-test', playerGender);
    assert.ok(playerNameMatchesGender(p.name, gender));
  }
});

test('noms : une photo incompatible corrige le prénom et le pseudo ; noms corrects et doublons restent maîtrisés', () => {
  const a = { id: 'a', portraitId: 'p01', name: 'Idris "Le Rusé" Voss' };
  normalisePlayerNames([a], 'accord', playerGender); assert.ok(playerNameMatchesGender(a.name, 'female'));
  const first = a.name, b = { ...a, id: 'b' }; normalisePlayerNames([a, b], 'accord', playerGender);
  assert.equal(a.name, first); assert.notEqual(b.name, first);
  normalisePlayerNames([a, b], 'another-namespace', playerGender); assert.equal(a.name, first);
  a.portraitId = 'p02'; normalisePlayerNames([a], 'accord', playerGender); assert.ok(playerNameMatchesGender(a.name, 'male'));
  a.portraitId = 'p03'; normalisePlayerNames([a], 'accord', playerGender); assert.ok(playerNameMatchesGender(a.name, 'neutral'));
});

test('noms : importer une rencontre commencée normalise le club sans réécrire les joueurs du match', () => {
  let c = createCareer('Archives', 'frozen-names'); c = launchCareerMatch(confirmDraft(c, c.market.slice(0, 6).map(p => p.id)));
  c.clubs[0].players[0].name = c.current.config.rosters.home[0].name = c.current.state.players[0].name = 'Nora';
  const frozen = structuredClone(c.current), loaded = importCareer(exportCareer(c));
  assert.deepEqual(loaded.current, frozen); assert.notEqual(loaded.clubs[0].players[0].name, 'Nora');
  assert.ok(playerNameMatchesGender(loaded.clubs[0].players[0].name, playerGender(loaded.clubs[0].players[0])));
});

test('noms en ligne : clubs, offres renouvelées et projections accordés au portrait après la soirée', () => {
  const now = '2026-10-18T10:00:00Z';
  let s = createLeague({ id: 'names-league', userId: 'a', name: 'Ligue', clubName: 'A', seed: 'names-online', inviteCode: 'a'.repeat(32), capacity: 2 }, now);
  s = startLeague(joinLeague(s, 'b', { clubName: 'B' }, now), 'a', now); s = advanceLeague(s, s.nextLockAt); s = advanceLeague(s, s.night.endsAt);
  for (const member of s.members) {
    for (const p of [...member.club.players, ...member.club.market]) assert.ok(playerNameMatchesGender(p.name, playerGender(p)));
    assert.deepEqual(leagueProjection(s, member.userId, s.nextLockAt).club.players, member.club.players);
  }
});
