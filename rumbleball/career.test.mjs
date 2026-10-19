import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES } from './data.mjs';
import { classCaps, classResources, initialClassState, classAbilities } from './classes.mjs';
import { createMatch, simulateMatch, stepMatch } from './engine.mjs';
import { assertInvariants } from './rules.mjs';
import { CATALOGUE, MAX_LEVEL, XP_THRESHOLDS, compilePlayer, levelOf, progressPlayer, salary, recruitmentPrice, fatigueRecovery } from './progression.mjs';
import { createCareer, confirmDraft, configureTeam, ownedPlayers, payroll, nextFixture, managementLocked, purchaseBlock, recruit, sellPlayer, buyItem, assignProtection, sellProtection, launchCareerMatch, settleCareerMatch, saveCareerTurn, nextSeason, standings, aiLineup, careerSeasonFinished, advanceCareerPlayoffs } from './career.mjs';
import { CAREER_KEY, validateCareer, persistCareer, loadCareer, importCareer, exportCareer } from './career-storage.mjs';
import { playerNameMatchesGender, playerNamingClass } from './player-names.mjs';
import { playerGender } from './identity.mjs';
import { pendingAbilityLevels } from './player-development.mjs';

const club = (count = 5, seed = 'test-career') => { const c = createCareer('Les Rebuts', seed); return confirmDraft(c, c.market.slice(0, count).map((p) => p.id)); };
function complete(input, forcedResult) {
  let c = launchCareerMatch(input);
  const simulation = simulateMatch(c.current.config);
  if (forcedResult !== undefined) simulation.state.result.winnerId = forcedResult;
  return saveCareerTurn(c, simulation.state, simulation.events);
}
const fakeStorage = () => { const map = new Map(); return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map }; };
function finishPlayoffs(c) {
  while (!careerSeasonFinished(c)) c = nextFixture(c) ? complete(c) : advanceCareerPlayoffs(c);
  return c;
}

test('création : douze profils fixes, trois par archétype, cinq Recrues, contrats groupés', () => {
  const c = createCareer('  Les Rebuts  ', 'draft'); const original = structuredClone(c);
  assert.equal(c.balance, 2400); assert.equal(c.market.length, 12); assert.equal(c.clubs[0].name, 'Les Rebuts');
  for (const type of ['belier', 'escamoteur', 'capitaine', 'passeur']) assert.equal(c.market.filter((p) => PROFILES[p.profile].archetype === type).length, 3);
  assert.ok(c.market.every(p => /^[^"\n]+ "[^"\n]+" [^"\n]+$/.test(p.name)));
  assert.throws(() => confirmDraft(c, c.market.slice(0, 4).map((p) => p.id)), /cinq/);
  assert.throws(() => confirmDraft(c, c.market.slice(0, 11).map((p) => p.id)), /dix/);
  assert.throws(() => confirmDraft(c, c.market.slice(0, 9).map((p) => p.id)), /manque/);
  assert.throws(() => confirmDraft(c, Array(5).fill(c.market[0].id)), /différents/);
  const next = confirmDraft(c, c.market.slice(0, 8).map((p) => p.id));
  assert.equal(next.balance, 0); assert.equal(next.transactions.length, 1); assert.equal(next.lineup.length, 5);
  assert.deepEqual(c, original); validateCareer(c); validateCareer(next);
});
test('calendrier : chaque paire se rencontre une fois dans chaque sens, six clubs par journée', () => {
  const c = club(), fixtures = c.schedule.flat(); assert.equal(c.schedule.length, 10); assert.equal(fixtures.length, 30);
  assert.equal(new Set(fixtures.map((f) => `${f.homeId}-${f.awayId}`)).size, 30);
  for (const day of c.schedule) assert.equal(new Set(day.flatMap((f) => [f.homeId, f.awayId])).size, 6);
  assert.deepEqual(c.schedule, club().schedule); assert.deepEqual(c.market, club().market);
  assert.equal(new Set(c.clubs.slice(1).map((c) => c.style)).size, 5); assert.ok(c.clubs.slice(1).every((c) => c.players.length === 7));
});
test('compilation : seuils, niveaux multiples, plafond, compétences et réserves propres aux archétypes', () => {
  const c = club(); const bases = structuredClone(PROFILES);
  for (const p of ownedPlayers(c)) {
    const base = compilePlayer(p); p.xp = 140; const max = compilePlayer(p);
    assert.equal(max.level, 5); assert.equal(max.maxHp, base.maxHp + 4 * ((max.archetype === 'belier' ? 7 : 5) + Math.floor((p.abilities.constitution - 10) / 2)));
    const skill = ['belier', 'capitaine'].includes(max.archetype) ? 'wrestling' : 'acrobatics'; assert.equal(max.skills[skill], base.skills[skill] + 1);
    assert.equal(max.speed, base.speed + (max.archetype === 'escamoteur' ? 3 : 0));
    assert.deepEqual(compilePlayer(p), max); p.xp = 1000; assert.equal(levelOf(p), MAX_LEVEL);
  }
  for (const [xp, level] of [[0, 1], [19, 1], [20, 2], [49, 2], [50, 3], [90, 4], [139, 4], [140, 5]]) assert.equal(levelOf({ xp }), level);
  assert.deepEqual(PROFILES, bases);
  assert.equal(classCaps({ archetype: 'belier', level: 5 }).adrenaline, 10);
  assert.equal(classCaps({ archetype: 'capitaine', level: 5 }).calls, 4);
  assert.equal(classCaps({ archetype: 'passeur', level: 5 }).focus, 4);
  assert.equal(classCaps({ archetype: 'escamoteur', level: 5 }).flaw, 1);
  assert.match(classResources({ archetype: 'belier', level: 5, classState: initialClassState('belier', 5) }), /10\/10/);
  assert.match(classAbilities({ archetype: 'capitaine', level: 5 })[1][1], /4 appels/);
});
test('fatigue : seuils exacts, KO, récupération et régulateur sans indisponibilité', () => {
  const p = ownedPlayers(club())[1], base = compilePlayer(p);
  for (const fatigue of [0, 2, 3, 4, 5, 6]) {
    p.fatigue = fatigue; const compiled = compilePlayer(p);
    assert.equal(compiled.speed, base.speed - (fatigue >= 3 ? 1.5 : 0));
    for (const key of ['wrestling', 'athletics', 'acrobatics']) assert.equal(compiled.skills[key], base.skills[key] - Number(fatigue >= 5));
  }
  p.fatigue = 0; progressPlayer(p, true, true); assert.equal(p.fatigue, 3); assert.equal(p.xp, 10);
  p.implant = 'regulator'; progressPlayer(p, true, true); assert.equal(p.fatigue, 5); progressPlayer(p, true, true); assert.equal(p.fatigue, 6);
  const recovery = fatigueRecovery(p);
  progressPlayer(p, false); assert.equal(p.fatigue, Math.max(0, 6 - recovery)); progressPlayer(p, false); assert.equal(p.fatigue, Math.max(0, 6 - 2 * recovery)); assert.equal(p.xp, 38);
});
test('finances : seuls les salaires créent une dette ; remboursement partiel et ventes en dette', () => {
  let c = club(8); c = launchCareerMatch(c); assert.equal(c.balance, -120); assert.equal(c.current.wages, 120);
  assert.equal(managementLocked(c), true); assert.throws(() => launchCareerMatch(c), /verrouillée/); assert.throws(() => recruit(c, c.market[0].id), /verrouillée/);
  let s = simulateMatch(c.current.config).state; s.result.winnerId = 'away'; c = saveCareerTurn(c, s, []);
  assert.equal(c.balance, 80); assert.equal(c.current.summary.debtRepaid, 120); assert.equal(c.current.summary.reward, 200);
  // Five high-level players and a larger bench can retain debt after the 200 loss prize.
  for (const p of ownedPlayers(c)) p.xp = 140;
  c.balance = 40; const launched = launchCareerMatch(c); assert.equal(launched.current.wages, 280); assert.equal(launched.balance, -240);
  s = simulateMatch(launched.current.config).state; s.result.winnerId = 'away'; c = saveCareerTurn(launched, s, []);
  assert.equal(c.balance, -40); assert.equal(c.current.summary.debtRepaid, 200); assert.match(purchaseBlock(c, 1), /impayés/);
  assert.throws(() => buyItem(c, 'vest'), /impayés/); assert.throws(() => recruit(c, c.market[0].id), /impayés|complet/);
  const sold = sellPlayer(c, ownedPlayers(c)[0].id); assert.equal(sold.balance, 410); assert.equal(ownedPlayers(sold).length, 7);
  const zero = club(8); assert.throws(() => buyItem(zero, 'vest'), /manque/); assert.equal(zero.balance, 0);
});
test('effectif : composition, consignes, rotation, limites et cession d’un titulaire', () => {
  let c = club(); assert.throws(() => sellPlayer(c, c.lineup[0]), /minimum/);
  c = recruit(c, c.market[0].id); const before = c.balance; const id = c.lineup[0]; c = sellPlayer(c, id);
  assert.equal(c.lineup.length, 5); assert.ok(!c.lineup.includes(id)); assert.equal(c.balance, before + 150);
  const reverse = [...c.lineup].reverse(), p = ownedPlayers(c)[0];
  c = configureTeam(c, reverse, { [p.id]: { role: 'blocker', instruction: 'aggressive' } }, 'pressing');
  assert.deepEqual(c.lineup, reverse); assert.equal(c.clubs[0].strategy, 'pressing'); assert.equal(ownedPlayers(c)[0].instruction, 'aggressive');
  assert.throws(() => configureTeam(c, Array(5).fill(reverse[0]), {}, 'balanced'), /distincts/);
  const ai = c.clubs[1], first = aiLineup(ai); for (const p of ai.players.filter((p) => first.includes(p.id))) p.fatigue = 2;
  assert.ok(aiLineup(ai).some((id) => !first.includes(id)));
});

test('effectif : recrutement jusqu’à dix, cinq remplaçants, sauvegarde et refus du onzième', () => {
  let c = club(5, 'ten-players');
  for (let day = 0; day < 6 && ownedPlayers(c).length < 10; day++) {
    while (ownedPlayers(c).length < 10 && c.market.length && c.balance >= recruitmentPrice(c.market[0])) c = recruit(c, c.market[0].id);
    if (ownedPlayers(c).length < 10) c = complete(c, 'home');
  }
  assert.equal(ownedPlayers(c).length, 10); assert.equal(c.lineup.length, 5);
  assert.equal(ownedPlayers(c).filter(p => !c.lineup.includes(p.id)).length, 5);
  assert.throws(() => recruit(c, c.market[0].id), /dix joueurs/);
  assert.deepEqual(importCareer(exportCareer(c)), c);
  const invalid = structuredClone(c); invalid.clubs[0].players.push({ ...c.market[0] });
  assert.throws(() => validateCareer(invalid), /invalide/);
});

test('clubs adverses : vingt journées de rotation, progression, contrats et équipement avec budgets persistants', { timeout: 120000 }, () => {
  let c = club(5, 'ai-management');
  // Legacy saves have seven players and no club economy yet.
  for (const ai of c.clubs.slice(1)) { delete ai.balance; delete ai.inventory; delete ai.transactions; }
  c = importCareer(exportCareer(c));
  for (let day = 0; day < 20; day++) {
    if (c.day === 10) c = nextSeason(finishPlayoffs(c));
    const before = structuredClone(c.clubs.slice(1)), launched = launchCareerMatch(c);
    const fixture = nextFixture(c), opponent = before.find(ai => ai.id === (fixture.homeId === 'club' ? fixture.awayId : fixture.homeId));
    assert.deepEqual(launched.current.config.rosters.away, aiLineup(opponent).map(id => compilePlayer(opponent.players.find(p => p.id === id), opponent.inventory)));
    const simulation = simulateMatch(launched.current.config); c = saveCareerTurn(launched, simulation.state, simulation.events); validateCareer(c);
    for (const ai of c.clubs.slice(1)) {
      const old = before.find(other => other.id === ai.id), played = aiLineup(old), wages = old.players.reduce((sum, p) => sum + salary(p), 0);
      for (const p of old.players) {
        const next = ai.players.find(q => q.id === p.id), starter = played.includes(p.id);
        assert.equal(next.xp, p.xp + (starter ? 10 : 4));
        assert.deepEqual(next.abilities, p.abilities); assert.equal(pendingAbilityLevels(next).length, 0);
        if (c.day === 10) assert.equal(next.fatigue, 0);
        else if (starter) assert.ok(next.fatigue >= Math.min(6, p.fatigue + (p.implant === 'regulator' ? 1 : 2)));
        else assert.equal(next.fatigue, Math.max(0, p.fatigue - fatigueRecovery(p)));
      }
      const today = ai.transactions.filter(t => t.fixtureId.startsWith(`s${c.season}-d${c.day}-`));
      assert.equal(today.filter(t => t.label === 'Salaires de la journée').length, 1);
      assert.equal(today.find(t => t.label === 'Salaires de la journée').amount, -wages);
      assert.equal(today.filter(t => t.label === 'Prime de match').length, 1);
      assert.ok(ai.players.length >= 7 && ai.players.length <= 10);
      assert.ok(ai.players.every(p => playerNameMatchesGender(p.name, playerGender(p), playerNamingClass(p))));
      if (!day) { assert.equal(ai.players.length, 8); assert.equal(ai.inventory.length, 1); assert.ok(aiLineup(ai).some(id => !played.includes(id))); }
    }
    assert.deepEqual(settleCareerMatch(c), c); assert.deepEqual(importCareer(exportCareer(c)), c);
  }
  assert.ok(c.clubs.slice(1).every(ai => ai.players.some(p => levelOf(p) >= 3) && ai.inventory.length > 0));
  assert.ok(c.clubs.slice(1).some(ai => ai.players.length === 10));
  const invalid = structuredClone(c); invalid.clubs[1].inventory[0].playerId = 'unknown';
  assert.throws(() => validateCareer(invalid), /invalide/);
});

test('clubs adverses : achètent implants et armes quand le budget préserve les salaires et contrats', () => {
  let c = club(5, 'ai-implant-budget'); const ai = c.clubs[1];
  ai.balance += 3000; ai.transactions.push({ id: 'test-grant', fixtureId: 'initial-budget', amount: 3000, label: 'Dotation de test', balance: ai.balance });
  for (let day = 0; day < 6; day++) c = complete(c);
  const managed = c.clubs[1]; assert.equal(managed.players.length, 10);
  assert.ok(managed.players.some(p => p.implant)); assert.ok(managed.transactions.some(t => /Régulateur|augmentées|contractiles|visuomotrice/.test(t.label)));
  assert.ok(managed.inventory.some(item => CATALOGUE[item.itemId].slot === 'weapon'));
  assert.ok(managed.balance >= managed.players.reduce((sum, p) => sum + salary(p), 0)); validateCareer(c);
});
test('équipement : pièces localisées, transfert, revente et destruction d’implant', () => {
  let c = club(); const [a, b] = ownedPlayers(c), base = compilePlayer(a);
  c = buyItem(c, 'vest', a.id); const gear = c.inventory[0].id;
  assert.equal(compilePlayer(ownedPlayers(c)[0], c.inventory).maxHp, base.maxHp);
  assert.equal(compilePlayer(ownedPlayers(c)[0], c.inventory).armor, base.armor + 1);
  c = buyItem(c, 'gloves', a.id); assert.equal(c.inventory.filter((i) => i.playerId === a.id).length, 2);
  assert.equal(compilePlayer(ownedPlayers(c)[0], c.inventory).maxHp, base.maxHp);
  assert.equal(compilePlayer(ownedPlayers(c)[0], c.inventory).armor, base.armor + 1);
  assert.equal(compilePlayer(ownedPlayers(c)[0], c.inventory).skills.wrestling, base.skills.wrestling + 1);
  c = assignProtection(c, gear, b.id); assert.equal(c.inventory.find((i) => i.id === gear).playerId, b.id);
  c = buyItem(c, 'legs', a.id); assert.equal(compilePlayer(ownedPlayers(c)[0], c.inventory).speed, base.speed + 1.5);
  assert.throws(() => buyItem(c, 'fibers', a.id), /détruit/);
  c = buyItem(c, 'fibers', a.id, true); assert.equal(ownedPlayers(c)[0].implant, 'fibers');
  assert.equal(compilePlayer(ownedPlayers(c)[0], c.inventory).speed, base.speed);
  const before = c.balance; c = sellProtection(c, gear); assert.equal(c.balance, before + 50);
  assert.deepEqual(compilePlayer(ownedPlayers(c)[0], c.inventory), compilePlayer(ownedPlayers(c)[0], c.inventory));
  assert.equal(CATALOGUE.maul.hands, 2); assert.equal(CATALOGUE.tonfa.light, true); validateCareer(c);
});
test('moteur : effectifs compilés, identifiants permanents, noms et stratégie adverse, ressources restaurées', () => {
  let c = club(); for (const p of ownedPlayers(c)) { p.xp = 140; p.fatigue = 6; } c = launchCareerMatch(c);
  const m = c.current.state; assert.equal(m.teams[0].name, 'Les Rebuts'); assert.equal(m.players[0].playerId, c.lineup[0]); assert.equal(m.players[0].id, 'home-0');
  assert.ok(m.players.every((p) => p.hp === p.maxHp)); assert.equal(m.players[1].classState.adrenaline, m.players[1].caps.adrenaline); assert.equal(m.players[0].classState.calls, m.players[0].caps.calls);
  assert.equal(m.teams[1].strategy, c.current.config.awayStrategy); assertInvariants(m);
  assert.equal(createMatch().teams[0].name, 'Les Recrues');
});
test('sauvegarde/reprise : état et marché identiques, un salaire et une prime, replay déterministe', () => {
  const storage = fakeStorage(); let c = launchCareerMatch(club()); const wages = c.balance, market = structuredClone(c.market);
  for (let i = 0; i < 5; i++) { const turn = stepMatch(c.current.state); c = saveCareerTurn(c, turn.state, turn.events); persistCareer(storage, c); }
  let restored = loadCareer(storage).career; assert.deepEqual(restored, c); assert.deepEqual(restored.market, market); assert.equal(restored.balance, wages);
  while (!restored.current.settled) { const turn = stepMatch(restored.current.state); restored = saveCareerTurn(restored, turn.state, turn.events); }
  const settled = settleCareerMatch(restored); assert.deepEqual(settled, restored); persistCareer(storage, settled); assert.deepEqual(loadCareer(storage).career, settled);
  assert.equal(settled.transactions.filter((t) => t.label === 'Salaires de la journée').length, 1); assert.equal(settled.transactions.filter((t) => t.label === 'Prime de match').length, 1);
  assert.deepEqual(simulateMatch(settled.current.config).state, settled.current.state);
  assert.equal(settled.market.length, 6); assert.equal(new Set(settled.market.map((p) => PROFILES[p.profile].archetype)).size, 4);
});
test('stockage : corruption, import refusé, stockage indisponible et dernière sauvegarde conservée', () => {
  const storage = fakeStorage(), c = club(); persistCareer(storage, c); const valid = storage.getItem(CAREER_KEY);
  const unavailable = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  assert.match(loadCareer(unavailable).error, /conservée/); assert.throws(() => persistCareer(unavailable, c), /Quota/);
  assert.equal(storage.getItem(CAREER_KEY), valid); assert.deepEqual(importCareer(exportCareer(c)), c);
  assert.throws(() => importCareer('{oops'), /JSON/); assert.throws(() => importCareer('{}'), /Format/);
  const broken = structuredClone(c); broken.lineup[0] = 'intrus'; assert.throws(() => persistCareer(storage, broken), /invalide/); assert.equal(storage.getItem(CAREER_KEY), valid);
  storage.setItem(CAREER_KEY, '{oops'); const loaded = loadCareer(storage); assert.equal(loaded.career, null); assert.equal(loaded.hasSave, true); assert.equal(storage.getItem(CAREER_KEY), '{oops');
  for (const mutate of [(s) => s.clubs[0].players[0].fatigue = 7, (s) => s.market[0].profile = 500, (s) => s.balance = null, (s) => s.schedule[0].pop(), (s) => s.inventory.push({ id: 'x', itemId: 'legs', playerId: null })]) { const bad = structuredClone(c); mutate(bad); assert.throws(() => importCareer(JSON.stringify({ format: 'the-hub-rumbleball', version: 1, career: bad }))); }
});
test('classement : points, victoires et ordre déterministe de saison', () => {
  const c = club(); const f = c.schedule[0][0]; f.result = { winnerId: f.homeId, round: 10 };
  const rows = standings(c); assert.equal(rows[0].clubId, f.homeId); assert.equal(rows[0].points, 3); assert.equal(rows[0].wins, 1);
  const ties = standings(club()); assert.deepEqual(ties.map((r) => r.clubId), c.tieOrder);
});
test('nul : prime de 275 et un point pour chaque club', () => {
  const c = club(), fixture = nextFixture(c), settled = complete(c, null);
  assert.equal(settled.current.summary.reward, 275);
  for (const id of [fixture.homeId, fixture.awayId]) {
    const row = standings(settled).find((r) => r.clubId === id); assert.equal(row.points, 1); assert.equal(row.draws, 1);
  }
});
test('saison coûteuse perdue : dette persistante, aucun intérêt et jeu toujours possible', { timeout: 120000 }, () => {
  let c = club(8, 'expensive-losses'), balance = 0; for (const p of ownedPlayers(c)) p.xp = 140;
  for (let day = 1; day <= 10; day++) {
    const wages = payroll(c); balance += 200 - wages;
    c = complete(c, 'away'); validateCareer(c);
    assert.equal(c.current.wages, wages);
    if (day < 10) assert.equal(c.balance, balance);
  }
  balance += 100;
  assert.equal(c.current.summary.seasonPrize, 100); assert.equal(c.balance, balance); assert.ok(balance < -700);
  c = nextSeason(finishPlayoffs(c)); assert.equal(c.balance, balance); assert.ok(ownedPlayers(c).every((p) => p.fatigue === 0));
  const wages = payroll(c), launched = launchCareerMatch(c); assert.equal(launched.balance, balance - wages); assert.match(purchaseBlock(launched, 1), /lecture seule/);
  const state = simulateMatch(launched.current.config).state; state.result.winnerId = 'away'; c = saveCareerTurn(launched, state, []);
  balance += 200 - wages;
  assert.equal(c.balance, balance); assert.equal(c.current.summary.available, 0);
  const sale = Math.floor(recruitmentPrice(ownedPlayers(c)[0]) / 2);
  c = sellPlayer(c, ownedPlayers(c)[0].id); assert.equal(c.balance, balance + sale); assert.match(purchaseBlock(c, 1), /impayés/);
  const secondSale = Math.floor(recruitmentPrice(ownedPlayers(c)[0]) / 2);
  c = sellPlayer(c, ownedPlayers(c)[0].id); assert.equal(c.balance, balance + sale + secondSale); validateCareer(c);
});
test('plusieurs saisons : journées complètes, cinq offres de niveau, XP/fatigue IA et conservation de la carrière', { timeout: 120000 }, () => {
  let c = club(7, 'long-season'); const ids = ownedPlayers(c).map((p) => p.id);
  for (let season = 1; season <= 3; season++) {
    for (let day = 0; day < 10; day++) {
      c = complete(c, season === 2 ? 'away' : undefined); validateCareer(c);
      assert.equal(c.day, day + 1); assert.equal(c.schedule.flat().filter((f) => f.result).length, 3 * (day + 1));
      assert.ok(c.market.every((p) => levelOf(p) === Math.min(MAX_LEVEL, 1 + Math.floor(c.completedDays / 5))));
    }
    assert.ok(c.clubs.slice(1).every((club) => club.players.filter(p => !p.id.includes('-recruit-')).every(p => p.xp > 0)));
    assert.equal(c.transactions.filter((t) => t.fixtureId === `season-${season}`).length, 1);
    assert.ok(c.table.every((r) => r.played === 10)); assert.equal(c.seasonHistory.length, season);
    c = finishPlayoffs(c);
    const balance = c.balance, xp = ownedPlayers(c).map((p) => p.xp); c = nextSeason(c);
    assert.equal(c.balance, balance); assert.deepEqual(ownedPlayers(c).map((p) => p.xp), xp); assert.deepEqual(ownedPlayers(c).map((p) => p.id), ids);
    assert.ok(c.clubs.every((club) => club.players.every((p) => p.fatigue === 0))); assert.equal(c.day, 0); validateCareer(c);
  }
});
