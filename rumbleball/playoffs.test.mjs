import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayoffs, playoffPlaces, playoffFixtures, settlePlayoffFixture, currentPlayoffRound, validPlayoffs } from './playoffs.mjs';
import { createCareer, confirmDraft, nextFixture, launchCareerMatch, saveCareerTurn, advanceCareerPlayoffs, nextSeason, careerSeasonFinished, standings, settleCareerMatch } from './career.mjs';
import { simulateMatch, stepMatch } from './engine.mjs';
import { exportCareer, importCareer, validateCareer } from './career-storage.mjs';
import { mountCareer } from './career-ui.mjs';
import { environment, button } from './test-support/dom.mjs';

const ranking = n => Array.from({ length: n }, (_, i) => `club-${i + 1}`);
function complete(c, winnerId = 'home') {
  c = launchCareerMatch(c); const simulation = simulateMatch(c.current.config); simulation.state.result.winnerId = winnerId;
  return saveCareerTurn(c, simulation.state, simulation.events);
}
let qualified, eliminated;
test.before(() => {
  for (const winner of ['home', 'away']) {
    let c = createCareer('Les Chromés', `playoffs-${winner}`); c = confirmDraft(c, c.market.slice(0, 6).map(p => p.id));
    for (let day = 0; day < 10; day++) c = complete(c, winner);
    if (winner === 'home') qualified = c; else eliminated = c;
  }
});

test('qualification : moitié arrondie au multiple de quatre supérieur, limitée au nombre de clubs', () => {
  for (const [clubs, places] of [[2, 2], [4, 4], [6, 4], [8, 4], [10, 8], [16, 8], [18, 12], [24, 12], [32, 16]]) assert.equal(playoffPlaces(clubs), places);
  const bracket = createPlayoffs(ranking(6), 'test');
  assert.deepEqual(playoffFixtures(bracket).map(m => [m.homeId, m.awayId]), [['club-1', 'club-4'], ['club-2', 'club-3']]);
  assert.deepEqual(bracket.seeds, ranking(4)); assert.equal(bracket.rounds[1].name, 'Finale');
});

test('arbre fixe : les vainqueurs des deux demi-finales se rencontrent, sans nouveau classement', () => {
  const bracket = createPlayoffs(ranking(6), 'test');
  settlePlayoffFixture(bracket, 'test-r1-m1', { winnerId: 'club-4', round: 10 });
  assert.equal(validPlayoffs(bracket, ranking(6), 'test'), true);
  settlePlayoffFixture(bracket, 'test-r1-m2', { winnerId: 'club-2', round: 11 });
  assert.deepEqual(playoffFixtures(bracket).map(m => [m.homeId, m.awayId]), [['club-4', 'club-2']]);
  settlePlayoffFixture(bracket, 'test-r2-m1', { winnerId: 'club-4', round: 10 });
  assert.equal(bracket.championId, 'club-4'); assert.equal(currentPlayoffRound(bracket), null);
  assert.equal(validPlayoffs(bracket, ranking(6), 'test'), true);
  assert.throws(() => settlePlayoffFixture(bracket, 'test-r2-m1', { winnerId: 'club-2', round: 10 }));
});

test('douze qualifiés : quatre exemptions pour les meilleures têtes de série et finale 1–2 possible', () => {
  const bracket = createPlayoffs(ranking(24), 'large'); assert.equal(bracket.size, 16);
  assert.deepEqual(bracket.rounds[0].matches.filter(m => m.decision === 'bye').map(m => m.winnerId).sort(), ['club-1', 'club-2', 'club-3', 'club-4']);
  let played = 0;
  while (!bracket.championId) for (const match of [...playoffFixtures(bracket)]) {
    const winnerId = [match.homeId, match.awayId].sort((a, b) => bracket.seeds.indexOf(a) - bracket.seeds.indexOf(b))[0];
    settlePlayoffFixture(bracket, match.id, { winnerId, round: 10 }); played++;
  }
  assert.equal(played, 11); assert.equal(bracket.championId, 'club-1');
  assert.deepEqual([bracket.rounds.at(-1).matches[0].homeId, bracket.rounds.at(-1).matches[0].awayId], ['club-1', 'club-2']);
  assert.equal(validPlayoffs(bracket, ranking(24), 'large'), true);
});

test('nul : meilleur classement qualifié, résultat du match conservé et tableau falsifié refusé', () => {
  const bracket = createPlayoffs(ranking(4), 'draw'); settlePlayoffFixture(bracket, 'draw-r1-m1', { winnerId: null, round: 13 });
  const match = bracket.rounds[0].matches[0]; assert.equal(match.winnerId, 'club-1'); assert.equal(match.result.winnerId, null); assert.equal(match.decision, 'ranking');
  for (const mutate of [b => b.seeds.reverse(), b => b.rounds[0].matches[0].winnerId = 'club-4', b => b.rounds[1].matches[0].result = { winnerId: 'club-1', round: 10 }, b => b.championId = 'club-1']) {
    const bad = structuredClone(bracket); mutate(bad); assert.equal(validPlayoffs(bad, ranking(4), 'draw'), false);
  }
  assert.throws(() => settlePlayoffFixture(bracket, 'draw-r1-m2', { winnerId: 'outsider', round: 10 }));
});

test('carrière : groupe figé, quatre qualifiés, fatigue retirée une fois et saison non terminée', () => {
  const c = structuredClone(qualified), before = structuredClone(c);
  assert.equal(c.day, 10); assert.equal(c.playoffs.seeds.length, 4); assert.equal(c.playoffs.seeds[0], 'club');
  assert.deepEqual(c.playoffs.seeds, c.table.slice(0, 4).map(row => row.clubId));
  assert.ok(c.clubs.every(club => club.players.every(p => p.fatigue === 0)));
  assert.equal(c.current.summary.fatigueReset, true); assert.equal(careerSeasonFinished(c), false);
  assert.throws(() => nextSeason(c), /playoffs/); assert.throws(() => advanceCareerPlayoffs(c), /Votre club/);
  const launched = launchCareerMatch(c); assert.equal(launched.current.state.players[0].fatigue, 0);
  const step = stepMatch(launched.current.state), saved = saveCareerTurn(launched, step.state, step.events);
  assert.deepEqual(importCareer(exportCareer(saved)), saved); assert.deepEqual(c, before);
});

test('carrière : demi-finales, finale, fatigue conservée entre les tours et champion archivé', () => {
  let c = structuredClone(qualified), table = structuredClone(c.table); const groupPrize = c.seasonHistory[0].prize;
  c = complete(c); assert.equal(currentPlayoffRound(c.playoffs).name, 'Finale'); assert.ok(nextFixture(c));
  assert.ok(c.clubs[0].players.some(p => p.fatigue > 0)); assert.deepEqual(c.table, table);
  assert.deepEqual(importCareer(exportCareer(c)), c); c = complete(c);
  assert.equal(c.playoffs.championId, 'club'); assert.equal(c.seasonHistory[0].championId, 'club'); assert.equal(c.seasonHistory[0].prize, groupPrize);
  assert.equal(c.transactions.filter(t => t.fixtureId === 'season-1').length, 1); assert.equal(careerSeasonFinished(c), true);
  assert.deepEqual(settleCareerMatch(c), c); assert.deepEqual(importCareer(exportCareer(c)), c);
  const next = nextSeason(c); assert.equal(next.season, 2); assert.equal(next.playoffs, null);
  assert.equal(next.seasonHistory[0].playoffs.championId, 'club'); assert.deepEqual(c.table, table); validateCareer(next);
});

test('carrière : élimination ou non-qualification permet de simuler les autres clubs sans payer ni gagner de l’XP', () => {
  for (let c of [complete(structuredClone(qualified), 'away'), structuredClone(eliminated)]) {
    const balance = c.balance, xp = c.clubs[0].players.map(p => p.xp), table = standings(c);
    assert.equal(nextFixture(c), null);
    while (!careerSeasonFinished(c)) c = advanceCareerPlayoffs(c);
    assert.equal(c.balance, balance); assert.deepEqual(c.clubs[0].players.map(p => p.xp), xp); assert.deepEqual(standings(c), table);
    assert.ok(c.playoffs.championId); assert.deepEqual(importCareer(exportCareer(c)), c);
    assert.throws(() => advanceCareerPlayoffs(c), /Aucun tour/); validateCareer(nextSeason(c));
  }
});

test('migration : ancienne fin de groupe, fatigue remise à zéro sans modifier le match ni repayer la prime', () => {
  const old = structuredClone(qualified); delete old.playoffs;
  for (const club of old.clubs) for (const p of club.players) p.fatigue = 6;
  const before = structuredClone(old.current), count = old.transactions.length, balance = old.balance;
  const migrated = importCareer(exportCareer(old));
  assert.ok(migrated.playoffs); assert.equal(migrated.transactions.length, count); assert.equal(migrated.balance, balance); assert.deepEqual(migrated.current, before);
  assert.ok(migrated.clubs.every(club => club.players.every(p => p.fatigue === 0)));
  assert.deepEqual(importCareer(exportCareer(migrated)), migrated);
  const bad = structuredClone(migrated); bad.playoffs.rounds[0].matches[0].winnerId = 'club'; assert.throws(() => validateCareer(bad), /invalide/);
});

test('UI : places qualificatives et légende sous le classement, arbre et continuation après élimination', async () => {
  const e = environment(exportCareer(eliminated)), { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  assert.ok(button(e.root, 'Simuler · Demi-finales')); assert.equal(button(e.root, 'Commencer la saison suivante'), undefined);
  await button(e.root, 'Ligue').click();
  assert.equal(e.root.querySelectorAll('.rb-playoff-qualifier').length, 4);
  const legend = e.root.querySelector('.rb-qualification-legend'); assert.equal(legend.textContent, 'Les 4 premières équipes se qualifient pour les playoffs.');
  const tree = e.root.querySelector('.rb-playoff-tree'); assert.equal(tree.children.length, 2); assert.equal(e.root.querySelectorAll('.rb-playoff-match').length, 3);
  await button(e.root, 'Club').click(); await button(e.root, 'Simuler · Demi-finales').click(); await button(e.root, 'Simuler · Finale').click();
  assert.ok(button(e.root, 'Commencer la saison suivante')); assert.match(e.root.textContent, /Champion de la saison/);
  await button(e.root, 'Commencer la saison suivante').click(); assert.equal(e.saved().season, 2);
});
