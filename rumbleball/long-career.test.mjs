import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, confirmDraft, recruit, launchCareerMatch, settleCareerMatch, saveCareerTurn, nextSeason, nextFixture, advanceCareerPlayoffs, careerSeasonFinished, configureTeam, aiLineup, buyItem } from './career.mjs';
import { createLongOpponents, applyInjury, longSeasonOutcome } from './long-career.mjs';
import { DIVISIONS, LONG_RULES, injuryChance, matchReward } from './career-rules.mjs';
import { validateCareer, exportCareer, importCareer } from './career-storage.mjs';
import { levelOf, compilePlayer, progressPlayer } from './progression.mjs';
import { CATALOGUE, equipmentAt, equipmentAvailable, equipmentTier } from './equipment.mjs';
import { createMatch, seedHash } from './engine.mjs';
import { check, randomInt, d20Probability, attackHitChance } from './rules.mjs';
import { passCompletionChance, stripSuccessChance } from './ai.mjs';
import { createPlayoffs, playoffFixtures, settlePlayoffFixture, validPlayoffs } from './playoffs.mjs';

const start = (seed = 'long-tests') => { const c = createCareer('Les Rebuts', seed, undefined, { mode: 'long' }); return confirmDraft(c, c.market.slice(0, 5).map(p => p.id)); };
const freeze = club => club.players.map(p => ({ id: p.id, name: p.name, portraitId: p.portraitId, xp: p.xp, abilities: p.abilities, advancements: p.advancements, implant: p.implant }));
function unavailable(club) { for (const p of club.players) p.injuryMatches = 4; }
function finishByForfeits(input, win = true) {
  let c = structuredClone(input);
  while (!careerSeasonFinished(c)) {
    for (const club of c.clubs.slice(1)) unavailable(club);
    if (!win && c.day < 10) {
      unavailable(c.clubs[0]); const fixture = nextFixture(c), opponent = c.clubs.find(club => club.id === (fixture.homeId === 'club' ? fixture.awayId : fixture.homeId));
      for (const p of opponent.players) p.injuryMatches = 0;
    }
    c = nextFixture(c) ? launchCareerMatch(c) : advanceCareerPlayoffs(c);
    validateCareer(c);
  }
  return c;
}

test('mode explicite, six divisions et bots fixes de dix joueurs entièrement équipés au sommet', () => {
  const classic = createCareer('Classique', 'same-seed'), long = start('same-seed');
  assert.equal(classic.mode, undefined); assert.equal(long.mode, 'long'); assert.equal(long.longCareer.division, 1);
  validateCareer(classic); validateCareer(long);
  for (const division of DIVISIONS) {
    const clubs = createLongOpponents('fixed-pyramid', division.level);
    assert.deepEqual(clubs, createLongOpponents('fixed-pyramid', division.level));
    assert.equal(clubs.length, 5);
    for (const club of clubs) {
      assert.equal(club.players.length, 10); assert.equal(club.balance, undefined);
      for (const p of club.players) {
        assert.ok(levelOf(p) >= division.botLevels[0] && levelOf(p) <= division.botLevels[1]);
        if (division.level === 6) {
          assert.equal(levelOf(p), 12); assert.equal(equipmentTier(CATALOGUE[p.implant]), 5);
          for (const slot of ['head', 'torso', 'gloves', 'feet', 'rightHand', 'leftHand']) assert.equal(equipmentTier(CATALOGUE[equipmentAt(p, club.inventory, slot)?.itemId]), 5);
        }
      }
    }
  }
});

test('saisons : finalistes promus, bots inchangés et recrues liées à la division, jamais aux journées', () => {
  let c = start('promotions'); const initial = createLongOpponents(c.seed, 1);
  for (let division = 1; division <= 6; division++) {
    assert.equal(c.longCareer.division, division);
    const before = c.clubs.slice(1).map(freeze), gear = c.clubs.slice(1).map(club => club.inventory);
    c = finishByForfeits(c);
    assert.equal(c.playoffs.championId, 'club');
    assert.deepEqual(c.clubs.slice(1).map(freeze), before); assert.deepEqual(c.clubs.slice(1).map(club => club.inventory), gear);
    assert.equal(c.current.summary.reward, DIVISIONS[division - 1].victory);
    c = nextSeason(c); validateCareer(c);
    const range = DIVISIONS[c.longCareer.division - 1].recruitLevels;
    assert.ok(c.market.every(p => levelOf(p) >= range[0] && levelOf(p) <= range[1]));
  }
  assert.equal(c.longCareer.division, 6);
  c.longCareer.division = 1; c.clubs = [c.clubs[0], ...createLongOpponents(c.seed, 1)];
  assert.deepEqual(c.clubs.slice(1), initial);
});

test('défaite en finale : le second finaliste monte aussi ; maintien, relégation et division plancher', () => {
  const c = start('second-finalist'); c.day = 10; c.table = c.clubs.map((club, i) => ({ clubId: club.id, name: club.name }));
  c.playoffs = createPlayoffs(c.table.map(r => r.clubId), 'outcome');
  for (const fixture of [...playoffFixtures(c.playoffs)]) settlePlayoffFixture(c.playoffs, fixture.id, { winnerId: fixture.homeId, round: 10 });
  const final = playoffFixtures(c.playoffs)[0]; settlePlayoffFixture(c.playoffs, final.id, { winnerId: final.awayId, round: 10 });
  assert.equal(longSeasonOutcome(c).nextDivision, 2);
  c.longCareer.division = 6; assert.equal(longSeasonOutcome(c).nextDivision, 6);
  let relegated = nextSeason(finishByForfeits(start('relegation'))); assert.equal(relegated.longCareer.division, 2);
  relegated = nextSeason(finishByForfeits(relegated, false)); assert.equal(relegated.longCareer.division, 1); validateCareer(relegated);
  assert.equal(relegated.seasonHistory.at(-1).movement, 'relegation');
  relegated = nextSeason(finishByForfeits(relegated, false)); assert.equal(relegated.longCareer.division, 1); validateCareer(relegated);
});

test('forfaits : indisponibilité temporaire, aucun replay ni XP, salaires et règlement idempotent', () => {
  let c = start('injury-forfeit'); unavailable(c.clubs[0]); for (const club of c.clubs.slice(1)) unavailable(club);
  const balance = c.balance, xp = c.clubs[0].players.map(p => p.xp);
  c = launchCareerMatch(c);
  assert.equal(c.current.kind, 'forfeit'); assert.equal(c.current.result.kind, 'double-forfeit'); assert.equal(c.current.state, undefined);
  assert.equal(c.current.summary.reward, 0); assert.equal(c.balance, balance - c.current.wages); assert.equal(c.day, 1);
  assert.deepEqual(c.clubs[0].players.map(p => p.xp), xp); assert.ok(c.clubs[0].players.every(p => p.injuryMatches === 3));
  assert.equal(c.table.find(r => r.clubId === 'club').points, 0); assert.equal(c.table.find(r => r.clubId === 'club').losses, 1);
  assert.deepEqual(settleCareerMatch(c), c); assert.deepEqual(importCareer(exportCareer(c)), c);
  for (let i = 0; i < 3; i++) { for (const club of c.clubs.slice(1)) unavailable(club); c = launchCareerMatch(c); }
  assert.ok(c.clubs[0].players.every(p => p.injuryMatches === 0)); validateCareer(c);
  assert.equal(aiLineup({ players: [{ id: 'hurt', injuryMatches: 1 }, { id: 'ok', injuryMatches: 0 }] }).includes('hurt'), false);
});

test('blessures sur KO : de 2 à 20 %, tirage stable, récupération différée et remplaçant automatique', () => {
  assert.equal(injuryChance(0), .02); assert.equal(injuryChance(10), .2);
  let c, p;
  for (let i = 0; i < 100; i++) {
    c = start(`injury-${i}`); p = c.clubs[0].players[0];
    if (applyInjury(c, structuredClone(p), nextFixture(c).id, 10)) break;
  }
  const duration = applyInjury(c, structuredClone(p), nextFixture(c).id, 10); assert.ok(duration >= 1 && duration <= 4);
  c.balance += 1000; c.transactions.push({ id: 'grant', amount: 1000, label: 'Dotation de test', balance: c.balance }); c = recruit(c, c.market[0].id);
  const reserveId = c.clubs[0].players.at(-1).id; p = c.clubs[0].players[0];
  p.fatigue = 10;
  // Avoid background matches: other clubs are unavailable, only this fixture is played.
  const fixture = nextFixture(c), opponentId = fixture.homeId === 'club' ? fixture.awayId : fixture.homeId;
  for (const club of c.clubs.slice(1)) if (club.id !== opponentId) unavailable(club);
  c = launchCareerMatch(c); const state = structuredClone(c.current.state);
  state.players.find(q => q.playerId === p.id).hp = 0; state.finished = true; state.result = { winnerId: 'home', round: 1, reason: 'possession', carrierId: null };
  const first = saveCareerTurn(c, state, []), second = saveCareerTurn(c, state, []);
  assert.deepEqual(first, second); validateCareer(first);
  assert.equal(first.clubs[0].players.find(q => q.id === p.id).injuryMatches, duration);
  assert.equal(first.current.summary.progress.find(q => q.playerId === p.id).newInjury, duration);
  assert.equal(first.current.config.careerRules, LONG_RULES);
  assert.ok(first.lineup.includes(reserveId)); assert.ok(!first.lineup.includes(p.id));
  assert.throws(() => configureTeam(first, [p.id, ...first.lineup.slice(1)], {}, first.clubs[0].strategy), /blessé/);
});

test('XP : titulaire avec rotation au maximum vers dix saisons, bots et blessés sans progression', () => {
  const p = structuredClone(start().clubs[0].players[0]); p.xp = 0;
  let appearances = 0;
  while (levelOf(p) < 12 && appearances < 200) { progressPlayer(p, appearances % 3 !== 2, false, { mode: 'long' }); appearances++; }
  assert.ok(appearances >= 110 && appearances <= 120, `Niveau maximal après ${appearances} matchs de calendrier`);
  const before = p.xp; p.injuryMatches = 2; progressPlayer(p, false, false, { mode: 'long' }); assert.equal(p.xp, before); assert.equal(p.injuryMatches, 1);
  p.injuryMatches = 0; progressPlayer(p, true, false, { mode: 'long', fixed: true }); assert.equal(p.xp, before);
  const legacy = structuredClone(p); progressPlayer(legacy, true); assert.equal(legacy.xp, before + 10); assert.equal(legacy.fatigue, 6);
});

test('fatigue : seuils, régulateurs, constitution et désavantage réservé au nouveau mode', () => {
  const p = start().clubs[0].players[0], base = compilePlayer({ ...p, fatigue: 0 });
  for (const fatigue of [0, 3, 5, 8, 10]) {
    const compiled = compilePlayer({ ...p, fatigue }, [], { mode: 'long' });
    assert.equal(compiled.speed, base.speed - (fatigue >= 3 ? 1.5 : 0));
    assert.equal(compiled.skills.wrestling, base.skills.wrestling - Number(fatigue >= 5));
    assert.equal(compiled.attack.bonus, base.attack.bonus - Number(fatigue >= 8));
  }
  const rested = { ...p, fatigue: 10, implant: 'regulator_singularite' }, recovery = compilePlayer(rested).recovery;
  progressPlayer(rested, false, false, { mode: 'long' }); assert.equal(rested.fatigue, Math.max(0, 10 - recovery));
  progressPlayer(rested, true, false, { mode: 'long' }); assert.equal(rested.fatigue, Math.min(10, 11 - recovery));
  const rosters = { home: Array(5).fill(compilePlayer({ ...p, fatigue: 10 }, [], { mode: 'long' })) };
  for (const careerRules of [undefined, LONG_RULES]) {
    const state = createMatch({ seed: 'fatigue-dice', rosters, ...(careerRules ? { careerRules } : {}) }), actor = state.players[0], events = [];
    check(state, 0, events, 'Test', { playerId: actor.id }); assert.equal(events[0].dice.length, careerRules ? 2 : 1);
    if (careerRules) {
      assert.equal(events[0].natural, Math.min(...events[0].dice));
      const helped = []; check(state, 0, helped, 'Aidé', { playerId: actor.id, advantage: true }); assert.equal(helped[0].dice.length, 1);
      const rng = { rng: seedHash('fatigue-dice') }, initiative = Math.min(randomInt(rng, 20) + 1, randomInt(rng, 20) + 1); assert.equal(actor.initiativeDie, initiative);
    }
    const probability = Array.from({ length: 20 }, (_, i) => d20Probability(state, actor, i + 1)).reduce((a, b) => a + b, 0); assert.ok(Math.abs(probability - 1) < 1e-12);
  }
});

test('nouveaux équipements : vingt variantes, aucune hausse de PV, achat réservé et catalogue disponible dès le départ', () => {
  let c = start('shop'); const p = c.clubs[0].players[0], base = compilePlayer(p);
  c.balance += 50000; c.transactions.push({ id: 'grant', amount: 50000, balance: c.balance, label: 'Dotation de test' });
  const items = Object.entries(CATALOGUE).filter(([, item]) => item.longOnly); assert.equal(items.length, 20);
  assert.ok(items.every(([id]) => equipmentAvailable(id, 'long') && !equipmentAvailable(id, 'classic')));
  for (const id of ['helmet_singularite', 'armor_singularite', 'gloves_singularite', 'boots_singularite', 'regulator_singularite', 'maul_singularite']) c = buyItem(c, id, p.id);
  const compiled = compilePlayer(c.clubs[0].players[0], c.inventory, c), training = compilePlayer(p, [{ id: 'training', itemId: 'maul', playerId: p.id }]); assert.equal(compiled.maxHp, base.maxHp); assert.equal(compiled.attack.count, 2); assert.equal(compiled.attack.die, 6); assert.equal(compiled.attack.bonus, training.attack.bonus + 4);
  assert.equal(compiled.recovery, base.recovery + 2); validateCareer(c); assert.deepEqual(importCareer(exportCareer(c)), c);
  const classic = createCareer('Classic', 'gated'); const active = confirmDraft(classic, classic.market.slice(0, 5).map(q => q.id));
  assert.throws(() => buyItem(active, 'maul_singularite', active.lineup[0]), /réservé/);
  const bad = structuredClone(active); bad.inventory.push({ id: 'illegal', itemId: 'maul_singularite', playerId: null }); assert.throws(() => validateCareer(bad));
});

test('estimations tactiques : fatigue de l’attaquant, du passeur et du défenseur, sans consommer de jets', () => {
  const c = start(), roster = c.clubs[0].players.map(p => compilePlayer(p, [], c));
  const state = createMatch({ seed: 'long-odds', careerRules: LONG_RULES, rosters: { home: roster, away: roster } });
  const [actor, receiver] = state.players, target = state.players[5];
  state.players.slice(5).forEach((p, i) => { p.position = { x: 11, y: i + 1 }; });
  actor.position = { x: 0, y: 0 }; receiver.position = { x: 2, y: 0 }; state.ball = { carrierId: actor.id, position: { ...actor.position } };
  const rng = state.rng, normalPass = passCompletionChance(state, actor, receiver), normalHit = attackHitChance(state, actor, target);
  actor.fatigue = 10; assert.ok(passCompletionChance(state, actor, receiver) < normalPass); assert.ok(attackHitChance(state, actor, target) < normalHit);
  const tiredStrip = stripSuccessChance(state, actor, target); target.fatigue = 10; assert.ok(stripSuccessChance(state, actor, target) > tiredStrip);
  state.aids.push({ allyId: actor.id, enemyId: target.id, kind: 'attack' }); assert.ok(Math.abs(attackHitChance(state, actor, target) - normalHit) < 1e-12);
  assert.equal(state.rng, rng);
});

test('validation : mode, blessures, fatigue, profil de match et forfaits classiques refusés', () => {
  for (const mutate of [c => c.longCareer.division = 7, c => c.clubs[0].players[0].injuryMatches = 5, c => c.clubs[0].players[0].fatigue = 11, c => c.mode = 'unknown']) {
    const c = start(); mutate(c); assert.throws(() => validateCareer(c));
  }
  const bracket = createPlayoffs(['a', 'b', 'c', 'd'], 'test'); const fixture = playoffFixtures(bracket)[0];
  assert.throws(() => settlePlayoffFixture(bracket, fixture.id, { winnerId: 'a', round: 0, kind: 'forfeit' }));
  settlePlayoffFixture(bracket, fixture.id, { winnerId: null, round: 0, kind: 'double-forfeit' }, { allowForfeit: true });
  assert.equal(bracket.rounds[0].matches[0].winnerId, 'a'); assert.ok(validPlayoffs(bracket, ['a', 'b', 'c', 'd'], 'test', { allowForfeit: true }));
  assert.equal(matchReward({ mode: 'long', longCareer: { division: 6 } }, 'home'), 2400);
});
