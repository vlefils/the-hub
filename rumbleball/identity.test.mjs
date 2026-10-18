import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { PORTRAITS, CRESTS, gearImage } from './identity.mjs';
import { CATALOGUE, compilePlayer } from './progression.mjs';
import { playerLook } from './appearance.mjs';
import { createCareer, confirmDraft, setClubCrest, launchCareerMatch, buyItem, recruit } from './career.mjs';
import { importCareer, exportCareer } from './career-storage.mjs';
import { simulateMatch } from './engine.mjs';
import { createLeague, joinLeague, startLeague, editPreparation, leagueProjection, advanceLeague } from './online/league.mjs';
import { athletePortrait } from './visuals.mjs';
import { installTestDOM } from './test-support/dom.mjs';

const club = () => { const c = createCareer('Les Chromes', 'broadcast-identity'); return confirmDraft(c, c.market.slice(0, 6).map(p => p.id)); };
const cosmeticFree = value => Array.isArray(value) ? value.map(cosmeticFree) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !['portraitId', 'crestId', 'kitColor'].includes(key)).map(([key, item]) => [key, cosmeticFree(item)])) : value;

test('catalogue : 32 portraits, 16 emblèmes et huit équipements livrés avec leurs miniatures', async () => {
  assert.equal(PORTRAITS.length, 32); assert.equal(CRESTS.length, 16);
  assert.equal(new Set(PORTRAITS.map(p => p.id)).size, 32); assert.equal(new Set(CRESTS.map(p => p.id)).size, 16);
  assert.equal(new Set(PORTRAITS.map(p => p.skin)).size, 6);
  assert.equal(PORTRAITS.filter(p => p.category === 'cyberpunk').length, 16);
  assert.equal(PORTRAITS.filter(p => p.category === 'fun').length, 12);
  await Promise.all([...PORTRAITS.flatMap(p => [p.src, p.thumb]), ...CRESTS.map(c => c.src), ...Object.keys(CATALOGUE).map(gearImage)].map(src => access(new URL(src))));
  const prompts = JSON.parse(await readFile(new URL('./assets/broadcast/generation.json', import.meta.url), 'utf8'));
  assert.equal(prompts.prompts.length, 57); assert.equal(prompts.generator, 'image_gen built-in');
});

test('identités : visages distincts, conservés après contrat, recrutement, équipement et export', () => {
  let c = club(); const before = c.clubs[0].players.map(p => p.portraitId);
  assert.equal(new Set(before).size, 6);
  c = recruit(c, c.market[0].id); c = buyItem(c, 'vest', c.lineup[0]); c = setClubCrest(c, 'raven');
  const saved = importCareer(exportCareer(c)); assert.deepEqual(saved.clubs[0].players.slice(0, 6).map(p => p.portraitId), before); assert.equal(saved.clubs[0].crestId, 'raven');
  const launched = launchCareerMatch(saved);
  assert.equal(launched.current.state.teams[0].crestId, 'raven');
  for (const p of launched.current.state.players.filter(p => p.teamId === 'home')) {
    const original = saved.clubs[0].players.find(q => q.id === p.playerId); assert.equal(p.portraitId, original.portraitId); assert.deepEqual(playerLook(p), playerLook(original));
  }
  assert.throws(() => setClubCrest(launched, 'hound'), /verrouillée/); assert.throws(() => setClubCrest(c, 'external-url'), /inconnu/);
});

test('ancienne carrière : lecture sans mutation, attribution à la prochaine action et match commencé préservé', () => {
  const old = club(); for (const c of old.clubs) { delete c.crestId; for (const p of c.players) delete p.portraitId; } for (const p of old.market) delete p.portraitId;
  const loaded = importCareer(exportCareer(old)); assert.deepEqual(loaded, old);
  const changed = setClubCrest(loaded, 'hound'); assert.ok(changed.clubs[0].players.every(p => p.portraitId)); assert.equal(old.clubs[0].players[0].portraitId, undefined);
  const launched = launchCareerMatch(changed), frozen = structuredClone(launched.current);
  const copied = structuredClone(launched); delete copied.clubs[0].crestId; copied.clubs[0].players.forEach(p => delete p.portraitId);
  assert.deepEqual(importCareer(exportCareer(copied)).current, frozen);
});

test('cosmétique : portraits et blasons ne changent aucun événement, jet ou résultat', () => {
  const c = club(), roster = c.lineup.map(id => compilePlayer(c.clubs[0].players.find(p => p.id === id)));
  const original = { seed: 'broadcast-neutrality', rosters: { home: cosmeticFree(roster), away: cosmeticFree(roster) } };
  const decorated = { ...original, rosters: { home: roster, away: roster }, crestIds: { home: 'hound', away: 'raven' } };
  assert.deepEqual(cosmeticFree(simulateMatch(decorated)), cosmeticFree(simulateMatch(original)));
});

test('multi : blason préparé privé, annulable, puis figé à 20 h avec les visages', () => {
  const now = '2026-10-18T10:00:00Z';
  let s = createLeague({ id: 'l', userId: 'a', name: 'Ligue', clubName: 'A', crestId: 'hound', seed: 'cosmetic', inviteCode: 'a'.repeat(32), capacity: 2 }, now);
  s = startLeague(joinLeague(s, 'b', { clubName: 'B', crestId: 'raven' }, now), 'a', now);
  const p = leagueProjection(s, 'a', now), payload = { lineup: p.club.lineup, assignments: {}, strategy: p.club.strategy, deployment: p.club.deployment, opening: p.club.opening, crestId: 'helmet' };
  const prepared = editPreparation(s, 'a', 'configure', payload, now);
  assert.equal(leagueProjection(prepared, 'a', now).club.crestId, 'helmet');
  const visible = leagueProjection(prepared, 'b', now).members.find(m => m.userId === 'a'); assert.equal(visible.crestId, 'hound'); assert.equal('players' in visible, false); assert.equal('draft' in visible, false);
  assert.deepEqual(editPreparation(prepared, 'a', 'cancel', {}, now), s);
  assert.throws(() => editPreparation(s, 'a', 'configure', { ...payload, crestId: 'bad' }, now), /inconnu/);
  const frozen = advanceLeague(prepared, s.nextLockAt, { maxRounds: 1 }); assert.equal(frozen.night.games[0].broadcast.initial.teams[0].crestId, 'helmet');
  assert.ok(frozen.night.games[0].broadcast.initial.players.every(p => p.portraitId));
  assert.throws(() => editPreparation(frozen, 'a', 'configure', payload, s.nextLockAt), /verrouillées/);
});

test('portrait : une image manquante conserve le pion de secours et son nom accessible', async () => {
  installTestDOM(); const c = club(), p = compilePlayer(c.clubs[0].players[0]), portrait = athletePortrait(p, '#35bdb3');
  assert.equal(portrait.getAttribute('aria-label'), p.name); const image = portrait.querySelector('img'); assert.ok(image); await image.emit('error'); assert.equal(image.hidden, true); assert.ok(portrait.querySelector('.rb-player-portrait'));
});

test('compatibilité : identifiants cosmétiques inconnus rejetés dans les imports', () => {
  const a = club(); a.clubs[0].crestId = 'invalid'; assert.throws(() => exportCareer(a), /invalide/);
  const b = club(); b.clubs[0].players[0].portraitId = 'invalid'; assert.throws(() => exportCareer(b), /invalide/);
});

test('multi : les identités publiques ne dépendent jamais de la graine secrète des rencontres', () => {
  const options = { id: 'public-league-id', userId: 'public-user-id', name: 'Ligue', clubName: 'Chromes', inviteCode: 'a'.repeat(32) };
  const a = createLeague({ ...options, seed: 'private-one' }, '2026-10-18T10:00:00Z').members[0].club;
  const b = createLeague({ ...options, seed: 'private-two' }, '2026-10-18T10:00:00Z').members[0].club;
  assert.equal(a.crestId, b.crestId); assert.deepEqual(a.players.map(p => p.portraitId), b.players.map(p => p.portraitId)); assert.deepEqual(a.market.map(p => p.portraitId), b.market.map(p => p.portraitId));
});
