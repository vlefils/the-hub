import test from 'node:test';
import assert from 'node:assert/strict';
import { playerName, playerNameMatchesGender, playerNamingClass, normalisePlayerNames, PLAYER_NAME_POOL_SIZE, PLAYER_NICKNAMES } from './player-names.mjs';
import { createCareer, confirmDraft, launchCareerMatch } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';
import { PORTRAITS, playerGender } from './identity.mjs';
import { readFile } from 'node:fs/promises';
import { createLeague, joinLeague, startLeague, advanceLeague, leagueProjection } from './online/league.mjs';
import { ARCHETYPES } from './classes.mjs';

test('noms : prénom "pseudo" nom et accords par classe dans 393216 combinaisons cyberpunk', () => {
  assert.equal(PLAYER_NAME_POOL_SIZE, 393216);
  assert.equal(playerNameMatchesGender('Nora "Mainframe" Voss', 'female', 'capitaine'), true);
  assert.equal(playerNameMatchesGender('Nora "Mainframe" Voss', 'female', 'belier'), false);
  assert.equal(playerNameMatchesGender('Nora "La Broyeuse" Voss', 'female', 'belier'), true);
  assert.equal(playerNameMatchesGender('Nora "Le Broyeur" Voss', 'female', 'belier'), false);
  assert.equal(playerNameMatchesGender('Idris "Le Broyeur" Voss', 'male', 'belier'), true);
  assert.equal(playerNameMatchesGender('Nora "La Broyeuse" Voss', 'male', 'belier'), false);
  assert.equal(playerNameMatchesGender('Camille "Ghostwire" Voss', 'neutral', 'escamoteur'), true);
  assert.equal(playerNameMatchesGender('Camille "La Fugitive" Voss', 'neutral', 'escamoteur'), false);
  assert.equal(playerNameMatchesGender('Idris "Railshot" Voss', 'male', 'passeur'), true);
  const used = new Set();
  for (const archetype of Object.keys(ARCHETYPES)) for (const gender of ['female', 'male', 'neutral']) for (let i = 0; i < 1024; i++) {
    const name = playerName(`player-${i}`, used, gender, archetype); assert.ok(!/\d/.test(name)); assert.ok(name.length <= 80); assert.ok(playerNameMatchesGender(name, gender, archetype)); assert.ok(!used.has(name)); used.add(name);
  }
  assert.equal(playerName('same'), playerName('same'));
  assert.notEqual(playerName('same', new Set([playerName('same')])), playerName('same'));
  const c = createCareer('Noms', 'names');
  const players = [...c.clubs.flatMap(club => club.players), ...c.market], names = players.map(p => p.name);
  assert.equal(new Set(names).size, names.length); assert.ok(names.every(name => !/\d/.test(name)));
  assert.ok(players.every(p => playerNameMatchesGender(p.name, playerGender(p), playerNamingClass(p))));
});

test('pseudos : seize alias par classe et par genre, sans chevauchement entre classes', () => {
  assert.deepEqual(Object.keys(PLAYER_NICKNAMES).sort(), Object.keys(ARCHETYPES).sort());
  const owners = new Map();
  for (const [archetype, pool] of Object.entries(PLAYER_NICKNAMES)) for (const names of Object.values(pool)) {
    assert.equal(names.length, 16); assert.equal(new Set(names).size, 16);
    for (const name of names) { assert.ok(!owners.has(name) || owners.get(name) === archetype, name); owners.set(name, archetype); }
  }
});

test('pseudos : migration des anciens alias et changement de classe sans changer prénom, nom ou portrait', () => {
  const players = [
    { id: 'captain', profile: 0, portraitId: 'p01', name: 'Nora "La Rusée" Voss', xp: 50 },
    { id: 'brute', profile: 1, portraitId: 'p01', name: 'Léna "Mainframe" Knox', xp: 20 },
    { id: 'runner', profile: 2, portraitId: 'p02', name: 'Idris "Ghostwire" Falk', xp: 0 },
    { id: 'passer', profile: 4, portraitId: 'p03', name: 'Camille "Écho" Rive', xp: 90 },
  ];
  const before = structuredClone(players); normalisePlayerNames(players, 'class-aliases', playerGender);
  for (let i = 0; i < players.length; i++) {
    const p = players[i], original = before[i], parts = p.name.split('"'), old = original.name.split('"');
    assert.equal(parts[0], old[0]); assert.equal(parts[2], old[2]); assert.deepEqual({ ...p, name: original.name }, original);
    assert.ok(playerNameMatchesGender(p.name, playerGender(p), playerNamingClass(p)));
  }
  assert.equal(players[2].name, before[2].name);
  const stable = structuredClone(players); normalisePlayerNames(players, 'other-namespace', playerGender); assert.deepEqual(players, stable);
  players[0].role = 'carrier'; normalisePlayerNames(players, 'class-aliases', playerGender); assert.equal(players[0].name, stable[0].name);
  players[0].profile = 2; normalisePlayerNames(players, 'class-aliases', playerGender);
  assert.ok(playerNameMatchesGender(players[0].name, 'female', 'escamoteur')); assert.match(players[0].name, /^Nora ".+" Voss$/);
});

test('noms : tous les anciens formats sont normalisés sans changer identifiants, portraits ni progression', () => {
  let c = createCareer('Archives', 'old-names'); c = confirmDraft(c, c.market.slice(0, 6).map(p => p.id));
  c.clubs[0].players[5].name = 'Boussole 1'; c.market[0].name = 'Echo 2'; c.clubs[1].players[0].name = 'Le Frigo 3';
  c.clubs[0].players[0].name = 'Agent 47';
  const before = structuredClone(c), json = exportCareer(c), loaded = importCareer(json), again = importCareer(json);
  assert.deepEqual(loaded, again); assert.notEqual(loaded.clubs[0].players[0].name, 'Agent 47');
  for (const [a, b] of [[loaded.clubs[0].players[0], before.clubs[0].players[0]], [loaded.clubs[0].players[5], before.clubs[0].players[5]], [loaded.market[0], before.market[0]], [loaded.clubs[1].players[0], before.clubs[1].players[0]]]) {
    assert.ok(playerNameMatchesGender(a.name, playerGender(a), playerNamingClass(a))); assert.deepEqual({ ...a, name: b.name }, b);
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
    const p = { id: portrait.id, portraitId: portrait.id, profile: 0, name: 'Ancien nom' }; normalisePlayerNames([p], 'portrait-test', playerGender);
    assert.ok(playerNameMatchesGender(p.name, gender, 'capitaine'));
  }
});

test('noms : une photo incompatible corrige le prénom et le pseudo ; noms corrects et doublons restent maîtrisés', () => {
  const a = { id: 'a', profile: 0, portraitId: 'p01', name: 'Idris "Le Fixeur" Voss' };
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
  assert.ok(playerNameMatchesGender(loaded.clubs[0].players[0].name, playerGender(loaded.clubs[0].players[0]), playerNamingClass(loaded.clubs[0].players[0])));
});

test('noms en ligne : clubs, offres renouvelées et projections accordés au portrait après la soirée', () => {
  const now = '2026-10-18T10:00:00Z';
  let s = createLeague({ id: 'names-league', userId: 'a', name: 'Ligue', clubName: 'A', seed: 'names-online', inviteCode: 'a'.repeat(32), capacity: 2 }, now);
  s = startLeague(joinLeague(s, 'b', { clubName: 'B' }, now), 'a', now); s = advanceLeague(s, s.nextLockAt); s = advanceLeague(s, s.night.endsAt);
  for (const member of s.members) {
    for (const p of [...member.club.players, ...member.club.market]) assert.ok(playerNameMatchesGender(p.name, playerGender(p), playerNamingClass(p)));
    assert.deepEqual(leagueProjection(s, member.userId, s.nextLockAt).club.players, member.club.players);
  }
});
