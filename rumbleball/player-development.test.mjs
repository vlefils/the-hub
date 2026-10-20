import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES } from './data.mjs';
import { ABILITY_PRIORITIES, rollAbilities, effectiveAbilities, pendingAbilityLevels, applyAbilityIncrease, automaticAbilityIncreases, validPlayerDevelopment } from './player-development.mjs';
import { XP_THRESHOLDS, levelOf, proficiencyBonus, compilePlayer, progressPlayer, fatigueRecovery } from './progression.mjs';
import { createCareer, confirmDraft, recruit, improveAbilities, launchCareerMatch } from './career.mjs';
import { exportCareer, importCareer, validateCareer } from './career-storage.mjs';
import { createMatch, stepMatch } from './engine.mjs';

const player = (profile = 1, xp = 0) => ({ id: 'stats-test', name: 'Chrome', profile, xp, fatigue: 0, role: PROFILES[profile].role, instruction: 'normal', implant: null,
  abilities: { strength: 15, dexterity: 13, constitution: 14, mind: 8, charisma: 9 }, advancements: [] });
const club = () => { const c = createCareer('Les Chromés', 'stats-tests'); return confirmDraft(c, c.market.slice(0, 6).map(p => p.id)); };

test('tirages : 59 points, cinq scores de 8 à 15, priorités de classe et diversité stable', () => {
  const distinct = new Set();
  for (let i = 0; i < 2000; i++) for (const [profile, template] of PROFILES.entries()) {
    const scores = rollAbilities(`pool-${i}`, profile), values = ABILITY_PRIORITIES[template.archetype].map(key => scores[key]);
    assert.equal(values.reduce((sum, n) => sum + n), 59);
    assert.ok(values.every(n => Number.isInteger(n) && n >= 8 && n <= 15));
    assert.deepEqual(values, [...values].sort((a, b) => b - a));
    assert.deepEqual(scores, rollAbilities(`pool-${i}`, profile)); distinct.add(JSON.stringify(scores));
  }
  assert.ok(distinct.size > 100);
});

test('offres : caractéristiques conservées du recrutement initial à l’achat et à la sauvegarde', () => {
  const initial = createCareer('Les Chromés', 'stats-tests'), original = structuredClone(initial);
  let c = confirmDraft(initial, initial.market.slice(0, 5).map(p => p.id));
  assert.deepEqual(c.clubs[0].players[0].abilities, initial.market[0].abilities);
  const offer = structuredClone(c.market[0]); c = recruit(c, offer.id);
  assert.deepEqual(c.clubs[0].players.at(-1), offer);
  assert.deepEqual(importCareer(exportCareer(c)), c); assert.deepEqual(initial, original);
  assert.notDeepEqual(initial.market.map(p => p.abilities), createCareer('Les Chromés', 'other-seed').market.map(p => p.abilities));
});

test('progression du livre : douze niveaux, maîtrise aux niveaux 4/7/10 et améliorations 3/6/9/12', () => {
  assert.deepEqual(XP_THRESHOLDS, [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650, 770]);
  for (let level = 1; level <= 12; level++) {
    assert.equal(levelOf({ xp: XP_THRESHOLDS[level - 1] }), level);
    if (level > 1) assert.equal(levelOf({ xp: XP_THRESHOLDS[level - 1] - 1 }), level - 1);
    assert.equal(proficiencyBonus(level), level < 4 ? 2 : level < 7 ? 3 : level < 10 ? 4 : 5);
  }
  assert.equal(levelOf({ xp: 999999 }), 12);
  assert.deepEqual(pendingAbilityLevels(player(1, 770)), [3, 6, 9, 12]);
});

test('compilation : caractéristiques, maîtrise entraînée, PV de classe, CA et réserves', () => {
  const p = player(1, 90), compiled = compilePlayer(p);
  assert.equal(compiled.maxHp, 41); assert.equal(compiled.armor, 11);
  assert.deepEqual(compiled.attack, { bonus: 5, die: 6, count: 2, flat: 2 });
  assert.deepEqual(compiled.skills, { wrestling: 5, athletics: 5, acrobatics: 1 });
  assert.equal(compiled.chargeDC, 13); assert.equal(compiled.caps.adrenaline, 8);
  assert.equal(compiled.proficiencyBonus, 3); assert.equal(compiled.recovery, 5);
  const scores = { strength: 8, dexterity: 13, constitution: 9, mind: 14, charisma: 15 };
  const captain = compilePlayer({ ...player(0), abilities: scores });
  assert.equal(captain.maxHp, 7); assert.equal(captain.caps.calls, 4);
  assert.equal(captain.skills.wrestling, 1); assert.equal(captain.skills.athletics, -1);
  assert.equal(compilePlayer({ ...player(4), abilities: scores }).caps.focus, 4);
  const live = createMatch({ rosters: { home: Array(5).fill(compiled), away: Array(5).fill(captain) } });
  assert.equal(live.players[0].classState.adrenaline, 8); assert.equal(live.players[5].classState.calls, 4);
  assert.equal(live.players[0].chargeDC, 13); assert.equal(live.players[0].hp, 41);
});

test('protections : CA supplémentaire sans PV, coût de vitesse et absence de cumul', () => {
  const p = player(), base = compilePlayer(p);
  const light = compilePlayer(p, [{ playerId: p.id, itemId: 'vest' }]);
  const heavy = compilePlayer(p, [{ playerId: p.id, itemId: 'armor' }]);
  assert.equal(light.maxHp, base.maxHp); assert.equal(light.armor, base.armor + 1);
  assert.equal(heavy.maxHp, base.maxHp); assert.equal(heavy.armor, base.armor + 2); assert.equal(heavy.speed, base.speed - 1.5);
  assert.deepEqual(compilePlayer(p), base); assert.equal(p.abilities.constitution, 14);
});

test('constitution : récupération du banc, bornage de fatigue et PV rétroactifs après +2', () => {
  for (const [score, recovery] of [[8, 2], [10, 3], [14, 5], [20, 8]]) {
    const p = player(); p.abilities.constitution = score; p.fatigue = 6;
    assert.equal(fatigueRecovery(p), recovery); progressPlayer(p, false);
    assert.equal(p.fatigue, Math.max(0, 6 - recovery)); assert.equal(p.xp, 4);
  }
  const p = player(1, 50), before = compilePlayer(p); applyAbilityIncrease(p, { constitution: 2 });
  const after = compilePlayer(p); assert.equal(after.maxHp, before.maxHp + 3);
  assert.equal(after.recovery, before.recovery + 1); assert.equal(after.caps.adrenaline, before.caps.adrenaline + 1);
});

test('points : +2 ou deux +1, attribution unique par palier et plafond 20', () => {
  const p = player(1, 50); assert.throws(() => applyAbilityIncrease(player(), { strength: 2 }), /Aucune/);
  applyAbilityIncrease(p, { strength: 1, dexterity: 1 });
  assert.deepEqual(effectiveAbilities(p), { strength: 16, dexterity: 14, constitution: 14, mind: 8, charisma: 9 });
  assert.deepEqual(p.advancements, [{ level: 3, changes: { strength: 1, dexterity: 1 } }]);
  assert.throws(() => applyAbilityIncrease(p, { strength: 2 }), /Aucune/);
  p.xp = 770;
  applyAbilityIncrease(p, { strength: 2 }); applyAbilityIncrease(p, { strength: 2 });
  assert.equal(effectiveAbilities(p).strength, 20); assert.throws(() => applyAbilityIncrease(p, { strength: 1, mind: 1 }), /20/);
  applyAbilityIncrease(p, { mind: 2 }); assert.deepEqual(pendingAbilityLevels(p), []); assert.equal(validPlayerDevelopment(p), true);
  assert.equal(p.abilities.strength, 15); assert.equal(compilePlayer(p).attack.bonus, 10);
});

test('points : aucune charge mal formée ne consomme une amélioration', () => {
  const p = player(1, 50), original = structuredClone(p);
  for (const changes of [null, [], {}, { strength: 1 }, { strength: 3 }, { strength: -1, mind: 3 }, { strength: 1.5, mind: .5 }, { strength: '2' }, { hp: 2 }, { strength: 1, mind: 1, charisma: 0 }, { __proto__: null, constructor: 2 }]) {
    assert.throws(() => applyAbilityIncrease(p, changes)); assert.deepEqual(p, original);
  }
});

test('gestion : choix du propriétaire, copie immuable et verrouillage pendant le match', () => {
  let c = club(); c.clubs[0].players[0].xp = 50; const id = c.lineup[0], original = structuredClone(c);
  const improved = improveAbilities(c, id, { charisma: 2 });
  assert.deepEqual(c, original); assert.equal(improved.balance, c.balance); assert.deepEqual(improved.lineup, c.lineup);
  assert.equal(improved.clubs[0].players[0].advancements.length, 1);
  assert.throws(() => improveAbilities(c, c.clubs[1].players[0].id, { strength: 2 }), /inconnu/);
  assert.throws(() => improveAbilities(launchCareerMatch(c), id, { charisma: 2 }), /verrouillée/);
  assert.deepEqual(importCareer(exportCareer(improved)), improved);
});

test('IA : répartit tous les paliers par classe et conserve les choix déjà faits', () => {
  const p = player(1, 770); automaticAbilityIncreases(p);
  assert.deepEqual(p.advancements.map(g => g.level), [3, 6, 9, 12]);
  assert.equal(effectiveAbilities(p).strength, 20); assert.equal(effectiveAbilities(p).constitution, 17);
  assert.deepEqual(pendingAbilityLevels(p), []); assert.ok(validPlayerDevelopment(p));
  const original = structuredClone(p); automaticAbilityIncreases(p); assert.deepEqual(p, original);
  let c = club(); c.clubs[0].players[0].xp = c.clubs[1].players[0].xp = 770;
  c = importCareer(exportCareer(c));
  assert.equal(c.clubs[0].players[0].advancements.length, 0); assert.equal(c.clubs[1].players[0].advancements.length, 4);
});

test('sauvegarde : refuse scores falsifiés, gains précoces, doublons et dépassement du plafond', () => {
  const c = club();
  const invalid = [
    p => p.abilities.strength = 16, p => p.abilities.mind++, p => delete p.abilities.charisma,
    p => p.abilities.extra = 8, p => p.advancements = [{ level: 3, changes: { mind: 2 } }],
    p => { p.xp = 50; p.advancements = [{ level: 6, changes: { mind: 2 } }]; },
    p => { p.xp = 200; p.advancements = [{ level: 3, changes: { mind: 2 } }, { level: 3, changes: { mind: 2 } }]; },
    p => { p.xp = 770; p.abilities = player().abilities; p.advancements = [3, 6, 9].map(level => ({ level, changes: { strength: 2 } })); },
  ];
  for (const mutate of invalid) { const bad = structuredClone(c); mutate(bad.clubs[0].players[0]); assert.throws(() => validateCareer(bad), /invalide/); }
});

test('anciennes sauvegardes : tirage stable, choix humains en attente et rencontre figée inchangée', () => {
  let c = club(); c.clubs[0].players[5].xp = 50; c = launchCareerMatch(c);
  for (const side of ['home', 'away']) c.current.config.rosters[side] = c.current.config.rosters[side].map(p => {
    const base = structuredClone(PROFILES.find(q => q.archetype === p.archetype));
    return { ...base, name: p.name, playerId: p.playerId, level: 1, role: p.role, instruction: p.instruction, portraitId: p.portraitId };
  });
  c.current.state = createMatch(c.current.config);
  for (const p of [...c.clubs.flatMap(club => club.players), ...c.market]) { delete p.abilities; delete p.advancements; }
  const json = exportCareer(c), snapshot = structuredClone(c.current), restored = importCareer(json), again = importCareer(json);
  assert.deepEqual(restored.current, snapshot); assert.deepEqual(restored, again);
  assert.deepEqual(stepMatch(restored.current.state), stepMatch(snapshot.state));
  assert.equal(restored.clubs[0].players[5].advancements.length, 0); assert.deepEqual(pendingAbilityLevels(restored.clubs[0].players[5]), [3]);
  assert.deepEqual(importCareer(exportCareer(restored)), restored);
});
